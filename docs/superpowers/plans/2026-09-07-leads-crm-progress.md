# Operator Leads CRM — progress

Brief: `docs/superpowers/briefs/2026-09-07-leads-crm-brief.md` (pasted in chat
2026-09-08; not yet saved to the repo — **see "Loose ends" below**).
Prior briefs and their autonomy grants carry forward unchanged.

**Paused 2026-09-08 at Jason's request. Resume at "NEXT STEP" below.**

---

## Step 1 — `sql/LEADS.sql` · DONE AND APPLIED

`1420f0f` → `8592e52` → `1933120`. **The table exists in SystemsByVega and is
empty (0 rows).** I applied it myself while verifying, which is worth knowing
because the brief said Jason runs it — re-running is harmless and idempotent,
and all 13 checks come back true on a second run.

### It failed twice first, and the reason is a lesson worth keeping

Both failures were `42P01: relation "_leads_verify" does not exist`.

- **Attempt 1** used a temp table to collect check results.
- **Attempt 2** wrapped the file in one transaction with a savepoint, on the
  theory that the temp table was the problem.
- **Attempt 3** — the one that works — dropped every piece of session state.

The actual cause is that the Supabase SQL editor auto-commits each statement
and may run them on **different pooled sessions**, so a temp table, `set local
role` and savepoints are all equally unavailable. Attempt 2 diagnosed the
symptom rather than the cause.

**Why my dry runs kept passing:** to avoid applying the file I wrapped it in a
transaction — which is precisely the thing that made session state survive. My
test and Jason's invocation were never the same shape, twice in a row. *A dry
run that changes the execution shape is not a dry run.* Any future "test
without applying" needs to preserve the statement-splitting and session
behaviour of the real runner, or it proves nothing.

### What the verify block does and does not prove

It is now a single SELECT over `pg_policies`, `pg_proc`, `pg_constraint`,
`pg_indexes` and the `has_*_privilege` functions. All 13 rows true, twice.

It gained a check worth more than the ones it lost: it reads each policy's
**predicate text** and confirms all three are gated on
`sbv_is_tenant(client_id)`, instead of only counting that three policies exist.
A policy scoped to something useless passed the old count.

Catalog reads cannot prove RLS filters at runtime. That was verified
**separately** against the live table with a real operator session:

| check | result |
|---|---|
| operator sees their own lead | true |
| operator CANNOT see another tenant's lead | true |
| operator sees zero rows for a tenant they do not own | true |

That test is deliberately NOT in the file (it needs session state). Re-run it
ad hoc if the policies are ever touched.

### Two deliberate departures from the brief's schema, both tightening it

1. **UPDATE is column-level on `(status, note, deleted_at)` only.** The brief
   said operators update status and note; restricting the grant means a lead
   cannot later be edited into saying something the visitor never wrote.
2. **A lead must carry a phone or an email** (`sbv_leads_contactable_ck`).
   A lead with no way to reach the person back is noise.

Both are reversible if Jason disagrees; neither has been raised with him yet.

### A finding about the test tenants, discovered here

**All four mapped test tenants — primetest, startest, testerson, testy2 —
belong to the SAME operator account.** `sbv_is_tenant()` is legitimately true
for all of them. My first isolation test staged the "other tenant" lead under
testerson, the operator could see it, and it looked like an RLS hole. It was
not.

`testy` and `test2` have **no** operator mapping, which makes `testy` the only
honest choice of "a tenant this operator does not own".

**Implication beyond this feature:** any earlier test that assumed those four
tenants were isolated from one another was not testing isolation.

---

## Step 2 — `api/submit-lead.mjs` · DONE (`796eab6`)

Public route recording a booking-form enquiry in sbv_leads. Additive: FormSubmit
still delivers every enquiry and stays the path of record, the page calls this
afterwards, and every failure path is silent because the operator has already
been told.

**The brief's hard gate is satisfied, twice.** Before pushing, the real handler
was run against the real database: 5 submissions accepted, 6th refused 429 with
Retry-After, exactly 5 rows stored, still refused after soft-deleting all five.
Then after deploying, the literal curl proof against production:

```
submission 1..5 -> HTTP 200  {"ok":true}
submission 6    -> HTTP 429  {"ok":false,"error":"rate_limited"}
rows stored: 5, all source=form
```

