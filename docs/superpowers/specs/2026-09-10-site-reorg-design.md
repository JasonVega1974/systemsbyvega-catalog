# SystemsByVega.com — Reorganization Design Spec

**Date:** 2026-09-10 · **Owner:** Jason Vega
**Brief:** 2026-09-10 site reorganization · **Audit:** `2026-09-10-site-audit.md` (approved)
**Follow-ups:** `2026-09-10-followups.md`

Jason's answers, carried through this whole document:

| | Decision |
|---|---|
| Q1 | Roady's sentence stays on `/about/` verbatim. Command Center card comes down — employer work. |
| Q2 | Dom Vegz: **include**. |
| Q3 | kingdom-creatives.com: label **offline**, hosting handled separately. |
| Q4 | **Drop** the operator count. Print only the four true figures. |
| Q5 | Spanish **parked** → F1. |
| Q6 | Fold `/demo/` into `/services/`. |
| Q7 | **Extend the three-tone band system.** Not dark-first. |
| Form | Build `sbv_inquiries` with its own SQL file. |
| A | `/showcase/` **retired** — 301 → `/services/`, files kept in the repo. |
| B | Featured six: **dj** and **child-care** in; estate-sale and window-cleaning out. |
| C | Roady's sentence in **first person**, same facts. |

**Already shipped before this spec** (approved as live-bug fixes): the `/sites/`
`noindex` narrowing and the twelve wrong homepage numbers. See §9.

---

## 1. The thesis

The site has four products and one door. After this work it has four products, one
door, and five rooms — and the door's only job is to say which room you want.

```
/            "What is this?"        →  routes you. Sells nothing directly.
/sites/      "I want one."          →  the catalog. 38 businesses, 32 buyable sites.
/platforms/  "I want the whole thing."→ ESB · GSB · CSB in depth.
/services/   "I need something built."→ custom work. Absorbs /demo/.
/work/       "Has he actually shipped?" → portfolio. Absorbs /portfolio/.
/about/      "Who is this guy?"      →  short, human, credible.
```

One sentence per page, and no page tries to do a second one's job. That is the whole
information architecture, and every layout decision below serves it.

---

## 2. Design direction

### 2.1 The band system is the identity — extend it (Q7)

`assets/sbv.css` runs three grounds and one rule: **no tone touches itself.**

```
paper   #F1F4F8      the reading ground
panel   #FFFFFF      the lifted ground
console #141821      the dark ground
```

Every component reads local tokens (`--bg`, `--surface`, `--tx`, `--acc`, …) declared
per band, so one component definition renders on all three grounds without a dark
variant. This is why the reorg extends it instead of layering a new system on top:
**every new component below is written once and works in any band.**

Band schedule per page. Read down each column; no tone repeats:

| | `/` | `/sites/` | `/platforms/` | `/services/` | `/work/` | `/about/` |
|---|---|---|---|---|---|---|
| nav | console | console | console | console | console | console |
| 1 | hero **console** | hero + ledger **console** | hero **console** | hero **console** | hero **console** | hero **console** |
| 2 | offerings **white** | disclosure + filters **paper** | ESB **paper** | the problem **paper** | filters **paper** | story **paper** |
| 3 | featured **paper** | the board **white** | GSB **white** | what I build **white** | grid **white** | what I don't do **white** |
| 4 | how it works **white** | registry **paper** | CSB **paper** | how I work **paper** | — | — |
| 5 | platforms **console** | waitlist form **white** | what's next **console** | inquiry form **white** | — | — |
| 6 | proof **paper** | FAQ **paper** | — | — | — | — |
| 7 | services teaser **white** | — | — | — | — | — |
| foot | console | console | console | console | console | console |

The nav and hero are both console on purpose — they read as one masthead unit, exactly
as `/` does today. That is not a repeat; it is the existing masthead.

### 2.2 Type — unchanged, extended

Archivo (display 600–900) · IBM Plex Sans (body 400–700) · IBM Plex Mono (labels 400–600).
Already loaded on every page. **No new families.** The mono eyebrow with its amber rule
(`.step` / `.eyebrow`) is the section marker across all six pages.

