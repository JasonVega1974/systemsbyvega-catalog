#!/usr/bin/env node
/* a11y-sweep.js — the §9.4 pass, measured rather than eyeballed.
 *
 * Four checks, over every built page, at 360px:
 *   1. horizontal overflow  — documentElement.scrollWidth > clientWidth, plus the
 *      specific elements whose right edge crosses the viewport, so the punch list
 *      names a selector and not just "the page"
 *   2. tap targets          — every interactive element whose rendered box is
 *      under 44x44 CSS px (WCAG 2.5.5 / 2.5.8 AAA-ish; 24px is the AA floor, so
 *      both thresholds are reported separately)
 *   3. focus rings          — focus each interactive element and check that
 *      SOMETHING visibly changes (outline, box-shadow, or a ring via ::after).
 *      outline:none with no replacement is the failure this catches.
 *   4. contrast             — WCAG 2.1 ratio from RESOLVED colours, walking up
 *      for the first non-transparent background. Reports < 4.5 for normal text
 *      and < 3.0 for large text (>=24px, or >=18.66px bold).
 *
 * Contrast against a gradient or image background cannot be computed from
 * getComputedStyle — those are reported separately as "needs a human eye"
 * rather than guessed at.
 *
 *   node tools/a11y-sweep.js [--width 360] [--json <file>] [slug ...]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const REPO = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : d; };
const WIDTH = Number(flag('--width', 360));
const JSON_OUT = flag('--json', '');
const only = args.filter(a => !a.startsWith('--') && a !== String(WIDTH) && a !== JSON_OUT);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function resolvePlaywright() {
  for (const c of [process.env.SITELAB_PLAYWRIGHT, 'playwright',
    'C:/Users/JasonVega/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright']) {
    if (!c) continue;
    try { return require(c); } catch (e) { /* next */ }
  }
  throw new Error('playwright not found — set SITELAB_PLAYWRIGHT');
}

/* Same three-way browser resolution as tools/build-shots.js: playwright-core
   is already a dependency, @sparticuz/chromium's executablePath is undefined
   outside its AWS-Lambda build (verified on this machine, so never tried
   here), and system Chrome via channel:'chrome' is the reliable local route.
   Falls back to whatever resolvePlaywright() found, in case a future machine
   does have a bundled browser under one of those paths. */
async function launchBrowser() {
  const attempts = [];
  try {
    const { chromium } = require('playwright-core');
    return await chromium.launch({ headless: true, channel: 'chrome' });
  } catch (e) { attempts.push(`playwright-core channel:'chrome' -> ${e.message.split('\n')[0]}`); }

  try {
    const pw = resolvePlaywright();
    try { return await pw.chromium.launch({ headless: true, channel: 'chrome' }); }
    catch (e) { return await pw.chromium.launch({ headless: true }); }
  } catch (e) { attempts.push(`resolvePlaywright() -> ${e.message.split('\n')[0]}`); }

  throw new Error('No local Chromium found. Attempts:\n  ' + attempts.join('\n  '));
}

function serve(root) {
  const ROOT = path.resolve(root);
  return new Promise((res, rej) => {
    const s = http.createServer((req, r) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/favicon.ico') { r.writeHead(204); return r.end(); }
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        r.writeHead(404); return r.end('nf');
      }
      r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      r.end(fs.readFileSync(f));
    });
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => res({ s, port: s.address().port }));
  });
}

/* The six marketing pages. pages() previously enumerated niches/ only, so
   every page a visitor actually lands on first went unswept. */
const MARKETING = ['/', '/sites/', '/platforms/', '/services/', '/work/', '/about/'];

/* Every built page: a plain niche is one, a themed niche is one per theme,
   plus the six marketing routes above — unless `only` narrows to specific
   slugs, in which case the marketing pages are skipped so
   `node tools/a11y-sweep.js landscaping` still means just landscaping. */
