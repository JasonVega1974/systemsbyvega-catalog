/* ============================================================================
   POST /api/stripe-webhook — the provisioning point
   ----------------------------------------------------------------------------
   Stripe calls this. The browser never does.

     checkout.session.completed  -> claim the territory, create the operator
     charge.refunded             -> release the territory back to the pool

   ── WHY THE WEBHOOK AND NOT THE BROWSER ────────────────────────────────────
   EstateSaleBiz provisioned from the buyer's own browser after the redirect
   back from Stripe. That works right up until the buyer closes the tab, loses
   signal, or has an ad blocker in the way — at which point they have paid, no
   account exists, and the only record is inside Stripe. Provisioning here means
   the outcome does not depend on the buyer's browser surviving the round trip.

   ── STATUS CODES ARE PART OF THE DESIGN ────────────────────────────────────
   Stripe retries any non-2xx for about three days with backoff. That is a
   feature for transient problems and a liability for permanent ones, so the two
   are separated deliberately:

     400  bad or missing signature        never fixed by retrying
     500  database or network failure     RETRY — the next attempt may work
     200  permanent business conflict     do NOT retry; a human is needed and
          (city taken, already done,      the row recording that has already
           no intake behind the payment)  been written

   Returning 500 on a city conflict would retry a permanent failure hundreds of
   times and bury the one alert that matters under its own noise.

   ── THE ORDER, AND WHY MONEY COMES FIRST ───────────────────────────────────
   sbv_billing.client_id is nullable precisely so the payment can be recorded
   before a tenant exists. If provisioning then breaks at any later step, the
   money is still in our database rather than visible only inside Stripe. The
   billing row is never rolled back: the payment happened, and that stays true
   regardless of what failed afterwards.

   ── NO TRANSACTION SPANS THESE STEPS ───────────────────────────────────────
   PostgREST gives one statement per request, so a failure part-way through
   unwinds with explicit compensating deletes rather than a ROLLBACK. Each one
   is commented where it happens, because a delete in a payment path deserves
   to be justified at the point it runs.
   ========================================================================= */

import {
  json, pgSelectOne, pgInsert, pgUpdate, pgDelete, rpc,
  verifyStripeSignature, verifyStripeSession,
  sendBrevo, ownerAlert, escHtml,
  STRIPE_WEBHOOK_SECRET, SUPPORT_EMAIL, SITE_URL, APEX,
  SUPABASE_URL, SERVICE_KEY, RESERVED_SLUGS,
  VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID,
} from './_shared.mjs';

export const config = { runtime: 'nodejs' };

export default { fetch: handler };

async function handler(request) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  /* RAW BODY FIRST, before anything parses it. The signature is computed over
     the exact bytes Stripe sent; re-serialising a parsed object reorders keys
     and fails verification every single time. This is the whole reason these
     endpoints use the fetch handler shape instead of Vercel's (req, res). */
  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');

  const verdict = verifyStripeSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  if (!verdict.ok) {
    /* 400, not 500: a bad signature is never fixed by retrying. Logged loudly,
       because a sudden run of these means either the wrong signing secret is
       deployed or somebody is probing the endpoint. */
    console.error('WEBHOOK SIGNATURE REJECTED:', verdict.reason);
    return json({ ok: false, error: 'invalid_signature', reason: verdict.reason }, 400);
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return json({ ok: false, error: 'bad_json' }, 400); }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    /* 500 so Stripe retries — a deploy/config problem may be fixed inside the
       retry window, and a payment must not be lost to it. */
    console.error('webhook cannot reach Supabase: SUPABASE_URL/SERVICE_ROLE_KEY missing');
    return json({ ok: false, error: 'not_configured' }, 500);
  }

  console.log('webhook received:', event.type, event.id);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        return await provision(event.data.object);
      case 'charge.refunded':
        return await handleRefund(event.data.object);
      default:
        /* Acknowledged and ignored. 200 for unhandled types stops Stripe
           retrying events this endpoint was never meant to act on. */
        return json({ ok: true, ignored: event.type });
    }
  } catch (e) {
    /* Anything unexpected gets a 500 so the delivery is retried rather than
       silently dropped. An unhandled throw that returned 200 would lose a
       payment permanently. */
    console.error('webhook handler threw:', event.type, e && e.message, e && e.stack);
    return json({ ok: false, error: 'handler_error' }, 500);
  }
}

