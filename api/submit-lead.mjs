/* ============================================================================
   POST /api/submit-lead
   ----------------------------------------------------------------------------
   A booking-form submission from a claimed operator site, recorded in
   sbv_leads so the operator has a running list and not only an inbox.

   THIS DOES NOT REPLACE THE EMAIL. FormSubmit still delivers every enquiry and
   remains the path of record. This endpoint is additive, and the page calls it
   AFTER the email has already gone — so if this fails, the operator has still
   been told. That is why every failure here answers with a body the page
   ignores rather than anything it should surface to a visitor: the visitor's
   enquiry succeeded regardless of what happened in here.

   WHY service_role AND NOT anon. The caller is a visitor, not an authenticated
   operator, so there is no JWT to scope with. sbv_leads has no anon policy and
   no anon grant by design — a public key that can write rows into an
   operator's lead list is a spam target with a free API. The insert therefore
   runs with the service key behind this route, and this route is the only
   thing standing between the internet and that table. Everything below is that
   standing.

   MANUAL LEADS DO NOT COME THROUGH HERE, and this is a deliberate departure
   from the brief, which said they should. An operator logging a phone call is
   authenticated and already holds a Supabase client; sbv_leads has an INSERT
   policy written for exactly that case. Routing them through here would give
   one endpoint two authentication models, and the branch that chooses between
   them becomes the thing a bug lets you take the wrong side of — a form
   submission claiming to be manual, or skipping the rate limit. The admin
   inserts directly under RLS instead. See docs/superpowers/plans for the note.
   ========================================================================== */

import {
  json, preflight, pgSelect, pgSelectOne, pgInsert, PgError,
} from './_shared.mjs';

export const config = { runtime: 'nodejs' };

/* Per client_id, per hour. The brief's number. Counted from the table itself
   rather than from any in-process memory: this runs on Fluid Compute where a
   second instance would otherwise get its own fresh allowance. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

/* Mirrors sbv_leads' CHECK constraints exactly. Enforced here so a rejection
   is a clean 400 the page can log rather than a 23514 from PostgREST, and
   enforced there as well because this route is not the only thing that can
   reach the table. */
const LIMITS = { name: 120, phone: 40, email: 200, message: 4000 };

/* The same shape sbv_tenants_reserved_ck allows, so a malformed client_id is
   refused before it reaches the database. */
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return preflight();
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ ok: false, error: 'bad_json' }, 400);
    }
    if (!body || typeof body !== 'object') return json({ ok: false, error: 'bad_json' }, 400);

    /* The honeypot the build injects into every form. A real visitor never
       sees the field; a bot fills everything. Answer 200 and write nothing —
       telling a bot which of its submissions were discarded just teaches it
       what to change. */
    if (str(body._honey)) return json({ ok: true });

    const clientId = str(body.client_id);
    if (!clientId || !LABEL.test(clientId)) {
      return json({ ok: false, error: 'bad_client_id' }, 400);
    }

    const name = str(body.name);
    const phone = str(body.phone);
    const email = str(body.email);
    const message = str(body.message);

    /* A lead nobody can reply to is not a lead. Same rule as the table's
       sbv_leads_contactable_ck. */
    if (!phone && !email) return json({ ok: false, error: 'no_contact' }, 400);

    for (const [field, max] of Object.entries(LIMITS)) {
      const value = { name, phone, email, message }[field];
      if (value.length > max) return json({ ok: false, error: 'too_long', field }, 400);
    }

    try {
      /* The tenant must exist and be live. This is also what stops the
         endpoint being used to write rows against a client_id somebody
         guessed: an unknown or deactivated tenant gets nothing. */
      const tenant = await pgSelectOne('sbv_tenants',
        'client_id=eq.' + encodeURIComponent(clientId) +
        '&is_active=eq.true&select=client_id');
      if (!tenant) return json({ ok: false, error: 'unknown_tenant' }, 404);

      /* Rate limit. Counted across the window including soft-deleted rows —
         a deleted lead was still a submission, and excluding them would let
         anyone with the admin clear their way to a fresh allowance.

         limit=RATE_LIMIT+1 because the only question is whether the count has
         reached the ceiling; fetching more rows to count them precisely would
         cost more and answer the same question. */
      const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
      const recent = await pgSelect('sbv_leads',
        'client_id=eq.' + encodeURIComponent(clientId) +
        '&created_at=gt.' + encodeURIComponent(since) +
        '&select=id&limit=' + (RATE_LIMIT + 1));
      if (Array.isArray(recent) && recent.length >= RATE_LIMIT) {
        return json({ ok: false, error: 'rate_limited' }, 429,
          { 'Retry-After': String(RATE_WINDOW_MS / 1000) });
      }

      /* Empty string is stored as null so "not given" reads the same whether
         the field was absent or blank — the admin's list renders one dash
         either way and does not have to know the difference. */
      await pgInsert('sbv_leads', {
        client_id: clientId,
        name: name || null,
        phone: phone || null,
        email: email || null,
        message: message || null,
        source: 'form',
      }, { minimal: true });

      return json({ ok: true });
    } catch (e) {
      /* Never echo a database message to a public caller: PgError carries the
         PostgREST body, which names columns and constraints. Log it, answer
         with a code. */
      const status = e instanceof PgError && e.status >= 400 && e.status < 500 ? 400 : 503;
      console.error('submit-lead:', clientId, e && e.message);
      return json({ ok: false, error: status === 400 ? 'rejected' : 'unavailable' }, status);
    }
  },
};
