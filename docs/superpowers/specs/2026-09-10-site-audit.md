# SystemsByVega.com — Read-Only Site Audit

**Date:** 2026-09-10 · **Brief:** `docs/superpowers/briefs/` → 2026-09-10 site reorganization
**Scope:** §2 of the brief. Read-only. Nothing was changed.
**Repo root audited:** `systemsbyvega/` (the deployed repo; the parent
`systems-by-vega/` folder holds loose artwork and two dead HTML sources that are
**not** deployed — see §8).

**This is a mandatory checkpoint. No design or build work has started.**

---

## 0. Executive summary — the seven things that matter

1. **`/sites/` is served `X-Robots-Tag: noindex` today.** Verified live. `vercel.json`
   applies it to `/sites/(.*)` on the apex host, and that pattern matches `/sites/`
   itself, not just the 32 storefronts under it. The brief moves the *primary revenue
   page* to that URL. Ship as-specified and the SiteLab catalog becomes unindexable.
   **This must be narrowed before T2.** (§6.1)
2. **The homepage contradicts itself in prose vs. data.** The ledger bar is computed
   from the seed and reads *38 listed · 3 open · 32 sites*. The prose on the same page
   says "**Two** of these are finished", "**Twenty-seven** entries", "**twenty-nine** I
   have not built", "**Twenty-three** trades, twenty-three sites already built". All
   four are hand-typed and all four are now wrong. ConsignmentBiz is live and open in
   the seed, yet `#proof` explicitly states "there is no third finished platform."
   Spanish carries the same errors. (§5.1)
3. **There are zero real operators.** `sbv_tenants` holds 6 rows; every one is a test
   (`test2`, `testerson`, `testy`, `testy2`, `startest`, `primetest`). The brief's proof
   strip says "X operators (pull from DB)". Pulled honestly that number is **0**;
   pulled naively it is **6 fabricated operators**. Neither ships. (§7.1)
4. **`/` and `/sites/` are not two views of one catalog — they are two products with
   two incompatible stories.** `/` sells territory-exclusive businesses (registry,
   waitlist, one-operator-per-city). `/sites/` sells white-label website builds, and its
   "how it works" still describes a **manual, done-for-you** process on **GitHub Pages** —
   a workflow the platform replaced with self-serve Stripe checkout → auto-provisioned
   subdomain → operator admin. The merge is not a layout merge; it is a copy decision. (§5)
5. **`/services/` cannot reuse `sbv_leads` as the brief suggests.** `sbv_leads.client_id`
   is `NOT NULL` with an FK to `sbv_tenants` — every lead must belong to an operator.
   `sbv_demand` requires a `niche_slug` FK plus a city. A SystemsByVega services inquiry
   fits neither. Also: the brief says FormSubmit; the live form uses **Web3Forms**. (§7.2)
6. **`/demo/` is already 80% of the `/services/` page the brief asks for**, and
   `/showcase/` is the interactive proof that belongs beside it. Neither is orphaned —
   both are linked from `/` and `/sites/` — but neither has an analytics tag, and both
   still link to `/pricing/`, which now 308s. (§4)
7. **The Roady's boundary is already crossed in two places today.** `/portfolio/`
   names "Roady's Truck Stops" in its About paragraph, and its "Operations Command
   Center" project card describes work "for a national retail network." Both are live.
   The brief bars Roady's from the portfolio and permits one sentence in `/about/`.
   **Jason's call required.** (§9, Q1)

---

## 1. Deployed route map (verified live, 2026-09-10)

