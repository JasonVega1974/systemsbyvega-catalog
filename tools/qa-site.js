#!/usr/bin/env node
/* tools/qa-site.js — the SITELAB_TEMPLATE.md §9 QA checklist.
 *
 *   node tools/qa-site.js <slug> [--built <dir>]
 *
 * Checks the niche sources and, if present, the built page. Exits non-zero on
 * any failure so the build can gate on it.
 *
 * §9.4's rendering checks (overflow at 360px, tap targets, focus rings) need a
 * browser and are NOT covered here — they stay a manual pass. Everything
 * statically checkable is automated.
 *
 * ── STANDING RULES FOR EVERY CHECK IN THIS FILE ──────────────────────────
 *
 * 1. A check that scans a whole file will eventually match its own
 *    documentation. Strip comments before testing for code.
 *      Cost so far: the rAF check passed on a stub whose header read "its only
 *      requestAnimationFrame is a toast fade"; the DEFAULT_CONTENT parser
 *      anchored on a mention in a comment above the declaration.
 *
 * 2. "Absent" and "correct" are different results. A check that returns green
 *    on an empty input is not a check.
 *      Cost: "scene.svg ids are prefixed" passed on a file with no ids at all.
 *
 * 3. Test the requirement, not one author's phrasing of it.
 *      Cost: reduced-motion demanded "if (reduce) return" and failed a scene
 *      that branches to a static reveal — a better answer than returning.
 *      Interactive-pricing demanded a "change" handler and failed a working
 *      click-driven wheel.
 *
 * 4. Context-width matching hides matches near line boundaries. Match the bare
 *    token with no surrounding-character requirement, then triage.
 *      Cost: three fabricated credentials survived two "clean" passes in Item 1.
 *
 * 5. Never write a regex into this file through a shell -e snippet. Bash turns
 *    \b into a 0x08 byte and \s into the letter s, silently, and grep renders
 *    the damage invisible. Write the patch as a file. Verify with cat -A.
 *
 * Zero dependencies. Node 18+.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const slug = args.find(a => !a.startsWith('--'));
const builtFlag = args.indexOf('--built');
if (!slug) { console.error('usage: node tools/qa-site.js <slug> [--built <dir>]'); process.exit(2); }

/* A themed niche (dj) keeps shared structure here, and per-theme niche.css,
   content overlay and og.png under themes/<theme>/. */
const themeFlag = args.indexOf('--theme');
const theme = themeFlag > -1 ? args[themeFlag + 1] : '';
const SRC = path.join(REPO, 'niches', slug);
const THEME_SRC = theme ? path.join(SRC, 'themes', theme) : SRC;
/* Auditing a themed niche without naming a theme would look for a niche.css
   that is not there and read content missing its overlay. Fail loudly — an
   unverified result is not a pass. */
if (!theme && fs.existsSync(path.join(SRC, 'themes'))) {
  console.error(slug + ' is a themed niche — pass --theme <name> (' +
                fs.readdirSync(path.join(SRC, 'themes')).join(', ') + ')');
  process.exit(2);
}
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
/* niche.css, og.svg and og.png come from the theme; everything else is shared. */
const homeOf = f => (['niche.css', 'og.png', 'og.svg'].includes(f) ? THEME_SRC : SRC);
const BUILT = builtFlag > -1 ? path.resolve(args[builtFlag + 1]) : path.join(REPO, 'sites', slug);

let failures = 0, warnings = 0;
const ok   = (s, d) => console.log('  ok    ' + s + (d ? '   ' + d : ''));
const bad  = (s, d) => { failures++; console.log('  FAIL  ' + s + (d ? '   ' + d : '')); };
const warn = (s, d) => { warnings++; console.log('  warn  ' + s + (d ? '   ' + d : '')); };
const section = s => console.log('\n' + s);

const exists = p => fs.existsSync(p);
const read = p => exists(p) ? fs.readFileSync(p, 'utf8') : null;

/* ═══ §9.1 Structural ══════════════════════════════════════════════════ */
section('§9.1 structural');

const REQUIRED_FILES = ['content.json', 'niche.css', 'sections.css', 'niche.js', 'scene.js', 'sections.html', 'brief.md'];
// scene.svg is OPTIONAL (§6.1) — only niches with a shared <defs> block have one.
for (const f of REQUIRED_FILES) {
  exists(path.join(homeOf(f), f)) ? ok('present  ' + f) : bad('missing  ' + f);
}

