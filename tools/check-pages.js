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
  { route: '/',       file: 'index.html',       sharedAssets: true },
  /* sharedAssets:false is a DECLARED, REASONED exception, not an oversight.
     sites/index.html is ~300 lines of inline <style> and loads neither shared
     asset, so the injected chrome is unstyled and its drawer is inert there.
     Task 10 deletes that inline block when it consolidates the catalog into
     this page, and flips this flag to true. The gate fails if it forgets. */
  { route: '/sites/', file: 'sites/index.html', sharedAssets: false,
    pending: 'inline <style> until Task 10 consolidates the catalog here' },
  { route: '/platforms/', file: 'platforms/index.html', sharedAssets: true },
  { route: '/services/', file: 'services/index.html', sharedAssets: true },
  { route: '/work/', file: 'work/index.html', sharedAssets: true },
  { route: '/about/', file: 'about/index.html', sharedAssets: true },
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

  /* Ruling R11: sharedAssets is a declared, reasoned exception, not silence.
     A page that opts out still gets a line on every run, so the debt stays
     visible instead of disappearing the way the missing /sites/ disclaimer
     once did. */
  if (page.sharedAssets) {
    if (!html.includes('/assets/sbv.css')) bad(page.route, 'does not load /assets/sbv.css');
    if (!html.includes('/assets/sbv.js'))  bad(page.route, 'does not load /assets/sbv.js');
  } else {
    console.log(`  pend  ${page.route}  shared assets deferred — ${page.pending}`);
  }

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