| Route | Status | Source file | Purpose |
|---|---|---|---|
| `/` | 200 | `index.html` (80 KB, generated) | Territory catalog — "the board" |
| `/sites/` | 200 **noindex** | `sites/index.html` (122 KB, hand-authored) | Site Shop — 32 website demos |
| `/sites/<slug>/` | 200 **noindex** | `sites/<slug>/index.html` ×32 (generated) | Niche storefront demo |
| `/sites/<slug>/{guide,terms,privacy}.html` | 200 | generated | Operator guide + per-niche legal |
| `/sites/dj/` | 200 | theme picker → `blue` \| `green` \| `pink` | The one themed niche |
| `/demo/` | 200 | `demo/index.html` (70 KB) | Ops-build services pitch |
| `/showcase/` | 200 | `showcase/index.html` (229 KB + 160 KB geo JSON) | Interactive ops console demo |
| `/portfolio/` | 200 | `portfolio/index.html` + `projects.json` (11 projects) | Portfolio hub |
| `/claim/` | 200 | `claim/index.html` | Stripe **cancel_url** landing |
| `/claim/thank-you.html` | 200 | | Stripe **success_url** landing |
| `/admin/` | 200 | `admin/index.html` (137 KB) | Operator admin |
| `/__owner__/` | 200 | `__owner__/index.html` | Demand console (noindex, no-store) |
| `/legal/{terms,privacy,refund,operator-agreement}.html` | 200 | | Platform legal |
| `/pricing/` | **308 → `/#websites`** | `vercel.json` | Legacy redirect |
| `/niche-landing.html` | 308 → `/#catalog` | `vercel.json` | Legacy redirect |
| `/platforms/` `/services/` `/work/` `/about/` | **404** | — | The four new pages |
| `/robots.txt` `/sitemap.xml` | **404** | — | Neither exists (§6.3) |
| `<client>.systemsbyvega.com` | rewrite | `middleware.js` | Tenant storefront |

**API (12 functions):** `_shared.mjs`, `acceptance`, `check-territory`, `create-checkout`,
`demand.js`, `digest.js`, `marketing-kit`, `operator-content`, `owner.js`,
`stripe-webhook`, `submit-lead`, `verify-session`.

**Build tools (11 + 30 converters):** `build-catalog.js` (the Vercel `buildCommand`,
runs `--check`), `build-site.js`, `build-manifest-index.js`, `build-og.js`,
`gen-seed-sql.js`, `a11y-sweep.js`, `qa-site.js`, `runtime-check.js`,
`validate-manifest.js`, plus `tools/convert/`.

---

## 2. How the catalog is actually generated

```
assets/data/niches.seed.json  (38 niches, 6 families)
        │
        ├── tools/build-catalog.js ──┐   (Vercel buildCommand, --check in CI)
        │                            ├── assets/catalog-render.js  ← ONE renderer
        └── assets/sbv.js  ──────────┘      (build time + run time, cannot drift)
                 │
                 └── overlays live rows from sbv_niches + sbv_demand_counts
```

`catalog-render.js` is the shared module. `build-catalog.js` writes the finished markup
between `<!-- BUILD:* -->` markers in `index.html` — catalog, `<select>`, inline seed,
and **every masthead figure**. `sbv.js` re-renders the same markup from live DB rows.
The build **validates the seed and fails the deploy** on: duplicate slug/catalog_no, bad
family code, `open_url` without `status:open`, `website_offer` without `demo_path`, a
`demo_path` with no `index.html` on disk, and — a genuine compliance tripwire — **any
dollar figure appearing in `job_line` or `caveat`**.

Niche storefronts are a separate pipeline: `niches/<slug>/` (manifest, `sections.html`,
`sections.css`, `niche.js`, `content.json`, `scene.js`, `og.png`) → `tools/build-site.js`
→ `sites/<slug>/`. Demo brand names ("Larkspur & Ledge", "Cinder Hog BBQ") live in
`niches/<slug>/content.json` → `brand.name`. **All 32 exist.**

**Consequence for the reorg:** the seed and `catalog-render.js` are the only places a
catalog number may come from. Any figure typed into the new landing page HTML by hand
repeats the exact failure §5.1 documents.

---

## 3. Database state (queried live, project `newjbexmvltvtmxollca`)

