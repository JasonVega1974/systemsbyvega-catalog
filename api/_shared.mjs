/* ============================================================================
   api/_shared.mjs — everything the commerce endpoints have in common
   ----------------------------------------------------------------------------
   The leading underscore keeps Vercel from routing this as a URL. It is
   imported by create-checkout, stripe-webhook and verify-session.

   WHY .mjs AND NOT .js. The webhook must hash the EXACT bytes Stripe sent.
   Vercel's Node (req, res) runtime — which api/demand.js, api/digest.js and
   api/owner.js use — parses a JSON body before the handler sees it, and a
   re-serialised object has different bytes and fails every signature check.
   The Web-standard handler shape gives `await request.text()`, which is exact.
   .mjs opts these three files into ESM without a package.json, so the existing
   CommonJS endpoints keep working untouched and Vercel's build for a live site
   does not change.

   ZERO DEPENDENCIES, DELIBERATELY. This repo has no package.json and no
   node_modules, and api/demand.js and api/owner.js already talk to PostgREST
   with plain fetch. GarageSaleBiz uses @supabase/supabase-js; copying that
   would introduce a dependency tree to a repo that has never had one, to save
   a dozen lines of fetch. node:crypto is a built-in, not a dependency —
   api/owner.js already requires it.

   WHAT LIVES HERE AND WHAT DOES NOT. No business rules. Deciding whether a
   city is available, whether a niche is for sale, or whether a territory can
   be claimed all happen in the database, because those are the decisions that
   have to be right when two buyers arrive at once. This file is transport.
   ========================================================================= */

import crypto from 'node:crypto';

/* ---------------------------------------------------------------- identity */

/* Every sender, reply-to and alert address in the family. Never a personal
   address. Placeholders in form fields are input hints, not contact details,
   and are fine. */
export const SUPPORT_EMAIL = 'info@kingdom-creatives.com';
export const APEX = 'systemsbyvega.com';

export const SITE_URL =
  String(process.env.PUBLIC_SITE_URL || 'https://systemsbyvega.com')
    .trim().replace(/\/+$/, '');

/* ------------------------------------------------------------- supabase url */

/* supabase-js appends /rest/v1 to whatever it is handed, and so do the helpers
   below. A trailing slash, a pasted /rest/v1, or a dashboard URL all surface as
   PGRST125 — an error that reads like a malformed QUERY and is actually a
   malformed BASE URL, so the table name and filters are never even reached.
   Normalise, then refuse to run on something that is not a bare origin. */
function normaliseSupabaseUrl(raw) {
  const v = String(raw || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/i, '')
    .replace(/\/+$/, '');
  if (!v) return '';
  let u;
  try { u = new URL(v); } catch { return ''; }
  /* A bare origin has no path. Anything else is a dashboard link or a REST
     path and will produce PGRST125 later, far from the real cause. */
  if (u.pathname !== '/' && u.pathname !== '') return '';
  return u.origin;
}

export const SUPABASE_URL  = normaliseSupabaseUrl(process.env.SUPABASE_URL);
export const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
/* The anon key is what /auth/v1/user wants as its apikey. It is public by
   design — RLS is the boundary — but it still lives in an env var rather than
   a literal, because these endpoints are server-side and have no reason to
   hardcode it. */
export const ANON_KEY      = process.env.SUPABASE_PUBLISHABLE_KEY || '';

/* -------------------------------------------------------------- stripe env */

export const STRIPE_SECRET_KEY     = process.env.STRIPE_SECRET_KEY || '';
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

/* One Price per tier. The webhook does NOT trust an amount alone — it asserts
   the session's line item carries the Price id this tier is supposed to sell
   (see verifyStripeSession). That is immune to a price change in the Stripe
   dashboard, whereas a hardcoded cents figure silently starts rejecting every
   legitimate payment the moment someone edits the price. */
export const TIER_PRICE_ID = {
  launch: process.env.STRIPE_PRICE_ID_LAUNCH || '',
  custom: process.env.STRIPE_PRICE_ID_CUSTOM || '',
};
export const TIERS = Object.keys(TIER_PRICE_ID);

/* A sanity floor, not the real check. Set it BELOW the cheapest tier: each
   sibling in this family has a different price, and inheriting one of theirs
   puts the floor above list price and rejects every real payment as
   amount_too_low. $250 sits under the $299 launch tier. */
