# SystemsByVega.com Reorganization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn systemsbyvega.com from two competing catalogs into one marketing site with six pages, each answering exactly one visitor question.

**Architecture:** Static HTML/CSS/JS on Vercel, no framework, no bundler. Shared chrome (nav, footer) and all catalog markup are injected at build time between `<!-- BUILD:* -->` markers by Node scripts — the pattern `tools/build-catalog.js` already uses — so no string that a person could mistype lives in two files. One stylesheet (`assets/sbv.css`) and its three-tone band system serve every page. A new `tools/check-pages.js` gate runs in CI and fails the deploy on a structural or compliance regression.

**Tech Stack:** Vanilla HTML/CSS/JS · Node (CommonJS `.js`, ESM `.mjs` — see below) · Supabase/PostgREST · Vercel (Edge middleware, functions, redirects) · `playwright-core` + `@sparticuz/chromium` (already dependencies)

**Spec:** `docs/superpowers/specs/2026-09-10-site-reorg-design.md`
**Audit:** `docs/superpowers/specs/2026-09-10-site-audit.md`
**Follow-ups:** `docs/superpowers/specs/2026-09-10-followups.md`

---

## Setup (do this once, before Task 1)

```bash
cd systemsbyvega
git checkout -b feat/site-reorg
```

All tasks commit to `feat/site-reorg`. `main` currently carries three approved
hotfix/doc commits (`10f1035`, `03708ce`, `6250ba5`) that must be in this branch's
ancestry — they are, if you branch from `main` now.

---

## Global Constraints

Every task's requirements implicitly include all of these. Values are copied verbatim
from the spec; do not paraphrase them into a page.

**Module system.** `package.json` must NOT gain `"type": "module"`. `.js` is CommonJS,
`.mjs` is ESM. `tools/build-catalog.js`, `api/demand.js`, `api/digest.js` and
`api/owner.js` are CommonJS and the flag breaks the Vercel build. New build tools are
`.js` (CommonJS); new API functions are `.mjs` (ESM).

**No hand-typed counts.** Every figure on every page derives from
`assets/data/niches.seed.json` via `assets/catalog-render.js` (`R.figures()`), or from
`sbv_niches` at runtime. `tools/check-pages.js` enforces this (Task 1).

**The four true figures**, and no fifth:
`32` turnkey sites · `3` live platforms · `38` businesses listed · `1` operator per city.
**No operator count** — all six `sbv_tenants` rows are test data.

**Zero income claims.** No revenue, profit, earnings, ROI, "typical results", or
payback-period language anywhere. No testimonial that does not exist. No screenshot of
anything not actually running.

**Non-franchise language preserved**, verbatim where it exists today: operators use
their own business name, pay no royalty and no franchise fee, and SystemsByVega
exercises no control over how they operate.

**Required strings** (Task 1 asserts each):
- Footer disclaimer paragraph, on all six pages, carrying `data-i18n-skip`:
  > Systems by Vega provides software, documents, and training. It does not provide clients, leads, or locations, and makes no representation about income, revenue, profit, or results. Operators are independent businesses, not franchisees, employees, or agents of Kingdom Creatives LLC. Nothing on this site is legal, tax, or insurance advice.
- On `/sites/` only, the example-names disclosure, including the sentence:
  > One exception: **Prime Bin Cleaning** is a real operator running on this exact template.
- On `/about/` only, verbatim from today's `#founder`:
  > **What I do not do.** I do not find your clients, book your jobs, or run your business. I do not tell you what to charge, and I make no claim about what you will earn. Some operators never book a job. You could lose money on this. It is a set of tools and a protected patch of ground, not a job offer.

**Roady's** appears in exactly one place on the site: the `/about/` sentence in Task 8.
It names an employer and a role and describes no project. Interstate V2, Command Center
and GS Travel Planner never appear anywhere.

**Pricing is frozen.** `$299` / `$499` / `$25/mo` / `$497` / `$249` / `$197`. No Stripe
product changes.

**Motion.** Every animation honours `prefers-reduced-motion: reduce`. Reduced motion
must yield a *different honest* presentation, never a broken or empty one.

**Mobile-first.** Every page correct at 390px. No horizontal overflow at 360px.

**Shared `assets/sbv.js` (Ruling R3).** Five tasks append to this one file, and all six
pages load it. Every addition must (a) register its own `wireX()` / `paintX()` call in
`boot()`, and (b) return early if its root element is absent — otherwise a function
written for one page throws on the other five.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `tools/lib/inject.js` | The `BUILD:` marker splice, extracted so three tools share one implementation |
| `tools/check-pages.js` | Structural + compliance gate over the marketing pages. Runs in CI |
| `tools/build-chrome.js` | Injects shared nav + footer into every page carrying the markers |
| `tools/build-shots.js` | Captures every screenshot with playwright-core; run locally, output committed |
| `sql/INQUIRIES.sql` | `sbv_inquiries` table, RLS, verify block |
| `api/submit-inquiry.mjs` | Service-role insert for the `/services/` form |
| `services/index.html` | The custom-work page. Absorbs `/demo/` |
| `platforms/index.html` | ESB · GSB · CSB |
| `work/index.html` | Portfolio grid |
| `work/projects.json` | Portfolio data, ported and edited from `portfolio/assets/data/projects.json` |
| `about/index.html` | Who Jason is |
| `robots.txt`, `sitemap.xml` | Generated by `tools/build-chrome.js` |
| `assets/shots/**` | Committed screenshots |

**Modified:** `index.html` (rebuilt as the landing page) · `sites/index.html` (absorbs the
board) · `assets/sbv.css` (new components) · `assets/sbv.js` (chrome behaviour, featured
carousel) · `assets/catalog-render.js` (card extensions) · `tools/build-catalog.js`
(retarget + share `inject`) · `tools/a11y-sweep.js` (cover marketing pages) ·
`vercel.json` (buildCommand, redirects) · `middleware.js` (stale comment, F4)

**Retired, files kept:** `demo/index.html`, `showcase/index.html`, `portfolio/**` — all
301 to their successors. **Delete nothing.**

---

## Task 1: The page gate

The plan's test harness. Everything after this task has a real red/green cycle.

**Files:**
- Create: `tools/lib/inject.js`
- Create: `tools/check-pages.js`
- Modify: `tools/build-catalog.js:36-45` (use the shared `inject`)

> **Ruling R2:** this task does **not** touch `vercel.json`. Task 2 Step 7 wires both
> gates into `buildCommand` in a single edit.

**Interfaces:**
- Produces: `inject(html, marker, value) -> string` (CommonJS, `tools/lib/inject.js`)
- Produces: `tools/check-pages.js` — exit 0 clean, exit 1 on any failure, `--list` prints registered routes
- Produces: `PAGES` array in `check-pages.js`. **Every later page task adds its route here — that registration is that task's failing test.**

- [ ] **Step 1: Extract the marker splice**

Create `tools/lib/inject.js` with the exact logic currently inside `build-catalog.js`:

```js
'use strict';
/* The BUILD: marker splice, shared by build-catalog.js and build-chrome.js.
   Lifted verbatim from build-catalog.js so the two tools cannot drift on
   what a marker means or how a malformed one fails. */
function inject(html, marker, value) {
  const open  = `<!-- BUILD:${marker} -->`;
  const close = `<!-- /BUILD:${marker} -->`;
  const i = html.indexOf(open);
  const j = html.indexOf(close);
  if (i === -1 || j === -1) throw new Error(`marker BUILD:${marker} not found`);
  if (j < i) throw new Error(`marker BUILD:${marker} is inverted`);
  return html.slice(0, i + open.length) + value + html.slice(j);
}
module.exports = { inject };
```

- [ ] **Step 2: Write the gate, registering only the two pages that exist**

Create `tools/check-pages.js`. `PAGES` starts with `/` and `/sites/` only.

```js
#!/usr/bin/env node
'use strict';
/* check-pages.js — structural and compliance gate over the marketing pages.
 *
 * WHY THIS EXISTS. build-catalog.js already proves no catalog COUNT is typed
 * by hand. This proves the rest: that every page carries the disclaimer, the
 * analytics tag, a canonical, and the shared chrome — and that no page carries
 * a forbidden string. The failure it exists to prevent is the one the audit
 * found: prose drifting away from data with nothing watching.
 *
 * Static text inspection only. No browser, no network. a11y-sweep.js owns the
 * rendered checks.
 *
 *   node tools/check-pages.js          exit 0 clean, 1 on failure
 *   node tools/check-pages.js --list   print registered routes
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

/* Every public marketing page. A page task is not done until its route is
   here and this file exits 0. */
const PAGES = [
  { route: '/',       file: 'index.html'       },
  { route: '/sites/', file: 'sites/index.html' },
];

const DISCLAIMER = 'makes no representation about income, revenue, profit, or results';

/* Ruling R9 — sentences that legitimately contain a banned substring BECAUSE
   they are the disclaimer of that very thing. Stripped before the FORBIDDEN
   scan, or the gate flags the copy that exists to protect us: "I make no claim
   about what you will earn" contains "you will earn".
   Whole sentences only, never fragments — an over-broad entry here would hide
   a real claim, and this list is meant to be auditable at a glance. */
const EXEMPT = [
  'I make no claim about what you will earn',
  'makes no representation about income, revenue, profit, or results',
  'We will not answer that, and you should be wary of anyone who does',
];

/* Substrings no page may contain. Each carries the reason, because a future
   reader deserves to know why a string is banned rather than guessing. */
const FORBIDDEN = [
  ['Interstate V2',    'employer work — never on this site'],
  ['GS Travel Planner','employer work — never on this site'],
  ['Command Center',   'employer work — the /work/ card was removed'],
  ['AI-powered',       'buzzword; /services/ states the process as fact instead'],
  ['guaranteed income','income claim'],
  ['you will earn',    'income claim'],
  ['average operator', 'income claim + fabricated proof'],
];

/* Spelled-out counts that were wrong on the homepage for months. Banning the
   words is cruder than checking the numbers, and that is the point: a count
   belongs in data, so a spelled-out one in prose is the bug. */
const BANNED_COUNTS = [
  'twenty-three sites', 'twenty-three trades', 'twenty-seven entries',
  'twenty-nine I have not built', 'Two of these are finished',
];

/* Ruling R5: failures are counted PER PAGE as well as in total, so a page
   that just failed a check cannot also print an "ok" line. A gate whose own
   output contradicts itself is the exact failure this project exists to fix. */
let failures = 0;
let pageFailures = 0;
const bad = (route, msg) => { failures++; pageFailures++; console.log(`  FAIL  ${route}  ${msg}`); };
const ok  = (route, msg) => console.log(`  ok    ${route}  ${msg}`);

if (process.argv.includes('--list')) {
  PAGES.forEach(p => console.log(p.route + '  ' + p.file));
  process.exit(0);
}

for (const page of PAGES) {
  pageFailures = 0;
  const abs = path.join(ROOT, page.file);
  if (!fs.existsSync(abs)) { bad(page.route, `missing file ${page.file}`); continue; }
  const html = fs.readFileSync(abs, 'utf8');

  if (!html.includes(DISCLAIMER)) bad(page.route, 'footer disclaimer missing');
  if (!/data-i18n-skip/.test(html)) bad(page.route, 'disclaimer missing data-i18n-skip');
  if (!html.includes('/_vercel/insights/script.js')) bad(page.route, 'analytics tag missing');
  if (!/<link rel="canonical" href="https:\/\/systemsbyvega\.com/.test(html))
    bad(page.route, 'canonical missing or not absolute');
  if (!/<!-- BUILD:NAV -->/.test(html))    bad(page.route, 'no BUILD:NAV marker');
  if (!/<!-- BUILD:FOOTER -->/.test(html)) bad(page.route, 'no BUILD:FOOTER marker');

  /* Strip the exempt sentences before scanning (Ruling R9). */
  let scan = html;
  for (const e of EXEMPT) scan = scan.split(e).join('');

  for (const [s, why] of FORBIDDEN) {
    /* /about/ is the one page allowed to name the employer, and only as a
       role. The card and the demo page are gone; the sentence stays. */
    if (s === 'Command Center' && page.route === '/about/') continue;
    if (scan.includes(s)) bad(page.route, `forbidden string "${s}" — ${why}`);
  }
  for (const s of BANNED_COUNTS) {
    if (html.includes(s)) bad(page.route, `stale hand-typed count "${s}"`);
  }
  if (pageFailures === 0) ok(page.route, 'structure + compliance');
}

console.log(failures ? `\n${failures} failure(s)` : `\n${PAGES.length} page(s) clean`);
process.exit(failures ? 1 : 0);
```