| Table | Rows | Note |
|---|---|---|
| `sbv_niches` | 38 (38 listed) | 3 open · 10 in line · 25 website-only · 32 `website_offer` |
| `sbv_tenants` | 6 (6 active) | **all six are test rows** |
| `sbv_city_claims` | 5 active | belong to the test tenants |
| `sbv_operator_content` | 1 | `primetest` |
| `sbv_demand` | 1 | |
| `sbv_leads` | 1 | |

The DB is **in sync with the seed** — 38/3/10/25/32 matches exactly, and the three open
rows carry the same price labels. No drift to reconcile.

**Numbers that are true today and safe to print:** 32 turnkey sites · 3 live platforms ·
38 businesses listed · 6 family plates · 1 operator per city.
**Numbers that are not:** any operator, customer, city, or revenue count.

---

## 4. Page-by-page inventory

### `/` — `index.html` (80 KB)
Sections in order: `nav` → `.plate` masthead (animated board + 4-cell ledger) → `#how`
(3 steps) → `#catalog` (6 family plates, 38 cards, filter chips, `.related` band) →
`#line` (demand form) → `#proof` (2 screenshots) → `#registry` → `#founder` → `#websites`
(3 pricing tiers → `/sites/`) → `#faq` (6 Q&A) → `footer` → niche modal → exit-intent card.

Carries: Vercel Analytics, `assets/sbv.css`, EN/ES i18n (`i18n.js` + 34 KB `es.js`),
`SBV_SEED` inline, and a **Supabase email-confirmation bridge** — Supabase's Site URL
points at `/`, and an inline script consumes the auth fragment and forwards to `/sites/`.
Links out to: `/sites/`, all 32 `/sites/<slug>/`, `/demo/`, `/showcase/`, `/portfolio/`,
`/legal/*`, and the three platform domains.

### `/sites/` — `sites/index.html` (122 KB)
`nav` → dark hero → `#gallery` (32 hand-authored cards) → `.how` (3 steps) → `#contact`
(Web3Forms) → footer. **~300 lines of inline `<style>`; does not load `sbv.css`.** No i18n.
Loads `supabase-2.114.0.js` + `claim/claim.js`, which injects the territory-claim modal
(`Claim this territory` per card) and reads `sbv_claim_counts` / `sbv_public_claimed_cities`.
32 iframes armed only at ≥900 px, `loading="lazy"`. Nav still points at `/pricing/` (308).

### `/demo/` (70 KB) — **the services page in embryo**
"From Spreadsheet Chaos to a Live Operations Console." Before → how I'd fix it → live
console → outcomes → engagement model → FAQ → "I build the others too" (custom databases,
automated reports, inventory systems, operations dashboards, web design, SOPs) → contact.
**No analytics tag.** Nav → `/demo/`, `/showcase/`, `/pricing/`(308), `/portfolio/`.

### `/showcase/` (229 KB + `us-states.json` 160 KB)
"Northwind Operations Command Center" — dashboards, sites database, task board, vendor
ROI, onboarding pipeline, territory heatmap, revenue calculator, LMS. All data fictional.
**No analytics tag.** Uses `cdn.jsdelivr.net` (the only third-party CDN in the repo).

### `/portfolio/` (5.6 KB shell + `projects.json`)
Data-driven, 11 projects, category filters, own CSS/JS, own admin at `/portfolio/admin/`
(21 KB). **No analytics tag.** Live projects: Systems by Vega, Kingdom Creatives, Church
for Truckers, YourLife CC, Faith Journey, Return, Legacy Vault, Estate Sale Biz, Dom Vegz,
Operations Command Center, Prime Bin Cleaning.

### `/claim/` + `/claim/thank-you.html`
Stripe `cancel_url` and `success_url`. **Zero inbound links** (correct — Stripe sends
here) but also **zero analytics**, so the checkout funnel's most important two pages are
invisible in reporting.

### `/admin/`, `/__owner__/`, `/legal/*`
Out of scope per the brief; all load correctly. `/legal/operator-agreement.html` is
reachable only from `/legal/terms.html`.

---