### 2.3 Family colour carries over

The six family colours (`--fam-sale-resale` … `--fam-people-pets`), already defined in
both light and dark variants, remain the catalog's organising colour. `/platforms/`
borrows `--fam-sale-resale` (house amber) because all three platforms are that family.

### 2.4 Motion, and its budget

Four devices, and nothing else:

1. **Hero sequence on `/`** — §3.1. The one real animation.
2. **Scroll reveal** — the existing `.reveal` + IntersectionObserver in `sbv.js`.
   Already reduced-motion-safe. Reused verbatim on all six pages.
3. **Card hover** — the existing `-3px` lift and amber border. Already defined.
4. **Filter re-pin** — the existing staggered sweep on `/sites/`. Already defined.

Three of the four already exist. `prefers-reduced-motion` is honoured by all of them
today and must stay honoured. No parallax, no scroll-jacking, no count-up numbers —
a ledger that animates its figures is a ledger arguing it might be lying.

### 2.5 What must NOT come along

The `/sites/` inline `<style>` block (~300 lines) is deleted; that page joins `sbv.css`.
The `/demo/` and `/portfolio/` private stylesheets are deleted with their pages. One
stylesheet after this, not four.

---

## 3. Page specs

### 3.1 `/` — the landing page

**Job:** answer "what is this?" in five seconds and route.
**Sells nothing.** Every CTA leaves for a room.

**1 · Hero** (console)

- Eyebrow: `SYSTEMS BY VEGA` · mono, amber rule.
- H1: **"I build the whole system, not the website."**
  Sub: "Turnkey local businesses, multi-tenant SaaS platforms, and custom software —
  built solo, shipped, and running today."
- Two CTAs: `Browse the catalog →` (`/sites/`) · `See what I build` (`/work/`).
- **The sequence.** A browser-chrome frame cross-fading three *real* screenshots on a
  ~9s loop: **demo storefront → the admin panel editing it → the same storefront
  rebranded.** Caption under the frame names the state ("The demo" / "Your admin" /
  "Your site"), so the mechanism is legible without motion.
  - Frame 3 must be a **genuine rebuild**, not a recolour in an image editor —
    `build-site.js` with an overridden `content.json` produces one. See §5.
  - `prefers-reduced-motion` → frame 1, static, with the three captions shown as a
    labelled 1-2-3 row instead. Not a degraded hero; a different, honest one.
  - Implementation is CSS `@keyframes` opacity on three stacked `<img>`. No JS, no
    library, no canvas.
- The existing decorative `#hero-board` tile field is **retired here** and stays on
  `/sites/`, where the tiles mean something (one per listed business).

**2 · Three offerings** (white) — three cards, each a room:

| | Turnkey websites | SaaS platforms | Custom builds |
|---|---|---|---|
| line | 32 industries, live demos, owner admin included | Run the whole operation, one operator per city | Dashboards, databases, automation |
| price | from **$299** | from **$197** | quoted |
| → | `/sites/` | `/platforms/` | `/services/` |

**3 · Featured sites** (paper) — 6 cards, **screenshots, not iframes** (audit §6.4).
Hover swaps to a second screenshot of the same site's signature interaction. Each card:
shot, demo brand name, trade, one line, `See the demo →`.

**The six (decision B):** `bin-cleaning` · `landscaping` · `dumpster-rental` ·
`dog-walking` · `dj` · `child-care`. Chosen for hero strength, and each has a signature
interaction worth the hover frame:

| Slug | Demo brand | Hover frame shows |
|---|---|---|
| bin-cleaning | Prime Bin Cleaning | the before/after drag slider |
| landscaping | Larkspur & Ledge Landscape Co. | the season wheel, switched |
| dumpster-rental | Sawtooth Dumpster Co. | the size/price picker |
| dog-walking | Bluebird & Biscuit Pet Care | the week builder |
| dj | DJ Nova | the live canvas visualiser |
| child-care | Huckleberry Sitters | the dusk-window twinkle |

