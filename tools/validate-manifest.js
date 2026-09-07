#!/usr/bin/env node
/* tools/validate-manifest.js — validates niches/<slug>/manifest.json against
 * the schema in docs/superpowers/specs/2026-09-06-phase-a-platform-generalization.md
 * Decision 1.
 *
 *   node tools/validate-manifest.js <slug>
 *
 * Exits 1 and prints one line per named field error when the manifest is
 * invalid. Exits 0 with NO output when it is valid — silence is the pass
 * signal, matching tools/build-site.js's fail-loud-or-say-nothing pattern.
 *
 * Also exported as a module so build-manifest-index.js and build-site.js can
 * reuse the exact same rules rather than re-implementing them (single source
 * of truth for "what is a valid manifest").
 *
 * Zero dependencies. Node 18+. CommonJS — matches every other tools/ script.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');

/* ---- schema constants (Decision 1) -------------------------------------- */

// theme.* keys whose values must be #rrggbb hex colors.
const THEME_COLOR_KEYS = [
  'ground', 'surface', 'card', 'accent', 'accentBright',
  'text', 'textSoft', 'ok', 'bad', 'onAccent'
];
// theme.* keys whose values are free-form strings (font stacks, a URL, a
// site-relative image path). logo and fontsHref may legitimately be "" for a
// niche with no demo logo asset — a niche cannot invent an image that does
// not exist, so an empty string is a valid, honest value, not a missing one.
const THEME_STRING_KEYS = ['fontsHref', 'display', 'label', 'body', 'logo'];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// photoSlots must be a subset of this known set.
const PHOTO_SLOTS = [
  'logo', 'hero', 'before', 'after', 'owner',
  'gallery1', 'gallery2', 'gallery3', 'gallery4',
  'gallery5', 'gallery6', 'gallery7', 'gallery8'
];

// sections must have exactly these keys, each a boolean.
const SECTION_KEYS = [
  'pricing', 'beforeAfter', 'jobDetails',
  'reviews', 'social', 'footerContact', 'ownerBlock'
];

// pricing.model enum (Decision 2).
const PRICING_MODELS = ['tiers', 'hourly', 'quote', 'percentage', 'calculator', 'flash', 'none'];

// merge.* enums.
const MERGE_BEFORE_AFTER = ['niche.beforeImg/afterImg', 'projects[0]', 'none'];
const MERGE_REVIEWS = ['testimonials', 'none'];
const MERGE_OWNER_SHAPE = ['owner', 'none'];

/* ---- validation ---------------------------------------------------------- */

/* Returns an array of human-readable error strings. Empty array = valid.
   Every error names the offending field, per the brief ("exit 1 with named
   field errors"). */
