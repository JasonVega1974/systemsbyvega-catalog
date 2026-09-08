#!/usr/bin/env node
/* tools/build-og.js — generate a niche's social share card.
 *
 *   node tools/build-og.js <slug>        writes niches/<slug>/og.svg
 *   node tools/build-og.js --all
 *
 * 1200x630, parameterised entirely from that niche's own content.json and
 * niche.css — brand name, tagline, service area, price range, palette, type.
 * Nothing is hand-authored per niche.
 *
 * NOTE ON FORMAT: this emits SVG as the SOURCE. Facebook, X and LinkedIn do not
 * render SVG for og:image — the card is raster-only in practice. See
 * SITELAB_TEMPLATE.md §8.1 for the rasterisation step that produces og.png,
 * which is what the page actually references.
 *
 * Zero dependencies. Node 18+.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const all = args.includes('--all');
const one = args.find(a => !a.startsWith('--'));
if (!one && !all) { console.error('usage: node tools/build-og.js <slug> | --all'); process.exit(2); }

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function deepMerge(base, over) {
  if (Array.isArray(over)) return over;
  if (!over || typeof over !== 'object') return over === undefined ? base : over;
  const out = Object.assign({}, base);
  for (const k of Object.keys(over)) {
    out[k] = (base && typeof base[k] === 'object' && !Array.isArray(base[k]))
      ? deepMerge(base[k], over[k]) : deepMerge(undefined, over[k]);
  }
  return out;
}

/* A themed niche draws its card from the theme's palette and merged content. */
const themeArg = () => {
  const i = process.argv.slice(2).indexOf('--theme');
  return i > -1 ? process.argv.slice(2)[i + 1] : '';
};

/* Pull a token's value out of niche.css, following one level of var() aliasing. */
function tokens(css) {
  const t = {};
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) t[m[1]] = m[2].trim();
  for (const k of Object.keys(t)) {
    const v = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(t[k]);
    if (v && t[v[1]]) t[k] = t[v[1]];
  }
  return t;
}