## 5. What is duplicated between `/` and `/sites/`

| Thing | On `/` | On `/sites/` | Verdict |
|---|---|---|---|
| The 32 turnkey sites | 32 catalog cards, DB-driven status, links to `/sites/<slug>/` | 32 hand-authored cards with iframes, per-card feature copy, "what's included" | **Same product, two hand-maintained lists.** Merge to one data-driven render. |
| Pricing $299 / $499 / $25 mo | `#websites`, 3 tiles | repeated in **all 32** `<details>` blocks | **33 copies of one price table.** |
| "How it works" 3 steps | Pick → Claim cities → Launch (territory) | Pick → I customize → You run it (**stale**) | Two different processes. **Copy decision, not a merge.** |
| Contact / lead capture | `#line` → `/api/demand` → `sbv_demand` | `#contact` → **Web3Forms** (3rd-party) | Two systems, two destinations. |
| Nav | 5 anchors + language picker | 5 page tabs + "Hire me" + auth state | Incompatible. Global nav is a real T7 task. |
| Footer | legal + Site Shop/Showcase/Portfolio/Demo + full disclaimer | legal + Pricing/Portfolio, **no disclaimer** | `/sites/` is missing the platform disclaimer entirely. |
| Design system | `sbv.css` band system (paper/white/dark alternating) | ~300 lines inline, light paper + dark hero | Two stylesheets for one site. |
| Analytics | ✅ | ✅ | — |
| Spanish | ✅ | ❌ | Merging drops or doubles the i18n surface. |

### 5.1 Copy that is factually wrong today

On `/`, all hand-typed, all live:

| Line | Says | Truth |
|---|---|---|
| `#proof` h2 | "**Two** of these are finished." | 3 (ESB, GSB, CSB — all 200 OK) |
| `#proof` caption | "there is no third finished platform" | ConsignmentBiz is `status:open` in the same page's seed |
| `#proof` caption | "**Twenty-seven** entries" | 35 |
| `#founder` | "**Two** of them are finished and running: estatesalebiz.com and garagesalebiz.com" | omits consignmentbiz.com |
| `#founder` | "rather than list **twenty-nine** I have not built" | 35 |
| `#websites` lede | "**Twenty-three** trades, twenty-three sites already built" | 32 |
| `#websites` CTA | "See all **twenty-three** sites →" | 32 |
| `<meta description>` | "Three are open today" | ✅ correct |

Every one of these is mirrored in `assets/lang/es.js` (lines 266, 278, 308, 319, 330), so
each fix is two edits. The ledger bar directly above them prints the correct 38/3/32 —
**the page argues with itself within one scroll.**

On `/sites/`, stale process copy:
- "hosting set up — **free on GitHub Pages**" — it is Vercel, on a `*.systemsbyvega.com`
  subdomain provisioned by `stripe-webhook.mjs`.
- "**I** customize & connect it" — self-serve checkout does this now.
- Nav → `/pricing/` (308 → `/#websites`), an anchor that will not survive the reorg.

---

## 6. Risks the reorg creates (read before designing)

### 6.1 `noindex` on `/sites/` — **blocker**
```
$ curl -sI https://systemsbyvega.com/sites/
HTTP/1.1 200 OK
X-Robots-Tag: noindex
```
`vercel.json` → `headers[0]`, source `"/sites/(.*)"`, host-conditioned to the apex. The
32 storefronts *should* stay noindex (32 near-identical templates competing in search is
the failure this prevents, and `middleware.js` flips it to `all` per tenant via
`sbv_public_has_content`). But the same rule silently covers the catalog index. Narrowing
it to `/sites/([^/]+)/(.*)` — or an explicit exclusion for the index — is a required T2
sub-task, and the merged catalog needs its own `<link rel=canonical>`.