function validate(m) {
  const errs = [];
  const isObj = v => v != null && typeof v === 'object' && !Array.isArray(v);

  if (!isObj(m)) return ['manifest is not a JSON object'];

  if (m.v !== 1) errs.push('v must be === 1, got ' + JSON.stringify(m.v));

  // Closed top-level key set — defense-in-depth before 21 hand-authored
  // manifests: a typo'd optional key must fail loudly, not silently no-op.
  const KNOWN_TOP = ['v', 'theme', 'photoSlots', 'sections', 'pricing', 'merge', 'realBrand', 'heroDefault'];
  for (const k of Object.keys(m)) {
    if (!KNOWN_TOP.includes(k)) errs.push('unknown top-level key: ' + k);
  }

  // realBrand (bin-cleaning A4/A8 item) — optional, boolean when present.
  if ('realBrand' in m && typeof m.realBrand !== 'boolean') {
    errs.push('realBrand must be a boolean, got ' + typeof m.realBrand);
  }

  // heroDefault (Task 6 hero-filename-convention item) — optional, a
  // site-relative path string overriding build-site.js's stamped default of
  // /sites/<slug>/photos/hero.jpg for a niche whose real hero file has a
  // different name (e.g. landscaping's photos/hero-garden-path.jpg).
  if ('heroDefault' in m && (typeof m.heroDefault !== 'string' || !m.heroDefault)) {
    errs.push('heroDefault must be a non-empty string, got ' + JSON.stringify(m.heroDefault));
  }

  // theme
  if (!isObj(m.theme)) {
    errs.push('theme is missing or not an object');
  } else {
    for (const k of THEME_COLOR_KEYS) {
      const v = m.theme[k];
      if (v == null) errs.push('theme.' + k + ' is missing');
      else if (typeof v !== 'string' || !HEX_RE.test(v)) {
        errs.push('theme.' + k + ' must be a #rrggbb hex color, got ' + JSON.stringify(v));
      }
    }
    for (const k of THEME_STRING_KEYS) {
      const v = m.theme[k];
      if (v == null) errs.push('theme.' + k + ' is missing');
      else if (typeof v !== 'string') {
        errs.push('theme.' + k + ' must be a string, got ' + typeof v);
      }
    }
  }

  // photoSlots
  if (!Array.isArray(m.photoSlots)) {
    errs.push('photoSlots is missing or not an array');
  } else {
    const bad = m.photoSlots.filter(s => !PHOTO_SLOTS.includes(s));
    if (bad.length) errs.push('photoSlots has unknown slot(s): ' + bad.join(', '));
  }

  // sections — exactly the spec's keys, each boolean.
  if (!isObj(m.sections)) {
    errs.push('sections is missing or not an object');
  } else {
    const missing = SECTION_KEYS.filter(k => !(k in m.sections));
    if (missing.length) errs.push('sections is missing key(s): ' + missing.join(', '));
    const extra = Object.keys(m.sections).filter(k => !SECTION_KEYS.includes(k));
    if (extra.length) errs.push('sections has unknown key(s): ' + extra.join(', '));
    for (const k of SECTION_KEYS) {
      if (k in m.sections && typeof m.sections[k] !== 'boolean') {
        errs.push('sections.' + k + ' must be a boolean, got ' + typeof m.sections[k]);
      }
    }
  }

  // pricing
  if (!isObj(m.pricing)) {
    errs.push('pricing is missing or not an object');
  } else {
    if (!PRICING_MODELS.includes(m.pricing.model)) {
      errs.push('pricing.model must be one of ' + PRICING_MODELS.join('|') + ', got ' + JSON.stringify(m.pricing.model));
    }
    if (!Array.isArray(m.pricing.editableFields) || m.pricing.editableFields.some(f => typeof f !== 'string')) {
      errs.push('pricing.editableFields must be an array of strings');
    }
    if (typeof m.pricing.mergePath !== 'string' || !m.pricing.mergePath) {
      errs.push('pricing.mergePath must be a non-empty string');
    }
  }

  // merge
  if (!isObj(m.merge)) {
    errs.push('merge is missing or not an object');
  } else {
    if (!MERGE_BEFORE_AFTER.includes(m.merge.beforeAfter)) {
      errs.push('merge.beforeAfter must be one of ' + MERGE_BEFORE_AFTER.join('|') + ', got ' + JSON.stringify(m.merge.beforeAfter));
    }
    if (!MERGE_REVIEWS.includes(m.merge.reviews)) {
      errs.push('merge.reviews must be one of ' + MERGE_REVIEWS.join('|') + ', got ' + JSON.stringify(m.merge.reviews));
    }
    if (!MERGE_OWNER_SHAPE.includes(m.merge.ownerShape)) {
      errs.push('merge.ownerShape must be one of ' + MERGE_OWNER_SHAPE.join('|') + ', got ' + JSON.stringify(m.merge.ownerShape));
    }
  }

  return errs;
}

/* Reads and parses niches/<slug>/manifest.json, validates it, and returns
   { manifest, errors }. errors includes a JSON-parse failure as a single
   entry rather than throwing, so callers get the same named-error shape
   regardless of what went wrong. */
function validateFile(slug) {
  const p = path.join(REPO, 'niches', slug, 'manifest.json');
  if (!fs.existsSync(p)) return { manifest: null, errors: ['no manifest.json for ' + slug], path: p };
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return { manifest: null, errors: ['manifest.json does not parse: ' + e.message], path: p };
  }
  return { manifest, errors: validate(manifest), path: p };
}

module.exports = {
  validate,
  validateFile,
  THEME_COLOR_KEYS,
  THEME_STRING_KEYS,
  PHOTO_SLOTS,
  SECTION_KEYS,
  PRICING_MODELS,
  MERGE_BEFORE_AFTER,
  MERGE_REVIEWS,
  MERGE_OWNER_SHAPE
};

/* ---- CLI ------------------------------------------------------------------ */
if (require.main === module) {
  const slug = process.argv.slice(2).find(a => !a.startsWith('--'));
  if (!slug) {
    console.error('usage: node tools/validate-manifest.js <slug>');
    process.exit(2);
  }
  const { errors, path: p } = validateFile(slug);
  if (errors.length) {
    console.error(path.relative(REPO, p).replace(/\\/g, '/') + ' is invalid:');
    for (const e of errors) console.error('  ' + e);
    process.exit(1);
  }
  process.exit(0);
}
