#!/usr/bin/env node
/* ============================================================================
   build-catalog.js — pre-render the catalog into sites/index.html (and hand
   its figures to every page that still needs one)
   ----------------------------------------------------------------------------
   Reads assets/data/niches.seed.json and writes the finished catalog markup,
   the niche <select>, the inline seed, and every masthead figure between
   BUILD: markers. The catalog board itself lives on sites/index.html now
   (Task 10 moved it off the root); index.html and platforms/index.html each
   still need a subset of the same figures, so this file targets all three.

   WHY THIS EXISTS. The catalog is the product; it must be in the HTML. If the
   page drew itself from JavaScript, a visitor with JS disabled or a script that
   threw early would get an empty page — which is exactly the failure the demo
   sites under /sites/ carried before this task (their #svcGrid, #priceGrid and
   #faqList rendered as empty containers with JS off).

   It also means NO COUNT IS EVER TYPED BY HAND. "38 businesses listed" and
   "Three are open today" are computed from the seed on every build. An earlier
   homepage claimed nine shipped projects while the portfolio rendered eleven,
   because both numbers were written out by a person. This removes that class
   of error entirely.

   Ruling R1 — three files, three marker sets. inject() throws on a marker a
   file does not declare, so each target below names exactly what it carries.
   index.html carries TOTAL/OPEN/SITES for its proof strip, plus (Ruling R20)
   SITES_OFFER/SITES_STEP/SITES_LINK for the three other places that page
   says "32" in prose — inject() cannot reuse one marker name twice in a
   file, so each spot gets its own name, all fed the same fig.sites value.

   Run:  node tools/build-catalog.js          (from the repo root)
         node tools/build-catalog.js --check  (verify, write nothing; CI-safe)
   ========================================================================= */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '..');
const SEED   = path.join(ROOT, 'assets', 'data', 'niches.seed.json');
const MANIFESTS = path.join(ROOT, 'assets', 'data', 'manifests.json');
const R      = require(path.join(ROOT, 'assets', 'catalog-render.js'));
const { inject } = require('./lib/inject');

const CHECK = process.argv.includes('--check');

/* Two files, different marker sets, and now a third. The catalog lives on
   /sites/ now, but the landing page's proof strip still needs its three
   figures — and those figures must come from the same R.figures() call as
   everything else, or the landing page becomes a fourth place a count is
   written down. platforms/index.html only ever needed the seed script, which
   it used to carry by hand (see the removed TODO there). inject() throws on a
   missing marker, so each target names exactly what it carries. */
const TARGETS = [
  { file: path.join(ROOT, 'index.html'),
    markers: ['TOTAL', 'OPEN', 'SITES', 'SITES_OFFER', 'SITES_STEP', 'SITES_LINK',
               'HERO_ROTATOR', 'SEED_SCRIPT'] },
  { file: path.join(ROOT, 'sites', 'index.html'),
    markers: ['TOTAL', 'OPEN', 'SITES', 'THESIS_OPEN',
              'CATALOG', 'NICHE_SELECT', 'SEED_SCRIPT', 'EXTRAS_SCRIPT'] },
  { file: path.join(ROOT, 'platforms', 'index.html'),
    markers: ['SEED_SCRIPT', 'PLAT_INLINE'] },
  /* Finding 3 of the final whole-branch review: three more pages hand-typed
     counts the project already ruled indefensible for the landing page
     (Ruling R20). Same fix, same reasoning — a marker fed from the one
     R.figures() call, so these cannot print a number that disagrees with
     the catalog a click away. */
  { file: path.join(ROOT, 'services', 'index.html'),
    markers: ['SVC_SITES'] },
  { file: path.join(ROOT, 'work', 'index.html'),
    markers: ['WK_SITES'] },
];

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

/* --------------------------------------------------------------- extras */
/* window.SBV_EXTRAS: a slug-keyed lookup of things that describe the demo
   ARTIFACT on disk (a brand name picked for the mockup, the feature chips a
   template happens to ship with) rather than the business's commercial state.
   Those can never become sbv_niches columns — see assets/catalog-render.js's
   header — so they travel next to the seed instead, read by both the build
   and the runtime re-render off the same file, same as SBV_SEED itself. */
const SECTION_LABEL = {
  pricing:      'Pricing tiers',
  beforeAfter:  'Before/after gallery',
  jobDetails:   'Job detail cards',
  reviews:      'Reviews',
  social:       'Social links',
  ownerBlock:   'Owner profile',
  footerContact:'Contact footer'
};