`dj`'s demo path is the theme picker at `/sites/dj/`; the card links there and the shot
is taken of `/sites/dj/pink/`, which is the variant the old catalog previewed.

Footer link: `All 32 sites →`.

**4 · How it works** (white) — three steps, and they must describe the **real, current**
flow, not the retired done-for-you one:
1. **Pick a site.** 32 built and live. Click into any of them.
2. **Claim your city.** Checkout, and the registry writes the row.
3. **Log in and make it yours.** Your admin, your name, your colours — live in a minute.

**5 · Platforms band** (console) — three cards, DB-driven status and price from
`sbv_niches` (`status`, `price_label`), never typed. → `/platforms/`.

**6 · Proof** (paper) — the four true figures, per Q4:

> **32** turnkey sites · **3** live platforms · **38** businesses listed · **1** operator per city

All four from `R.figures()`. **No operator count, no revenue, no testimonial.** The
`FLOOR = 3` convention stays available if a real operator count ever clears it.

**7 · Services teaser** (white) — one paragraph, one link → `/services/`.

**8 · Footer** (console) — global; §4.4.

---

### 3.2 `/sites/` — the catalog

**Job:** the merge. This is polish, not a rebuild — the board already works.

**What moves here from old `/`:** the masthead ledger, all six family plates and 38
cards, the filter chips, `#registry`, `#line` (the demand form), `#faq`, the niche
modal, the exit card, `SBV_SEED`, and the Supabase confirm bridge (§4.3).

**What arrives from old `/sites/`:** per-card **pricing** and the **"what's included"**
disclosure, the **iframe preview**, the territory-claim modal (`claim.js`), and the
example-names disclosure.

**What is deleted:** the old `/sites/` hand-authored 32-card list — every one of those
cards is regenerated from `niches.seed.json` + `niches/<slug>/content.json`
(`brand.name` is the demo business name). **33 copies of the price table become one.**

**Card anatomy** — the existing `.entry.sheet` plate, extended:

```
┌─ staples ────────────────────────────────┐
│ [iframe preview — desktop only, lazy]    │   ← from old /sites/
│ SR · N° 006          [Website]           │   ← existing
│ Estate Sales                             │   ← existing
│ Run the sale when a whole household…     │   ← existing job_line
│ Larkspur & Ledge Landscape Co.           │   ← NEW: demo brand, from content.json
│ [Season wheel] [Booking] [Owner admin]   │   ← NEW: feature chips, from manifest
│ $299 launch-ready · $499 custom          │   ← existing
│ ▸ What's included                        │   ← NEW: <details>, ONE shared partial
│ [Claim this territory] [See the demo →]  │   ← from old /sites/
└──────────────────────────────────────────┘
```

Every new field has a source in data. **This is the constraint that governs the merge:**
`catalog-render.js` is re-rendered at runtime from `sbv_niches` rows, so any field the
markup reads must exist on those rows *or* on a build-time lookup that the runtime
re-render also has. Feature chips and demo brand name come from `manifests.json` +
`content.json`, which are static and shipped — so `sbv.js` can hold them in a lookup
keyed by slug and survive the repaint. **No new database columns.**

**Sections in order:** hero + ledger (console) → example-names disclosure + filter chips
(paper) → the six family plates (white) → registry (paper) → `#line` waitlist form
(white) → FAQ (paper) → footer.

**The related-products band** stays but points at `/platforms/`, not the external
domains (brief §3b).

**Naming.** This page holds 38 businesses, of which 32 are buyable websites. The
landing sells "32 turnkey sites"; the catalog's `Website` filter chip *is* that 32.
Keep the `/sites/` URL — link equity, the demo banner on all 32 storefronts points
here, and the brief specifies it.

**Compliance — unchanged and non-negotiable:** the "nearly every business name is an
example" disclosure, the non-franchise paragraph, the FAQ's "How much can I make?"
answer, and the footer disclaimer all move across **verbatim**. The Prime Bin Cleaning
exception line stays.