/* ============================================================================
   checkout.session.completed
   ========================================================================= */

async function provision(session) {
  const sessionId = session && session.id;
  if (!sessionId) return json({ ok: false, error: 'no_session_id' }, 400);

  const q = (v) => encodeURIComponent(String(v));

  /* ── 1. PER-STEP IDEMPOTENCY ───────────────────────────────────────────
     "Done" means BOTH halves: the money is recorded AND the operator can log
     in. Short-circuiting on the billing row alone strands a buyer permanently
     — paid, claimed, and with no mapping — the moment Stripe stops retrying. */
  const billing = await pgSelectOne('sbv_billing',
    'stripe_session_id=eq.' + q(sessionId) + '&select=id,client_id,user_id,status');

  let tenant = null;
  let mapped = null;
  if (billing && billing.client_id) {
    tenant = await pgSelectOne('sbv_tenants',
      'client_id=eq.' + q(billing.client_id) + '&select=client_id,is_active,niche_slug');
    if (billing.user_id) {
      mapped = await pgSelectOne('sbv_client_users',
        'user_id=eq.' + q(billing.user_id) +
        '&client_id=eq.' + q(billing.client_id) + '&select=user_id');
    }
  }
  if (billing && tenant && tenant.is_active && mapped) {
    console.log('already provisioned, nothing to do:', sessionId);
    return json({ ok: true, already: true });
  }
  if (billing) console.warn('resuming half-finished provisioning for', sessionId);

  /* ── 2. THE PARKED SUBMISSION ──────────────────────────────────────────
     Loaded before verification because the tier assertion needs it: the tier
     comes from a row the browser never wrote, not from the session. */
  const intakeId = session.client_reference_id
    || (session.metadata && session.metadata.intake_id) || null;

  let intake = null;
  if (intakeId) {
    intake = await pgSelectOne('sbv_intake', 'id=eq.' + q(intakeId) + '&select=*');
  }

  /* ── 3. RE-VERIFY AGAINST THE STRIPE API ───────────────────────────────
     The signature proved the payload came from Stripe. This proves the payment
     is currently good: paid, one-time, right currency, the Price this tier is
     supposed to sell, and NOT REFUNDED. The refund check matters even here — a
     delivery retried after a 500, or replayed from the dashboard, can arrive
     after the charge was refunded, and payment_status still reads 'paid'. */
  const check = await verifyStripeSession(sessionId, intake ? intake.tier : null);
  if (!check.ok) {
    /* A fetch failure is transient and deserves a retry. Everything else is a
       permanent decision about this session that retrying cannot change. */
    if (check.reason === 'session_fetch_failed' || check.reason === 'pi_fetch_failed') {
      console.error('webhook: Stripe unreachable during verification:', check.detail);
      return json({ ok: false, error: check.reason }, 500);
    }
    console.warn('webhook: session rejected:', sessionId, check.reason, check.detail || '');

    /* Money that arrived but does not match what we sold needs a person.
       A refund or an unpaid session does not — those are ordinary. */
    const needsHuman = ['tier_price_mismatch', 'amount_too_low', 'wrong_currency', 'unknown_tier'];
    if (needsHuman.includes(check.reason)) {
      await ownerAlert('Payment does not match what we sell', [
        'session:  ' + sessionId,
        'reason:   ' + check.reason,
        'detail:   ' + (check.detail || ''),
        'intake:   ' + (intakeId || '(none)'),
        '',
        'NEXT: open the session in Stripe, decide whether to refund or to',
        'provision by hand, then mark the intake row accordingly.',
      ]);
    }
    return json({ ok: true, rejected: check.reason });
  }

  const paidSession = check.session;
  const charge = check.charge;
  const userId = (intake && intake.user_id)
    || (session.metadata && session.metadata.user_id) || null;

  /* ── 4. RECORD THE MONEY ───────────────────────────────────────────────
     Before the tenant, before the claim, before anything else that can fail.
     Upserted on the session id so a retried delivery refreshes this row rather
     than colliding with one it wrote itself a moment ago. client_id is left
     null here and filled in at step 8, once a tenant exists to point at. */
  try {
    await pgInsert('sbv_billing', {
      stripe_session_id: sessionId,
      stripe_payment_intent: typeof paidSession.payment_intent === 'string'
        ? paidSession.payment_intent
        : (paidSession.payment_intent && paidSession.payment_intent.id) || null,
      user_id: userId,
      amount_cents: Number(paidSession.amount_total || 0),
      currency: (paidSession.currency || 'usd').toLowerCase(),
      tier: intake ? intake.tier : null,
      buyer_email: (intake && intake.operator_email)
        || paidSession.customer_email
        || (paidSession.customer_details && paidSession.customer_details.email)
        || null,
      status: 'paid',
      client_id: billing ? billing.client_id : null,
    }, { upsertOn: 'stripe_session_id' });
  } catch (e) {
    console.error('webhook: billing upsert failed:', e.message, e.body || '');
    return json({ ok: false, error: 'billing_failed' }, 500);   // retry
  }

  /* ── 5. NO INTAKE BEHIND THE PAYMENT ───────────────────────────────────
     Cannot happen through /api/create-checkout. If it does, somebody paid via
     a link created outside this flow: real money with no submission behind it,
     which needs a person and not a retry. The money is already recorded above,
     which is the point of doing that first. */
  if (!intake) {
    console.error('webhook: paid session with no intake row:', sessionId);
    await ownerAlert('Payment with no order behind it', [
      'session:  ' + sessionId,
      'amount:   $' + (Number(paidSession.amount_total || 0) / 100).toFixed(2),
      'email:    ' + (paidSession.customer_email || '(unknown)'),
      'intake:   ' + (intakeId || '(none supplied)'),
      '',
      'The payment IS recorded in sbv_billing. Nothing was provisioned.',
      '',
      'NEXT: find out what they meant to buy, then either provision by hand',
      'or refund. Do not re-send the Stripe event; it will land here again.',
    ]);
    return json({ ok: true, blocked: 'no_intake' });
  }

  /* ── 6. THE TENANT ROW ─────────────────────────────────────────────────
     is_active stays false until the very end: the storefront must never go
     live before the operator can reach it.

     The subdomain was checked free at checkout, but another buyer may have
     taken it in the meantime, so a collision is handled rather than assumed
     away. On a resumed run we reuse whatever the earlier attempt created. */
  let clientId = billing && billing.client_id ? billing.client_id : null;
  if (!clientId) {
    clientId = await freeClientId(intake.client_id);
    if (!clientId) {
      console.error('webhook: could not find a free subdomain for', intake.client_id);
      await ownerAlert('Could not assign a subdomain after payment', [
        'session:  ' + sessionId,
        'wanted:   ' + intake.client_id,
        'intake:   ' + intake.id,
        '',
        'NEXT: pick a subdomain by hand, create the tenant, claim the city,',
        'and map the user. The payment is recorded.',
      ]);
      return json({ ok: true, blocked: 'no_free_client_id' });
    }
  }

  if (!tenant) {
    try {
      await pgInsert('sbv_tenants', {
        client_id: clientId,
        niche_slug: intake.niche_slug,
        business_name: intake.business_name,
        operator_name: intake.operator_name,
        operator_email: intake.operator_email,
        operator_phone: intake.operator_phone,
        tier: intake.tier,
        is_active: false,
      }, { minimal: true });
    } catch (e) {
      /* 409 means it appeared between freeClientId() and here — a genuine race
         with another buyer, or our own retry. Re-read and carry on if it is
         ours; otherwise a fresh name will be chosen on the next delivery. */
      if (e.status === 409) {
        const existing = await pgSelectOne('sbv_tenants',
          'client_id=eq.' + q(clientId) + '&select=client_id,niche_slug');
        if (!existing || existing.niche_slug !== intake.niche_slug) {
          console.error('webhook: subdomain taken by someone else mid-flight:', clientId);
          return json({ ok: false, error: 'client_id_race' }, 500);  // retry, new name
        }
        console.warn('webhook: tenant already existed, resuming:', clientId);
      } else {
        console.error('webhook: tenant insert failed:', e.message, e.body || '');
        return json({ ok: false, error: 'tenant_insert_failed' }, 500);   // retry
      }
    }
  }

  /* ── 7. THE ATOMIC TERRITORY CLAIM ─────────────────────────────────────
     THIS is the exclusivity guarantee — the partial unique index behind
     sbv_claim_city(), not the availability check at checkout. Two buyers can
     both have passed that check; exactly one of them gets past this. */
  let claim;
  try {
    claim = await rpc('sbv_claim_city', {
      p_niche_slug: intake.niche_slug,
      p_city_label: intake.city_label,
      p_state_code: intake.state_code,
      p_client_id: clientId,
      p_stripe_session_id: sessionId,
    });
  } catch (e) {
    console.error('webhook: claim rpc failed:', e.message, e.body || '');
    return json({ ok: false, error: 'claim_failed' }, 500);   // retry
  }

  /* `mine` distinguishes "I already claimed this on an earlier delivery" from
     "somebody else owns it". Without that, a resumed run would read its own
     claim as a lost race and get the buyer refunded for nothing. */
  if (!claim || (claim.ok !== true && !(claim.reason === 'already_claimed' && claim.mine === true))) {
    const reason = (claim && claim.reason) || 'unknown';

    if (reason !== 'already_claimed') {
      /* incomplete / no_such_tenant_for_niche are our own ordering mistakes.
         Retry: the tenant insert above may simply not have landed yet. */
      console.error('webhook: claim rejected:', reason, JSON.stringify(claim));
      return json({ ok: false, error: 'claim_rejected', reason }, 500);
    }

    /* Lost the race, after payment. Undo the tenant so a loser leaves nothing
       behind, record what happened, and tell a human. */
    if (!tenant) {
      try { await pgDelete('sbv_tenants', 'client_id=eq.' + q(clientId)); }
      catch (e) { console.error('webhook: could not roll back tenant:', e.message); }
    }

    try {
      await pgInsert('sbv_blocked_purchases', {
        stripe_session_id: sessionId,
        user_id: userId,
        niche_slug: intake.niche_slug,
        client_id: clientId,
        requested_city: intake.city_label,
        requested_state: intake.state_code,
        holder_client_id: claim.holder || null,
        amount_cents: Number(paidSession.amount_total || 0),
        buyer_email: intake.operator_email,
        reason: 'already_claimed',
      }, { minimal: true, upsertOn: 'stripe_session_id' });
    } catch (e) {
      console.error('webhook: could not record blocked purchase:', e.message, e.body || '');
    }

    try {
      await pgUpdate('sbv_intake', 'id=eq.' + q(intake.id), { status: 'blocked' });
    } catch (e) { console.error('webhook: could not mark intake blocked:', e.message); }

    await ownerAlert('PAID BUT BLOCKED — city already claimed', [
      'session:  ' + sessionId,
      'buyer:    ' + intake.operator_email,
      'wanted:   ' + intake.city_label + ', ' + intake.state_code
                   + '  (' + intake.niche_slug + ')',
      'held by:  ' + (claim.holder || '(unknown)'),
      'amount:   $' + (Number(paidSession.amount_total || 0) / 100).toFixed(2),
      '',
      'NEXT: refund this payment, or offer them another city and provision by',
      'hand. Row is in sbv_blocked_purchases; mark it resolved when done.',
    ]);

    /* 200 on purpose. This is permanent — retrying it three hundred times over
       three days would bury the alert above, which is the only useful output. */
    return json({ ok: true, blocked: 'already_claimed' });
  }

  /* ── 8. POINT THE MONEY AT THE TENANT ──────────────────────────────────── */
  try {
    await pgUpdate('sbv_billing', 'stripe_session_id=eq.' + q(sessionId),
      { client_id: clientId });
  } catch (e) {
    console.error('webhook: could not attach billing to tenant:', e.message);
    return json({ ok: false, error: 'billing_link_failed' }, 500);   // retry
  }

  /* ── 9. THE MAPPING — without this the operator cannot log in ──────────── */
  if (!mapped && userId) {
    try {
      await pgInsert('sbv_client_users',
        { user_id: userId, client_id: clientId, role: 'operator' },
        { minimal: true });
    } catch (e) {
      if (e.status === 409) {
        console.warn('webhook: mapping already existed:', userId, clientId);
      } else {
        /* Roll BOTH back. The claim must go too — otherwise a retry hits this
           buyer's own city row and reads it as a conflict against itself,
           which looks exactly like a lost race and gets someone refunded for
           nothing. sbv_release_territory() is keyed on the session, so it
           releases precisely this purchase and no other. */
        console.error('webhook: mapping insert failed:', e.message, e.body || '');
        try { await rpc('sbv_release_territory', { p_stripe_session_id: sessionId }); }
        catch (e2) { console.error('webhook: could not release after mapping failure:', e2.message); }
        try { await pgDelete('sbv_tenants', 'client_id=eq.' + q(clientId)); }
        catch (e2) { console.error('webhook: could not roll back tenant:', e2.message); }
        return json({ ok: false, error: 'mapping_failed' }, 500);   // retry
      }
    }
  } else if (!userId) {
    /* Cannot normally happen — sbv_intake.user_id is NOT NULL — but if it ever
       does, STOP HERE rather than carrying on to step 10.
       The rule this file is built around is that a storefront never goes live
       before its operator can reach it. Activating a tenant nobody can sign in
       to would break exactly that rule, in the one case where it is least
       likely to be noticed. The territory is claimed and the money is recorded;
       what remains is a person's job. */
    console.error('webhook: no user_id anywhere for session', sessionId);
    await ownerAlert('Claimed, paid, but no operator login', [
      'session:  ' + sessionId,
      'tenant:   ' + clientId + '   (left INACTIVE on purpose)',
      'buyer:    ' + intake.operator_email,
      '',
      'The territory is claimed and the payment is recorded, but no auth user',
      'was attached, so nobody could sign in. The storefront has deliberately',
      'NOT been activated.',
      '',
      'NEXT: find or create their auth user, insert the sbv_client_users row,',
      'then set sbv_tenants.is_active = true.',
    ]);
    return json({ ok: true, blocked: 'no_operator_login' });
  }

  /* ── 9.5 SUBDOMAIN — before activation, and never fatal ────────────────────
     Ordered ahead of the is_active flip so the hostname is attached by the time
     the storefront is reachable, per D-5. It is not allowed to block: the money
     has moved and the city is claimed, so a Vercel failure leaves a live tenant
     plus an alert rather than an operator stuck mid-provision. */
  const domain = await assignSubdomain(clientId);
  if (!domain.ok) {
    console.error('webhook: subdomain not attached for', clientId, '—', domain.reason);
    await ownerAlert('Storefront domain not attached — ' + clientId, [
      'tenant:    ' + clientId + '   (activating anyway)',
      'host:      ' + clientId + '.' + APEX,
      'reason:    ' + domain.reason,
      '',
      'The sale is complete. The operator can sign in and edit their site;',
      'only the public hostname is missing, so their subdomain will not load.',
      '',
      'NEXT: add ' + clientId + '.' + APEX + ' to the Vercel project by hand,',
      '      or fix VERCEL_TOKEN / VERCEL_PROJECT_ID / VERCEL_TEAM_ID and',
      '      re-run this step for the tenant.',
    ]);
  } else {
    console.log('subdomain attached', domain.host, domain.note || '');
  }

  /* ── 10. GO LIVE — last, deliberately ──────────────────────────────────── */
  try {
    await pgUpdate('sbv_tenants', 'client_id=eq.' + q(clientId), { is_active: true });
  } catch (e) {
    console.error('webhook: could not activate tenant:', e.message);
    return json({ ok: false, error: 'activate_failed' }, 500);   // retry
  }

  try {
    await pgUpdate('sbv_intake', 'id=eq.' + q(intake.id), { status: 'paid' });
  } catch (e) { console.error('webhook: could not mark intake paid:', e.message); }

  /* ── 11. MAIL — best effort, never fails the request ───────────────────
     By the time these fire the money has moved and the database is correct.
     A Brevo outage must not become a 500 that makes Stripe retry work that is
     already done. */
  /* The catalog name, not the slug: "dj" and "bbq food truck" are what the
     slug degrades to, and this is the first line of the first email a buyer
     reads after paying. Best-effort — mail is not worth failing a provision
     over, so a miss falls back to the slug. */
  let nicheName = null;
  try {
    const n = await pgSelectOne('sbv_niches',
      'slug=eq.' + q(intake.niche_slug) + '&select=name');
    nicheName = n && n.name;
  } catch (e) {
    console.warn('could not read niche name for the welcome email:', e.message);
  }
  await sendWelcome(intake, clientId, nicheName);
  /* Subject carries category and territory so the inbox list alone says what
     sold, without opening anything. */
  await ownerAlert(
    'New operator — ' + intake.niche_slug + ', ' + intake.city_label + ' ' + intake.state_code, [
    'TERRITORY SOLD' + ' '.repeat(35) +
      '$' + (Number(paidSession.amount_total || 0) / 100).toFixed(2),
    '',
    'business   ' + intake.business_name,
    'operator   ' + intake.operator_email,
    'category   ' + intake.niche_slug,
    'territory  ' + intake.city_label + ', ' + intake.state_code,
    'tier       ' + intake.tier,
    'subdomain  ' + clientId + '.' + APEX,
    '',
    'stripe     ' + sessionId,
    'charge     ' + (charge && charge.id ? charge.id : '(unknown)'),
    'tenant     ' + clientId + '  (active)',
    '',
    'NEXT: build the ' + intake.niche_slug + ' template for ' + clientId + ', then point',
    '      the subdomain at it and send the "your site is live" email.',
  ]);

  console.log('provisioned', clientId, 'for', intake.operator_email);
  return json({ ok: true, client_id: clientId });
}

