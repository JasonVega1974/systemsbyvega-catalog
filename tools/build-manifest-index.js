#!/usr/bin/env node
/* tools/build-manifest-index.js — compiles every niches/<slug>/manifest.json
 * into one built artifact, assets/data/manifests.json, so the browser (admin,
 * which cannot read niches/ at runtime) has a single fetch to consult.
 * See docs/superpowers/specs/2026-09-06-phase-a-platform-generalization.md
 * Decision 1 ("Admin consumption").
 *
 *   node tools/build-manifest-index.js
 *
 * Reads all niches/*, skips any niche without a manifest.json (most don't
 * have one yet — Task 3 fills the rest in), validates every manifest found
 * (reusing tools/validate-manifest.js so the rules can never drift between
 * the two tools), and fails loudly on the first invalid one rather than
 * shipping a partial index.
 *
 * Output is deterministic: slugs sorted, and each entry's keys written in a
 * fixed order — so the same inputs always produce a byte-identical file, and
 * a diff on this file only ever reflects an actual manifest change.
 *
 * Single-writer rule (per the plan): only this tool writes
 * assets/data/manifests.json. tools/build-site.js validates a manifest when
 * building a niche but never regenerates the index.
 *
 * Zero dependencies. Node 18+. CommonJS — matches every other tools/ script.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { validate } = require('./validate-manifest');

const REPO = path.resolve(__dirname, '..');
const NICHES_DIR = path.join(REPO, 'niches');
const OUT_PATH = path.join(REPO, 'assets', 'data', 'manifests.json');

const slugs = fs.readdirSync(NICHES_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .filter(slug => fs.existsSync(path.join(NICHES_DIR, slug, 'manifest.json')))
  .sort();

const index = {};
let hadError = false;

for (const slug of slugs) {
  const p = path.join(NICHES_DIR, slug, 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(slug + '/manifest.json does not parse: ' + e.message);
    hadError = true;
    continue;
  }
  const errors = validate(manifest);
  if (errors.length) {
    console.error(slug + '/manifest.json is invalid:');
    for (const e of errors) console.error('  ' + e);
    hadError = true;
    continue;
  }

  // Stable, explicit key order — not "...manifest" — so the emitted shape
  // cannot silently pick up a new top-level key (e.g. realBrand) without a
  // deliberate decision here, and so byte order never depends on the
  // authoring order of the source manifest.json.
  index[slug] = {
    theme: manifest.theme,
    photoSlots: manifest.photoSlots,
    sections: manifest.sections,
    pricing: {
      model: manifest.pricing.model,
      editableFields: manifest.pricing.editableFields,
      /* T7 prep: the merge endpoint resolves the overlay target from here. */
      mergePath: manifest.pricing.mergePath,
      /* Optional; the marketing kit appends it to a unit-priced headline. */
      headlineSuffix: manifest.pricing.headlineSuffix || ''
    },
    merge: manifest.merge,
    /* Phase B0: the admin's hero-upload caption reads this — true means the
       niche's built page actually renders the hero-photo component, so the
       "shows after its hero update lands" honesty caption must NOT show. */
    heroWired: manifest.heroWired === true,
    /* Theme variant names for a themed niche, from the same niches/<slug>/themes/
       directories that produce themes.mjs below. The admin already fetches this
       index, so putting them here avoids a second source of truth for the one
       question it needs answered: does this niche have variants, and what are
       they called. Absent for every unthemed niche rather than an empty array,
       so the admin's check is a plain truthiness test. */
    themes: themeNamesFor(slug),
    /* The first-week checklist, lifted from the niche's guide so the admin's
       Start-here tab and the guide itself cannot drift apart. Titles only —
       the full step text stays in the guide, which is where somebody reads
       it properly. Empty for a niche with no guide yet. */
    guideSteps: guideStepsFor(slug)
  };
}

if (hadError) {
  console.error('build-manifest-index: aborted, ' + Object.keys(index).length + ' manifest(s) would have been dropped silently');
  process.exit(1);
}