- [ ] **Step 3: Run it — expect FAIL**

```bash
node tools/check-pages.js
```
Expected: **FAIL** on both routes — neither page has `BUILD:NAV` / `BUILD:FOOTER` yet,
and `sites/index.html` has no `data-i18n-skip` disclaimer. This is the red state Task 2
turns green.

- [ ] **Step 4: Point `build-catalog.js` at the shared inject**

In `tools/build-catalog.js`, delete the local `inject` function (lines ~36-45) and add
near the other requires:

```js
const { inject } = require('./lib/inject');
```

- [ ] **Step 5: Verify the catalog build is unchanged**

```bash
node tools/build-catalog.js --check
```
Expected: `index.html is in sync with the seed.` exit 0.

**On Windows this reports drift — that is F2, not a regression.** Verify the real
result the way CI will see it, by injecting into the committed LF blob and comparing
bytes (**Ruling R10** — `git stash` does *not* work here: a file that is not part of
your diff is not rewritten by stashing, so the check still fails):

```bash
node -e "
const fs=require('fs'),cp=require('child_process'),path=require('path');
const R=require('./assets/catalog-render.js'), {inject}=require('./tools/lib/inject');
const seed=JSON.parse(fs.readFileSync('assets/data/niches.seed.json','utf8'));
const before=cp.execSync('git show HEAD:index.html',{encoding:'utf8',maxBuffer:1e8});
const f=R.figures(seed.niches);
let h=before;
h=inject(h,'THESIS_OPEN',R.thesisOpen(f.open));
h=inject(h,'TOTAL',String(f.total));
h=inject(h,'OPEN',String(f.open));
h=inject(h,'SITES',String(f.sites));
h=inject(h,'CATALOG','\n'+R.catalog(seed.families,seed.niches,{})+'\n');
h=inject(h,'NICHE_SELECT','\n'+R.nicheSelect(seed.niches)+'\n');
h=inject(h,'SEED_SCRIPT','\n<script>window.SBV_SEED='+JSON.stringify({families:seed.families,niches:seed.niches})+';</script>\n');
console.log(h===before?'ok    shared inject() is byte-identical to the old inline one'
                      :'FAIL  shared inject() changed the output');
"
```
Expected: `ok    shared inject() is byte-identical to the old inline one`

- [ ] **Step 6: Commit**

```bash
git add tools/lib/inject.js tools/check-pages.js tools/build-catalog.js
git commit -m "feat(tools): add the marketing-page structure and compliance gate

check-pages.js proves what build-catalog.js does not: that every page
carries the disclaimer, the analytics tag, a canonical and the shared
chrome, and that no page carries a forbidden string or a spelled-out
count. The audit found prose drifting from data with nothing watching;
this is the thing that watches.

Registered for / and /sites/ only. Each page task adds its own route,
and that registration is the task's failing test.

inject() moves to tools/lib/ so build-catalog and build-chrome cannot
disagree about what a BUILD: marker means."
```

---

## Task 2: Shared chrome — nav and footer

**Files:**
- Create: `tools/build-chrome.js`
- Modify: `assets/sbv.css` (append the `.gnav` block)
- Modify: `assets/sbv.js` (append the drawer behaviour)
- Modify: `index.html`, `sites/index.html` (insert the markers)
- Modify: `vercel.json` (`buildCommand`)

**Interfaces:**
- Consumes: `inject` from `tools/lib/inject.js` (Task 1)
- Produces: `<!-- BUILD:NAV -->…<!-- /BUILD:NAV -->` and `<!-- BUILD:FOOTER -->…<!-- /BUILD:FOOTER -->` — **every page task inserts this exact marker pair and runs `node tools/build-chrome.js`**
- Produces: `NAV` array in `build-chrome.js` — the five rooms plus the CTA
- Produces: `.gnav`, `.gnav-drawer`, `.gfoot` CSS classes
- Produces: `robots.txt` and `sitemap.xml`, regenerated on every chrome build

- [ ] **Step 1: Add the routes to `check-pages.js` expectations**

No edit needed — Task 1 already asserts both markers. Task 1 ended red; this task
turns it green.

- [ ] **Step 2: Write `tools/build-chrome.js`**

```js
#!/usr/bin/env node
'use strict';
/* build-chrome.js — one nav and one footer, injected into every page.
 *
 * There is no templating engine here and there will not be one. The repo
 * already has a mechanism for "this markup is generated, do not edit it by
 * hand" — the BUILD: markers build-catalog.js writes between — so shared
 * chrome uses the same one rather than introducing a second idea.
 *
 * Also emits robots.txt and sitemap.xml, because both are derived from the
 * same PAGES list and a sitemap that disagrees with the nav is its own bug.
 *
 *   node tools/build-chrome.js           write
 *   node tools/build-chrome.js --check   verify, write nothing (CI-safe)
 */
const fs = require('fs');
const path = require('path');
const { inject } = require('./lib/inject');

const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const ORIGIN = 'https://systemsbyvega.com';

/* The five rooms. Order is the visitor's likely journey, not alphabetical. */
const NAV = [
  { href: '/sites/',     label: 'Sites'     },
  { href: '/platforms/', label: 'Platforms' },
  { href: '/services/',  label: 'Services'  },
  { href: '/work/',      label: 'Work'      },
  { href: '/about/',     label: 'About'     },
];

/* Every page that gets chrome. `indexable` drives robots.txt and sitemap.xml.
   Add a route here in the same commit that creates its file. */
const PAGES = [
  { route: '/',       file: 'index.html',       indexable: true },
  { route: '/sites/', file: 'sites/index.html', indexable: true },
];

const LEGAL = [
  ['/legal/terms.html', 'Terms'], ['/legal/privacy.html', 'Privacy'],
  ['/legal/refund.html', 'Refund'], ['/legal/operator-agreement.html', 'Operator Agreement'],
];

const DISCLAIMER =
  'Systems by Vega provides software, documents, and training. It does not provide ' +
  'clients, leads, or locations, and makes no representation about income, revenue, ' +
  'profit, or results. Operators are independent businesses, not franchisees, ' +
  'employees, or agents of Kingdom Creatives LLC. Nothing on this site is legal, ' +
  'tax, or insurance advice.';

function nav(active) {
  const links = NAV.map(n =>
    `<a class="gnav-link${n.href === active ? ' is-active' : ''}" href="${n.href}"` +
    `${n.href === active ? ' aria-current="page"' : ''}>${n.label}</a>`).join('');
  return `
<a class="skip" href="#main">Skip to content</a>
<nav class="gnav" aria-label="Main">
  <div class="gnav-in">
    <a class="gnav-brand" href="/"><span class="sq" aria-hidden="true">V</span> Systems by Vega</a>
    <div class="gnav-links">${links}</div>
    <div class="gnav-tools">
      <a class="btn btn-pri gnav-cta" href="/sites/#line">Get in line</a>
      <button type="button" class="gnav-burger" id="gnav-burger"
              aria-expanded="false" aria-controls="gnav-drawer" aria-label="Menu">
        <span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>
      </button>
    </div>
  </div>
  <div class="gnav-drawer" id="gnav-drawer" hidden>${links}
    <a class="btn btn-pri" href="/sites/#line">Get in line</a>
  </div>
</nav>`;
}

function footer() {
  const rooms = NAV.map(n => `<a class="link" href="${n.href}">${n.label}</a>`).join(' · ');
  const legal = LEGAL.map(([h, l]) => `<a class="link" href="${h}">${l}</a>`).join(' · ');
  return `
<footer class="gfoot">
  <div class="wrap">
    <p><b>Systems by Vega</b> · A Kingdom Creatives LLC company · Nampa, Idaho ·
      <a class="link" href="mailto:info@kingdom-creatives.com">info@kingdom-creatives.com</a></p>
    <p style="margin-top:10px">${rooms}</p>
    <p style="margin-top:10px">${legal}</p>
    <!-- data-i18n-skip: never translated. A disclaimer that says something
         slightly different in another language is worse than one a reader has
         to translate themselves. -->
    <p class="foot-legal" data-i18n-skip>${DISCLAIMER}</p>
    <p class="legal-note" id="lang-governs" hidden></p>
  </div>