### 6.2 Things that break if `/` stops being the catalog
- **Supabase auth redirect.** The project Site URL points at `/`; the inline bridge
  script there consumes the confirmation fragment. If `/` becomes marketing, that block
  must move with the catalog or the confirm flow strands buyers. (Its own comment says
  it is "STILL A BRIDGE" and should die once `emailRedirectTo` reaches `/sites/` — this
  reorg is the moment to finish that, but it needs the Supabase **Redirect URLs**
  allowlist updated, which is a dashboard change, not a code change.)
- **`vercel.json` redirects.** `/pricing/` → `/#websites` and `/niche-landing.html` →
  `/#catalog`. Neither anchor exists on a new landing page. Retarget both to `/sites/`.
- **`#line` demand form.** Lives on `/`. `/api/demand` + `sbv_demand` + the
  `.js-line` / `data-niche` prefill hooks in `catalog-render.js` all assume a form on the
  same page as the cards. Moving the cards moves the form.
- **i18n.** `assets/lang/es.js` is 34 KB of strings keyed to `/`'s exact English. It
  translates the catalog, the FAQ, the founder block, the registry. Splitting `/` into
  two pages splits that file, and every rewritten sentence is a dead translation key.
  **Decide the Spanish scope before writing copy, not after.**
- **Inbound links.** `/` is the canonical, the OG url, the org schema `url`, and the
  target of the ad traffic the brief describes.

### 6.3 SEO gaps that exist independently
No `robots.txt`, no `sitemap.xml` (both 404). With four new indexable pages arriving,
both should be part of T7 — and the sitemap must exclude the noindexed storefronts.

### 6.4 Performance of the merged `/sites/`
32 storefronts total **3.9 MB of HTML** plus **11 MB of photos**. Today's `/sites/` arms
all 32 iframes at ≥900 px (`loading="lazy"` gates the actual fetch, but a full scroll
pulls the lot). The brief also wants a **featured-sites carousel with live iframes** on
the landing page. Two pages iframing real storefronts is a Lighthouse problem on top of
an already-heavy page. Recommend: **screenshots on `/`, iframes only on `/sites/`**, and
even there consider swapping to poster-image-until-hover.

### 6.5 The build gate
`vercel.json`'s `buildCommand` is `node tools/build-catalog.js --check`, which **fails
the deploy** if `index.html` drifts from the seed. If `/` becomes a hand-written landing
page, that command has nothing to check and the guard disappears unless
`build-catalog.js` is retargeted to the new `/sites/index.html`. Losing it is how §5.1
happens again.

---

## 7. Where the brief meets reality

### 7.1 The proof strip (§3a.6)
Brief: *"real numbers only: '32 turnkey sites', '3 live platforms', 'X operators' (pull
from DB, don't fabricate)."* The first two are true and DB-backed. **`X operators` is 0.**
All six `sbv_tenants` rows are tests. Options, in order of preference:

1. **Drop the operator count.** Print `32 turnkey sites · 3 live platforms · 38
   businesses listed · 1 operator per city`. All four are true, DB-derived, and none is
   a growth metric that shrinks under scrutiny.
2. Apply the platform's existing `FLOOR = 3` convention — `catalog-render.js` already
   refuses to print a count of 1 or 2 because "a count of one argues against the thing it
   is meant to evidence." Reuse it: render the operator count only above 3, from a
   test-excluding query. Below the floor, the tile simply is not there.
3. ~~Print 6.~~ Not an option — it is a fabricated proof claim.

Whichever we pick, **the test rows need excluding at the query level**, not by
subtracting a constant in JS.

### 7.2 The `/services/` inquiry form (§3d)
Brief: *"a `services_inquiry` source in sbv_leads, or a dedicated form that emails
info@kingdom-creatives.com via FormSubmit."*

- **`sbv_leads` will not take it.** `client_id` is `NOT NULL` with an FK to
  `sbv_tenants ON DELETE CASCADE`; `/api/submit-lead` verifies the tenant is active before
  inserting, and `sbv_leads_source_ck` allows only `('form','manual')`. A SystemsByVega
  inquiry has no tenant. Making one up pollutes the operator table that feeds the proof
  strip in §7.1.