export const MIN_AMOUNT_CENTS = Number(process.env.STRIPE_MIN_AMOUNT_CENTS || '25000');

export const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

/* ------------------------------------------------------------------ vercel */

/* Attaching <client_id>.systemsbyvega.com to the project after a sale.
   Deliberately NOT checked in assertConfigured(): a missing token must degrade
   to "this operator needs a manual domain add", never to a failed provision on
   a payment that already cleared.

   VERCEL_TEAM_ID is required whenever the project sits under a team rather than
   a personal account. Omitting it makes the API answer 403 with a body shaped
   like a not-found, which reads as a wrong project id and sends you looking in
   the wrong place. */
export const VERCEL_TOKEN      = process.env.VERCEL_TOKEN || '';
export const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || '';
export const VERCEL_TEAM_ID    = process.env.VERCEL_TEAM_ID || '';

/* ---------------------------------------------------------- reserved slugs */

/* MUST STAY IN STEP WITH sbv_tenants_reserved_ck in sql/COMMERCE-2.sql's
   sibling COMMERCE.sql. The database constraint is the authority; this copy
   exists only so a buyer gets "pick another" in the form instead of a 500 from
   a constraint violation. If the two drift, the failure is a worse error
   message, never a bad row. */
export const RESERVED_SLUGS = new Set([
  'www','api','admin','app','mail','ftp','dashboard','staging','dev','test',
  'demo','sites','portfolio','showcase','niches','assets','legal','tools',
  'owner','docs','cdn','static','blog','help','support','status','account',
]);

/* ------------------------------------------------------------- acceptance  */

/* The exact text a buyer ticks. Stored on the intake row as a version plus a
   SHA-256 of the text, because a version string alone does not survive someone
   editing the document — the hash pins the bytes that were actually agreed.
   No income claim, no projection, no guarantee of outcome: this family makes
   no earnings representation anywhere, in any medium. */
export const CURRENT_ACCEPTANCE_VERSION = 'v1-2026-08-27';

/* ⚠ BUMP THE VERSION KEY WHENEVER YOU EDIT THE TEXT.
   The hash stored on sbv_intake.acceptance_hash is computed SERVER-SIDE from
   whatever string sits under the version the client sent, and the client sends
   only the version — never the text, never a hash. So editing the wording in
   place leaves buyers agreeing to what they read while the database records a
   hash of something else, with nothing to detect the difference.
   A new key is free. Editing an existing one silently rewrites history. */
export const ACCEPTANCE_TEXTS = {
  'v1-2026-08-27':
    'I am buying a website and a business kit for one city. Systems by Vega ' +
    'does not operate my business, set my prices, or promise any particular ' +
    'result. Territory exclusivity applies to this niche in this city only, ' +
    'for as long as my account is active. Licensing and insurance for the ' +
    'work I do are my responsibility to check and to hold.',
};

/* -------------------------------------------------------------- http bits  */

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

/* These endpoints are called by pages on this origin only. No wildcard CORS:
   there is no third party that needs to POST a checkout, and a permissive
   header on an endpoint that spends money is a standing invitation. */
export function preflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': SITE_URL,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  });
}

/* --------------------------------------------------------------- postgrest */

/* Thrown by every helper below on an HTTP or network failure. Carries the
   status so a caller can tell a transient database problem (retry, 500) from a
   permanent one, which is the whole basis of the webhook's status-code
   discipline. */
export class PgError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'PgError';
    this.status = status;
    this.body = body;
  }
}

export function assertConfigured() {
  if (!SUPABASE_URL) {
    throw new PgError(
      'SUPABASE_URL is missing or is not a bare API origin ' +
      '(https://<ref>.supabase.co). A dashboard URL or a pasted /rest/v1 path ' +
      'surfaces later as PGRST125, which reads like a bad query.', 0, null);
  }
  if (!SERVICE_KEY) throw new PgError('SUPABASE_SERVICE_ROLE_KEY is missing', 0, null);
}

function serviceHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/* Build every PostgREST URL by concatenation on one line. A template literal
   split across lines injects a literal newline into the query string, and the
   resulting error names the filter rather than the formatting. */
