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
      editableFields: manifest.pricing.editableFields
    },
    merge: manifest.merge
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

console.log('built ' + path.relative(REPO, OUT_PATH).replace(/\\/g, '/') +
  ' — ' + slugs.length + ' niche(s): ' + slugs.join(', '));