- **`sbv_demand` will not take it either.** It requires `niche_slug` (FK) + `city_label` +
  `city_norm`, and dedupes on `(niche, email, city)`.
- **The live site uses Web3Forms, not FormSubmit** (`sites/index.html` `#contact`, access
  key `4d5cdfe7…`).

Three viable paths, cheapest first: **(a)** reuse the existing Web3Forms endpoint with a
new `subject`/`from_name` — zero backend, matches what already works; **(b)** a new
`sbv_inquiries` table + a small `/api/submit-inquiry` — durable, queryable, consistent
with the rest of the platform, one SQL file; **(c)** extend `sbv_demand.source` (it is
free text ≤40 chars) and relax `niche_slug`/`city` to nullable — cheap but bends a table
whose whole purpose is "who wants which business in which town," and would corrupt
`sbv_demand_counts`, which the catalog reads. **Recommend (b), with (a) as the fallback
if we want `/services/` shipped before any SQL runs.**

### 7.3 The featured-sites "KEEP" list (§3a.3)
The brief names bin-cleaning, landscaping, dumpster-rental, dog-walking, christmas-lights,
mechanic, estate-sale, window-cleaning. The 2026-09-06 platform inventory's hero audit
rated **bin-cleaning, landscaping, dj, dog-walking, dumpster-rental, child-care,
caregiving, personal-trainer, plumbing** as KEEP (best heroes as-built). Christmas-lights,
mechanic, estate-sale and window-cleaning were not in that KEEP set. Worth a look at the
actual demos before locking the carousel — `dj` (live canvas visualiser) and `child-care`
(dusk window vignette) are the two strongest heroes in the repo and are currently absent
from the brief's list.

### 7.4 `/work/` portfolio candidates — link check
| Project | Live? | Note |
|---|---|---|
| EstateSaleBiz · GarageSaleBiz · ConsignmentBiz | 200 · 200 · 200 | ✅ |
| YourLife CC | 200 | ✅ |
| Church for Truckers | 200 | ✅ |
| Prime Bin Cleaning | 200 | ✅ authorization on record |
| Dom Vegz | 200 | ⚠️ **needs Jason's explicit yes** (§9 Q2) |
| SiteLab | n/a | is `/sites/` itself |
| **Kingdom Creatives** | **DOWN** | DNS resolves to `24.199.117.131`; no HTTP or HTTPS response. Listed "Live" in `projects.json` today. Email on that domain is a separate service and is presumably fine — but the **parent company's own site does not load**, and `/work/` linking to it would be a credibility hit. (§9 Q3) |

---

## 8. Orphans, dead weight, and drift

- **`/claim/`, `/claim/thank-you.html`** — zero inbound links (correct: Stripe sends
  here). But zero analytics on the two highest-value pages in the funnel.
- **`/__owner__/`** — zero inbound, deliberately (noindex + no-store).
- **Analytics missing on:** `/demo/`, `/showcase/`, `/portfolio/`, `/claim/`,
  `/claim/thank-you.html`. Present on `/`, `/sites/`, `/sites/<slug>/*`, `/legal/*`,
  `/admin/`.
- **`/pricing/` referenced from `/demo/` and `/sites/` nav** — 308s to an anchor the
  reorg deletes.
- **`middleware.js` stale comment** — it explains at length that tenant pages still ship
  a baked `<meta name="robots" content="noindex">` that beats the header. They do not:
  `build-site.js` sets `ROBOTS: ''` and **zero** of the 32 built pages contain a robots
  meta. The header is the only signal now. Harmless, but the comment misleads.
- **Parent-folder strays (not deployed, not in this repo):**
  `systems-by-vega/pricing.html`, `niche-landing.html`, `domvegz.html`,
  `__prime_trunc_tmp.html`, `systems-by-vega-facebook-v2-source.html`,
  `systems-by-vega-print-v2-source.html`, plus ~10 loose JPG/PNG screenshots and
  `Systems-by-Vega-Services-Agreement.docx`. Several of the JPGs duplicate
  `portfolio/assets/img/`. The two `-source.html` marketing templates are the pattern
  `_template/marketing/` was built from and are worth keeping; the rest is scratch.
  There is also a **second git repo** at `systems-by-vega/portfolio-hub/` that appears to
  predate `systemsbyvega/portfolio/`.