function restUrl(path) {
  return SUPABASE_URL + '/rest/v1/' + path;
}

async function pgFetch(url, init, what) {
  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    /* Network-level. Always transient as far as we can tell from here. */
    throw new PgError(what + ': ' + e.message, 0, null);
  }
  const text = await res.text();
  if (!res.ok) throw new PgError(what + ' failed (' + res.status + ')', res.status, text);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

/** SELECT. `query` is a raw PostgREST query string, e.g. "id=eq.1&select=*". */
export async function pgSelect(table, query) {
  assertConfigured();
  return pgFetch(restUrl(table) + '?' + query, { headers: serviceHeaders() },
    'select ' + table);
}

/** SELECT expecting at most one row. Returns the row or null. */
export async function pgSelectOne(table, query) {
  const rows = await pgSelect(table, query + '&limit=1');
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

/** INSERT. Returns the inserted row(s) unless `minimal`. */
export async function pgInsert(table, row, { minimal = false, upsertOn = null } = {}) {
  assertConfigured();
  const prefer = [minimal ? 'return=minimal' : 'return=representation'];
  /* Upsert is how a retried webhook delivery refreshes a row instead of
     failing on a unique key it wrote itself a moment ago. */
  if (upsertOn) prefer.push('resolution=merge-duplicates');
  const headers = serviceHeaders({ Prefer: prefer.join(',') });
  const url = restUrl(table) + (upsertOn ? '?on_conflict=' + encodeURIComponent(upsertOn) : '');
  return pgFetch(url, { method: 'POST', headers, body: JSON.stringify(row) },
    'insert ' + table);
}

/** UPDATE. `query` selects the rows; PostgREST refuses an unfiltered update. */
export async function pgUpdate(table, query, patch) {
  assertConfigured();
  return pgFetch(restUrl(table) + '?' + query,
    { method: 'PATCH', headers: serviceHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(patch) },
    'update ' + table);
}

/** DELETE. Used only for the webhook's compensating rollbacks. */
export async function pgDelete(table, query) {
  assertConfigured();
  return pgFetch(restUrl(table) + '?' + query,
    { method: 'DELETE', headers: serviceHeaders({ Prefer: 'return=minimal' }) },
    'delete ' + table);
}

/** Call a database function. Named args, exactly as the SQL declares them. */
export async function rpc(fn, args) {
  assertConfigured();
  return pgFetch(restUrl('rpc/' + fn),
    { method: 'POST', headers: serviceHeaders(), body: JSON.stringify(args || {}) },
    'rpc ' + fn);
}

/* -------------------------------------------------------------------- auth */

/* Who is calling? Verified against Supabase rather than decoded locally: a JWT
   this process does not verify the signature of is just a string the caller
   chose. No SDK needed — /auth/v1/user does exactly this.

   Returns { user } or { error }. Never throws, so a caller can turn a bad
   token into a 401 without a try/catch. */
export async function userFromRequest(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { error: 'no_token' };
  if (!SUPABASE_URL || !ANON_KEY) return { error: 'not_configured' };

  let res;
  try {
    res = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + token },
    });
  } catch (e) {
    return { error: 'auth_unreachable: ' + e.message };
  }
  if (!res.ok) return { error: 'invalid_token' };

  const user = await res.json().catch(() => null);
  if (!user || !user.id) return { error: 'invalid_token' };
  return { user };
}

/* ------------------------------------------------------------------ stripe */

/* Stripe's API is form-encoded, including nested structures:
   line_items[0][price]=…  and  expand[]=…  . Encoding this by hand is why
   there is no Stripe SDK here: one small function against a stable wire format
   beats a dependency whose version has to be kept in step with an API version. */
export function stripeForm(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? prefix + '[' + k + ']' : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') stripeForm(item, key + '[' + i + ']', out);
        else out.append(key + '[' + i + ']', String(item));
      });
    } else if (typeof v === 'object') {
      stripeForm(v, key, out);
    } else {
      out.append(key, String(v));
    }
  }
  return out;
}

export class StripeError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'StripeError';
    this.status = status;
    this.stripeCode = code;
  }
}