/* The merged view is what actually ships, so it is what gets audited. */
let raw = read(path.join(SRC, 'content.json'));
if (theme && raw) {
  const ov = path.join(THEME_SRC, 'content.json');
  if (fs.existsSync(ov)) {
    raw = JSON.stringify(deepMerge(JSON.parse(raw), JSON.parse(fs.readFileSync(ov, 'utf8'))), null, 2) + '\n';
  }
}
let content = null;
if (raw) {
  try { content = JSON.parse(raw); ok('content.json parses'); }
  catch (e) { bad('content.json parses', e.message); }
}

if (content) {
  // required fields
  // brand.tagline is OPTIONAL (D-Q): not every source has one, and cropping a
  // title or a hero sentence into a tagline is writing copy for the operator.
  // brand.phone and brand.email are OPTIONAL too: dj takes bookings through a
  // form and publishes neither. leadEmail stays required — that is where leads
  // route, not a contact detail the operator picks.
  const req = [['brand.name'], ['brand.leadEmail'],
               ['brand.city'],
               ['seo.title'], ['seo.description'], ['seo.ogTitle'], ['seo.ogDescription'],
               ['seo.schemaType'], ['seo.canonical'], ['seo.themeColor']];
  // seo.priceRange is deliberately absent: 13 of 23 originals have none, and
  // inventing one puts a number we made up into the operator's structured data.
  const get = p => p.split('.').reduce((o, k) => (o == null ? o : o[k]), content);
  const missing = req.map(([p]) => p).filter(p => {
    const v = get(p);
    return v == null || v === '' || (Array.isArray(v) && !v.length);
  });
  missing.length ? bad('required fields (§4.1)', 'missing: ' + missing.join(', '))
                 : ok('required fields (§4.1)', req.length + ' present');

  /* serviceArea is optional (§4.1, D-N): a mobile business has stops, not an
     area. Absent is legitimate; note it so it reads as a decision. */
  if (!content.serviceArea || !content.serviceArea.region) {
    warn('no serviceArea — falling back to brand.city',
         JSON.stringify((content.brand || {}).city || ''));
  }
  for (const f of ['phone', 'email']) {
    if (!(content.brand || {})[f]) {
      warn('no brand.' + f, 'absent in the source; not invented (D-Q reasoning)');
    }
  }
  if (!(content.brand || {}).tagline) {
    warn('no brand.tagline — share card and JSON-LD slogan omit it',
         'absent in the source; not invented (D-Q)');
  }

  // leadEmail is fixed
  (content.brand || {}).leadEmail === 'info@kingdom-creatives.com'
    ? ok('leadEmail is info@kingdom-creatives.com')
    : bad('leadEmail is info@kingdom-creatives.com', 'found: ' + (content.brand || {}).leadEmail);

  // Retired field names. `best` and `featured` are only retired as the
  // highlight FLAG on a pricing tier — a niche may legitimately have a `best`
  // string elsewhere (dumpster's sizes[].best is "Best for bathroom remodels…"),
  // so those two are checked against tier arrays only, not the whole document.
  /* Canonical names govern CANONICAL sections. `niche` is the niche-local
     escape hatch (§4), so a key retired from the canonical schema may live
     there legitimately — tattoo-studio's niche.galleryCats[].cat is the join key
     its gallery filter reads. Same reasoning as `best` just below.
     The credential sweep still reads niche in full; only NAMING is scoped. */
  const canonicalOnly = { ...content };
  delete canonicalOnly.niche;
  const flat = JSON.stringify(canonicalOnly);
  const found = [];
  for (const [k, m] of [['"plans"', 'plans[] -> pricing[]'], ['"packages"', 'packages[] -> pricing[]'],
                        ['"author"', 'author -> name'], ['"lab"', 'lab -> label'], ['"cat"', 'cat -> tag'],
                        ['"period"', 'period -> per'], ['"platform"', 'platform -> icon'],
                        ['"meta"', 'meta -> tag'],
                        ['"area"', 'brand.area -> serviceArea.region'],
                        ['"about"', 'about -> owner']]) {
    if (flat.includes(k)) found.push(m);
  }
  /* The highlight flag has been written three ways: best, featured, popular.
     Test the TYPE, not the key — a STRING `best` is a tier description
     (dumpster's sizes[].best, car-detailing's packages[].best) and belongs in
     `blurb`, not the retired list. Flagging the key blind produced a false
     positive on both sites converted so far. */
  for (const arr of ['pricing', 'plans', 'packages']) {
    for (const row of (Array.isArray(content[arr]) ? content[arr] : [])) {
      if (!row || typeof row !== 'object') continue;
      for (const k of ['best', 'featured', 'popular']) {
        if (typeof row[k] === 'boolean') found.push(`${arr}[].${k} -> highlight`);
      }
      if (typeof row.best === 'string') found.push(`${arr}[].best (string) -> blurb`);
    }
  }
  found.length ? bad('no retired field names (§4.2)', [...new Set(found)].join('; '))
               : ok('no retired field names (§4.2)');

  // pricing shape
  if (Array.isArray(content.pricing)) {
    const errs = [];
    content.pricing.forEach((p, i) => {
      // absent is allowed (a tier may express itself as a blurb range); present must be a number
      if (p.price != null && typeof p.price !== 'number') errs.push(`pricing[${i}].price is ${typeof p.price}, want number`);
      if (p.priceHigh != null && typeof p.priceHigh !== 'number') errs.push(`pricing[${i}].priceHigh is ${typeof p.priceHigh}, want number`);
      if (p.priceHigh != null && p.price == null) errs.push(`pricing[${i}] has priceHigh but no price`);
      if (p.features != null && !Array.isArray(p.features)) errs.push(`pricing[${i}].features is not an array`);
      if (p.highlight != null && typeof p.highlight !== 'boolean') errs.push(`pricing[${i}].highlight is not boolean`);
    });
    errs.length ? bad('pricing[] shape (§4.2)', errs.join('; ')) : ok('pricing[] shape (§4.2)');
  }

  /* niche.* is flattened onto the runtime object by base.js, so a key that
     exists at BOTH levels would be silently overridden — the site would render
     the wrong data and nothing would throw. Forbidden by §4.3. */
  if (content.niche && typeof content.niche === 'object') {
    const clash = Object.keys(content.niche).filter(k => k !== 'niche' && k in content);
    clash.length
      ? bad('niche.* does not collide with the top level (§4.3)', clash.join(', '))
      : ok('niche.* does not collide with the top level (§4.3)',
           Object.keys(content.niche).length + ' keys checked');
  }

  // no nulls
  /\bnull\b/.test(flat) ? bad('no null values (§4.4)') : ok('no null values (§4.4)');
}

