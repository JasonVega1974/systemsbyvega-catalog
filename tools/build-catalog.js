#!/usr/bin/env node
/* ============================================================================
   build-catalog.js — pre-render the catalog into index.html
   ----------------------------------------------------------------------------
   Reads assets/data/niches.seed.json and writes the finished catalog markup,
   the niche <select>, the inline seed, and every masthead figure into
   index.html between BUILD: markers.

   WHY THIS EXISTS. The catalog is the product; it must be in the HTML. If the
   page drew itself from JavaScript, a visitor with JS disabled or a script that
   threw early would get an empty page — which is exactly the failure the demo
   sites under /sites/ carry today (their #svcGrid, #priceGrid and #faqList
   render as empty containers with JS off).

   It also means NO COUNT IS EVER TYPED BY HAND. "29 businesses listed" and
   "Two are open today" are computed from the seed on every build. The previous
   homepage claimed nine shipped projects while the portfolio rendered eleven,
   because both numbers were written out by a person. This removes that class
   of error entirely.

   Run:  node tools/build-catalog.js          (from the repo root)
         node tools/build-catalog.js --check  (verify, write nothing; CI-safe)
   ========================================================================= */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '..');
const SEED   = path.join(ROOT, 'assets', 'data', 'niches.seed.json');
const PAGE   = path.join(ROOT, 'index.html');
const R      = require(path.join(ROOT, 'assets', 'catalog-render.js'));
const { inject } = require('./lib/inject');

const CHECK = process.argv.includes('--check');

/* ------------------------------------------------------------- validation */
/* A bad seed should stop the build, not ship a wrong catalog. */
function validate(seed) {
  const errs = [];
  const slugs = new Set();
  const cats  = new Set();
  const famKeys = new Set(seed.families.map(f => f.key));
  const famCode = Object.fromEntries(seed.families.map(f => [f.key, f.code]));

  seed.niches.forEach(n => {
    const at = n.slug || '(no slug)';
    if (slugs.has(n.slug)) errs.push(`duplicate slug: ${n.slug}`);
    slugs.add(n.slug);
    if (cats.has(n.catalog_no)) errs.push(`duplicate catalog_no: ${n.catalog_no}`);
    cats.add(n.catalog_no);

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(n.slug || '')) errs.push(`bad slug: ${at}`);
    if (!famKeys.has(n.family)) errs.push(`${at}: unknown family "${n.family}"`);
    if (famCode[n.family] && n.catalog_no.split('-')[0] !== famCode[n.family]) {
      errs.push(`${at}: catalog_no "${n.catalog_no}" does not match family code "${famCode[n.family]}"`);
    }
    if (!['open', 'in_line', 'website_only'].includes(n.status)) errs.push(`${at}: bad status "${n.status}"`);

    // an open business must have somewhere to send people, and only an open one may
    if ((n.status === 'open') !== (n.open_url != null)) {
      errs.push(`${at}: open_url must be set if and only if status is "open"`);
    }
    // never offer a website preview we cannot show
    if (n.website_offer && !n.demo_path) errs.push(`${at}: website_offer with no demo_path`);
    if (!n.job_line) errs.push(`${at}: missing job_line`);

    // compliance tripwire: no figure that could read as an earnings claim
    const money = /\$[\d,]+/g;
    const fields = [n.job_line, n.caveat].filter(Boolean).join(' ');
    if (money.test(fields)) errs.push(`${at}: dollar figure in job_line/caveat — prices belong in price_label`);
  });

  // every demo_path must actually exist on disk
  seed.niches.forEach(n => {
    if (!n.demo_path) return;
    const p = path.join(ROOT, n.demo_path.replace(/^\//, ''), 'index.html');
    if (!fs.existsSync(p)) errs.push(`${n.slug}: demo_path ${n.demo_path} has no index.html on disk`);
  });

  return errs;
}

/* -------------------------------------------------------------------- run */
function main() {
  const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));

  const errs = validate(seed);
  if (errs.length) {
    console.error('SEED INVALID — nothing written:\n' + errs.map(e => '  · ' + e).join('\n'));
    process.exit(1);
  }

  const fig = R.figures(seed.niches);
  const seedScript =
    '\n<script>window.SBV_SEED=' +
    JSON.stringify({ families: seed.families, niches: seed.niches }) +
    ';</script>\n';

  let html = fs.readFileSync(PAGE, 'utf8');
  const before = html;

  html = inject(html, 'THESIS_OPEN',  R.thesisOpen(fig.open));
  html = inject(html, 'TOTAL',        String(fig.total));
  html = inject(html, 'OPEN',         String(fig.open));
  html = inject(html, 'SITES',        String(fig.sites));
  html = inject(html, 'CATALOG',      '\n' + R.catalog(seed.families, seed.niches, {}) + '\n');
  html = inject(html, 'NICHE_SELECT', '\n' + R.nicheSelect(seed.niches) + '\n');
  html = inject(html, 'SEED_SCRIPT',  seedScript);

  if (CHECK) {
    if (before !== html) {
      console.error('index.html is out of date with the seed. Run: node tools/build-catalog.js');
      process.exit(1);
    }
    console.log('index.html is in sync with the seed.');
    return;
  }

  fs.writeFileSync(PAGE, html);

  console.log('built index.html from seed');
  console.log(`  ${fig.total} listed · ${fig.open} open · ${fig.inLine} in line · ${fig.websiteOnly} website-only`);
  console.log(`  ${seed.families.length} family plates`);
}

main();
