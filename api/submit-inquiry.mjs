/* ============================================================================
   POST /api/submit-inquiry
   ----------------------------------------------------------------------------
   A custom-work inquiry from /services/, recorded in sbv_inquiries.

   WHY service_role AND NOT anon. The caller is an anonymous visitor, not an
   authenticated operator, so there is no JWT to scope with. sbv_inquiries has
   no anon policy and no anon grant by design — a public key that can write
   rows into an inbox table is a spam target with a free API. The insert
   therefore runs with the service key behind this route, and this route is
   the only thing standing between the internet and that table.

   NO client_id, UNLIKE submit-lead.mjs. A SystemsByVega inquiry has no
   tenant, so there is nothing to look up and no tenant-exists check to make.
   See sql/INQUIRIES.sql's header for why sbv_leads and sbv_demand could not
   hold these rows instead.

   RATE LIMIT IS PER IP, NOT PER TENANT. There is no tenant to scope by, so
   the limiter counts recent rows in sbv_inquiries itself, keyed on the first
   hop of X-Forwarded-For. Counted from the table rather than in-process
   memory for the same reason as submit-lead: this runs on Fluid Compute,
   where a second instance would otherwise get its own fresh allowance.
   ip_hash is a column added to sbv_inquiries beyond the brief's sample
   schema specifically to make this possible — see sql/INQUIRIES.sql's header.

   Ruling R15 — A HASH, NOT THE ADDRESS. check-territory.mjs rate-limits by IP
   entirely in an in-memory Map and never persists it, which is fine there
   because a missed territory check is harmless. This table is the owner's
   inbox and has to survive across serverless instances, so the bucket has to
   be durable — but durable does not mean the raw address belongs in
   Postgres. legal/privacy.html discloses only that our HOSTING PROVIDER
   keeps standard server logs with IP addresses; it says nothing about
   SystemsByVega persisting them, and storing the raw value here would have
   made that published statement false. A salted SHA-256 buckets identically
   for rate-limiting purposes without keeping the address anywhere this
   database can be queried for it. See ipHash() below for the hashing, the
   salt, and the 'unknown' fallback for a missing X-Forwarded-For.

   budget_range IS THE BUYER'S BUDGET, NOT A CLAIM ABOUT RETURN. It records
   what a prospect says they can spend. Nothing here may describe a payback
   period, a return, or what a project "pays for itself" in — see
   api/_shared.mjs's acceptance text for the standing no-earnings-claim rule
   this family holds to everywhere.
   ========================================================================== */

import {
  json, preflight, pgSelect, pgInsert, PgError, sha256Hex,
} from './_shared.mjs';

export const config = { runtime: 'nodejs' };

/* Ruling R15's salt. Read the same way api/_shared.mjs reads every other
   environment value: process.env with a non-empty literal fallback, never an
   empty string that would make an unset var silently hash with nothing. The
   fallback is not a secret worth protecting — it only has to be non-empty so
   local runs without the env var still bucket consistently; production sets
   its own via Vercel env. */
const IP_SALT = process.env.SBV_IP_SALT || 'sbv-inquiries-default-salt-2026';

/* Per IP, per hour. Counted from the table itself rather than any in-process
   memory: this runs on Fluid Compute where a second instance would otherwise
   get its own fresh allowance. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

/* Mirrors sbv_inquiries' CHECK constraints exactly. Enforced here so a
   rejection is a clean 400 the page can act on rather than a 23514 from
   PostgREST, and enforced there as well because this route is not the only
   thing that can reach the table. */
const LIMITS = { name: 120, company: 160 };
const PROJECT_MIN = 10;
const PROJECT_MAX = 4000;
const EMAIL_MAX = 254;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

/* The five values sbv_inquiries_budget_ck allows. An unrecognised value is
   dropped to null rather than rejected: a stale <option> in the form must
   never cost a buyer a 400-word project description. */