/* ============================================================================
   charge.refunded — put the territory back on the market
   ========================================================================= */

async function handleRefund(charge) {
  const piId = charge && charge.payment_intent;
  if (!piId) {
    console.warn('refund event with no payment_intent');
    return json({ ok: true, ignored: 'no_payment_intent' });
  }

  /* The charge does not carry the Checkout Session, so the billing row is what
     bridges the two — which is why the payment intent is stored on it at
     provisioning time. */
  const billing = await pgSelectOne('sbv_billing',
    'stripe_payment_intent=eq.' + encodeURIComponent(String(piId)) +
    '&select=stripe_session_id,client_id,buyer_email');

  if (!billing || !billing.stripe_session_id) {
    /* A refund for something this system never provisioned. Nothing to undo. */
    console.warn('refund for unknown payment intent:', piId);
    return json({ ok: true, ignored: 'unknown_payment' });
  }

  let released;
  try {
    released = await rpc('sbv_release_territory',
      { p_stripe_session_id: billing.stripe_session_id });
  } catch (e) {
    console.error('refund: release failed:', e.message, e.body || '');
    return json({ ok: false, error: 'release_failed' }, 500);   // retry
  }

  await ownerAlert('Refund processed — territory released', [
    'session:  ' + billing.stripe_session_id,
    'tenant:   ' + (billing.client_id || '(none)'),
    'buyer:    ' + (billing.buyer_email || '(unknown)'),
    'released: ' + JSON.stringify(released),
    '',
    'The storefront is deactivated and the city is back on the market.',
    '',
    'NEXT: nothing automatic. Take the site down if one was built.',
  ]);

  console.log('refund released', billing.stripe_session_id, JSON.stringify(released));
  return json({ ok: true, released });
}