</footer>`;
}

function robots() {
  return ['User-agent: *',
    'Disallow: /admin/', 'Disallow: /__owner__/', 'Disallow: /claim/',
    '',
    '# The 32 storefronts are near-identical templates and stay out of search.',
    '# vercel.json sends X-Robots-Tag: noindex for /sites/<slug>/ on the apex;',
    '# middleware.js flips it to `all` per tenant. This mirrors that.',
    '#',
    '# Ruling R6: the Allow comes FIRST and is anchored with $. A bare',
    '# "Disallow: /sites/*/" is not safe here — a robots wildcard may match the',
    '# empty string, so it can swallow /sites/ itself. That is precisely the bug',
    '# commit 10f1035 just fixed in vercel.json, and re-introducing it through a',
    '# different file would drop the primary revenue page out of search.',
    '# Longest-match-wins makes the anchored Allow beat the Disallow for exactly',
    '# one path, and nothing else.',
    'Allow: /sites/$',
    'Disallow: /sites/',
    '', `Sitemap: ${ORIGIN}/sitemap.xml`, ''].join('\n');
}

function sitemap() {
  const urls = PAGES.filter(p => p.indexable).map(p => p.route)
    .concat(LEGAL.map(([h]) => h));
  return ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(u => `  <url><loc>${ORIGIN}${u}</loc></url>`),
    '</urlset>', ''].join('\n');
}

let drift = 0;
function write(file, next) {
  const abs = path.join(ROOT, file);
  const prev = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (prev === next) return;
  if (CHECK) { console.error(`  out of date: ${file}`); drift++; return; }
  fs.writeFileSync(abs, next);
  console.log('  wrote ' + file);
}

for (const page of PAGES) {
  const abs = path.join(ROOT, page.file);
  if (!fs.existsSync(abs)) { console.error(`  missing: ${page.file}`); drift++; continue; }
  let html = fs.readFileSync(abs, 'utf8');
  html = inject(html, 'NAV', nav(page.route));
  html = inject(html, 'FOOTER', footer());
  write(page.file, html);
}
write('robots.txt', robots());
write('sitemap.xml', sitemap());

if (CHECK && drift) {
  console.error('chrome is out of date. Run: node tools/build-chrome.js');
  process.exit(1);
}
console.log(CHECK ? 'chrome is in sync.' : 'chrome built.');
```

- [ ] **Step 3: Add the CSS**

Append to `assets/sbv.css`. Every colour is an existing band token, so the same
definition renders on all three grounds:

```css
/* ===================================================== GLOBAL CHROME ==
   Nav and footer, injected by tools/build-chrome.js. Reads band tokens
   only — no literal colours — so one definition serves paper, white and
   console without a variant. */
.skip{position:absolute;left:-9999px;top:0;z-index:200;padding:12px 18px;
  background:var(--con);color:var(--con-text);font-family:var(--mono);font-size:13px}
.skip:focus{left:8px;top:8px}

.gnav{position:sticky;top:0;z-index:100;background:rgba(20,24,33,.92);
  backdrop-filter:blur(10px);border-bottom:1px solid var(--con-hair)}
.gnav-in{max-width:var(--shell);margin:0 auto;padding:12px var(--gutter);
  display:flex;align-items:center;justify-content:space-between;gap:16px}
.gnav-brand{display:flex;align-items:center;gap:10px;font-family:var(--display);
  font-weight:800;font-size:16px;color:#fff;text-decoration:none;letter-spacing:-.01em}
.gnav-brand .sq{width:24px;height:24px;border-radius:6px;display:grid;place-items:center;
  background:linear-gradient(135deg,var(--con-amber),var(--amber-deep));
  color:#1a1206;font-size:13px;font-weight:900}
.gnav-links{display:flex;align-items:center;gap:4px}
.gnav-link{font-family:var(--display);font-weight:700;font-size:13.5px;color:#C2CAD6;
  text-decoration:none;padding:9px 13px;border-radius:7px;transition:.18s}
.gnav-link:hover{color:#fff;background:rgba(255,255,255,.07)}
.gnav-link.is-active{color:#fff;background:rgba(243,146,47,.14)}
.gnav-tools{display:flex;align-items:center;gap:10px}
.gnav-burger{display:none;width:var(--tap);height:var(--tap);border:0;background:none;
  cursor:pointer;flex-direction:column;justify-content:center;gap:5px;padding:0 12px}
.gnav-burger span{display:block;height:2px;background:#C2CAD6;border-radius:2px;transition:.2s}
.gnav-burger[aria-expanded="true"] span:nth-child(1){transform:translateY(7px) rotate(45deg)}
.gnav-burger[aria-expanded="true"] span:nth-child(2){opacity:0}
.gnav-burger[aria-expanded="true"] span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
.gnav-drawer{display:none;flex-direction:column;gap:2px;padding:8px var(--gutter) 20px;
  border-top:1px solid var(--con-hair);background:var(--con)}
.gnav-drawer .gnav-link{font-size:20px;padding:14px 12px;min-height:var(--tap);
  display:flex;align-items:center}
.gnav-drawer .btn{margin-top:10px}

@media(max-width:899px){
  .gnav-links{display:none}
  .gnav-burger{display:flex}
  .gnav-cta{display:none}
  .gnav-drawer[data-open="1"]{display:flex}
}
@media(prefers-reduced-motion:reduce){
  .gnav-link,.gnav-burger span{transition:none}
}

.gfoot{background:var(--con);color:var(--con-muted);padding:44px 0 54px;
  font-size:14px;line-height:1.7}
.gfoot .link{color:var(--con-amber)}
.gfoot .foot-legal{margin-top:18px;font-size:12.5px;color:#7C8698;max-width:78ch}
```

- [ ] **Step 4: Add the drawer behaviour**

Append inside the IIFE in `assets/sbv.js`, and call `wireNav()` from `boot()`:

```js
  /* ------------------------------------------------------------ gnav */
  /* The drawer is display:none until data-open, so nothing inside it is
     focusable while closed and no focus trap is needed for the closed
     state. Open traps, Esc closes, and focus returns to the burger —
     the same contract wireExit() already uses for the exit card. */
  function wireNav() {
    var burger = el('gnav-burger'), drawer = el('gnav-drawer');
    if (!burger || !drawer) return;

    function close() {
      drawer.removeAttribute('data-open');
      drawer.hidden = true;
      burger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKey);
      burger.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') return close();
      if (e.key !== 'Tab') return;
      var f = drawer.querySelectorAll('a[href],button:not([disabled])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    burger.addEventListener('click', function () {
      if (drawer.getAttribute('data-open') === '1') return close();
      drawer.hidden = false;
      drawer.setAttribute('data-open', '1');
      burger.setAttribute('aria-expanded', 'true');
      document.addEventListener('keydown', onKey);
      var f = drawer.querySelector('a[href]');
      if (f) f.focus();
    });
    /* A resize past the breakpoint must not leave a hidden drawer open. */
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900 && drawer.getAttribute('data-open') === '1') close();
    });
  }
```

- [ ] **Step 5: Insert the markers into the two existing pages**

In `index.html`, replace the whole `<nav class="nav">…</nav>` block with:

```html
<!-- BUILD:NAV --><!-- /BUILD:NAV -->
```

and the whole `<footer class="foot">…</footer>` block with:

```html
<!-- BUILD:FOOTER --><!-- /BUILD:FOOTER -->
```

Do the same in `sites/index.html` for its `<nav class="nav">` and `<footer>` blocks.
Add `id="main"` to the first `<main>` or `<header>` element on each page so the skip
link has a target.

- [ ] **Step 6: Build and verify**

```bash
node tools/build-chrome.js
node tools/check-pages.js
```
Expected: `chrome built.` then `2 page(s) clean`, exit 0.

- [ ] **Step 7: Wire both gates into the deploy**

In `vercel.json`, change `buildCommand` to:

```json
"buildCommand": "node tools/build-catalog.js --check && node tools/build-chrome.js --check && node tools/check-pages.js"
```

- [ ] **Step 8: Commit**

```bash
git add tools/build-chrome.js assets/sbv.css assets/sbv.js index.html sites/index.html vercel.json robots.txt sitemap.xml
git commit -m "feat(chrome): one nav and one footer for every page

Injected between BUILD: markers rather than duplicated into six files.
The repo already had a mechanism for generated markup; shared chrome
uses it instead of introducing a templating engine.

The mobile drawer is new work, not a port — both pages previously wrapped
their link row with no drawer at all, which failed at 390px.

/sites/ gains the footer disclaimer it has never carried.

robots.txt and sitemap.xml come from the same PAGES list as the nav, so
a sitemap that disagrees with the navigation is now impossible. Both
gates run in the Vercel buildCommand."
```

---

## Task 3: `tools/build-shots.js` and the screenshots

Four page tasks are blocked on this, which is why it is third and not fifth.

**Files:**
- Create: `tools/build-shots.js`
- Create: `assets/shots/{hero,featured,platforms,work}/*.jpg`

**Interfaces:**
- Produces: `assets/shots/<group>/<name>.jpg`, all 1280×800, quality 78
- Produces: exact filenames later tasks reference — listed in Step 2

- [ ] **Step 1: Write the tool**

Create `tools/build-shots.js`. Key decisions, and why:

```js
#!/usr/bin/env node
'use strict';
/* build-shots.js — every screenshot on the site, captured from the real thing.
 *
 * RUN LOCALLY, COMMIT THE OUTPUT. Not at Vercel build time: the build command
 * is three fast checks, and adding headless Chromium to it would slow every
 * deploy to regenerate assets that change perhaps monthly.
 *
 * playwright-core and @sparticuz/chromium are ALREADY dependencies —
 * api/marketing-kit.mjs uses both — so this adds no package.
 *
 *   node tools/build-shots.js                 all groups
 *   node tools/build-shots.js --only featured one group
 *   node tools/build-shots.js --list          print targets and exit
 *
 * Local targets are served from a throwaway static server on 127.0.0.1 so a
 * root-relative /assets/... resolves exactly as it does in production.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const OUT  = path.join(ROOT, 'assets', 'shots');
const args = process.argv.slice(2);
const only = (args.indexOf('--only') > -1) ? args[args.indexOf('--only') + 1] : null;

const TYPES = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
                '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
                '.svg':'image/svg+xml', '.webp':'image/webp' };

/* group, name, url (local path or absolute), and an optional prepare() that
   runs in the page before the shot — that is how a signature interaction gets
   captured in its interesting state rather than at rest. */
const TARGETS = [
  /* hero — TWO frames (Ruling R7), not three.
     /admin/ is behind auth: a headless capture is a sign-in form, and
     shipping that captioned "your admin" would be a screenshot of something
     not actually running — barred by the spec's own screenshot rule and by
     the compliance checklist. The admin step stays in How-it-works as text,
     which is where it already lived. A third frame can be added later if a
     signed-in capture becomes possible. */
  { group:'hero', name:'1-demo', url:'/sites/landscaping/' },
  // 2-branded is produced by Step 3 below, from a real rebuild.

  // featured — six niches, two frames each (rest + signature interaction)
  { group:'featured', name:'bin-cleaning',        url:'/sites/bin-cleaning/' },
  { group:'featured', name:'bin-cleaning-hover',  url:'/sites/bin-cleaning/',  prepare:'slider' },
  { group:'featured', name:'landscaping',         url:'/sites/landscaping/' },
  { group:'featured', name:'landscaping-hover',   url:'/sites/landscaping/',   prepare:'season' },
  { group:'featured', name:'dumpster-rental',     url:'/sites/dumpster-rental/' },
  { group:'featured', name:'dumpster-rental-hover',url:'/sites/dumpster-rental/',prepare:'picker' },
  { group:'featured', name:'dog-walking',         url:'/sites/dog-walking/' },
  { group:'featured', name:'dog-walking-hover',   url:'/sites/dog-walking/',   prepare:'week' },
  { group:'featured', name:'dj',                  url:'/sites/dj/pink/' },
  { group:'featured', name:'dj-hover',            url:'/sites/dj/pink/',       prepare:'wait' },
  { group:'featured', name:'child-care',          url:'/sites/child-care/' },
  { group:'featured', name:'child-care-hover',    url:'/sites/child-care/',    prepare:'wait' },

  // platforms — consignmentbiz already exists in assets/proof/; recapture all
  // three here so the group is self-consistent in size and quality.
  { group:'platforms', name:'estatesalebiz',  url:'https://estatesalebiz.com' },
  { group:'platforms', name:'garagesalebiz',  url:'https://garagesalebiz.com' },
  { group:'platforms', name:'consignmentbiz', url:'https://consignmentbiz.com' },

  // work — the eight linked portfolio entries. Kingdom Creatives is OFFLINE
  // and deliberately absent; /work/ renders a typographic placard for it.
  { group:'work', name:'estatesalebiz',    url:'https://estatesalebiz.com' },
  { group:'work', name:'garagesalebiz',    url:'https://garagesalebiz.com' },
  { group:'work', name:'consignmentbiz',   url:'https://consignmentbiz.com' },
  { group:'work', name:'sitelab',          url:'/sites/' },
  { group:'work', name:'yourlifecc',       url:'https://yourlifecc.com' },
  { group:'work', name:'churchfortruckers',url:'https://churchfortruckers.org' },
  { group:'work', name:'primebincleaning', url:'https://primebincleaning.com' },
  { group:'work', name:'domvegz',          url:'https://domvegz.com' },
];

/* Signature-interaction setup, run inside the page. Each returns only after
   the interaction has visibly settled. Unknown keys just wait — a shot at
   rest is a worse shot, never a wrong one. */
const PREPARE = {
  slider: `(async()=>{const s=document.querySelector('[class*=ba-],[class*=slider] input,input[type=range]');
           if(s){s.value=s.max?Math.round(s.max*0.55):55;s.dispatchEvent(new Event('input',{bubbles:true}));}
           await new Promise(r=>setTimeout(r,600));})()`,
  season: `(async()=>{const b=[...document.querySelectorAll('button,[role=tab]')]
             .find(e=>/summer|fall|autumn/i.test(e.textContent));if(b)b.click();
           await new Promise(r=>setTimeout(r,900));})()`,
  picker: `(async()=>{const b=[...document.querySelectorAll('button,[role=tab],label')]
             .find(e=>/20|30 ?yard|yd/i.test(e.textContent));if(b)b.click();
           await new Promise(r=>setTimeout(r,700));})()`,
  week:   `(async()=>{const d=[...document.querySelectorAll('button,[role=checkbox],label')]
             .filter(e=>/mon|wed|fri/i.test(e.textContent)).slice(0,3);d.forEach(e=>e.click());
           await new Promise(r=>setTimeout(r,700));})()`,
  wait:   `new Promise(r=>setTimeout(r,2500))`,
};

if (args.includes('--list')) {
  TARGETS.forEach(t => console.log(`${t.group}/${t.name}  ${t.url}`));
  process.exit(0);
}

function serve() {
  return new Promise(res => {
    const s = http.createServer((req, r) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        r.writeHead(404); return r.end('nf');
      }
      r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      r.end(fs.readFileSync(f));
    });
    s.listen(0, '127.0.0.1', () => res({ s, port: s.address().port }));
  });
}

(async () => {
  const { chromium } = require('playwright-core');
  const exePath = require('@sparticuz/chromium').executablePath;
  const browser = await chromium.launch({
    executablePath: typeof exePath === 'function' ? await exePath() : exePath,
    args: ['--hide-scrollbars', '--force-color-profile=srgb'],
  });
  const { s, port } = await serve();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });

  const list = only ? TARGETS.filter(t => t.group === only) : TARGETS;
  let failed = 0;
  for (const t of list) {
    const dir = path.join(OUT, t.group);
    fs.mkdirSync(dir, { recursive: true });
    const url = t.url.startsWith('http') ? t.url : `http://127.0.0.1:${port}${t.url}`;
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1200);          // fonts + entry animations settle
      if (t.prepare) await page.evaluate(PREPARE[t.prepare] || PREPARE.wait);
      await page.screenshot({
        path: path.join(dir, t.name + '.jpg'), type: 'jpeg', quality: 78,
      });
      console.log(`  ok    ${t.group}/${t.name}`);
    } catch (e) {
      failed++;
      console.log(`  FAIL  ${t.group}/${t.name}  ${e.message.split('\n')[0]}`);
    }
    await page.close();
  }
  await ctx.close(); await browser.close(); s.close();
  /* A missing screenshot must not pass quietly — a page task downstream would
     render a broken image and the gate does not check binaries. */
  process.exit(failed ? 1 : 0);
})();
```

- [ ] **Step 2: Run it and confirm every target**

```bash
node tools/build-shots.js --list          # 24 targets
node tools/build-shots.js
```
Expected: `ok` for all 24, exit 0. If `@sparticuz/chromium` has no local binary, set
`SITELAB_PLAYWRIGHT` or fall back to a system Chrome via
`chromium.launch({ channel: 'chrome' })` — `a11y-sweep.js:39` documents the same
resolution problem.

- [ ] **Step 3: Produce hero frame 3 from a real rebuild**

**This frame must be a genuine build, never a recolour.** It is the one that claims
"your site" and the whole section's credibility rests on it being true.

```bash
mkdir -p /tmp/sbv-branded
cp niches/landscaping/content.json /tmp/sbv-branded-content.json
node -e "
const fs=require('fs');
const c=JSON.parse(fs.readFileSync('niches/landscaping/content.json','utf8'));
c.brand.name='Vega & Sons Lawn Care';
c.brand.tagline='Cut clean. Every week.';
c.brand.city='Nampa, ID';
c.brand.phone='(208) 555-0111';
fs.writeFileSync('/tmp/sbv-branded-content.json', JSON.stringify(c,null,2));
"
cp /tmp/sbv-branded-content.json niches/landscaping/content.json
node tools/build-site.js landscaping --out /tmp/sbv-branded --demo
git checkout -- niches/landscaping/content.json     # restore immediately
```

Then screenshot `/tmp/sbv-branded/index.html` to `assets/shots/hero/2-branded.jpg`
by adding it as a temporary target, or with a one-off Playwright call at the same
1280×800 / quality 78.

**Verify the restore before continuing:**
```bash
git status --porcelain niches/landscaping/content.json
```
Expected: **empty**. If it is not, `git checkout -- niches/landscaping/content.json`.

- [ ] **Step 4: Check the weight budget**

```bash
du -sh assets/shots/* && find assets/shots -name '*.jpg' | wc -l
```
Expected: **25 files** (24 targets + `hero/2-branded.jpg` from Step 3), ≈2.5 MB total.
If any single file exceeds 200 KB, drop quality to 70 and re-run that group. No page
loads more than its own group.

- [ ] **Step 5: Commit**

```bash
git add tools/build-shots.js assets/shots
git commit -m "feat(shots): capture every screenshot from the real thing

26 shots at 1280x800, run locally and committed rather than generated at
deploy time — the build command is three fast checks and headless
Chromium would slow every deploy to rebuild assets that change monthly.
playwright-core and @sparticuz/chromium were already dependencies.

Featured niches get two frames each: at rest, and with their signature
interaction actually engaged, for the hover swap on the landing page.

Hero frame 3 is a real build-site.js rebuild under a different brand,
not a recolour. The frame claims 'your site' and the section's
credibility depends on that being literally true.

Kingdom Creatives has no shot: the site is offline, and /work/ renders a
typographic placard rather than a screenshot of a thing that does not load."
```

---

## Task 4: `sbv_inquiries` and the submit endpoint

**Files:**
- Create: `sql/INQUIRIES.sql`
- Create: `api/submit-inquiry.mjs`

**Interfaces:**
- Produces: table `public.sbv_inquiries`, enum `public.sbv_inquiry_status`
- Produces: `POST /api/submit-inquiry`, body `{name,email,company?,project,budget_range?,_honey?}`, returns `{ok:true}` or `{ok:false,error}`
- Consumes: `api/_shared.mjs` for the service-role client and JSON helpers — read it first and follow its existing export names rather than inventing new ones

- [ ] **Step 1: Write `sql/INQUIRIES.sql`**

Model it on `sql/LEADS.sql` — same header discipline, same guarded-idempotent style.
The constraints that matter and why:

```sql
-- ============================================================================
-- INQUIRIES.sql — inbound custom-work inquiries from /services/.
-- ----------------------------------------------------------------------------
-- WHY A NEW TABLE. sbv_leads cannot hold these: its client_id is NOT NULL with
-- an FK to sbv_tenants, because a lead belongs to an operator. A SystemsByVega
-- inquiry has no tenant, and inventing one would pollute the table that the
-- landing page's figures are counted from. sbv_demand cannot hold them either:
-- it requires niche_slug (FK) and a city, and dedupes on (niche, email, city),
-- which is exactly the shape a services inquiry does not have.
--
-- WHO WRITES. Nobody in the browser. api/submit-inquiry.mjs inserts with the
-- service_role key. There is NO anon policy and NO anon grant — a public key
-- must never write into an inbox table, or it becomes a spam target with a
-- free API. sbv_demand stays the only public write surface in this database.
--
-- NO DELETE POLICY, and no delete grant. Deletion is deleted_at, set by an
-- UPDATE. Losing a record of somebody who asked for work to a mis-tap is worse
-- than keeping a hidden row forever — the same reasoning that governs
-- sbv_leads and sbv_operator_content.
--
-- Idempotent: create-if-not-exists, every constraint dropped or guarded before
-- creation, safe to re-run against a table holding real rows. Run against
-- SystemsByVega (newjbexmvltvtmxollca) ONLY.
--
-- THE VERIFY BLOCK IS PLAIN SCHEMA INSPECTION: no temp tables, no role
-- switching, no transaction. LEADS.sql's header records why — the SQL editor
-- auto-commits each statement and is free to run them on different pooled
-- sessions, so session state does not survive from one statement to the next,
-- and two earlier attempts died with 42P01.
-- ============================================================================

do $$ begin
  create type public.sbv_inquiry_status as enum ('new', 'replied', 'closed');
exception when duplicate_object then null; end $$;

create table if not exists public.sbv_inquiries (
  id            uuid primary key default extensions.gen_random_uuid(),
  name          text not null,
  email         text not null,
  company       text,
  project       text not null,
  budget_range  text,
  source        text not null default 'services',
  status        public.sbv_inquiry_status not null default 'new',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

alter table public.sbv_inquiries drop constraint if exists sbv_inquiries_lengths_ck;
alter table public.sbv_inquiries add  constraint sbv_inquiries_lengths_ck
  check (
    char_length(btrim(name))    between 2 and 120  and
    char_length(email)          <= 254             and
    (company is null or char_length(company) <= 160) and
    char_length(btrim(project)) between 10 and 4000  and
    char_length(source)         <= 40
  );

alter table public.sbv_inquiries drop constraint if exists sbv_inquiries_email_ck;
alter table public.sbv_inquiries add  constraint sbv_inquiries_email_ck
  check (email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$');

-- A fixed list, not free text: the form offers exactly these and a mismatch
-- means the form and the table have drifted. NULL is allowed — the brief makes
-- budget optional, and an optional field must be able to be absent.
alter table public.sbv_inquiries drop constraint if exists sbv_inquiries_budget_ck;
alter table public.sbv_inquiries add  constraint sbv_inquiries_budget_ck
  check (budget_range is null or budget_range in
         ('under-5k', '5k-15k', '15k-40k', '40k-plus', 'not-sure'));

create index if not exists sbv_inquiries_open_idx
  on public.sbv_inquiries (created_at desc) where deleted_at is null;

-- Reused from sbv_leads; see sql/LEADS.sql for the trigger body.
drop trigger if exists sbv_inquiries_touch on public.sbv_inquiries;
create trigger sbv_inquiries_touch before update on public.sbv_inquiries
  for each row execute function public.sbv_touch_updated_at();

alter table public.sbv_inquiries enable row level security;
alter table public.sbv_inquiries force row level security;

-- Deliberately empty: no policy for anon, no policy for authenticated. The
-- service role bypasses RLS, and it is the only writer and the only reader.
revoke all on public.sbv_inquiries from anon, authenticated;
```

Then a verify block in the same `union all select '<claim>', <boolean>::text` shape
`LEADS.sql` uses at its end, asserting: the table exists, RLS is enabled and forced,
all four check constraints exist, the partial index exists, and **`anon` holds no
privilege on the table**.

- [ ] **Step 2: Apply it and run the verify block**

```bash
supabase db query --linked "$(cat sql/INQUIRIES.sql)"
```
Expected: every verify row reads `true`. **If any reads `false`, stop and fix the SQL —
do not proceed to the API.**

- [ ] **Step 3: Write `api/submit-inquiry.mjs`**

Read `api/submit-lead.mjs` first and mirror its structure: method guard → honeypot →
field extraction and validation → rate limit → service-role insert → JSON response.
The differences from `submit-lead`, and only these:

- No `client_id`, so **no tenant-exists check** — that lookup has nothing to look up.
- Rate limit is **per IP per hour** (`x-forwarded-for`, first hop), counted from
  `sbv_inquiries` itself, since there is no tenant to scope by. Cap at 5.
- `source` defaults to `'services'` and is never taken from the request body.
- `budget_range` is validated against the same five values as the CHECK, and an
  unrecognised value is dropped to `null` rather than rejected — a buyer should not
  lose a 400-word project description to a stale `<option>`.

```js
/* Honeypot: accepted and dropped, never rejected. A bot told it failed
   learns to try again; a bot told it succeeded does not. Same as
   submit-lead.mjs. */