// Sorted-slug object literal above already fixes key order (V8 preserves
// string-key insertion order for non-integer-like keys), and JSON.stringify
// walks an object's own keys in that same order — so this is stable across
// runs given the same inputs, with no extra sort step needed here.
const out = JSON.stringify(index, null, 2) + '\n';

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, out, 'utf8');

/* -- themed niches, for the router ------------------------------------------
   A themed niche keeps per-theme builds under sites/<slug>/<theme>/, and
   sites/<slug>/ is NOT a storefront -- dj's is a hand-authored theme picker.
   middleware.js therefore has to append the tenant's theme segment, which
   means it needs the list of legal theme names: to pick a fallback, and more
   importantly to whitelist a value that ends up inside a filesystem path.

   The directories under niches/<slug>/themes/ are the only source of truth for
   that list, and an edge function cannot read them at request time. So it is
   emitted here, beside the manifest index, and imported statically by the
   middleware. Generated rather than hand-listed on purpose: writing "dj" into
   the router by hand is exactly what silently misroutes the day a second
   themed niche appears. */
/* Pulls the <b>Step title.</b> out of each <li> in the guide's gd-steps list.
   A regex over our own generated markup rather than a parser: the shape is
   fixed by _template/guide and the build already fails if a guide is
   malformed, so there is nothing here a parser would catch that the build
   does not. Returns [] rather than null so the admin can render unconditionally. */
function guideStepsFor(slug) {
  const p = path.join(REPO, 'niches', slug, 'guide.html');
  if (!fs.existsSync(p)) return [];
  const html = fs.readFileSync(p, 'utf8');
  const list = html.match(/<ol class="gd-steps">[\s\S]*?<\/ol>/);
  if (!list) return [];
  const steps = [...list[0].matchAll(/<li>\s*<b>([\s\S]*?)<\/b>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (steps.length && (steps.length < 5 || steps.length > 7)) {
    console.error('build-manifest-index: ' + slug
      + ' guide has ' + steps.length + ' first-week steps; the brief says 5-7');
    process.exit(1);
  }
  return steps;
}

/* Shared by the manifest index entries above and the themed map below, so the
   two can never disagree about what a niche's variants are. A function
   declaration, so it is hoisted above the index that calls it. Returns null
   rather than [] for an unthemed niche, which keeps the admin's check a plain
   truthiness test and keeps the key out of 31 of 32 index entries. */
function themeNamesFor(slug) {
  const themeDir = path.join(REPO, 'niches', slug, 'themes');
  if (!fs.existsSync(themeDir)) return null;
  const names = fs.readdirSync(themeDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  if (!names.length) {
    console.error('build-manifest-index: ' + slug + ' has an empty themes/ directory');
    process.exit(1);
  }
  return names;
}

const themed = {};
for (const slug of slugs) {
  const names = themeNamesFor(slug);
  if (!names) continue;
  /* The fallback is first-alphabetically rather than a hand-picked favourite,
     so it stays stable and needs no second source of truth. It is only ever
     used for a tenant whose theme was never recorded. */
  themed[slug] = { themes: names, fallback: names[0] };
}

const THEMES_PATH = path.join(REPO, 'assets', 'data', 'themes.mjs');
fs.writeFileSync(THEMES_PATH,
  '/* GENERATED by tools/build-manifest-index.js from niches/<slug>/themes/.\n'
  + '   Do not edit. Imported by middleware.js to resolve a tenant to their\n'
  + '   theme, and to whitelist that segment before it reaches a file path. */\n'
  + 'export const THEMED_NICHES = ' + JSON.stringify(themed, null, 2) + ';\n',
  'utf8');

console.log('built ' + path.relative(REPO, THEMES_PATH).replace(/\\/g, '/')
  + ' -- ' + (Object.keys(themed).length || 'no') + ' themed niche(s)'
  + (Object.keys(themed).length ? ': ' + Object.keys(themed).join(', ') : ''));


console.log('built ' + path.relative(REPO, OUT_PATH).replace(/\\/g, '/') +
  ' — ' + slugs.length + ' niche(s): ' + slugs.join(', '));