// token contract
const nicheCss = read(path.join(THEME_SRC, 'niche.css'));
if (nicheCss) {
  const REQ_TOKENS = ['--scheme', '--ground', '--ink', '--panel', '--muted', '--hair',
                      '--accent', '--accent-ink', '--accent-deep', '--display', '--body', '--mono'];
  const have = new Set([...nicheCss.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m => m[1]));
  const miss = REQ_TOKENS.filter(t => !have.has(t));
  miss.length ? bad('required tokens (§5.1)', 'missing: ' + miss.join(', '))
              : ok('required tokens (§5.1)', have.size + ' declared');
  /\{[^}]*\}/.test(nicheCss.replace(/:root\s*\{[\s\S]*?\}/, ''))
    ? warn('niche.css contains a rule outside :root — structure belongs in base.css')
    : ok('niche.css is tokens only (§5.3)');

  /* Every font family named in a token must be requested by seo.fontsHref.
     A declared-but-unloaded family renders as a silent system fallback. */
  if (content && (content.seo || {}).fontsHref) {
    const href = decodeURIComponent(content.seo.fontsHref).replace(/\+/g, ' ');
    const named = [];
    for (const role of ['--display', '--body', '--mono']) {
      const m = new RegExp(role + '\\s*:\\s*([^;]+);').exec(nicheCss);
      if (!m) continue;
      const fam = m[1].split(',')[0].replace(/['"]/g, '').trim();
      if (fam) named.push([role, fam]);
    }
    /* A token whose first family is generic or preinstalled loads nothing by
       design. This check exists to catch a SILENT fallback — a webfont named but
       never requested. An explicit system stack is the opposite of silent. */
    const SYSTEM = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
      'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji',
      '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'helvetica', 'helvetica neue', 'arial',
      'georgia', 'times', 'times new roman', 'courier', 'courier new', 'consolas', 'menlo',
      'monaco', 'tahoma', 'verdana', 'impact', 'trebuchet ms']);
    const unloaded = named.filter(([, fam]) =>
      !SYSTEM.has(fam.toLowerCase()) && !href.includes(fam));
    unloaded.length
      ? bad('font tokens are actually loaded (§5.1)',
            unloaded.map(([r, f]) => r + ' = "' + f + '" not in fontsHref').join('; '))
      : ok('font tokens are actually loaded (§5.1)', named.length + ' checked');
  }
}