/* 'Anybody', system-ui, sans-serif  ->  Anybody */
const firstFamily = stack => (String(stack || '').split(',')[0] || '').replace(/['"]/g, '').trim();

/* Break a headline onto at most `max` lines at word boundaries. */
function wrap(text, perLine, max) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (next.length > perLine && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  if (lines.length > max) {
    const kept = lines.slice(0, max);
    kept[max - 1] = kept[max - 1].replace(/[\s—-]+$/, '') + '…';
    return kept;
  }
  return lines;
}

function card(slug) {
  const SRC = path.join(REPO, 'niches', slug);
  const theme = themeArg();
  const THEME_SRC = theme ? path.join(SRC, 'themes', theme) : SRC;
  let c = JSON.parse(fs.readFileSync(path.join(SRC, 'content.json'), 'utf8'));
  if (theme) {
    const ov = path.join(THEME_SRC, 'content.json');
    if (fs.existsSync(ov)) c = deepMerge(c, JSON.parse(fs.readFileSync(ov, 'utf8')));
  }
  const T = tokens(fs.readFileSync(path.join(THEME_SRC, 'niche.css'), 'utf8'));

  const ground = T['--ground'] || '#101010';
  const groundDeep = T['--ground-deep'] || ground;
  const ground2 = T['--ground-2'] || ground;
  const ink = T['--ink'] || '#ffffff';
  const inkDim = T['--ink-dim'] || T['--muted'] || ink;
  const muted = T['--muted'] || inkDim;
  const accent = T['--accent'] || '#ffffff';
  const accentInk = T['--accent-ink'] || ground;

  const display = firstFamily(T['--display']) || 'Georgia';
  const mono = firstFamily(T['--mono']) || 'monospace';
  const body = firstFamily(T['--body']) || 'sans-serif';

  /* An unquoted CSS font family must be a sequence of identifiers, and an
     identifier cannot start with a digit. "Source Sans 3" and "Baloo 2" are
     therefore INVALID unquoted, and the browser drops the whole font-family
     declaration rather than just that name — the card silently rasterised in
     Times New Roman. Quote only what actually needs it, so every niche whose
     families are already valid regenerates byte-identically. Single quotes,
     because this lands inside a double-quoted SVG attribute. */
  const needsQuotes = (n) => !/^[A-Za-z_-][\w-]*(?:\s+[A-Za-z_-][\w-]*)*$/.test(String(n).trim());
  const fam = (n) => (needsQuotes(n) ? "'" + String(n).replace(/'/g, '') + "'" : n);

  const brand = (c.brand || {}).name || slug;
  const tagline = (c.brand || {}).tagline || '';
  const area = (c.serviceArea || {}).region || (c.brand || {}).city || '';
  /* Only render the price when it carries figures. A schema.org price TIER
     ("$", "$") is valid structured data but renders as a stray glyph. */
  const rawPrice = (c.seo || {}).priceRange || '';
  const price = /\d/.test(rawPrice) ? rawPrice : '';

  // Headline scales down as it lengthens, so a long brand name never overflows.
  const nameLines = wrap(brand, 22, 2);
  const size = nameLines.length > 1 ? 78 : 96;
  const lead = size * 1.06;
  const nameY = nameLines.length > 1 ? 300 : 330;

  const tagLines = wrap(tagline, 46, 2);

  /* The footer rule used to sit at a fixed y=536 while everything above it
     flows from the headline's height, so a two-line brand name AND a two-line
     tagline put the second tagline baseline at 544.68 — the rule struck it
     through. Follow the content instead, with 536 as a floor so every
     shorter combination renders byte-identically, and a 564 ceiling so the
     rule never reaches the wordmark circle (top edge y=570). */
  const tagBottom = nameY + (nameLines.length - 1) * lead + 116 + (tagLines.length - 1) * 46;
  const footerY = Math.min(564, Math.max(536, Math.round(tagBottom + 18)));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${esc(brand)} — ${esc(tagline)}">
  <title>${esc(brand)}</title>
  <defs>
    <linearGradient id="${slug}-og-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${ground2}"/>
      <stop offset="0.55" stop-color="${ground}"/>
      <stop offset="1" stop-color="${groundDeep}"/>
    </linearGradient>
    <radialGradient id="${slug}-og-glow" cx="0.86" cy="-0.08" r="0.75">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${slug}-og-glow2" cx="0.04" cy="1.05" r="0.6">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#${slug}-og-ground)"/>
  <rect width="1200" height="630" fill="url(#${slug}-og-glow)"/>
  <rect width="1200" height="630" fill="url(#${slug}-og-glow2)"/>

  <!-- accent spine, left edge -->
  <rect x="0" y="0" width="10" height="630" fill="${accent}"/>

  <!-- eyebrow: where they work -->
  <text x="90" y="140" font-family="${fam(mono)}, ui-monospace, monospace" font-size="21"
        letter-spacing="4.6" fill="${muted}">${esc(area.toUpperCase())}</text>

  <!-- headline: the business -->
  ${nameLines.map((l, i) => `<text x="90" y="${nameY + i * lead}" font-family="${fam(display)}, Georgia, serif" font-size="${size}" font-weight="800" fill="${ink}">${esc(l)}</text>`).join('\n  ')}

  <!-- accent rule -->
  <rect x="90" y="${nameY + (nameLines.length - 1) * lead + 44}" width="132" height="7" fill="${accent}"/>

  <!-- tagline -->
  ${tagLines.map((l, i) => `<text x="90" y="${nameY + (nameLines.length - 1) * lead + 116 + i * 46}" font-family="${fam(body)}, system-ui, sans-serif" font-size="34" fill="${inkDim}">${esc(l)}</text>`).join('\n  ')}

  <!-- footer rule -->
  <rect x="90" y="${footerY}" width="1020" height="1" fill="${ink}" opacity="0.16"/>

  <!-- wordmark -->
  <circle cx="97" cy="577" r="7" fill="${accent}"/>
  <text x="116" y="584" font-family="${fam(mono)}, ui-monospace, monospace" font-size="20"
        letter-spacing="3.4" fill="${muted}">SYSTEMS BY VEGA</text>

  ${price ? `<text x="1110" y="584" text-anchor="end" font-family="${fam(mono)}, ui-monospace, monospace" font-size="20"
        letter-spacing="1.6" fill="${accent}">${esc(price)}</text>` : ''}
</svg>
`;
}

const slugs = all
  ? fs.readdirSync(path.join(REPO, 'niches'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
  : [one];

for (const s of slugs) {
  const th = themeArg();
  const out = th ? path.join(REPO, 'niches', s, 'themes', th, 'og.svg')
                 : path.join(REPO, 'niches', s, 'og.svg');
  const svg = card(s);
  fs.writeFileSync(out, svg, 'utf8');
  console.log('  ' + path.relative(REPO, out).replace(/\\/g, '/').padEnd(38) + svg.split('\n').length + ' lines');
}