---

### 3.3 `/platforms/`

**Job:** proof of depth. Three platforms, expandable to more.

Hero (console): "Three businesses you can run, not three websites you can buy."
Then one full-width block per platform, alternating paper/white:

- Real screenshot (§5), sized like the `/` proof shots.
- Two sentences on what it does.
- One sentence on who it is for.
- **Status and price from `sbv_niches`** — `status`, `price_label`, and territory
  availability. Never typed.
- `Open estatesalebiz.com →`.

Closing band (console): "What's next" — the 10 `in_line` businesses, rendered from the
seed, linking to `/sites/#line`. This is where the waitlist story lives for someone who
came for platforms.

**Copy posture:** these are tools that run a business. No income claims, no earnings
projections, no "operators are making…". The `/sites/` FAQ answer on earnings is
mirrored here in one line with a link.

---

### 3.4 `/services/` — absorbs `/demo/` (Q6)

`/demo/` is 70 KB of on-voice, working copy. This page is **its content, re-banded and
extended** — not a fresh write.

**Reused from `/demo/` nearly verbatim:** the "everything important lives in a file
someone can overwrite by accident" opener, the four-point "how I'd fix it" grid, the
FAQ (existing data / IT staff / timeline), and the capability list.

**Sections:**

1. Hero (console) — "You don't need a template. You need the thing built."
2. The problem (paper) — from `/demo/` §01.
3. **What I build** (white) — five blocks, per brief §3d:
   - **Custom platforms** — "I built EstateSaleBiz from scratch. I can build yours."
     Multi-tenant, Stripe, Supabase, provisioning, admin panels.
   - **Dashboards & internal tools** — operational dashboards, command centers,
     reporting. **Category described, no client named** (Q1).
   - **Database design & migration** — Supabase/Postgres schema, RLS, migrations,
     moving off WordPress or legacy.
   - **Automation & integrations** — webhooks, Brevo email pipelines, scheduled jobs,
     API integrations.
   - **Websites** — when a template genuinely fits, that is `/sites/` and it is cheaper.
     Saying so here is a credibility move, not a lost sale.
4. **How I work** (paper) — brief → spec → plan → build → review → ship. Stated plainly,
   including that AI agents do the heavy lifting, **as a process fact**: it is why the
   work is fast and the price is what it is. No "AI-powered" language anywhere.
5. **Inquiry form** (white) — §6.
6. Footer.

**No live Command Center demo on this page** (Q1). The dashboards block describes the
category in words. `/showcase/` is retired and 301s here (decision A); its files stay
in the repo and are removed from the nav and from every inbound link.

---

### 3.5 `/work/`

**Job:** credibility. A filterable grid, which the existing `/portfolio/` already does
well — its `projects.json` + filter JS is the right pattern and carries over.

Card: screenshot, name, one line, tech-stack tags, status pill, link. Click opens a
detail panel (existing modal pattern from `sbv.js`) with more shots and a short write-up.

**The roster:**

| Project | Status pill | Link | Note |
|---|---|---|---|
| EstateSaleBiz | Live | ✓ | multi-tenant SaaS, Stripe, Supabase |
| GarageSaleBiz | Live | ✓ | multi-tenant SaaS |
| ConsignmentBiz | Live | ✓ | multi-tenant SaaS |
| SiteLab | Live | → `/sites/` | 32 niches, operator admin, marketing kit |
| YourLife CC | Live | ✓ | faith + family PWA, offline-first, parent/child accounts |
| Church for Truckers | Live | ✓ | Next.js, Pastor Portal, migrated off WordPress |
| Prime Bin Cleaning | Live | ✓ | real local operator; authorization on record |
| Dom Vegz | Live | ✓ | **Q2 = yes**; artist site, admin + YouTube sync |
| Kingdom Creatives | **Offline** | **none** | **Q3**: listed, labelled, not linked |

**Removed:** the Operations Command Center card (Q1).
**Not listed, ever:** Interstate V2, Command Center, GS Travel Planner.

