#!/usr/bin/env node
/* tools/resend-welcome.mjs — resend the operator welcome email for one purchase
 * ---------------------------------------------------------------------------
 *   node tools/resend-welcome.mjs .env.local --session cs_...
 *   node tools/resend-welcome.mjs .env.local --session cs_... --dry
 *
 * WHY THIS EXISTS. When Brevo rejects the send (the IP allowlist did exactly
 * this) the webhook still finishes: money recorded, tenant live, 200 returned.
 * Stripe will not retry a 200, and replaying the event by hand hits the
 * idempotency gate — "already provisioned, nothing to do" — before the mail
 * step. So a missed welcome email can only be redelivered by calling
 * sendWelcome directly, which is what this does, with the SAME code path and
 * copy as the webhook: it imports the function rather than copying it, so the
 * two can never drift.
 *
 * Reads the intake row from the database rather than taking name/city flags:
 * the database is what the webhook itself would have used, and retyping a
 * buyer's details by hand is how a wrong-name email gets sent.
 *
 * LOCAL ONLY. Named in .vercelignore beside brevo-diag.mjs. The env file is
 * .env.local from `vercel env pull` — never pasted keys, never committed.
 */
import fs from 'node:fs';

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : null; };
const envFile = argv.find((a) => !a.startsWith('--') && a !== arg('--session'));
const sessionId = arg('--session');
const dry = argv.includes('--dry');

if (!envFile || !sessionId || !/^cs_/.test(sessionId)) {
  console.error('usage: node tools/resend-welcome.mjs <env-file> --session cs_... [--dry]');
  process.exit(2);
}

/* Env must land in process.env BEFORE _shared.mjs is imported — its constants
   (BREVO_API_KEY, SERVICE_KEY) are read once at module load. Hence the dynamic
   import below rather than a top-level one. */
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
for (const need of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'BREVO_API_KEY']) {
  if (!process.env[need]) { console.error('missing ' + need + ' in ' + envFile); process.exit(2); }
}

const { pgSelectOne } = await import('../api/_shared.mjs');
const { sendWelcome } = await import('../api/stripe-webhook.mjs');

const enc = encodeURIComponent;
const intake = await pgSelectOne('sbv_intake',
  'stripe_session_id=eq.' + enc(sessionId) +
  '&select=operator_email,operator_name,business_name,city_label,state_code,niche_slug');
if (!intake) { console.error('no sbv_intake row for ' + sessionId); process.exit(1); }

const billing = await pgSelectOne('sbv_billing',
  'stripe_session_id=eq.' + enc(sessionId) + '&select=client_id');
if (!billing || !billing.client_id) {
  console.error('no sbv_billing row for ' + sessionId + ' — was this ever provisioned?');
  process.exit(1);
}

/* Refuse to welcome someone to a storefront that is not up. If the tenant is
   inactive the email would link a dead site, which is the exact failure the
   original copy rewrite was for. */
const tenant = await pgSelectOne('sbv_tenants',
  'client_id=eq.' + enc(billing.client_id) + '&select=client_id,is_active');
if (!tenant || !tenant.is_active) {
  console.error('tenant ' + billing.client_id + ' is not active — fix that first, then resend.');
  process.exit(1);
}

const niche = await pgSelectOne('sbv_niches',
  'slug=eq.' + enc(intake.niche_slug) + '&select=name');

console.log('to:       ' + intake.operator_email);
console.log('tenant:   ' + billing.client_id + '  (active)');
console.log('niche:    ' + ((niche && niche.name) || intake.niche_slug));
console.log('city:     ' + intake.city_label + ', ' + intake.state_code);

if (dry) { console.log('\n--dry: nothing sent.'); process.exit(0); }

const ok = await sendWelcome(intake, billing.client_id, niche && niche.name);
console.log(ok ? '\nsent.' : '\nSEND FAILED — see the brevo error above.');
process.exit(ok ? 0 : 1);
