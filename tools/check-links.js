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
 * Fix round 1 (F1/F2 on Task 11) added a second, STRICTER pass over
 * og:image/twitter:image `content` URLs: those are fetched by a social
 * crawler that will not follow a 301 into an HTML page, so an image URL
 * that only resolves via the redirect table is exactly as broken as one
 * that resolves nowhere at all — the /portfolio/:path* redirect silently
 * broke /sites/'s share card this way, and neither a browser click-through
 * nor the href pass above would ever have caught it.
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
   real path-to-regexp dependency for a build-time check.

   Walked char-by-char rather than replaced with two global regexes: the old
   version ran the param substitutions over the RAW source and never
   escaped what was left, so a literal `.` in a literal path (the one in
   /niche-landing.html) matched as "any character" instead of a literal dot
   — over-permissive, not dangerous, but still wrong. The one pre-existing
   `(.*)` group (/api/(.*).js) is recognised and passed through as-is, same
   as before; every other character gets escaped so it can only match
   itself. */
function sourceToRegExp(source) {
  let pattern = '';
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    let m;
    if ((m = /^\(\.\*\)/.exec(rest))) {
      pattern += '(.*)';
      i += m[0].length;
    } else if ((m = /^:[A-Za-z0-9_]+\*/.exec(rest))) {
      pattern += '.*';
      i += m[0].length;
    } else if ((m = /^:[A-Za-z0-9_]+/.exec(rest))) {
      pattern += '[^/]+';
      i += m[0].length;
    } else {
      pattern += rest[0].replace(/[.*+?^${}()|[\]\\]/, '\\$&');
      i += 1;
    }
  }
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

/* -- absolute-URL handling (for og:image / twitter:image) ---------------- */

/* These two are the only meta content URLs a social crawler fetches, and
   they are always written absolute (https://systemsbyvega.com/...) rather
   than root-relative, unlike every href on the site. Strip our own origin
   so the rest of the pipeline can treat them exactly like an href path.
   A URL on any other host is left alone — nothing here can check a file
   that does not live in this repo, and none of ours point off-site. */
function ownOriginPath(url) {
  const m = url.match(/^https?:\/\/(?:www\.)?systemsbyvega\.com(\/.*)$/i);
  return m ? m[1] : null;
}

/* -- href extraction ------------------------------------------------------ */

const HREF_RE = /href\s*=\s*"([^"]*)"/g;

/* Matches the whole <meta ...> tag so property/name and content can appear
   in either order, then a second pass pulls `content` out of that tag. */
const META_IMG_TAG_RE = /<meta\b[^>]*\b(?:property|name)\s*=\s*"(?:og:image|twitter:image)"[^>]*>/gi;
const CONTENT_ATTR_RE = /\bcontent\s*=\s*"([^"]*)"/i;

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

    META_IMG_TAG_RE.lastIndex = 0;
    while ((m = META_IMG_TAG_RE.exec(line))) {
      const contentMatch = m[0].match(CONTENT_ATTR_RE);
      if (!contentMatch) continue;
      const raw = contentMatch[1];
      if (raw === '' || /^data:/i.test(raw)) continue;

      const pathname = /^https?:\/\//i.test(raw) ? ownOriginPath(raw) : raw;
      if (pathname === null) continue; // a foreign host — not ours to check

      checked++;
      /* Redirects are checked FIRST and win even when a file also happens to
         sit at that same disk path — that is the real Vercel evaluation
         order (redirects are matched before the filesystem is ever
         consulted), and it is exactly how /sites/'s og:image broke: the
         file at portfolio/assets/img/systemsbyvega.jpg never stopped
         existing, but /portfolio/:path* intercepts the URL before the file
         is reached. A social crawler fetches this URL directly and will
         NOT follow a 301 into an HTML page, so landing on a redirect is
         exactly as broken as landing on nothing. */
      if (matchesRedirect(pathname)) {
        failures++;
        console.log(`  FAIL  ${rel}:${idx + 1}  content="${raw}" resolves to a REDIRECT, not a file — a crawler fetching this image gets an HTML page`);
      } else if (!fileResolves(pathname)) {
        failures++;
        console.log(`  FAIL  ${rel}:${idx + 1}  content="${raw}" resolves to neither a file nor a redirect`);
      }
    }
  });
}

console.log(failures
  ? `\n${failures} dead link(s) out of ${checked} checked`
  : `\n${checked} link(s) checked, all resolve`);
process.exit(failures ? 1 : 0);
