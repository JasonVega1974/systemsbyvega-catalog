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
  { route: '/',         file: 'index.html',         indexable: true },
  { route: '/sites/',   file: 'sites/index.html',   indexable: true },
  { route: '/platforms/', file: 'platforms/index.html', indexable: true },
  { route: '/services/', file: 'services/index.html', indexable: true },
  { route: '/work/', file: 'work/index.html', indexable: true },
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