async function stripeCall(method, path, body) {
  if (!STRIPE_SECRET_KEY) throw new StripeError('STRIPE_SECRET_KEY is missing', 0, null);
  const init = {
    method,
    headers: {
      Authorization: 'Bearer ' + STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };
  if (body) init.body = stripeForm(body).toString();

  let res;
  try {
    res = await fetch('https://api.stripe.com/v1/' + path, init);
  } catch (e) {
    throw new StripeError('stripe unreachable: ' + e.message, 0, null);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data.error || {};
    throw new StripeError(err.message || ('stripe ' + res.status), res.status, err.code);
  }
  return data;
}

export const stripePost = (path, body) => stripeCall('POST', path, body);
export const stripeGet  = (path)       => stripeCall('GET', path, null);

/* ------------------------------------------------- webhook signature check */

function timingSafeEqualHex(a, b) {
  const A = Buffer.from(String(a), 'utf8');
  const B = Buffer.from(String(b), 'utf8');
  /* timingSafeEqual throws on a length mismatch, which would itself leak the
     length. Compare lengths first and still run the comparison, so the failure
     path costs the same either way. */
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

/* Verifies the Stripe-Signature header against the RAW request body.
   Returns { ok: true } or { ok: false, reason }.

   Every v1 candidate is tried, not just the first: Stripe sends several during
   a signing-secret rotation, and checking only one turns a routine rotation
   into an outage that rejects real payments. */
export function verifyStripeSignature(rawBody, sigHeader, secret, toleranceSeconds = 300) {
  if (!secret)    return { ok: false, reason: 'no_webhook_secret_configured' };
  if (!sigHeader) return { ok: false, reason: 'no_signature_header' };

  let timestamp = null;
  const candidates = [];
  for (const part of String(sigHeader).split(',')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === 't') timestamp = v;
    else if (k === 'v1') candidates.push(v);
  }
  if (!timestamp)        return { ok: false, reason: 'no_timestamp' };
  if (!candidates.length) return { ok: false, reason: 'no_v1_signature' };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'bad_timestamp' };
  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > toleranceSeconds) return { ok: false, reason: 'timestamp_outside_tolerance:' + age };

  const expected = crypto
    .createHmac('sha256', secret)
    .update(timestamp + '.' + rawBody, 'utf8')
    .digest('hex');

  for (const c of candidates) if (timingSafeEqualHex(expected, c)) return { ok: true };
  return { ok: false, reason: 'no_matching_signature' };
}

/* ------------------------------------------------ session re-verification  */

/* The signature proves the payload came from Stripe. THIS proves the payment
   is currently good — and the two are different questions. A delivery retried
   after a 500, or replayed by hand from the dashboard, can arrive long after
   the charge was refunded.

   Returns { ok: true, session, charge } or { ok: false, reason, detail }.

   FAILS CLOSED. Anything it cannot positively confirm is a rejection. */