function buildExtras(seed) {
  let manifests = {};
  try { manifests = JSON.parse(fs.readFileSync(MANIFESTS, 'utf8')); }
  catch (e) { /* no manifest data — extras degrade to brand-only or empty */ }

  const extras = {};
  seed.niches.forEach(n => {
    if (!n.demo_path) return;
    const dirSlug = n.demo_path.replace(/^\/sites\//, '').replace(/\/$/, '');
    const contentPath = path.join(ROOT, 'sites', dirSlug, 'content.json');

    let brand = null;
    try {
      const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
      brand = (content.brand && content.brand.name) || null;
    } catch (e) { /* no content.json — brand stays unset, the card still renders */ }

    const sections = (manifests[dirSlug] && manifests[dirSlug].sections) || {};
    const chips = Object.keys(SECTION_LABEL)
      .filter(k => sections[k])
      .map(k => SECTION_LABEL[k]);
    if (n.website_offer) chips.push('Owner admin panel (live CMS)');

    if (brand || chips.length) extras[n.slug] = {};
    if (brand) extras[n.slug].brand = brand;
    if (chips.length) extras[n.slug].chips = chips;
  });
  return extras;
}

/* -------------------------------------------------------------------- run */
function main() {
  const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));

  const errs = validate(seed);
  if (errs.length) {
    console.error('SEED INVALID — nothing written:\n' + errs.map(e => '  · ' + e).join('\n'));
    process.exit(1);
  }

  const fig    = R.figures(seed.niches);
  const extras = buildExtras(seed);

  const seedScript =
    '\n<script>window.SBV_SEED=' +
    JSON.stringify({ families: seed.families, niches: seed.niches }) +
    ';</script>\n';
  const extrasScript =
    '\n<script>window.SBV_EXTRAS=' + JSON.stringify(extras) + ';</script>\n';

  /* Every value ANY target might ask for, built once from the one R.figures()
     call — so index.html, sites/index.html and platforms/index.html cannot
     print three different counts for the same seed. Each target's own
     `markers` list decides which of these it actually receives. */
  const VALUES = {
    THESIS_OPEN:  R.thesisOpen(fig.open),
    TOTAL:        String(fig.total),
    OPEN:         String(fig.open),
    SITES:        String(fig.sites),
    /* Ruling R20: three more spots on index.html print the same site count in
       prose ("32 industries…", "32 built and live…", "All 32 sites →").
       inject() splices between the FIRST open/close pair for a marker name,
       so one name cannot appear twice in a file — hence three distinct
       marker names, all fed this same fig.sites value, never typed by hand
       a second time. */
    SITES_OFFER:  String(fig.sites),
    SITES_STEP:   String(fig.sites),
    SITES_LINK:   String(fig.sites),
    /* Finding 3: services/index.html and work/index.html each print the
       site count once in prose; platforms/index.html prints the in-line
       count right above the chips that already render it. All three fed
       from this same fig, never typed by hand a second time. */
    SVC_SITES:    String(fig.sites),
    WK_SITES:     String(fig.sites),
    PLAT_INLINE:  String(fig.inLine),
    /* The hero rotator's 32 frames, from the same seed rows that name the
       screenshots tools/build-shots.js captures. Generated, not typed: a
       niche given a demo_path in the seed joins the hero on the next build,
       the same way it joins the catalog. */
    HERO_ROTATOR: '\n' + R.heroRotator(seed.niches) + '\n',
    CATALOG:      '\n' + R.catalog(seed.families, seed.niches, {}, extras) + '\n',
    NICHE_SELECT: '\n' + R.nicheSelect(seed.niches) + '\n',
    SEED_SCRIPT:  seedScript,
    EXTRAS_SCRIPT: extrasScript
  };

  let anyDrift = false;

  TARGETS.forEach(target => {
    const label = path.relative(ROOT, target.file);
    let html = fs.readFileSync(target.file, 'utf8');
    const before = html;

    target.markers.forEach(marker => {
      html = inject(html, marker, VALUES[marker], label);
    });

    if (CHECK) {
      if (before !== html) {
        console.error(`${label} is out of date with the seed.`);
        anyDrift = true;
      } else {
        console.log(`${label} is in sync with the seed.`);
      }
      return;
    }

    fs.writeFileSync(target.file, html);
    console.log(`built ${label} from seed`);
  });

  if (CHECK) {
    if (anyDrift) {
      console.error('Run: node tools/build-catalog.js');
      process.exit(1);
    }
    return;
  }

  console.log(`  ${fig.total} listed · ${fig.open} open · ${fig.inLine} in line · ${fig.websiteOnly} website-only`);
  console.log(`  ${seed.families.length} family plates`);
}

main();