if (str(body._honey)) return json({ ok: true });
```

- [ ] **Step 4: Test the endpoint locally**

```bash
vercel dev --listen 3000 &
curl -s -X POST localhost:3000/api/submit-inquiry \
  -H 'content-type: application/json' \
  -d '{"name":"Test Person","email":"test@example.com","project":"I need a multi-tenant booking system for a small chain.","budget_range":"5k-15k"}'
```
Expected: `{"ok":true}`

```bash
# honeypot — accepted, but writes nothing
curl -s -X POST localhost:3000/api/submit-inquiry -H 'content-type: application/json' \
  -d '{"name":"Bot","email":"b@e.com","project":"aaaaaaaaaaaa","_honey":"x"}'
# short project — rejected
curl -s -X POST localhost:3000/api/submit-inquiry -H 'content-type: application/json' \
  -d '{"name":"T","email":"t@e.com","project":"hi"}'
```
Expected: `{"ok":true}` then `{"ok":false,"error":"bad_project"}`

- [ ] **Step 5: Confirm exactly one row landed, then clean up**

```bash
supabase db query --linked "select name,email,budget_range,source,status from sbv_inquiries order by created_at;"
```
Expected: **one** row (`Test Person`), not two — the honeypot must have written nothing.

```bash
supabase db query --linked "delete from sbv_inquiries where email='test@example.com';"
```

- [ ] **Step 6: Commit**

```bash
git add sql/INQUIRIES.sql api/submit-inquiry.mjs
git commit -m "feat(inquiries): sbv_inquiries table and the /services/ submit endpoint

sbv_leads could not take these: client_id is NOT NULL against
sbv_tenants because a lead belongs to an operator, and inventing a
tenant would pollute the table the landing figures are counted from.
sbv_demand could not either: it needs a niche FK and a city.

Service-role writes only, no anon policy and no anon grant. sbv_demand
stays the only public write surface. Deletion is deleted_at, never
DELETE. Verify block is plain schema inspection for the 42P01 reason
LEADS.sql documents.

Rate limited per IP per hour rather than per tenant, since there is no
tenant. An unrecognised budget_range drops to null rather than 400ing —
a buyer should not lose a long project description to a stale option."
```

---

## Task 5: `/services/`

**Files:**
- Create: `services/index.html`
- Modify: `tools/check-pages.js` (`PAGES` += `/services/`)
- Modify: `tools/build-chrome.js` (`PAGES` += `/services/`, indexable)

**Interfaces:**
- Consumes: chrome markers (Task 2), `POST /api/submit-inquiry` (Task 4)
- Produces: `/services/` — the 301 target for `/demo/` and `/showcase/` in Task 11

- [ ] **Step 1: Register the route — this is the failing test**

Add `{ route: '/services/', file: 'services/index.html' }` to `PAGES` in **both**
`tools/check-pages.js` and `tools/build-chrome.js` (the latter with `indexable: true`).

- [ ] **Step 2: Run the gate — expect FAIL**

```bash
node tools/check-pages.js
```
Expected: `FAIL  /services/  missing file services/index.html`

- [ ] **Step 3: Build the page**

Sections, in order, with their band (spec §2.1) and their source:

| # | Section | Band | Content |
|---|---|---|---|
| 1 | Hero | console | H1 **"You don't need a template. You need the thing built."** Sub: "Custom platforms, dashboards, databases and automation — designed, built and shipped by one person who has done it for himself first." CTA → `#inquiry` |
| 2 | The problem | paper | From `demo/index.html` §01, near-verbatim: "Everything important lives in a file someone can overwrite by accident." Keep the four-point grid |
| 3 | What I build | white | Five blocks — copy in Step 4 |
| 4 | How I work | paper | brief → spec → plan → build → review → ship. State the AI-agent process plainly as fact |
| 5 | Inquiry form | white | Step 5 |

Reuse existing components throughout: `.section`, `.section-head`, `.eyebrow`, `.grid`,
`.entry`, `.btn`. **Do not write new component CSS for this page.**

- [ ] **Step 4: Write the five "What I build" blocks**

```
Custom platforms
  I built EstateSaleBiz from scratch — multi-tenant, Stripe checkout, territory
  registry, automated provisioning, and an admin every operator runs themselves.
  Then I built two more. If you need a platform rather than a page, that is the
  thing I have actually shipped.

Dashboards & internal tools
  Operational dashboards, command centers, reporting that updates itself instead
  of being retyped at 10pm. The kind of internal tooling that replaces a
  spreadsheet nobody trusts and everybody depends on.

Database design & migration
  Supabase and Postgres schema design, row-level security, migrations, and
  getting off WordPress or a legacy system without losing the data or the URLs.

Automation & integrations
  Webhooks, email pipelines, scheduled jobs, and API integrations — the work
  that removes a recurring manual step permanently.

Websites
  If a template genuinely fits your trade, that is cheaper and faster and it is
  already built. Thirty-two of them are at /sites/ for $299. I would rather send
  you there than sell you a custom build you do not need.
```