export async function verifyStripeSession(sessionId, expectedTier) {
  let session;
  try {
    /* line_items so the Price id can be checked against the tier. An amount
       alone would let a $299 payment provision a $499 build the moment either
       price is edited in the dashboard. */
    session = await stripeGet(
      'checkout/sessions/' + encodeURIComponent(sessionId) + '?expand[]=line_items');
  } catch (e) {
    return { ok: false, reason: 'session_fetch_failed', detail: e.message };
  }

  if (session.mode !== 'payment')            return { ok: false, reason: 'not_payment_mode' };
  if (session.payment_status !== 'paid')     return { ok: false, reason: 'not_paid', detail: session.payment_status };
  if ((session.currency || '').toLowerCase() !== 'usd')
    return { ok: false, reason: 'wrong_currency', detail: session.currency };

  const amount = Number(session.amount_total || 0);
  if (!(amount >= MIN_AMOUNT_CENTS))
    return { ok: false, reason: 'amount_too_low', detail: amount + ' < ' + MIN_AMOUNT_CENTS };

  /* The tier assertion. expectedTier comes from the intake row, which the
     browser never wrote. */
  if (expectedTier) {
    const wantPrice = TIER_PRICE_ID[expectedTier];
    if (!wantPrice) return { ok: false, reason: 'unknown_tier', detail: expectedTier };
    const items = (session.line_items && session.line_items.data) || [];
    const gotPrice = items.length === 1 && items[0].price ? items[0].price.id : null;
    if (gotPrice !== wantPrice)
      return { ok: false, reason: 'tier_price_mismatch', detail: gotPrice + ' != ' + wantPrice };
  }

  /* ---- the refund gate ------------------------------------------------ */
  /* Stripe does NOT change payment_status on a refund. A fully refunded
     session still reads 'paid' and passes every check above. Refund state
     lives on the Charge, which hangs off the PaymentIntent. */
  const piId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent && session.payment_intent.id);
  if (!piId) return { ok: false, reason: 'no_payment_intent' };

  let pi;
  try {
    pi = await stripeGet(
      'payment_intents/' + encodeURIComponent(piId) + '?expand[]=latest_charge');
  } catch (e) {
    return { ok: false, reason: 'pi_fetch_failed', detail: e.message };
  }

  /* TWO SHAPES. No Stripe-Version header is sent, so the response follows the
     account's default API version: modern accounts expand latest_charge,
     older ones return charges.data[]. Reading only charges.data[0] throws on a
     modern account and blocks EVERY buyer, not merely refunded ones. */
  const charge = (pi.latest_charge && typeof pi.latest_charge === 'object')
    ? pi.latest_charge
    : ((pi.charges && pi.charges.data && pi.charges.data[0]) || null);

  if (!charge) return { ok: false, reason: 'no_charge_on_intent' };
  if (charge.refunded) return { ok: false, reason: 'refunded' };
  if (Number(charge.amount_refunded || 0) > 0)
    return { ok: false, reason: 'partially_refunded', detail: String(charge.amount_refunded) };

  return { ok: true, session, charge };
}

/* ------------------------------------------------------------------- mail  */

export function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* NEVER THROWS. By the time any mail fires, money has moved and the database
   is already correct. A Brevo outage must not become a 500 that makes Stripe
   retry work that is already done, and must not surface to the buyer as a
   failed purchase. Returns true/false so the caller can log it. */
export async function sendBrevo({ to, toName, subject, html, text, replyTo }) {
  if (!BREVO_API_KEY) { console.warn('brevo: no API key, mail skipped:', subject); return false; }
  if (!to)            { console.warn('brevo: no recipient, mail skipped:', subject); return false; }
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Systems by Vega', email: SUPPORT_EMAIL },
        replyTo: { email: replyTo || SUPPORT_EMAIL },
        to: [{ email: to, name: toName || undefined }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });
    if (!res.ok) {
      console.error('brevo send failed', res.status, (await res.text()).slice(0, 400));
      return false;
    }
    return true;
  } catch (e) {
    console.error('brevo threw:', e.message);
    return false;
  }
}

/* Alert a human. Sent on every path where the software cannot finish the job:
   a territory lost after payment, a slug collision after payment, a session
   with no intake behind it, incomplete metadata, any provisioning failure.

   Always ends with a NEXT: line. An alert that describes a problem without
   saying what to do about it gets archived. */
export function ownerAlert(subject, lines) {
  const body = (Array.isArray(lines) ? lines : [String(lines)]);
  const html = '<pre style="font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace">'
    + body.map(escHtml).join('\n') + '</pre>';
  return sendBrevo({
    to: SUPPORT_EMAIL,
    toName: 'Systems by Vega',
    subject: '[SBV] ' + subject,
    html,
    text: body.join('\n'),
  });
}

/* ------------------------------------------------------------------ utils  */

export function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
}

/* A DNS-safe subdomain label. Mirrors the client_id CHECK on sbv_tenants:
   lowercase alphanumerics, single hyphens between, never leading or trailing. */
export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    /* Escapes, not literal combining marks: those are invisible in an editor
       and do not survive a careless re-encode. \u0300-\u036f is the combining
       diacriticals block NFKD splits accents into. */
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

/* THERE IS NO normCity() HERE, AND THAT IS THE POINT.

   GarageSaleBiz carries a city normaliser in JavaScript AND one in SQL, and
   the two have to agree exactly or the pre-purchase availability check
   disagrees with the unique index that actually sells the territory — a city
   reads free, the buyer pays, and the claim then fails. Every consumer here
   calls sbv_city_available(), which runs sbv_norm_city() in the database, so
   the check and the guarantee share one implementation by construction.

   If you ever find yourself needing to normalise a city name in this file,
   call the database instead. */