The `Offline` pill is a real status in the same set as `Live` — greyed, not amber, and
the card carries no outbound link. Listing something as live that does not load is the
credibility problem; labelling it honestly is not.

---

### 3.6 `/about/`

Short. One column, ~400 words.

1. Hero (console) — "One person, in Nampa, Idaho."
2. Story (paper) — who Jason is, why SystemsByVega exists, Kingdom Creatives as parent,
   the faith dimension, photo if provided.
   **The Roady's sentence, per Q1 + decision C** — same facts, first person:
   > "By day I'm Vice President of Digital Strategy & Innovation at Roady's Truck
   > Stops, leading digital for a national truck-stop network since 2019 — that
   > operator's instinct shapes everything I build on my own."

   This is the **only** mention of Roady's anywhere on the site. It names an employer
   and a role; it describes no project, product, or system built for them.
3. What I don't do (white) — the existing `#founder` disclaimer paragraph, **verbatim**:
   no client-finding, no job-booking, no income claims, "you could lose money on this."
   This is the most important paragraph on the site and it moves unedited.

---

## 4. Global systems

### 4.1 Navigation

Six destinations is too many for 390 px, so the nav is two-tier by width:

- **≥900 px:** brand · Sites · Platforms · Services · Work · About · `Get in line` (amber CTA).
- **<900 px:** brand · `Get in line` · hamburger → full-height console drawer, the five
  links at 20 px, 48 px tap targets, focus trapped, Esc closes.

Current state on both pages is a wrapping link row with no drawer — this is new work
(T7), not a port. Active page marked with the existing `.nav-tab.active` amber wash.

The language picker is **removed** from the nav while Spanish is parked (F1), not
hidden — a picker with one option is worse than none.

### 4.2 Redirect map

Nothing that used to work may 404.

| From | To | Code |
|---|---|---|
| `/demo/` | `/services/` | 301 |
| `/portfolio/` | `/work/` | 301 |
| `/pricing/` | `/sites/` | 301 *(was `/#websites` — anchor is gone)* |
| `/niche-landing.html` | `/sites/` | 301 *(was `/#catalog`)* |
| `/#catalog`, `/#websites` | `/sites/` | client-side hop on `/`, since servers never see the fragment |
| `/showcase/` | `/services/` | 301 *(decision A — files kept in the repo, page retired)* |

The fragment redirects need a small script on `/`: a bare `location.hash` check that
forwards the two known legacy anchors. Three lines, and it retires once the ad
creatives stop carrying them.

### 4.3 The Supabase confirm bridge — **needs a dashboard change by Jason**

The auth-confirmation bridge script moves from `/` to `/sites/`. That only works once
the Supabase project's **Site URL** and **Redirect URLs** allowlist include
`https://systemsbyvega.com/sites/`. **I cannot make that change** — it is a dashboard
setting. Until it lands, the bridge must stay on `/` as well as `/sites/`.

Sequence: (1) add the allowlist entry, (2) deploy the reorg with the bridge on both
pages, (3) verify a real confirmation lands on `/sites/`, (4) delete the copy on `/`.
`claim.js` already sends the correct `emailRedirectTo`.

### 4.4 Footer

One footer, every page. Brand line · contact · the five room links · legal (Terms,
Privacy, Refund, Operator Agreement) · **the platform disclaimer paragraph verbatim**,
carrying its `data-i18n-skip`. Old `/sites/` shipped no disclaimer at all — that gap
closes.

### 4.5 Analytics, robots, sitemap

Vercel Analytics tag on all six pages plus the two `/claim/` pages (F5). `robots.txt`
allowing everything except `/sites/<slug>/`, `/admin/`, `/__owner__/`, `/claim/`.
`sitemap.xml` listing exactly the six public pages and the four legal pages — and
**excluding the 32 storefronts**, which remain noindex.

---

## 5. Screenshots

**Real screenshots, never mockups** (brief §4). New tool: `tools/build-shots.js`.