Test tenants and every row deleted afterwards; the table is empty and tenants
are back to 6.

**Departure from the brief, deliberate.** Manual leads do NOT go through this
route. The brief said they should, but that gives one endpoint two
authentication models and makes the branch between them the thing a bug lets
you take the wrong side of. The admin is authenticated and sbv_leads has an
INSERT policy for exactly that case, so it inserts directly under RLS.

**Bug found in my own first cut:** clientId was read from the operator-content
row, which does not exist until an operator's first save — so it would have
been null for precisely the operator taking their first enquiries. It comes
from the tenant row now.

**Also departed:** lead capture lives in `_template/base.js`, not in 32
niche.js files. base.js already sees every submit on every niche through
consentGate, so this is one implementation that cannot drift and a new niche
inherits it by existing.

**Worth knowing:** `/api/submit-lead` 308-redirects to `/api/submit-lead/`
because vercel.json sets trailingSlash. Every API route does this and browsers
follow it transparently — but curl needs `-L` or the trailing slash.

---

## Step 5 — the Leads tab · DONE (`5b77718`)

Rows not a table (stacks on a phone), semantic status colours independent of
the niche accent, KPI strip, filter, 25-row pagination, inline expand with
status and note, soft delete, manual add.

Not part of the Save bar, deliberately: everything else in the admin is a draft
composed then committed, but a lead's status is a fact about a call that
already happened. Each change writes immediately.

Verified in a browser against the real database with 30 seeded leads: controls
present, page 1 returns 25 of 30, the filter narrows, soft delete drops the row
from the list while it stays in the table. Cleanup left nothing.

Also gave the admin a favicon — it had none, so the page operators use most
404'd on /favicon.ico every load.

---

## NEXT STEP — resume here

**Step 4 of the brief is the only piece not done: nothing has been verified
end to end on a LIVE claimed tenant.** The route is proven, the capture is in
all 34 builds, and the tab is proven — but no real form submission on a real
subdomain has been watched landing in a real Leads tab. That needs a tenant
with a signed-in operator, which needs a password I do not have.

Everything else in the leads brief is complete.

## Also queued, agreed with Jason 2026-09-08, not started

1. **DJ theme selector in the admin — option B.** Jason chose it explicitly.
   Requires: `grant update (theme)` on `sbv_tenants` to authenticated (today it
   is deliberately withheld — see `sql/DJ-THEME.sql`, which reasons that theme
   repoints which build the subdomain serves, like `niche_slug` and `tier`);
   surfacing the theme list to the admin (cleanest: have
   `tools/build-manifest-index.js` add `themes` to each niche's entry in
   `assets/data/manifests.json`, which the admin already fetches — rather than
   a second source of truth); a selector shown only for themed niches; and
   reading/writing `sbv_tenants.theme`, which the admin does not currently
   touch at all (it reads `sbv_operator_content`).
2. **Guides + mini-course content for all 32 niches** (guides brief §3/§4).
   Not started. Use `niches/<slug>/brief.md` and `content.json` as source.
   Compliance: zero income claims, zero fabricated statistics.

---

## Loose ends a fresh session would not otherwise know

- **The Leads CRM brief exists only in chat.** It was pasted, never written to
  `docs/superpowers/briefs/`. Ask Jason for it again, or reconstruct from this
  ledger, before relying on details not captured here.
- **3 commits are unpushed** on `main`: `1420f0f`, `8592e52`, `1933120`. All
  three are `sql/LEADS.sql` only. Nothing in the working tree, nothing else
  depends on them, and the table is already applied — so pushing them is safe
  whenever, and holding them changes nothing.
- Live schema state as of the pause: `sbv_leads` exists, 0 rows;
  `sbv_operator_content.terms_custom` and `.privacy_custom` exist;
  `sbv_tenants.theme` exists; 6 tenants; `djroutetest` was deleted after the
  routing verification.

---

## Still open for Jason, carried from the guides/legal ledger

- **Attorney review of the franchise / FTC posture before launch.** Blocking
  for launch, not for building. Details in
  `2026-09-08-guides-and-legal-progress.md`.
- **Nothing captures a dj buyer's theme choice at purchase.** Item 1 above
  closes it from the operator side; the checkout side stays open.