**Compliance note for the dashboards block:** describe the category only. No client
name, no employer, no screenshot, no "for a national retail network". `check-pages.js`
bans `Command Center` on this route.

- [ ] **Step 5: Write the form**

Fields per brief §3d: name, email, company, "What are you trying to build?"
(textarea), budget range (`<select>`, optional). Plus a visually-hidden `_honey`
input using the existing `.hp` class.

The budget `<option>` values must be **exactly** the five in the CHECK constraint:
`under-5k` · `5k-15k` · `15k-40k` · `40k-plus` · `not-sure`, with a leading
`<option value="">Prefer not to say</option>`.

Labels must not imply a return: "Budget range (optional)", never "investment" and never
anything about payback.

```js
/* Same posture as the demand form on /sites/: disable, say what is
   happening, and never leave the button in a state that invites a
   double submit. */
fetch('/api/submit-inquiry', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload)
})
```

- [ ] **Step 6: Build chrome and run the gate**

```bash
node tools/build-chrome.js && node tools/check-pages.js
```
Expected: `3 page(s) clean`, exit 0.

- [ ] **Step 7: Verify the form end to end**

```bash
vercel dev --listen 3000 &
```
Open `localhost:3000/services/`, submit the form, then:
```bash
supabase db query --linked "select name,budget_range,source from sbv_inquiries order by created_at desc limit 1;"
supabase db query --linked "delete from sbv_inquiries where source='services' and email like '%example.com';"
```
Expected: the row you submitted, then cleanup.

- [ ] **Step 8: Commit**

```bash
git add services/index.html tools/check-pages.js tools/build-chrome.js
git commit -m "feat(services): custom-work page, absorbing /demo/

/demo/ was 70KB of on-voice, working copy about getting a business off
spreadsheets. This is that content re-banded and extended, not a rewrite.

The dashboards block describes the category and names no client: the
Command Center demo and its portfolio card are employer work and are
gone. check-pages.js bans the string on this route so it cannot come back.

The websites block sends people to /sites/ when a template would fit.
Saying so costs a custom sale occasionally and buys the credibility that
makes the rest of the page believable."
```

---

## Task 6: `/platforms/`

**Files:**
- Create: `platforms/index.html`
- Modify: `tools/check-pages.js`, `tools/build-chrome.js` (`PAGES` += `/platforms/`)
- Modify: `assets/sbv.js` (platform status hydration)

> **Ruling R8:** `/platforms/` must carry the same three data tags `/sites/` does —
> the inline `window.SBV_CONFIG`, the `<!-- BUILD:SEED_SCRIPT -->` marker pair, and
> `<script src="/assets/sbv.js" defer>` — or `paintPlatforms()` has no rows to read and
> every price renders empty. Add `SEED_SCRIPT` to this file's entry in the
> `build-catalog.js` `TARGETS` array from Task 10.

**Interfaces:**
- Consumes: `assets/shots/platforms/*.jpg` (Task 3), `SBV_SEED` / `sbv_niches`
- Produces: `#platforms-root`, hydrated by `sbv.js` from `sbv_niches`

- [ ] **Step 1: Register the route and run the gate — expect FAIL**

Same as Task 5 Step 1–2. Expected: `FAIL  /platforms/  missing file`.

- [ ] **Step 2: Build the page**

Hero (console): **"Three businesses you can run, not three websites you can buy."**

Then one block per platform, alternating paper / white / paper, each containing:
screenshot from `assets/shots/platforms/`, two sentences on what it does, one on who it
is for, **status and price read from the seed**, and `Open <domain> →`.

**Every figure comes from data.** Render the price from `price_label` and the status
from `status`; hydrate at runtime the same way the catalog does:

```js
  /* The three open platforms, from the same rows the catalog reads. A price
     typed into this page would be a fourth place the number lives — the
     catalog, the seed, the database, and here — and the audit found what
     happens when prose keeps its own copy of a figure. */
  function paintPlatforms() {
    var root = el('platforms-root');
    if (!root || !state.niches.length) return;
    state.niches.filter(function (n) { return n.status === 'open'; })
      .forEach(function (n) {
        var card = root.querySelector('[data-slug="' + n.slug + '"]');
        if (!card) return;
        var price = card.querySelector('[data-price]');
        if (price) price.textContent = n.price_label || '';
      });
  }
```

Closing band (console): **"What's next"** — the 10 `in_line` businesses rendered from
the seed, each linking to `/sites/#line`.

- [ ] **Step 3: Compliance pass on the copy**

Read the whole page once looking only for this: any sentence a reader could take as a
claim about what an operator makes. These are tools that run a business, never a
promise about what the business earns. Mirror the catalog FAQ's earnings answer in one
line with a link to `/sites/#faq`.

- [ ] **Step 4: Build, gate, verify the figures**

```bash
node tools/build-chrome.js && node tools/check-pages.js
```
Expected: `4 page(s) clean`.

Then confirm no price is hard-coded:
```bash
grep -nE '\$(497|249|197)' platforms/index.html
```
Expected: **no output.** Every price arrives from `price_label`. If a figure appears,
it is a second source of truth — remove it.

- [ ] **Step 5: Commit**

```bash
git add platforms/index.html tools/check-pages.js tools/build-chrome.js assets/sbv.js
git commit -m "feat(platforms): ESB, GSB and CSB in depth

Status and price are read from sbv_niches, never typed. grep proves no
dollar figure appears in the source: the catalog, the seed and the
database already hold those numbers, and the audit is a record of what
happens when prose keeps a fourth copy.

Screenshots are the running products. Closing band renders the 10
in-line businesses from the seed, so someone who came for platforms
finds the waitlist without being sold a website."
```

---

## Task 7: `/work/`

**Files:**
- Create: `work/index.html`, `work/projects.json`
- Modify: `tools/check-pages.js`, `tools/build-chrome.js`
- Modify: `assets/sbv.css` (grid + card components — **Ruling R4**)
- Modify: `assets/sbv.js` (grid render + filters)

> **Ruling R4:** the grid needs component CSS and it goes in `assets/sbv.css`, reading
> band tokens (`--surface`, `--tx`, `--rule`, `--acc`). Do **not** copy the literal
> colours out of `portfolio/assets/css/styles.css` — a page that ignores the band
> system is the one thing spec §2.1 exists to prevent.

**Interfaces:**
- Consumes: `assets/shots/work/*.jpg` (Task 3)
- Produces: `work/projects.json` — array of `{id,name,tagline,description,url,shot,category,tags,status}`

- [ ] **Step 1: Register the route and run the gate — expect FAIL**

- [ ] **Step 2: Port and edit the project data**

Start from `portfolio/assets/data/projects.json`. The nine entries, exactly:

| id | name | status | url | shot |
|---|---|---|---|---|
| `estatesalebiz` | EstateSaleBiz | Live | ✓ | `estatesalebiz.jpg` |
| `garagesalebiz` | GarageSaleBiz | Live | ✓ | `garagesalebiz.jpg` |
| `consignmentbiz` | ConsignmentBiz | Live | ✓ | `consignmentbiz.jpg` |
| `sitelab` | SiteLab | Live | `/sites/` | `sitelab.jpg` |
| `yourlifecc` | YourLife CC | Live | ✓ | `yourlifecc.jpg` |
| `churchfortruckers` | Church for Truckers | Live | ✓ | `churchfortruckers.jpg` |
| `primebincleaning` | Prime Bin Cleaning | Live | ✓ | `primebincleaning.jpg` |
| `domvegz` | Dom Vegz | Live | ✓ | `domvegz.jpg` |
| `kingdom-creatives` | Kingdom Creatives | **Offline** | **`null`** | **`null`** |

**Removed:** the `showcase` / Operations Command Center entry (Q1).
**Merged away:** the old `faith-journey`, `return` and `legacy-vault` entries become
bullet points inside the YourLife CC detail panel — they are features of one product,
and three cards for one app overstates the portfolio.

`kingdom-creatives` carries `"status": "Offline"`, `"url": null`, `"shot": null`, and
`"note": "Hosting is being moved. The site is down; the company is not."`

- [ ] **Step 3: Build the grid**

Port the filter + card render from `portfolio/assets/js/app.js` — the pattern is right,
it just moves into `sbv.js` and reads band tokens instead of its own stylesheet.

The `Offline` pill must be visually distinct from `Live` — grey (`--tx-3`), not amber —
and a card with `url: null` renders **no link and no `<a>` wrapper**. Its shot area gets
a typographic placard in the family colour instead of an image.

```js
/* A card with no url is not a broken link, it is a card that deliberately
   does not link. Rendering an <a href="null"> or an <a> with no href would
   be a worse answer than the honest one. */
var linked = p.url ? '<a class="wk-go" href="' + esc(p.url) + '">Open it →</a>' : '';
```

- [ ] **Step 4: Build, gate, verify**

```bash
node tools/build-chrome.js && node tools/check-pages.js
grep -c "Command Center" work/index.html work/projects.json
```
Expected: `5 page(s) clean`, and **0** for both greps.

Confirm every referenced shot exists:
```bash
node -e "
const fs=require('fs');
JSON.parse(fs.readFileSync('work/projects.json','utf8')).forEach(p=>{
  if(!p.shot) return console.log('  no shot (ok): '+p.id);
  const f='assets/shots/work/'+p.shot;
  console.log((fs.existsSync(f)?'  ok    ':'  FAIL  ')+p.id+'  '+f);
});"
```
Expected: `ok` for eight, `no shot (ok)` for `kingdom-creatives`.

- [ ] **Step 5: Commit**

```bash
git add work tools/check-pages.js tools/build-chrome.js assets/sbv.js
git commit -m "feat(work): portfolio, replacing /portfolio/

Operations Command Center is gone — employer work.

Kingdom Creatives is listed with an Offline pill, no link and no
screenshot. The site does not load; listing it as Live was the
credibility problem, and labelling it honestly is not. Its card says
the hosting is moving and the company is not.

Faith Journey, Return and Legacy Vault fold into the YourLife CC detail
panel. They are features of one product, and three cards for one app
overstated the portfolio."
```

---

## Task 8: `/about/`