**Run locally, commit the output.** Not at Vercel build time: the build command is
currently a fast `--check`, and adding headless Chromium to it would slow every deploy
to serve assets that change perhaps monthly. `playwright-core` and
`@sparticuz/chromium` are **already dependencies** (`api/marketing-kit.mjs` uses them),
so this adds no new package.

```
node tools/build-shots.js              # all targets
node tools/build-shots.js --only work  # one group
```

Output → `assets/shots/<group>/<name>.jpg`, 1280×800, quality 78, ~90–120 KB each.

| Group | Count | Targets |
|---|---|---|
| `hero` | 3 | demo storefront · admin editing it · same storefront rebuilt under a new brand |
| `featured` | 12 | 6 niches × (default + signature interaction) for the hover swap |
| `platforms` | 3 | ESB · GSB · CSB *(CSB already captured — see §9)* |
| `work` | 8 | the eight linked portfolio entries |

Total ≈ 26 shots ≈ 2.6 MB in the repo, but **no page loads more than its own group**,
and every shot below the fold is `loading="lazy"` with explicit `width`/`height` so
nothing shifts.

**Hero frame 3 must be a real rebuild.** `build-site.js` accepts `--out`, so:
build a niche to a scratch directory with an overridden `content.json` (different
`brand.name`, colours, city), screenshot it, discard the directory. The frame shows a
site that actually existed, which is the entire point of the section.

**Kingdom Creatives gets no shot** (offline, Q3). Its card uses a typographic placard
in the family colour instead — the same device `/` used for its missing third platform
before ConsignmentBiz filled it.

---

## 6. `sbv_inquiries` — `sql/INQUIRIES.sql`

Modelled on `sql/LEADS.sql`, which already solved this exact problem for operator leads.
**The audit ruled out `sbv_leads`** (`client_id NOT NULL` → `sbv_tenants`) and
`sbv_demand` (`niche_slug` FK + city + a dedupe index the catalog counts).

**Who writes:** nobody in the browser. `/api/submit-inquiry` inserts with the
service-role key. **No anon policy and no anon grant** — a public key must never write
into an inbox table, or it becomes a spam target with a free API. Same reasoning as
`LEADS.sql`, and it is why `sbv_demand` (the one genuinely public write surface) stays
the only one.

```
sbv_inquiries
  id            uuid pk
  name          text not null   (2..120)
  email         text not null   (email regex, <=254)
  company       text            (<=160)
  project       text not null   (10..4000)   -- "what are you trying to build"
  budget_range  text            (check in a fixed list, nullable — optional per brief)
  source        text not null default 'services'  (<=40)
  status        sbv_inquiry_status not null default 'new'   -- new | replied | closed
  created_at    timestamptz not null default now()
  deleted_at    timestamptz          -- deletion is an UPDATE, never a DELETE
```

- **No DELETE policy, no delete grant.** Same as `sbv_leads`: losing a record of someone
  who asked for work to a mis-tap is worse than keeping a hidden row forever.
- **Rate limit** per IP per hour, counted from the table itself, in the API.
- **Honeypot** field, silently accepted and dropped — the `submit-lead.mjs` pattern.
- **Idempotent**: create-if-not-exists; every constraint and policy dropped or guarded
  before creation, safe to re-run against a table holding real rows.
- **Verify block**: plain schema inspection only — **no temp tables, no role switching,
  no transaction.** `LEADS.sql`'s header records why: the SQL editor auto-commits each
  statement and may run them on different pooled sessions, so session state does not
  survive and both earlier attempts died with `42P01`.
- **Reads** go through `/__owner__/` with the service role. No operator-facing surface —
  these are Jason's inquiries, not a tenant's.

`budget_range` is the *buyer's* budget. It is not an earnings figure and creates no
income-claim exposure, but the form must not imply a return of any kind — no "typical
project pays for itself in…" language.

---

## 7. Forks — settled 2026-09-10

**A — `/showcase/` is retired.** 301 → `/services/`. **The files stay in the repo**;
nothing is deleted. Removed from the nav and from every inbound link (`/`, `/sites/`,
`/demo/`). `/services/` describes the dashboards category in words, per brief §3d.
Rationale: the reasoning that removed the `/work/` card — employer work — covers the
demo page it was a card for.

