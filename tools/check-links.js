#!/usr/bin/env node
'use strict';
/* check-links.js — nothing that used to work may 404.
 *
 * WHY THIS EXISTS. Task 11 retired /demo/, /showcase/ and /portfolio/ behind
 * 301s and retargeted /pricing/ and /niche-landing.html away from anchors
 * that no longer exist. Ad creatives on Facebook, Instagram and TikTok carry
 * old URLs that cannot be edited retroactively, so every internal href this
 * site ships has to resolve to SOMETHING — a real file, or a redirect rule
 * in vercel.json that gets it there. A link that resolves to neither is a
 * silent 404 waiting for a paying visitor to find it.
 *
 * This crawls every href in the six marketing pages plus /legal/*, resolves
 * each one against the filesystem and the vercel.json redirect table, and
 * fails on anything that resolves to neither. It does not know or care
 * whether a redirect is the RIGHT fix — check-pages.js and human judgment
 * own that. It only proves the destination exists.
 *
 * Static text inspection only. No browser, no network — same posture as
 * check-pages.js.
 *
 *   node tools/check-links.js          exit 0 clean, 1 on any dead link
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

/* The six marketing pages, same set check-pages.js gates, plus every legal
   document they all link to from the footer. A page task is not done until
   its route is here. */
const FILES = [
  'index.html',
  'sites/index.html',
  'platforms/index.html',
  'services/index.html',
  'work/index.html',
  'about/index.html',
  'legal/terms.html',
  'legal/privacy.html',
  'legal/refund.html',
  'legal/operator-agreement.html',
];

/* -- load the redirect table -------------------------------------------- */

let redirects;
try {
  const vercelJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  redirects = vercelJson.redirects || [];
} catch (e) {
  console.error('check-links: could not read/parse vercel.json —', e.message);
  process.exit(1);
}

/* Vercel's `source` uses path-to-regexp. This codebase's table only ever
   needs two of its features: a literal path, and a `:name*` catch-all
   segment (plus one pre-existing bare regex group in /api/(.*).js, which
   passes through untouched since `(...)` is already valid regex). That is
   enough to match everything actually in the table without pulling in the
   real path-to-regexp dependency for a build-time check. */
function sourceToRegExp(source) {
  const pattern = source.replace(/:([A-Za-z0-9_]+)\*/g, '.*')
                         .replace(/:([A-Za-z0-9_]+)/g, '[^/]+');
  return new RegExp('^' + pattern + '$');
}

const redirectMatchers = redirects.map(r => ({
  source: r.source,
  regex: sourceToRegExp(r.source),
}));

function matchesRedirect(pathname) {
  return redirectMatchers.some(m => m.regex.test(pathname));
}

/* -- filesystem resolution ------------------------------------------------ */

function fileResolves(pathname) {
  if (pathname === '' || pathname === '/') return fs.existsSync(path.join(ROOT, 'index.html'));

  const clean = pathname.replace(/^\/+/, '');

  /* A path with a real extension (.html, .css, .js, ...) is a file, checked
     literally. A path with no extension is a route — this site serves it
     as trailingSlash-normalized directory/index.html either way, so both
     the exact directory (with or without the slash already stripped) and
     its index.html are checked. */
  const abs = path.join(ROOT, clean);
  if (path.extname(clean) && fs.existsSync(abs) && fs.statSync(abs).isFile()) return true;
  if (fs.existsSync(path.join(abs, 'index.html'))) return true;
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return true;
  return false;
}

/* -- href extraction ------------------------------------------------------ */

const HREF_RE = /href\s*=\s*"([^"]*)"/g;

function skip(href) {
  return href === ''
    || /^https?:\/\//i.test(href)
    || /^mailto:/i.test(href)
    || /^tel:/i.test(href)
    || /^data:/i.test(href)
    || href.startsWith('#');
}

let failures = 0;
let checked = 0;

for (const rel of FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.log(`  FAIL  ${rel}  file does not exist (add it to FILES only once it does)`);
    failures++;
    continue;
  }
  const lines = fs.readFileSync(abs, 'utf8').split('\n');

  lines.forEach((line, idx) => {
    let m;
    HREF_RE.lastIndex = 0;
    while ((m = HREF_RE.exec(line))) {
      const raw = m[1];
      if (skip(raw)) continue;

      /* Strip the fragment and query — neither is seen by the filesystem or
         by a Vercel redirect match, and a page linking to its OWN #section
         is not a cross-page link this tool has any business judging. */
      const pathname = raw.split('#')[0].split('?')[0];
      if (pathname === '') continue; // was fragment/query-only, e.g. "#line" already skipped above, or "?x=1"

      checked++;
      if (!fileResolves(pathname) && !matchesRedirect(pathname)) {
        failures++;
        console.log(`  FAIL  ${rel}:${idx + 1}  href="${raw}" resolves to neither a file nor a redirect`);
      }
    }
  });
}

console.log(failures
  ? `\n${failures} dead link(s) out of ${checked} checked`
  : `\n${checked} link(s) checked, all resolve`);
process.exit(failures ? 1 : 0);