const BUDGET_RANGES = new Set(['under-5k', '5k-15k', '15k-40k', '40k-plus', 'not-sure']);

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/* Ruling R15: the rate limit needs a stable per-client bucket that survives
   across serverless instances, which an in-memory Map cannot give. It does
   NOT need the address itself. A salted hash buckets identically and stores
   no raw identifier — legal/privacy.html discloses only that our HOST keeps
   server logs, not that we keep IPs in Postgres, and that statement must
   stay true. check-territory.mjs takes the in-memory route because a missed
   territory check is harmless; this table is the owner's inbox, so the
   bucket has to be durable.

   First hop only. Anything after it is whatever the client claimed and is
   not trustworthy for rate-limiting; the edge/proxy in front of this route
   is what prepends the real one. Falls back to the literal 'unknown' rather
   than an empty string, matching check-territory.mjs's clientKey():
   header-less callers share one allowance instead of each getting a private
   bucket, which fails toward limiting rather than toward waving everyone
   through. Truncated to 32 hex chars — plenty of entropy for a rate-limit
   bucket, and short enough to stay well under the column's 64-char cap. */
function ipHash(request) {
  const fwd = request.headers.get('x-forwarded-for') || '';
  const first = fwd.split(',')[0].trim() || 'unknown';
  /* sha256Hex(IP_SALT + first) is byte-identical to the createHash('sha256')
     call this replaced — same algorithm, same utf8 encoding, same input
     string — verified before this change shipped: this feeds the rate
     limiter's bucket key, and a changed hash would silently reset
     everyone's window. */
  return sha256Hex(IP_SALT + first).slice(0, 32);
}

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

    /* Honeypot: accepted and dropped, never rejected. A bot told it failed
       learns to try again; a bot told it succeeded does not. Same as
       submit-lead.mjs. */
    if (str(body._honey)) return json({ ok: true });

    const name = str(body.name);
    const email = str(body.email);
    const company = str(body.company);
    const project = str(body.project);

    /* Presence and max length only — same discipline as submit-lead.mjs,
       which never duplicates a table's minimum in JS. The table's own
       "between 2 and 120" is the backstop for a name that is present but
       too short to be real; it is not this route's job to guess where that
       line is. */
    if (!name || name.length > LIMITS.name) {
      return json({ ok: false, error: 'bad_name' }, 400);
    }
    if (!email || email.length > EMAIL_MAX || !EMAIL_RE.test(email)) {
      return json({ ok: false, error: 'bad_email' }, 400);
    }
    if (company && company.length > LIMITS.company) {
      return json({ ok: false, error: 'too_long', field: 'company' }, 400);
    }
    if (project.length < PROJECT_MIN || project.length > PROJECT_MAX) {
      return json({ ok: false, error: 'bad_project' }, 400);
    }

    /* Unrecognised or absent budget_range becomes null, not a rejection. */
    const rawBudget = str(body.budget_range);
    const budgetRange = BUDGET_RANGES.has(rawBudget) ? rawBudget : null;

    const bucket = ipHash(request);

    try {
      /* Rate limit, per IP per hour, counted from sbv_inquiries itself since
         there is no tenant to scope by. Filters on the hash — see ipHash()
         and sql/INQUIRIES.sql's Ruling R15 note for why the table never
         holds the raw address.

         limit=RATE_LIMIT+1 because the only question is whether the count has
         reached the ceiling; fetching more rows to count them precisely would
         cost more and answer the same question. Same pattern as
         submit-lead.mjs. */
      const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
      const recent = await pgSelect('sbv_inquiries',
        'ip_hash=eq.' + encodeURIComponent(bucket) +
        '&created_at=gt.' + encodeURIComponent(since) +
        '&select=id&limit=' + (RATE_LIMIT + 1));
      if (Array.isArray(recent) && recent.length >= RATE_LIMIT) {
        return json({ ok: false, error: 'rate_limited' }, 429,
          { 'Retry-After': String(RATE_WINDOW_MS / 1000) });
      }

      await pgInsert('sbv_inquiries', {
        name,
        email,
        company: company || null,
        project,
        budget_range: budgetRange,
        source: 'services',
        ip_hash: bucket,
      }, { minimal: true });

      return json({ ok: true });
    } catch (e) {
      /* Never echo a database message to a public caller: PgError carries the
         PostgREST body, which names columns and constraints. Log it, answer
         with a code. */
      const status = e instanceof PgError && e.status >= 400 && e.status < 500 ? 400 : 503;
      console.error('submit-inquiry:', bucket, e && e.message);
      return json({ ok: false, error: status === 400 ? 'rejected' : 'unavailable' }, status);
    }
  },
};