**B — the featured six.** `bin-cleaning` · `landscaping` · `dumpster-rental` ·
`dog-walking` · `dj` · `child-care`. Table and hover frames in §3.1. Estate-sale and
window-cleaning drop off; christmas-lights is seasonal and better promoted in November
than carried year-round.

**C — the Roady's sentence** runs in first person, same facts, as set in §3.6. It is
the only mention of Roady's on the site.

---

## 8. Task split

Revised from the brief's §6.4 with the audit's additions.

| | Task | Depends on |
|---|---|---|
| **T1** | `/` landing — hero sequence, offerings, featured, how, platforms band, proof | T5 shots |
| **T2** | Catalog consolidation into `/sites/` — merge, retarget `build-catalog.js`, move the confirm bridge, redirects | §4.3 dashboard change |
| **T3** | `/platforms/` | T5 shots |
| **T4** | `/services/` — absorb `/demo/`, build `sql/INQUIRIES.sql` + `/api/submit-inquiry` | — |
| **T5** | `tools/build-shots.js` + capture all four groups | — |
| **T6** | `/work/` + `/about/` | T5 shots |
| **T7** | Global nav + footer + analytics + `robots.txt` + `sitemap.xml` | T1–T6 |
| **T8** | Mobile pass at 390 px, Lighthouse ≥90 mobile, a11y sweep (`tools/a11y-sweep.js`) | T7 |
| **T9** | Redirect + link audit — nothing that worked 404s | T7 |

**T5 moves early** — four tasks are blocked on screenshots, so it runs first, not fifth.

---

## 9. Already done (approved as live-bug fixes, 2026-09-10)

Committed ahead of this spec at your instruction:

1. **`vercel.json`** — `/sites/(.*)` → `/sites/(.+)`. One character. `(.*)` matched
   `/sites/` with an empty capture and put `noindex` on the catalog index; `(.+)`
   cannot. Verified against all 10 real path shapes: `/sites/` loses the header, every
   storefront path keeps it.
2. **`index.html`** — twelve corrections, not seven. The audit's list missed five:
   "Two you can buy today", "Click either one", "the two businesses that are open",
   "click into both", and the third proof cell itself. Plus the four inert filter-chip
   fallbacks, corrected for accuracy though `applyFilter()` overwrites them from the
   DOM before the bar unhides.
3. **`assets/proof/consignmentbiz.jpg`** — a real 1280×800 capture of the live site.
   "Three of these are finished" needed a third cell; the old cell said *"there is no
   third finished platform."* The "Everything else / thirty-five entries" honesty note
   moved below the row, keeping the device intact.

Verified: build gate passes in LF form (exit 0), no mixed line endings introduced, all
three proof images load, ledger 38/3/32/1 agrees with chips 38/3/10/25 and with every
sentence on the page.

Spanish for these strings now falls back to correct English by design (`i18n.js:102`) —
logged as F1.

---

## 10. Compliance checklist — applies to every page

Non-negotiable, carried from every prior brief:

- [ ] Zero income, revenue, profit, or results claims. Anywhere.
- [ ] Non-franchise language preserved: own business name, no royalty, no franchise fee,
      no control over how operators work.
- [ ] "Nearly every business name is an example" disclosure on the catalog, with the
      Prime Bin Cleaning exception.
- [ ] Footer disclaimer paragraph on all six pages, `data-i18n-skip` intact.
- [ ] "You could lose money on this" survives verbatim on `/about/`.
- [ ] No number printed anywhere that is not derived from the seed or the database.
- [ ] No fabricated proof: no operator count, no testimonials that do not exist, no
      screenshot of a thing that is not running.
- [ ] Pricing untouched — $299 / $499 / $25 mo / $497 / $249 / $197. No Stripe product
      changes.
- [ ] Roady's work never appears in `/work/`.

---

*Spec approved 2026-09-10, all forks settled. Next: implementation plan.*