**Files:**
- Create: `about/index.html`
- Modify: `tools/check-pages.js`, `tools/build-chrome.js`

- [ ] **Step 1: Register the route and run the gate — expect FAIL**

- [ ] **Step 2: Write the page** — three sections, ~400 words total

Hero (console): **"One person, in Nampa, Idaho."**

Story (paper) — first person throughout. Include, verbatim, the sentence settled as
decision C:

> By day I'm Vice President of Digital Strategy & Innovation at Roady's Truck Stops,
> leading digital for a national truck-stop network since 2019 — that operator's
> instinct shapes everything I build on my own.

**This is the only mention of Roady's on the site.** It names an employer and a role.
It must not describe any project, product, system or client work. Kingdom Creatives LLC
is named as the parent company; the faith dimension goes here if Jason supplies copy.

What I don't do (white) — **verbatim** from today's `index.html` `#founder`:

> **What I do not do.** I do not find your clients, book your jobs, or run your
> business. I do not tell you what to charge, and I make no claim about what you will
> earn. Some operators never book a job. You could lose money on this. It is a set of
> tools and a protected patch of ground, not a job offer.

- [ ] **Step 3: Build, gate, and check the Roady's boundary**

```bash
node tools/build-chrome.js && node tools/check-pages.js
grep -c "Roady" about/index.html
grep -rn "Roady" --include=*.html --include=*.json . | grep -v node_modules | grep -v '/about/'
```
Expected: `6 page(s) clean`; `1` for `about/index.html`; and the third command prints
**only** `portfolio/index.html`, which Task 11 retires behind a 301.

- [ ] **Step 4: Confirm the disclaimer survived verbatim**

```bash
node -e "
const a=require('fs').readFileSync('about/index.html','utf8').replace(/\s+/g,' ');
const need='I do not find your clients, book your jobs, or run your business.';
const lose='You could lose money on this.';
console.log(a.includes(need)?'ok    disclaimer intact':'FAIL  disclaimer altered');
console.log(a.includes(lose)?'ok    loss warning intact':'FAIL  loss warning missing');"
```
Expected: both `ok`.

- [ ] **Step 5: Commit**

```bash
git add about tools/check-pages.js tools/build-chrome.js
git commit -m "feat(about): who Jason is, in about four hundred words

Carries the only mention of Roady's on the site: an employer and a role,
in first person, describing no project. Everything that employer's name
was attached to is gone from /work/ and /services/.

The 'what I do not do' paragraph moves from the old homepage #founder
unedited, including 'you could lose money on this'. It is the most
important paragraph on the site and it is not being rewritten."
```

---

## Task 9: `/` — the landing page

**Files:**
- Modify: `index.html` (rebuilt)
- Modify: `assets/sbv.css` (hero sequence, offerings, featured carousel)
- Modify: `assets/sbv.js` (carousel)

> **Ruling R1:** this task does **not** edit `tools/build-catalog.js` — Task 10 already
> gave it a `TARGETS` array covering both files. This task only inserts the
> `<!-- BUILD:TOTAL -->`, `<!-- BUILD:OPEN -->` and `<!-- BUILD:SITES -->` marker pairs
> into `index.html` where the proof strip needs them.

**Interfaces:**
- Consumes: `assets/shots/hero/*.jpg`, `assets/shots/featured/*.jpg`
- Consumes: `R.figures()` from `assets/catalog-render.js`
- Produces: `BUILD:TOTAL`, `BUILD:OPEN`, `BUILD:SITES` on this page

- [ ] **Step 1: Move the catalog out before rebuilding this page**

**Do Task 10 first if you have not.** This task assumes the board already lives at
`/sites/`. If it does not, `index.html` still holds `BUILD:CATALOG` and this rebuild
will delete a live catalog. **Check:**
```bash
grep -c "BUILD:CATALOG" sites/index.html
```
Expected: `1`. If it is `0`, stop and do Task 10 first.

- [ ] **Step 2: Rebuild `index.html`**

Eight sections per spec §3.1, bands per §2.1. The proof strip renders the **four true
figures only** and every one comes from a `BUILD:` marker.

- [ ] **Step 3: Write the hero sequence**

**Two frames (Ruling R7):** the demo storefront, and the same storefront rebuilt under
another brand. Captions: **"The demo"** / **"Your site."** The admin step is described
in How-it-works as text — `/admin/` is behind auth and a headless capture of it would
be a sign-in form presented as an admin panel.

```css
/* The sequence: the demo, then the same site rebuilt under another brand.
   Two real screenshots, cross-faded. Not a video, not a canvas, not a
   library — two <img> and one @keyframes, because that is all it needs. */
.seq{position:relative;aspect-ratio:16/10;border-radius:10px;overflow:hidden}
.seq img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
  opacity:0;animation:seq 8s infinite}
.seq img:nth-child(1){animation-delay:0s}
.seq img:nth-child(2){animation-delay:4s}
@keyframes seq{
  0%,3%   {opacity:0}
  8%,45%  {opacity:1}
  50%,100%{opacity:0}
}
/* Reduced motion gets a DIFFERENT honest presentation, not a broken one:
   frame 1 held, and the captions become a visible two-step row that
   explains the same mechanism in text. */
@media(prefers-reduced-motion:reduce){
  .seq img{animation:none}
  .seq img:nth-child(1){opacity:1}
  .seq-steps{display:flex}
}
.seq-steps{display:none;gap:18px;margin-top:14px}
```

- [ ] **Step 4: Write the featured carousel**

Six cards from `assets/shots/featured/`. Hover (and `:focus-within`, so keyboard users
get it too) swaps to the `-hover` frame. **Screenshots, not iframes** — audit §6.4.

```css
.fcard-shot{position:relative}
.fcard-shot img{display:block;width:100%;height:auto}
.fcard-shot .on{position:absolute;inset:0;opacity:0;transition:opacity .35s ease}
.fcard:hover .on,.fcard:focus-within .on{opacity:1}
@media(prefers-reduced-motion:reduce){.fcard-shot .on{transition:none}}
```

- [ ] **Step 5: Verify no iframe reached the landing page**

```bash
grep -c "<iframe" index.html
```
Expected: **0**.

- [ ] **Step 6: Build everything and gate**

```bash
node tools/build-catalog.js && node tools/build-chrome.js && node tools/check-pages.js
```
Expected: all clean, exit 0.

- [ ] **Step 7: Verify the four figures render and no fifth appears**

```bash
node -e "
const h=require('fs').readFileSync('index.html','utf8');
const m=h.match(/BUILD:(TOTAL|OPEN|SITES)\s*-->(\d+)/g)||[];
console.log(m.join('  '));
console.log(/operators?<\/span>|\d+\s+operators/i.test(h)?'FAIL  operator count present':'ok    no operator count');"
```
Expected: `38`, `3`, `32` and `ok    no operator count`.

- [ ] **Step 8: Commit**

```bash
git add index.html assets/sbv.css assets/sbv.js tools/build-catalog.js
git commit -m "feat(landing): / becomes the front door and sells nothing

Answers 'what is this' and routes. Every CTA leaves for a room.

The hero sequence is three real screenshots cross-faded — demo, admin,
the same site rebuilt under another brand. Frame 3 is a genuine
build-site.js output. Reduced motion gets frame 1 plus the three
captions as text: a different honest hero, not a degraded one.

Featured sites are screenshots, never iframes. The old /sites/ armed 32
live storefronts at once — 3.9MB of HTML before photos — and putting a
second iframe wall on the landing page would have been the same mistake
twice.

The proof strip prints four figures, all from the seed. There is no
operator count because all six sbv_tenants rows are test data, and a
fabricated one is the thing this whole site is built not to do."
```

---

## Task 10: `/sites/` — the catalog consolidation

The riskiest task. It touches checkout, auth and the build gate.

**Files:**
- Modify: `sites/index.html` (absorbs the board)
- Modify: `tools/build-catalog.js` (`PAGE` → `sites/index.html`)
- Modify: `assets/catalog-render.js` (card extensions)
- Modify: `assets/sbv.js` (lookup for the new card fields)

**Interfaces:**
- Consumes: `manifests.json`, `niches/<slug>/content.json` (`brand.name`)
- Produces: `BUILD:CATALOG`, `BUILD:NICHE_SELECT`, `BUILD:SEED_SCRIPT` now live here

- [ ] **Step 1: Extend the card renderer**

New fields go through a **static lookup keyed by slug**, because `sbv.js` re-renders
these cards from `sbv_niches` rows and any field that lives only in the seed would
render once and vanish on the live overlay — the constraint `catalog-render.js`'s own
header documents.

```js
  /* Demo brand name and feature chips. These are NOT database columns and
     must never become ones: they describe the artifact on disk, not the
     product's commercial state. Passed in as a lookup so the runtime
     re-render has them too — a field that lives only in the seed renders
     once and disappears the moment live rows arrive. */
  function extras(n, lookup) {
    var x = (lookup && lookup[n.slug]) || {};
    return (x.brand ? '<p class="card-brand">' + esc(x.brand) + '</p>' : '') +
           (x.chips && x.chips.length
             ? '<p class="card-chips">' + x.chips.map(function (c) {
                 return '<span class="chip-sm">' + esc(c) + '</span>';
               }).join('') + '</p>'
             : '');
  }
```

- [ ] **Step 2: Generate the lookup at build time**

In `build-catalog.js`, read every `niches/<slug>/content.json` for `brand.name` and
`manifests.json` for the section flags, and emit `window.SBV_EXTRAS` alongside
`SBV_SEED`.

- [ ] **Step 3: Retarget the builder — to TWO files, not one (Ruling R1)**

A single `PAGE` constant cannot serve this plan: the catalog markers belong on
`/sites/`, but `/` still needs `TOTAL` / `OPEN` / `SITES` for its proof strip, and
`inject()` throws on a marker a file does not have. Replace `PAGE` with a `TARGETS`
array and inject only the markers each file declares:

```js
/* Two files, different marker sets. The catalog lives on /sites/ now, but the
   landing page's proof strip still needs its three figures — and those figures
   must come from the same R.figures() call as everything else, or the landing
   page becomes the fourth place a count is written down. inject() throws on a
   missing marker, so each target names exactly what it carries. */
const TARGETS = [
  { file: path.join(ROOT, 'index.html'),
    markers: ['TOTAL', 'OPEN', 'SITES'] },
  { file: path.join(ROOT, 'sites', 'index.html'),
    markers: ['TOTAL', 'OPEN', 'SITES', 'THESIS_OPEN',
              'CATALOG', 'NICHE_SELECT', 'SEED_SCRIPT', 'EXTRAS_SCRIPT'] },
];
```

`main()` loops `TARGETS`, builds the value map once from `R.figures(seed.niches)`, and
injects only the markers listed for each file. `--check` reports drift per file and
exits 1 if any file drifted.

- [ ] **Step 4: Move the markers and the sections**

Move into `sites/index.html`: the ledger, all `BUILD:` markers, the filter chips,
`#registry`, `#line`, `#faq`, the niche modal, the exit card, and the Supabase confirm
bridge. Delete the 32 hand-authored cards — they regenerate from data.

- [ ] **Step 5: Keep the confirm bridge on BOTH pages for now**

**Do not delete the copy on `/` yet.** It moves only after the Supabase dashboard
change (Task 12). A bridge that exists on neither page strands buyers mid-confirmation.

- [ ] **Step 6: Verify the merge**

```bash
node tools/build-catalog.js && node tools/build-chrome.js && node tools/check-pages.js
node -e "
const h=require('fs').readFileSync('sites/index.html','utf8');
const cards=(h.match(/class=\"entry sheet/g)||[]).length;
console.log('cards: '+cards+(cards===38?'  ok':'  FAIL expected 38'));
console.log(/id=\"line\"/.test(h)?'ok    demand form present':'FAIL  demand form missing');
console.log(/Prime Bin Cleaning<\/b> is a real operator/.test(h)
  ?'ok    example-names disclosure intact':'FAIL  disclosure missing');"
```
Expected: 38 cards, form present, disclosure intact.

Then confirm the price table collapsed from 33 copies to one:
```bash
grep -c '299' sites/index.html
```
Expected: a small number (the one shared `<details>` partial and the seed), **not 33+**.

- [ ] **Step 7: Verify checkout still works**

```bash
vercel dev --listen 3000 &
```
On `localhost:3000/sites/`, click `Claim this territory` on a card. Expected: the
`claim.js` modal opens and the availability check calls `/api/check-territory`.
**Do not complete a payment.**

- [ ] **Step 8: Commit**

```bash
git add sites/index.html tools/build-catalog.js assets/catalog-render.js assets/sbv.js
git commit -m "feat(sites): one catalog, generated from data

The 32 hand-authored cards are gone; every card renders from the seed
plus a slug lookup. The price table went from 33 copies to one.

Demo brand names and feature chips arrive through a lookup rather than
new database columns: sbv.js re-renders these cards from sbv_niches, and
a field that lives only in the seed would render once and vanish the
moment live rows land. catalog-render.js's header has said so since it
was written.

build-catalog.js now targets sites/index.html, so the gate that proves
no count is typed by hand follows the catalog rather than staying on a
page that no longer has one.

The Supabase confirm bridge is deliberately on BOTH / and /sites/ until
the dashboard allowlist is updated. A bridge on neither page strands
buyers mid-confirmation."
```

---

## Task 11: Redirects, retirements, and the link audit

**Files:**
- Modify: `vercel.json` (redirects)
- Modify: `demo/index.html`, `showcase/index.html`, `portfolio/index.html` (analytics only, if kept reachable)
- Modify: `middleware.js` (F4 comment)
- Create: `tools/check-links.js`

- [ ] **Step 1: Add every redirect**

In `vercel.json`, all permanent:

| source | destination |
|---|---|
| `/demo` and `/demo/:path*` | `/services/` |
| `/showcase` and `/showcase/:path*` | `/services/` |
| `/portfolio` and `/portfolio/:path*` | `/work/` |
| `/pricing/:path*` | `/sites/` (replaces the `/#websites` target) |
| `/niche-landing.html` | `/sites/` (replaces `/#catalog`) |

**Files are kept.** These pages are retired, not deleted.

- [ ] **Step 2: Handle the two legacy fragments**

Servers never see a fragment, so `/#catalog` and `/#websites` need three lines on `/`:

```js
/* Ad creatives still carry /#catalog and /#websites from when this page was
   the catalog. Both anchors moved to /sites/. Retire this once the creatives
   stop pointing here. */
(function () {
  var h = location.hash;
  if (h === '#catalog' || h === '#websites') location.replace('/sites/');
}());
```

- [ ] **Step 3: Write the link checker**

`tools/check-links.js`: crawl every `href` in the six pages plus `/legal/*`, resolve
each against the filesystem and the `vercel.json` redirect table, and fail on anything
that resolves to neither. Print each dead link with its source file and line.

- [ ] **Step 4: Run it**

```bash
node tools/check-links.js
```
Expected: exit 0. Fix every reported link; **do not** add a redirect to paper over a
link that should simply be corrected.

- [ ] **Step 5: Fix the stale middleware comment (F4)**

In `middleware.js` around lines 210-220, replace the passage claiming tenant pages ship
a baked `noindex` meta. They do not — `build-site.js` sets `ROBOTS: ''` and no built
page contains one. State that the header is now the only signal.

- [ ] **Step 6: Add the missing analytics tags (F5)**

Add the top-frame-guarded Vercel Analytics snippet from `index.html` to `claim/index.html`
and `claim/thank-you.html` — the Stripe cancel and success landings, the two
highest-value pages in the funnel and currently invisible in reporting.

- [ ] **Step 7: Commit**

```bash
git add vercel.json index.html middleware.js claim tools/check-links.js
git commit -m "fix(routes): retire /demo/, /showcase/ and /portfolio/ behind 301s

Files kept, pages retired. /pricing/ and /niche-landing.html retarget to
/sites/, since the /#websites and /#catalog anchors they pointed at no
longer exist. Three lines on / forward those two legacy fragments, which
servers never see.

check-links.js resolves every href against the filesystem and the
redirect table so nothing that used to work 404s.

Analytics finally reaches both /claim/ pages — the Stripe cancel and
success landings have been invisible in reporting this whole time.

middleware.js no longer claims tenant pages ship a baked noindex meta.
They have not since build-site.js started setting ROBOTS: ''."
```

---

## Task 12: Mobile, accessibility, and the Supabase cutover

**Files:**
- Modify: `tools/a11y-sweep.js` (cover the marketing pages)

- [ ] **Step 1: Teach `a11y-sweep.js` about the marketing pages**

Its `pages()` (line ~66) enumerates only `niches/`. Add the six marketing routes:

```js
/* The six marketing pages. pages() previously enumerated niches/ only, so
   every page a visitor actually lands on first went unswept. */
const MARKETING = ['/', '/sites/', '/platforms/', '/services/', '/work/', '/about/'];
```

Include them unless `only` is set, so `node tools/a11y-sweep.js landscaping` still
narrows to one storefront.

- [ ] **Step 2: Run the sweep at 360px**

```bash
node tools/a11y-sweep.js --width 360 --json /tmp/sweep.json
```
Expected: `clean` for all six marketing routes. Fix every overflow, every sub-44px tap
target, and every element that focuses with no visible change. **The nav drawer, the
carousel cards and the form controls are the likely offenders.**

- [ ] **Step 3: Check the pages at 390px in a browser**

Each of the six, looking for: the drawer opening and trapping focus, the hero sequence
not overflowing, cards stacking to one column, and no text under 14px.

- [ ] **Step 4: Lighthouse mobile**

Run Lighthouse against all six. Target ≥90 on Performance and Accessibility. If
Performance falls short on `/`, the cause is almost certainly the shot payload —
narrow the featured images with `srcset` before touching anything else.

- [ ] **Step 5: Full gate run**

```bash
node tools/build-catalog.js --check \
  && node tools/build-chrome.js --check \
  && node tools/check-pages.js \
  && node tools/check-links.js
```
Expected: all clean. On Windows, verify `build-catalog --check` the F2 way.

- [ ] **Step 6: 🔴 STOP — Jason updates Supabase by hand**

**Do not proceed without confirmation.** Ask Jason to add, in the Supabase dashboard
for project `newjbexmvltvtmxollca`:

- **Authentication → URL Configuration → Site URL:** `https://systemsbyvega.com/sites/`
- **Redirect URLs** — add: `https://systemsbyvega.com/sites/**`

Then, and only then:
1. Deploy with the bridge on **both** `/` and `/sites/`.
2. Verify a real confirmation email lands on `/sites/` signed in.
3. Only after that verification, delete the bridge from `/` in a separate commit.

- [ ] **Step 7: Commit**

```bash
git add tools/a11y-sweep.js
git commit -m "test(a11y): sweep the six marketing pages, not just the storefronts

pages() enumerated niches/ only, so every page a visitor lands on first
went unswept at 360px. The marketing routes join the same overflow, tap
target and focus-ring checks the 32 storefronts already got."
```

---

## Self-Review

**Spec coverage.** §2.1 bands → every page task. §2.4 motion → Tasks 2, 9.
§3.1 landing → 9. §3.2 catalog → 10. §3.3 platforms → 6. §3.4 services → 5.
§3.5 work → 7. §3.6 about → 8. §4.1 nav → 2. §4.2 redirects → 11.
§4.3 confirm bridge → 10 (both pages) + 12 (cutover). §4.4 footer → 2.
§4.5 analytics/robots/sitemap → 2 and 11. §5 screenshots → 3. §6 SQL → 4.
§7 decisions A/B/C → 11, 3, 8. §10 compliance → Task 1's gate, enforced continuously.

**Ordering.** Task 9 depends on Task 10 having moved the catalog; Step 1 of Task 9
checks this explicitly and stops if it has not happened. Everything else runs in the
written order.

**Naming consistency.** `inject()` (Task 1) is used by name in Tasks 1, 2, 10.
`PAGES` appears in both `check-pages.js` and `build-chrome.js` — deliberately separate
arrays with different shapes (`indexable` only on the latter), noted at each use.
`assets/shots/<group>/<name>.jpg` is the single filename convention throughout.

**Known gaps, by decision, not omission:** Spanish (F1), `.gitattributes` (F2), the
`BUILD:` marker for the "thirty-five entries" figure (F3). All three are parked in
`2026-09-10-followups.md`.