/* ============================================================================
   helpers
   ========================================================================= */

/* Attach <client_id>.systemsbyvega.com to the Vercel project, so the operator's
   storefront resolves without anyone touching a dashboard.

   BEST EFFORT BY CONTRACT. The card has cleared and the territory is claimed by
   the time this runs, so every failure returns a reason string instead of
   throwing. The caller alerts and carries on; a Vercel outage must never leave
   a paid operator un-provisioned waiting on a Stripe retry that would redo work
   already done.

   A 409 is checked rather than assumed. Vercel answers domain_already_in_use
   both when the host is already on THIS project (a Stripe replay, or a wildcard
   that already covers it — both fine) and when it belongs to a DIFFERENT one
   (not fine, and the storefront will not resolve). The follow-up GET is what
   tells those two apart, and it costs one request on a path that runs once per
   sale. */
async function assignSubdomain(clientId) {
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    return { ok: false, reason: 'VERCEL_TOKEN / VERCEL_PROJECT_ID not set' };
  }

  const host = clientId + '.' + APEX;
  const project = encodeURIComponent(VERCEL_PROJECT_ID);
  /* teamId goes in the query string, not a header — that is how the REST API
     takes it. See the note on VERCEL_TEAM_ID in _shared.mjs. */
  const team = VERCEL_TEAM_ID ? '?teamId=' + encodeURIComponent(VERCEL_TEAM_ID) : '';
  const auth = { Authorization: 'Bearer ' + VERCEL_TOKEN, 'Content-Type': 'application/json' };

  try {
    const res = await fetch('https://api.vercel.com/v10/projects/' + project + '/domains' + team, {
      method: 'POST', headers: auth, body: JSON.stringify({ name: host }),
    });
    if (res.ok) return { ok: true, host };

    const body = await res.json().catch(() => ({}));
    const code = (body && body.error && body.error.code) || '';
    const message = (body && body.error && body.error.message) || ('HTTP ' + res.status);

    if (res.status === 409 || code === 'domain_already_in_use') {
      const check = await fetch(
        'https://api.vercel.com/v9/projects/' + project + '/domains/' + encodeURIComponent(host) + team,
        { headers: auth });
      if (check.ok) return { ok: true, host, note: 'already attached' };
      return { ok: false, reason: host + ' is attached to a different Vercel project' };
    }
    return { ok: false, reason: message };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

/* Find a free subdomain, starting from the one the buyer asked for. Tries a
   numeric suffix before giving up, so a late collision costs a slightly
   different address rather than a failed purchase. Returns null if everything
   tried is taken, which is a case for a person. */
async function freeClientId(desired) {
  const base = String(desired || '').slice(0, 36).replace(/-+$/, '');
  if (!base) return null;

  const candidates = [base];
  for (let n = 2; n <= 9; n++) candidates.push((base + '-' + n).slice(0, 40));

  for (const c of candidates) {
    if (RESERVED_SLUGS.has(c)) continue;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c)) continue;
    const taken = await pgSelectOne('sbv_tenants',
      'client_id=eq.' + encodeURIComponent(c) + '&select=client_id');
    if (!taken) return c;
  }
  return null;
}

