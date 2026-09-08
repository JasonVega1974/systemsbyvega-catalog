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

## NEXT STEP — resume here

**Step 2 of the brief: `api/submit-lead.mjs`.** Nothing has been written yet.

Hard gate from the brief's §8, not yet satisfied: *do not push the route until
a curl test proves 5 rapid submissions succeed and the 6th returns 429.*

Then, in brief order: step 3 (add `clientId` to the merge endpoint response),
step 4 (niche form wiring in `applyRuntime()`, batched, rebuild all, qa 0
failures), step 5 (the admin Leads tab), step 6 (review, push).

---

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