- **`showcase/index.html` loads `cdn.jsdelivr.net`** — the only third-party runtime
  dependency in the deployed site.

---

## 9. Decisions I need from Jason before designing

**Q1 — Roady's boundary.** The brief bars Roady's work from `/work/` and permits one
sentence in `/about/`. Two things are live today that touch it:
  a. `/portfolio/` About names *"Vice President of Digital Strategy & Innovation at
     Roady's Truck Stops"* in full.
  b. `/showcase/` + its `projects.json` card describe the Operations Command Center as a
     demo of platforms built *"for a national retail network"* — genericized, fictional
     data ("Northwind"), no client named.
  Is (a) the sentence you want carried into `/about/` verbatim? And does (b) — a
  genericized demo, not the client's product — stay as a `/services/` capability
  demonstration, or come down entirely?

**Q2 — Dom Vegz.** Brief says do not list without your explicit yes. It is live (200) and
already in `projects.json` today. Include in `/work/` or not?

**Q3 — kingdom-creatives.com is down.** Parent company, listed "Live" in the portfolio,
and the contact email domain. Fix it, drop it from `/work/`, or list it without a link?

**Q4 — The operator count.** §7.1. My recommendation is to drop it and print the four
figures that are true. Confirm.

**Q5 — Spanish.** ES exists only on `/` and is keyed to sentences the reorg rewrites.
Options: (i) carry ES onto the new `/sites/` only, rewriting keys as copy changes;
(ii) carry ES to `/` and `/sites/` both; (iii) park ES, ship English, restore later.
This materially changes the copy workload on every page.

**Q6 — The `/demo/` and `/showcase/` pages.** They are 300 KB of good, working material
that overlaps `/services/` and `/work/` almost exactly. Fold `/demo/` into `/services/`
and `/showcase/` into a `/work/` detail panel (with redirects from the old URLs), or keep
both as standalone pages the new nav links to?

**Q7 — Dark-first.** The brief says "dark-first — the catalog and most niche demos are
dark. Keep it." Strictly, `/` runs an **alternating three-tone band system** (dark ·
white · paper · white · dark · paper · dark · white · paper · dark) whose whole design
rationale is that no tone repeats back-to-back; `/sites/` is light with a dark hero.
Should the new pages be genuinely dark-first, or extend the band system? I read the
band system as the thing worth extending, but it is your call and it sets the whole
visual direction.

---

## 10. Suggested build-order amendments

Relative to the brief's §6.4 task split, the audit adds:

- **T2 gains:** narrow the `/sites/` `noindex` header (§6.1); retarget `/pricing/` and
  `/niche-landing.html` redirects; move or retire the Supabase confirm bridge; decide
  where `#line` + `/api/demand` live; retarget `build-catalog.js --check` at whichever
  file now holds the generated catalog (§6.5).
- **T0 (new, tiny, do it first):** fix the seven wrong numbers on `/` and their Spanish
  twins (§5.1). They are wrong *today* and the fix is independent of everything else —
  no reason for it to wait on a design spec.
- **T4 gains:** pick the inquiry-form path (§7.2) and, if (b), write the SQL first.
- **T7 gains:** `robots.txt` + `sitemap.xml`; analytics on `/demo/`, `/showcase/`,
  `/portfolio/`, and both `/claim/` pages.
- **T8 gains:** an explicit iframe-budget decision for `/` vs `/sites/` (§6.4).

---

*Read-only audit. No files were modified. Awaiting Jason's answers to §9 before
brainstorming and the design spec (`docs/superpowers/specs/2026-09-10-site-reorg-design.md`).*