/* The buyer's confirmation. States what was bought and what happens next, and
   nothing else — no earnings language, no projection, no promise of outcome,
   and no link to a dashboard that does not exist yet. */
/* Exported for tools/resend-welcome.mjs — the one-off used when a provision
   succeeded but Brevo rejected the send (as the IP allowlist did once). The
   webhook's idempotency gate returns before mail on a replayed event, so a
   Stripe resend can never redeliver this; a direct call is the only path. */
export function sendWelcome(intake, clientId, nicheName) {
  const city = intake.city_label + ', ' + intake.state_code;
  const niche = nicheName || (intake.niche_slug || '').replace(/-/g, ' ');
  const web = clientId + '.' + APEX;
  const who = intake.operator_name || intake.business_name;

  /* THREE BEATS, AND EVERY ONE OF THEM IS TRUE TODAY — the linked version the
     earlier draft's comment promised. Both destinations now return 200: step
     9.5 attaches the subdomain and middleware.js routes it, and /admin/ is a
     real page. "Example content until you customise it" is load-bearing copy —
     the site IS live but wears the niche demo until the first save, and a
     buyer told simply "your site is live" would report the demo as a bug. */
  const adminUrl = SITE_URL + '/admin/?tenant=' + encodeURIComponent(clientId);
  const lines = [
    'Hi ' + who + ',',
    '',
    'You now hold ' + niche + ' — ' + city + '. That category is yours in that',
    'city for as long as your account is active. Nobody else can claim it.',
    '',
    'WHAT HAPPENS NEXT',
    '',
    '1. Your site is live now:',
    '   https://' + web + '/',
    '   It opens with example content until you customise it.',
    '',
    '2. Make it yours. Sign in with the account you created at checkout',
    '   and edit your business details:',
    '   ' + adminUrl,
    '   Changes show on your site within a minute.',
    '',
    '3. Wrong city or business name? Just reply and we will fix it.',
    '',
    'Your payment receipt comes from Stripe separately.',
    '',
    'Questions? Just reply.',
    SUPPORT_EMAIL,
  ];

  /* Inline styles only: Gmail strips a <style> block and Outlook ignores web
     fonts. 600px is the widest that survives a phone without horizontal
     scroll. Palette from assets/sbv.css — amber-text #A94E06 rather than
     --amber, because #E8791B lands at 4.4:1 on white and fails AA at body
     size. */
  const P = { ink: '#161B22', soft: '#48515F', amber: '#A94E06',
              hair: '#DCE2EA', paper: '#F1F4F8' };
  const base = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const step = (n, title, body) =>
    '<tr><td style="padding:0 0 18px;vertical-align:top;width:26px;' + base +
      ';font-size:15px;font-weight:700;color:' + P.amber + '">' + n + '.</td>' +
    '<td style="padding:0 0 18px;' + base + ';font-size:15px;line-height:1.6;color:' + P.ink + '">' +
      '<strong>' + escHtml(title) + '</strong><br>' +
      '<span style="color:' + P.soft + '">' + body + '</span></td></tr>';

  const html =
  '<div style="' + base + ';max-width:600px;margin:0 auto;padding:8px 4px;color:' + P.ink + '">' +
    '<p style="font-size:15px;line-height:1.6;margin:0 0 18px">Hi ' + escHtml(who) + ',</p>' +
    '<p style="font-size:15px;line-height:1.6;margin:0 0 6px">You now hold ' +
      '<strong style="color:' + P.amber + '">' + escHtml(niche) + ' — ' + escHtml(city) + '</strong>.</p>' +
    '<p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:' + P.soft + '">' +
      'That category is yours in that city for as long as your account is active. ' +
      'Nobody else can claim it.</p>' +
    '<div style="background:' + P.paper + ';border:1px solid ' + P.hair +
      ';border-radius:8px;padding:20px 18px 4px;margin:0 0 24px">' +
      '<p style="margin:0 0 16px;' + base + ';font-size:11px;font-weight:700;' +
        'letter-spacing:.09em;text-transform:uppercase;color:' + P.soft + '">What happens next</p>' +
      '<table cellpadding="0" cellspacing="0" border="0" style="width:100%">' +
        step(1, 'Your site is live now.',
          '<a href="https://' + escHtml(web) + '/" style="color:' + P.amber +
          ';font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px">' +
          escHtml(web) + '</a> — it opens with example content until you customise it.') +
        step(2, 'Make it yours.',
          'Sign in with the account you created at checkout and ' +
          '<a href="' + adminUrl + '" style="color:' + P.amber + '">edit your business info</a>. ' +
          'Changes show on your site within a minute.') +
        step(3, 'Wrong city or business name?',
          'Just reply to this email and we will fix it.') +
      '</table>' +
    '</div>' +
    '<p style="font-size:14px;line-height:1.6;margin:0 0 18px;color:' + P.soft + '">' +
      'Your payment receipt comes from Stripe separately.</p>' +
    '<hr style="border:0;border-top:1px solid ' + P.hair + ';margin:22px 0 16px">' +
    '<p style="font-size:14px;line-height:1.6;margin:0;color:' + P.soft + '">Questions? Just reply.<br>' +
      '<a href="mailto:' + SUPPORT_EMAIL + '" style="color:' + P.amber + '">' + SUPPORT_EMAIL + '</a></p>' +
  '</div>';

  return sendBrevo({
    to: intake.operator_email,
    toName: who,
    subject: 'Your territory is claimed — ' + city,
    text: lines.join('\n'),
    html,
  });
}