// shared CSS carries no niche colour
const baseCss = read(path.join(REPO, '_template', 'base.css'));
if (baseCss) {
  const strays = [...new Set(baseCss.match(/#[0-9a-fA-F]{3,8}\b/g) || [])].filter(h => h !== '#000');
  strays.length ? bad('base.css has no literal colour', strays.join(', ')) : ok('base.css has no literal colour');
}

/* ═══ §9.2 Credential sweep ════════════════════════════════════════════ */
section('§9.2 credential sweep');

const WORDS = /(certified|certification|licen[sc]ed|insured|accredited|bloodborne|award-winning|AWS)/i;
const NUMS  = /\b\d[\d,]*\+|\b\d+\s*(?:yrs|years)\b|\bIn\s+20\d\d\b/i;

/* Verified legitimate. Each was triaged during Phase 1 Item 1 — do not re-triage.
   A line matching any of these is exempt. */
const ALLOW = [
  /licensed-trade tasks/i, /licensed sub/i,          // hiring subs, not a self-claim
  /priceRange/i, /\$[\d,]+\s*-\s*\$[\d,]+\+?/,       // price ranges
  /multi-session/i, /\b72\+\s*hours/i, /\b18\+/,     // policies
  /\d+\+\s*people/i, /Wedding/i,                     // capacity tiers
  /single-use needles/i,                             // operating practice
  /stroke-width|viewBox|%\d\+|d="M/,                 // SVG/CSS numerics
  /\$[\d,]+\+/,                                     // open-ended price: "$800+"
  /\d\+\s*['"]/,                                    // JS concat: Math.random()*100+'%'
  /<option[^>]*>[^<]*\d\+/,                          // form option: "4+ bins"
  /\b\d+\+\s*(?:days?|hours?|bins?|cans?|dogs?|pets?|visits?|rooms?|windows?|vehicles?|loads?|bags?|stops?)\b/i,
  /* plan-tier label: "3+ days", "4+ bins". N+ attached to a unit of what is
     being BOUGHT is a tier the buyer picks, not a track record. A track-record
     claim attaches N+ to years, jobs, clients, projects or reviews — none of
     which are here, and years/yrs has its own NUMS branch anyway. */
  /for the next \d+\s*years?/i,                     // forward-looking, not a record
  /\d\+[A-Za-z_$(]/,                                 // arithmetic inside a template expr, not "150+ shows"
  /^\s*(\/\/|\/\*|\*)/                               // developer comments
];

/* Blank a comment's INTERIOR, keeping every newline so sweep's reported line
   numbers stay true. Distinct from the `strip` helper further down, which
   deletes and is used only for counting — this one must preserve line numbers.
   No line-comment handling, on purpose (D-R): a naive stripper eats the "//" in
   a URL and would blank a real claim later on that line. The ALLOW line-prefix
   rule already covers whole-line comments. */
function blankComments(text, kind) {
  const hollow = m => m.replace(/[^\n]/g, ' ');
  if (kind === 'html') return text.replace(/<!--[\s\S]*?-->/g, hollow);
  if (kind === 'js')   return text.replace(/\/\*[\s\S]*?\*\//g, hollow);
  return text;                      // json: there are no comments to blank
}

function sweep(label, text, kind) {
  if (!text) return;
  const hits = [];
  blankComments(text, kind).split('\n').forEach((ln, i) => {
    if (ALLOW.some(re => re.test(ln))) return;
    const w = ln.match(WORDS), n = ln.match(NUMS);
    if (w || n) hits.push(`${label}:${i + 1} [${[...new Set([...(w || []), ...(n || [])])].join(',')}]`);
  });
  hits.length ? bad('clean: ' + label, hits.slice(0, 6).join('  ')) : ok('clean: ' + label);
}
sweep('content.json', raw, 'json');
sweep('sections.html', read(path.join(SRC, 'sections.html')), 'html');
sweep('niche.js', read(path.join(SRC, 'niche.js')), 'js');

/* ═══ §9.3 Feature parity ══════════════════════════════════════════════ */
section('§9.3 feature parity');

const sections_ = read(path.join(SRC, 'sections.html')) || '';
const sceneJs = read(path.join(SRC, 'scene.js')) || '';
const sceneSvg = read(path.join(SRC, 'scene.svg')) || '';
const nicheJs = read(path.join(SRC, 'niche.js')) || '';

// Signature animation. Strip comments first — a check that greps the whole file
// passes on prose that merely NAMES requestAnimationFrame, which is how a
// deliberate no-op scored a green tick on its first run.
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const sceneCode = strip(sceneJs);
const nicheCode = strip(nicheJs);

/* D-P: the animation may live in scene.js (self-contained scene) or in niche.js
   (a spring helper the renderer calls). Grade the animation, not its address. */
/* A loop passes a callback it can NAME, because that is what re-scheduling
   requires. Counting calls instead graded metal-fabrication as animated on the
   strength of a nested double-rAF style-flush and a toast fade (decision 7).
   Checked against all 21 converted sites: same verdict everywhere the count rule
   was right, and correct where it was not. */
function rafLoop(s) {
  const ids = [...s.matchAll(/requestAnimationFrame\(\s*([A-Za-z_$][\w$]*)\s*\)/g)].map(m => m[1]);
  for (const id of new Set(ids)) {
    if (new RegExp('function\\s+' + id + '\\b').test(s)) return true;
    if (new RegExp('(?:var|let|const)\\s+' + id + '\\s*=').test(s)) return true;
  }
  return false;
}
const rafCount = s => (s.match(/requestAnimationFrame/g) || []).length;
/* Two or more calls means it re-schedules itself, i.e. it loops. A single call
   is a deferred style write — a toast fade — not a signature animation. */
const LOOPS = 2;   // retained for reference; superseded by rafLoop() (decision 7)

/* D-S: the animation may equally be CSS. Collect every @keyframes whose name is
   used in an animation shorthand carrying `infinite`, minus chrome. */
const sectionsCss = read(path.join(SRC, 'sections.css')) || '';
const CHROME = /toast|spinner|loader|skeleton|shimmer|pulse-dot/i;
function cssLoops(cssRaw) {
  /* Strip comments FIRST. The block-matching below treats whatever precedes a
     { as the selector, so a comment sitting above a rule is read as part of it —
     child-care reported its animation as living on
     "/* ambient motion — add ...". Same failure the credential sweep hit: a
     check that scans a whole file eventually matches its own documentation. */
  const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const declared = new Set([...css.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)].map(m => m[1]));
  const loops = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim(), body = m[2];
    const a = /animation:\s*([^;}]+)/.exec(body);
    if (!a || !/\binfinite\b/.test(a[1])) continue;
    const name = a[1].trim().split(/\s+/).find(tok => declared.has(tok));
    if (!name || CHROME.test(sel)) continue;
    loops.push(name + ' on ' + sel);
  }
  return loops;
}

/* A loop only counts as this niche's SIGNATURE when it is this niche's own.
   Four sites carry an identical pulse-on-.hero__art-.halo inherited from the
   reference; that is chrome with a different name. Compare against every other
   converted niche and keep the pairs that appear here and nowhere else. */
function loopsElsewhere(mySlug) {
  const base = path.join(REPO, 'niches');
  const seen = new Set();
  let dirs = [];
  try { dirs = fs.readdirSync(base); } catch (e) { return seen; }
  for (const d of dirs) {
    if (d === mySlug) continue;
    let css = '';
    try { css = fs.readFileSync(path.join(base, d, 'sections.css'), 'utf8'); } catch (e) { continue; }
    for (const l of cssLoops(css)) seen.add(l);
  }
  return seen;
}
const allCssLoops = cssLoops(sectionsCss);
const shared = loopsElsewhere(slug);
const uniqueLoops = allCssLoops.filter(l => !shared.has(l));
const borrowed = allCssLoops.filter(l => shared.has(l));

const animHome = rafLoop(sceneCode) ? 'scene.js'
               : rafLoop(nicheCode) ? 'niche.js'
               : uniqueLoops.length ? 'sections.css' : null;
const oneShot = !animHome && (rafCount(sceneCode) + rafCount(nicheCode)) > 0;
const isStub = !animHome;

if (isStub) {
  // Not a build-blocking failure: consolidation deliberately does not build
  // animations (Phase 1 decision D-B). It is reported every run until Phase 3.
  warn('PHASE 3 GAP: no signature animation (§7, §9.3)',
       oneShot ? 'only a one-shot rAF (a toast fade), no loop'
       : borrowed.length ? 'only inherited boilerplate, nothing of its own: ' + borrowed.join('; ')
       : 'no rAF loop and no infinite @keyframes on a scene element');
} else if (animHome === 'sections.css') {
  ok('signature animation loops in CSS (§7.1, D-S)', uniqueLoops.join('; '));
} else {
  ok('signature animation uses rAF (§7.1)', 'in ' + animHome);
}
/* Any conditional consulting `reduce` counts: an early return, a branch to a
   static reveal, or a guard inside the loop. Requiring `if (reduce) return`
   verbatim failed a scene whose reduced-motion path is richer than that. */
/* A CSS animation cannot gate on a JS `reduce` flag — its override is a
   prefers-reduced-motion block that turns the animation off. Check the file the
   animation is actually in, and for CSS require the block to NEUTRALISE it
   rather than merely mention the media query. */
const animCode = animHome === 'sections.css' ? sectionsCss
               : animHome === 'niche.js'     ? nicheCode : sceneCode;
const gatesOnReduce = animHome === 'sections.css'
  ? /@media[^{]*prefers-reduced-motion[\s\S]*?animation:\s*none/i.test(sectionsCss)
  /* Any conditional that consults reduce counts — an if, a guard inside the
     loop, or a ternary like reduce?frame(2):loop(). Requiring one shape has
     already failed two legitimate scenes. */
  : /if\s*\([^)]*\breduce\b/.test(animCode) ||
    /\breduce\s*\?/.test(animCode) ||
    /prefers-reduced-motion/.test(animCode);
gatesOnReduce
  ? ok('scene gates on reduced motion (§7.1)')
  : bad('scene gates on reduced motion (§7.1)', 'no conditional consults reduce');
/prefers-reduced-motion/.test(baseCss || '') ? ok('base.css reduced-motion block (§7.3)')
                                             : bad('base.css reduced-motion block (§7.3)');

/* Illustration richness (§6.1). Count defs across scene.svg AND sections.html —
   scene.svg is optional, and both wave-1 sites keep their illustrations inline in
   the markup rather than in a shared <defs> block. Counting scene.svg alone would
   fail a site for filing its work differently. */
const defs = ((sceneSvg + sections_).match(/<(linearGradient|radialGradient|filter)\b/g) || []).length;
if (defs >= 6) ok('illustration: >= 6 defs (§6.1)', defs + ' across scene.svg + sections.html');
else warn('PHASE 3 GAP: ' + defs + ' illustration defs, §6.1 wants 6+');
/* Id prefixing (§6.2). Only ids on referenceable SVG defs matter: those are
   what collide when two illustrations are inlined into one document. Page
   element ids (nav, top, price) are out of scope — checking them produced 40+
   false positives. Illustrations may sit in scene.svg, sections.html, or both. */
const illus = sceneSvg + sections_;
const DEF_EL = new RegExp(
  '<(linearGradient|radialGradient|pattern|filter|mask|clipPath|symbol)' +
  '[^>]*?\\sid="([A-Za-z0-9_-]+)"', 'g');
const svgIds = [...illus.matchAll(DEF_EL)].map(m => m[2]);
const unprefixed = svgIds.filter(id => !id.includes('-'));
if (!svgIds.length) warn('no illustration def ids found', 'stub scene and no inline defs');
else if (unprefixed.length) warn('illustration def ids should be slug-prefixed (§6.2)',
                                 unprefixed.length + ': ' + unprefixed.slice(0, 6).join(', '));
else ok('illustration def ids are prefixed (§6.2)', svgIds.length + ' checked');

// sections
/* The owner section goes by several ids across the estate — #owner, #about,
   #team, #meet. Accept any of them: the requirement is that the operator is on
   the page, not that one id was chosen. */
/* FAQ is a WARN, not a failure: a DJ landing page has none, and authoring one
   would be writing copy for the operator. owner and form stay hard — a site
   with no owner section and no form is not a lead-generating site. */
const softSections = new Set(['FAQ']);
const need = { 'FAQ': /id="faq"/i,
               /* Either the id convention, or the owner render hooks: the id has
                  been spelled six ways now (owner, about, team, meet, who, why),
                  and "why" is generic enough that matching it blind would pass a
                  section that has nothing to do with an owner. */
               'owner': /id="(owner|about|team|meet|who)"|id="meet(Title|Desc|Photo)"|class="[^"]*\bmeet__/i,
               'form': /<form/i };
for (const [k, re] of Object.entries(need)) {
  re.test(sections_) ? ok('section: ' + k)
    : softSections.has(k) ? warn('no ' + k + ' section', 'not every product has one; not authored on the operator\'s behalf')
    : bad('section: ' + k);
}

/* Consent (§9.3). Check the BUILT page, not sections.html: the control is
   injected at build time for niches that lack one, so a source-level check
   reports a false failure on exactly the sites the injection is for. */
{
  const builtForConsent = read(path.join(BUILT, 'index.html'));
  const subject = builtForConsent || sections_;
  const where = builtForConsent ? 'built page' : 'sections.html (not built yet)';
  if (/<form/i.test(subject)) {
    /id="[a-z]*-?consent"/i.test(subject)
      ? ok('consent checkbox present (§9.3)', where)
      : bad('consent checkbox present (§9.3)', 'missing in ' + where);
  }
}

/* Interactive pricing (§9.3): a control the visitor operates that updates a
   displayed figure. Accept 'change' (radio/select pickers, dumpster) OR 'click'
   (tile/wheel pickers, landscaping) — requiring 'change' alone reported a
   working seasonal wheel as a static grid. */
const hasHandler = /addEventListener\(\s*['"](change|click)['"]/.test(nicheJs);
const rendersPrice = /(renderPrice|priceLabel|calcPrice|updateQuote|recalc|syncSummary)\s*\(/.test(nicheJs);
const interactive = hasHandler && rendersPrice;
interactive ? ok('interactive pricing (§9.3)')
            : warn('interactive pricing (§9.3)', 'no change-handler updating a price — static grid?');

/* ═══ built page ═══════════════════════════════════════════════════════ */
const builtHtml = read(path.join(BUILT, 'index.html'));
if (builtHtml) {
  section('built page  ' + path.relative(REPO, BUILT).replace(/\\/g, '/'));

  const HEAD = { 'title': /<title>[^<]+<\/title>/, 'description': /name="description"/,
    'theme-color': /name="theme-color"/, 'canonical': /rel="canonical"/, 'og:url': /property="og:url"/,
    'og:title': /property="og:title"/, 'og:description': /property="og:description"/,
    'og:image': /property="og:image"/, 'twitter:card': /name="twitter:card"/,
    'twitter:image': /name="twitter:image"/, 'favicon': /rel="icon"/, 'JSON-LD': /application\/ld\+json/ };
  const miss = Object.entries(HEAD).filter(([, re]) => !re.test(builtHtml)).map(([k]) => k);
  miss.length ? bad('head items (§8)', 'missing: ' + miss.join(', ')) : ok('head items (§8)', '12 present');

  /* The share card must EXIST and be 1200x630 — a <meta og:image> pointing at a
     missing file is worse than no tag, because the crawler caches the miss.
     Reads the PNG header directly; no image library. */
  const ogOut = path.join(BUILT, 'og.png');
  if (!fs.existsSync(ogOut)) {
    bad('og.png present in build output (§8.1)', 'missing — see SITELAB_TEMPLATE.md §8.1');
  } else {
    const b = fs.readFileSync(ogOut);
    const isPng = b.length > 24 && b.readUInt32BE(0) === 0x89504e47;
    const w = isPng ? b.readUInt32BE(16) : 0, h = isPng ? b.readUInt32BE(20) : 0;
    (isPng && w === 1200 && h === 630)
      ? ok('og.png present and 1200x630 (§8.1)', (b.length / 1024).toFixed(0) + ' KB')
      : bad('og.png present and 1200x630 (§8.1)', isPng ? w + 'x' + h : 'not a PNG');
  }

  // no unresolved placeholders
  const ph = builtHtml.match(/\{\{[A-Z_]+\}\}/g);
  ph ? bad('no unresolved placeholders', [...new Set(ph)].join(', ')) : ok('no unresolved placeholders');

  // No external runtime dependency but Google Fonts. A canonical/preconnect
  // link is metadata, not a fetched asset — only script src and stylesheet
  // link count.
  const ext = [...builtHtml.matchAll(/<script[^>]*\bsrc="(https?:\/\/[^"]+)"/g)].map(m => m[1])
    .concat([...builtHtml.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="(https?:\/\/[^"]+)"/g)].map(m => m[1]))
    .filter(u => !/fonts\.(googleapis|gstatic)\.com/.test(u));
  ext.length ? bad('self-contained (no external deps)', ext.join(', ')) : ok('self-contained (no external deps)');

  // scripts parse
  let synt = 0;
  for (const m of builtHtml.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)) {
    try { new vm.Script(m[1]); } catch (e) { synt++; console.log('        ' + e.message); }
  }
  for (const m of builtHtml.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { synt++; console.log('        JSON-LD: ' + e.message); }
  }
  synt ? bad('scripts and JSON-LD parse') : ok('scripts and JSON-LD parse');

  // the single-source-of-truth invariant
  const dc = /var DEFAULT_CONTENT = ([\s\S]*?);\s*\n<\/script>/.exec(builtHtml);
  if (dc && raw) {
    let same = false;
    try { same = JSON.stringify(JSON.parse(dc[1])) === JSON.stringify(JSON.parse(raw)); } catch {}
    same ? ok('DEFAULT_CONTENT === content.json (§2.1)')
         : bad('DEFAULT_CONTENT === content.json (§2.1)', 'the two have drifted — rebuild');
  } else bad('DEFAULT_CONTENT found in built page');

  // JSON-LD claims nothing the page does not render
  const ld = /<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/.exec(builtHtml);
  if (ld) {
    try {
      const o = JSON.parse(ld[1]);
      const body = builtHtml.replace(/<script[^>]*ld\+json[^>]*>[\s\S]*?<\/script>/g, '');
      /* priceRange is a SUMMARY, not a quotation. build-site.js derives it from
         the numeric pricing[] tiers, so "$89-$249" is the min and max of prices
         the visitor can see — the concatenated string itself never appears in
         the body, and never would. Testing for it literally flagged two sites
         whose claims are fully supported.
         Test the requirement instead: both endpoints must be on the page. A
         range whose numbers appear nowhere still fails, which is the case this
         check exists for. */
      /* The tier prices are RENDERED by the niche's JS — the static body carries
         "price": 89, with no currency symbol — so looking for "$89" in the
         markup can never succeed. Compare against the data the page renders
         from: the range is backed when its endpoints are the min and max of
         pricing[].price. */
      const tiers = ((content && content.pricing) || [])
        .map(p => p.price).filter(n => typeof n === 'number');
      /* EITHER route backs the claim, and both are needed:
           - the string is in the body — landscaping and painting print their
             range in visible copy, and their numeric tiers are a different set;
           - or its endpoints ARE the tier min and max — hvac and personal-trainer
             render tiers individually and never print the range.
         Checking only the second regressed the first pair, which is how this
         was caught. */
      const backed = c => {
        const s = String(c);
        if (body.includes(s)) return true;
        const ends = s.match(/\d[\d,]*/g);
        if (/^\s*\$?[\d,]+\s*[–—-]\s*\$?[\d,]+\s*$/.test(s) && ends && ends.length === 2 && tiers.length) {
          const lo = Number(ends[0].replace(/,/g, '')), hi = Number(ends[1].replace(/,/g, ''));
          return lo === Math.min(...tiers) && hi === Math.max(...tiers);
        }
        return false;
      };
      const claims = [o.name, o.priceRange].filter(Boolean);
      const unbacked = claims.filter(c => !backed(c));
      unbacked.length ? warn('JSON-LD claims appear on the page (§8)', 'not found in body: ' + unbacked.join(', '))
                      : ok('JSON-LD claims appear on the page (§8)');
    } catch {}
  }
} else {
  section('built page');
  warn('not built yet', 'run: node tools/build-site.js ' + slug);
}

/* ═══ summary ══════════════════════════════════════════════════════════ */
console.log('\n' + '-'.repeat(60));
console.log(`${slug}:  ${failures} failure(s), ${warnings} warning(s)`);
console.log('§9.4 rendering checks (360px overflow, tap targets, focus, contrast) are manual.');
process.exit(failures ? 1 : 0);