function pages() {
  const out = [];
  if (!only.length) {
    for (const url of MARKETING) out.push({ name: url, url });
  }
  for (const slug of fs.readdirSync(path.join(REPO, 'niches'))) {
    if (!fs.statSync(path.join(REPO, 'niches', slug)).isDirectory()) continue;
    if (only.length && !only.includes(slug)) continue;
    const themes = path.join(REPO, 'niches', slug, 'themes');
    if (fs.existsSync(themes)) {
      for (const t of fs.readdirSync(themes)) out.push({ name: `${slug}/${t}`, url: `/sites/${slug}/${t}/index.html` });
    } else out.push({ name: slug, url: `/sites/${slug}/index.html` });
  }
  return out;
}

/* Runs INSIDE the page. Kept self-contained — no closure over node scope. */
const PROBE = () => {
  const R = { overflow: [], taps: [], focus: [], contrast: [], unmeasurable: [] };
  const vw = document.documentElement.clientWidth;

  const sel = el => {
    if (el.id) return '#' + el.id;
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return el.tagName.toLowerCase() + (cls.length ? '.' + cls.join('.') : '');
  };
  const vis = el => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    /* An off-canvas drawer (position:fixed/absolute, translateX past the
       viewport edge when closed) still has display!=none and a real
       bounding box, so without this it reads as a normal, visible,
       undersized nav link — closed navs like this exist specifically so
       their contents are NOT reachable until opened. Vertical position is
       untouched: below-the-fold content is genuinely visible on scroll and
       must still be checked. */
    if (r.right <= 0 || r.left >= vw) return false;
    return true;
  };

  /* ---- 1. horizontal overflow ---- */
  R.pageOverflow = Math.max(0, document.documentElement.scrollWidth - vw);
  if (R.pageOverflow > 0) {
    for (const el of document.querySelectorAll('body *')) {
      if (!vis(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width <= vw * 3) {
        const s = getComputedStyle(el);
        if (s.overflowX === 'auto' || s.overflowX === 'scroll') continue;  // deliberate
        R.overflow.push({ sel: sel(el), right: Math.round(r.right), over: Math.round(r.right - vw) });
      }
    }
    R.overflow.sort((a, b) => b.over - a.over);
    R.overflow = R.overflow.slice(0, 8);
  }

  /* ---- 2. tap targets ---- */
  const INTERACTIVE = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [tabindex]:not([tabindex="-1"])';
  const nodes = [...document.querySelectorAll(INTERACTIVE)].filter(vis);
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w < 44 || h < 44) {
      R.taps.push({ sel: sel(el), w, h, text: (el.innerText || el.value || '').trim().slice(0, 28),
                    aa: (w >= 24 && h >= 24) });
    }
  }

  /* ---- 3. focus rings ---- */
  /* stroke/strokeWidth added for SVG interactive elements (delivery's map-zone
     <path role=button> pins use a stroke-based focus ring, not outline/
     box-shadow/border — without these the snapshot never changed and every
     one of them read as "no visible focus", a false positive this tool would
     otherwise report on a focus style that genuinely exists). */
  const snap = el => { const s = getComputedStyle(el);
    return s.outlineStyle + '|' + s.outlineWidth + '|' + s.outlineColor + '|' + s.boxShadow + '|' +
           s.borderColor + '|' + s.backgroundColor + '|' + s.stroke + '|' + s.strokeWidth; };
  for (const el of nodes.slice(0, 60)) {
    const before = snap(el);
    try { el.focus({ preventScroll: true }); } catch (e) { continue; }
    /* Several niches swap outline for a border/background-color change that
       is CSS-transitioned (e.g. dj's .field input:focus, .2s). Read cold,
       immediately after focus(), that transition has not moved yet and
       "after" comes back identical to "before" — a false negative on a
       focus style that genuinely works. Finishing any transition/animation
       the focus triggered jumps straight to its end state without an actual
       wait, so the snapshot reflects where the style lands, not the first
       animation frame. */
    try { el.getAnimations().forEach(a => a.finish()); } catch (e) { /* not Animatable, fine */ }
    const after = snap(el);
    if (document.activeElement !== el) continue;
    if (before === after) R.focus.push({ sel: sel(el), text: (el.innerText || '').trim().slice(0, 28) });
    try { el.blur(); } catch (e) {}
  }

  /* ---- 4. contrast ---- */
  const parse = c => {
    const m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (!m) return null;
    const p = m[1].split(',').map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = c => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };

  const TEXT = 'p, li, a, span, h1, h2, h3, h4, button, label, td, th, figcaption, small, strong, em, div';
  const seen = new Set();
  for (const el of [...document.querySelectorAll(TEXT)].filter(vis)) {
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) continue;
    const s = getComputedStyle(el);
    const fg = parse(s.color);
    if (!fg || fg.a === 0) continue;

    /* walk up for the first opaque background; report, do not guess, when the
       backdrop is an image or gradient */
    let bg = null, node = el, gradient = false;
    while (node && node !== document.documentElement.parentNode) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') { gradient = true; break; }
      const c = parse(cs.backgroundColor);
      if (c && c.a >= 0.95) { bg = c; break; }
      node = node.parentElement;
    }
    const key = sel(el) + '|' + s.color + '|' + s.fontSize;
    if (seen.has(key)) continue;
    seen.add(key);

    if (gradient) {
      if (R.unmeasurable.length < 12) {
        R.unmeasurable.push({ sel: sel(el), fg: s.color, reason: 'gradient or image backdrop',
                              text: (el.innerText || '').trim().slice(0, 30) });
      }
      continue;
    }
    if (!bg) continue;
    const px = parseFloat(s.fontSize);
    const bold = Number(s.fontWeight) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const need = large ? 3.0 : 4.5;
    const got = ratio(fg, bg);
    if (got < need) {
      R.contrast.push({ sel: sel(el), ratio: Math.round(got * 100) / 100, need,
                        px: Math.round(px), fg: s.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`,
                        text: (el.innerText || '').trim().slice(0, 30) });
    }
  }
  R.contrast.sort((a, b) => a.ratio - b.ratio);
  R.contrast = R.contrast.slice(0, 10);
  R.tapCount = R.taps.length;
  R.taps = R.taps.slice(0, 10);
  return R;
};

(async () => {
  const browser = await launchBrowser();
  const { s, port } = await serve(REPO);

  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 800 },
                                         deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const all = [];

  for (const p of pages()) {
    await page.goto(`http://127.0.0.1:${port}${p.url}`, { waitUntil: 'load' });
    await page.waitForTimeout(700);          // let the renderer and reveal settle
    const r = await page.evaluate(PROBE);
    r.page = p.name;
    all.push(r);
    const bits = [];
    if (r.pageOverflow) bits.push(`overflow +${r.pageOverflow}px`);
    if (r.tapCount) bits.push(`${r.tapCount} small tap`);
    if (r.focus.length) bits.push(`${r.focus.length} no-focus`);
    if (r.contrast.length) bits.push(`${r.contrast.length} contrast`);
    if (r.unmeasurable.length) bits.push(`${r.unmeasurable.length} unmeasurable`);
    console.log('  ' + p.name.padEnd(20) + (bits.length ? bits.join(' · ') : 'clean'));
  }

  await browser.close();
  s.close();
  if (JSON_OUT) { fs.writeFileSync(JSON_OUT, JSON.stringify(all, null, 2)); console.log('\n  wrote ' + JSON_OUT); }

  const tot = k => all.reduce((n, r) => n + (Array.isArray(r[k]) ? r[k].length : 0), 0);
  console.log(`\n  ${all.length} pages at ${WIDTH}px · overflow ${all.filter(r => r.pageOverflow > 0).length} pages` +
              ` · small taps ${all.reduce((n, r) => n + r.tapCount, 0)}` +
              ` · missing focus ${tot('focus')} · contrast ${tot('contrast')} · unmeasurable ${tot('unmeasurable')}`);
})().catch(e => { console.error('sweep failed: ' + e.message); process.exit(1); });
