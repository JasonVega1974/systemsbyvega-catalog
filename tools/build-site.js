#!/usr/bin/env node
/* tools/build-site.js — build one SiteLab niche into a single self-contained page.
 *
 *   node tools/build-site.js <slug> [--out <dir>] [--demo]
 *
 * Inputs   _template/{index.html,base.css,base.js,consent.html}
 *          niches/<slug>/{content.json,niche.css,sections.css,niche.js,
 *                         sections.html,scene.svg,scene.js,og.png}
 * Outputs  <out>/index.html   one file, no runtime dependency but Google Fonts
 *          <out>/content.json copied verbatim, so the runtime fetch still works
 *          <out>/og.png       the share card
 *
 * Why a build step exists: see SITELAB_TEMPLATE.md §2. A content value is authored
 * once, in content.json. DEFAULT_CONTENT and the rendered markup are generated
 * from it, so the three copies in the shipped file cannot drift.
 *
 * Zero dependencies. Node 18+.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const slug = args.find(a => !a.startsWith('--'));
const outFlag = args.indexOf('--out');
const isDemo = args.includes('--demo');
/* A themed niche (dj) keeps shared structure at niches/<slug>/ and per-theme
   niche.css + content overlay + og.png under niches/<slug>/themes/<theme>/.
   Without --theme nothing below changes shape, so every existing site builds
   byte-for-byte as before. */
const themeFlag = args.indexOf('--theme');
const theme = themeFlag > -1 ? args[themeFlag + 1] : '';

if (!slug) {
  console.error('usage: node tools/build-site.js <slug> [--theme <name>] [--out <dir>] [--demo]');
  process.exit(2);
}

const TPL = path.join(REPO, '_template');
const SRC = path.join(REPO, 'niches', slug);
const THEME_SRC = theme ? path.join(SRC, 'themes', theme) : SRC;
if (theme && !fs.existsSync(THEME_SRC)) {
  console.error('no such theme: ' + path.relative(REPO, THEME_SRC));
  process.exit(1);
}
/* A themed niche must be asked for by theme. Building it unthemed would read a
   niche.css that is not there and fail confusingly, so say why. */
if (!theme && fs.existsSync(path.join(SRC, 'themes'))) {
  console.error(slug + ' is a themed niche — pass --theme <name> (' +
                fs.readdirSync(path.join(SRC, 'themes')).join(', ') + ')');
  process.exit(1);
}
const OUT = outFlag > -1 ? path.resolve(args[outFlag + 1])
          : theme       ? path.join(REPO, 'sites', slug, theme)
                        : path.join(REPO, 'sites', slug);

const read = p => {
  if (!fs.existsSync(p)) { console.error('missing input: ' + path.relative(REPO, p)); process.exit(1); }
  return fs.readFileSync(p, 'utf8');
};

const shell      = read(path.join(TPL, 'index.html'));
const baseCss    = read(path.join(TPL, 'base.css'));
const baseJs     = read(path.join(TPL, 'base.js'));
const nicheCss   = read(path.join(THEME_SRC, 'niche.css'));
const nicheJs    = read(path.join(SRC, 'niche.js'));
const sceneSvg   = read(path.join(SRC, 'scene.svg'));
const sceneJs    = read(path.join(SRC, 'scene.js'));
let   sections   = read(path.join(SRC, 'sections.html'));
const sectionCss = fs.existsSync(path.join(SRC, 'sections.css'))
  ? fs.readFileSync(path.join(SRC, 'sections.css'), 'utf8') : '';
/* Shared content, with the theme's overlay merged over it. The overlay holds
   only what genuinely differs — for dj that is artist.name, artist.about and
   four seo strings, two values plus their SEO echo out of 105.
   The MERGED result is what gets inlined as DEFAULT_CONTENT and what is written
   to <out>/content.json, so the two still cannot drift and the gate's
   single-source check keeps working. */
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
let contentRaw = read(path.join(SRC, 'content.json'));
if (theme) {
  const overlayPath = path.join(THEME_SRC, 'content.json');
  const overlay = fs.existsSync(overlayPath) ? JSON.parse(fs.readFileSync(overlayPath, 'utf8')) : {};
  contentRaw = JSON.stringify(deepMerge(JSON.parse(contentRaw), overlay), null, 2) + '\n';
}

/* ---- consent control (§9.3) --------------------------------------------
 * A form that collects a phone number for follow-up needs consent. Injected
 * here rather than authored per niche, so the sites that lack one pick it up
 * the moment they convert. Detection accepts ANY *-consent id: contracting
 * uses q-consent, and a second checkbox would be worse than none.
 */
{
  const hasConsent = /id="[a-z]*-?consent"/i.test(sections);
  if (/<form/i.test(sections) && !hasConsent) {
    const snippet = read(path.join(TPL, 'consent.html')).replace(/^<!--[\s\S]*?-->\s*/, '');
    const honey = /(\n[ \t]*<!-- spam honeypot[\s\S]*?<input[^>]*_honey[^>]*>)/i;
    if (honey.test(sections)) {
      sections = sections.replace(honey, () => '\n' + snippet + RegExp.$1);
    } else if (/<button[^>]*type="submit"/i.test(sections)) {
      sections = sections.replace(/(\n[ \t]*<button[^>]*type="submit")/i, (m) => '\n' + snippet + m);
    } else {
      sections = sections.replace(/(<\/form>)/i, (m) => snippet + '\n' + m);
    }
    console.log('  consent control injected');
  } else if (hasConsent && !/legal\/privacy\.html/.test(sections)) {
    // Keep the niche's own wording; append the privacy link only.
    sections = sections.replace(
      /(<label class="consent">[\s\S]*?)(<\/span>)/i,
      (m, a, b) => a + ' See our <a href="/legal/privacy.html">privacy policy</a>.' + b);
    console.log('  privacy link added to existing consent');
  }
}

let content;
try { content = JSON.parse(contentRaw); }
catch (e) { console.error('content.json does not parse: ' + e.message); process.exit(1); }

/* ---- manifest validation (Decision 1) -----------------------------------
 * A niche's manifest.json is optional for now — only bin-cleaning and
 * landscaping have one so far (Task 3 fills in the rest). When one exists,
 * an invalid manifest fails the build loudly rather than shipping a
 * half-wired niche; this tool does NOT write assets/data/manifests.json
 * (that is tools/build-manifest-index.js's job alone — single-writer rule).
 */
let manifest = null;
if (fs.existsSync(path.join(SRC, 'manifest.json'))) {
  const { validateFile } = require('./validate-manifest');
  const result = validateFile(slug);
  if (result.errors.length) {
    console.error('niches/' + slug + '/manifest.json is invalid:');
    for (const e of result.errors) console.error('  ' + e);
    process.exit(1);
  }
  manifest = result.manifest;
}

/* ---- shared component inclusion (Decision 4) ----------------------------
 * _template/components/<name>.{html,css,js} are OPTIONAL build-time includes.
 * A niche picks one up only when ALL of:
 *   1. it has a valid manifest.json (validated just above)
 *   2. the manifest flags the matching condition true (see COMPONENT_DEFS)
 *   3. its sections.html literally contains that component's slot comment,
 *      authored by hand per niche (a separate task, not this build step)
 * Missing any one of the three leaves sections/sectionCss/nicheJs untouched,
 * so a niche with a manifest but no slot comments rebuilds byte-identical to
 * a build without this mechanism at all.
 *
 * hero-photo has no matching boolean in the sections schema (Decision 1) --
 * a hero photo is a photography choice, not a content-section toggle -- so
 * its signal is photoSlots including 'hero' instead.
 */
const COMPONENTS_DIR = path.join(TPL, 'components');
const COMPONENT_DEFS = [
  { name: 'footer-contact', enabled: m => !!(m.sections && m.sections.footerContact) },
  { name: 'before-after',   enabled: m => !!(m.sections && m.sections.beforeAfter) },
  { name: 'job-details',    enabled: m => !!(m.sections && m.sections.jobDetails) },
  { name: 'reviews',        enabled: m => !!(m.sections && m.sections.reviews) },
  { name: 'hero-photo',     enabled: m => Array.isArray(m.photoSlots) && m.photoSlots.includes('hero') }
];
let componentsCss = '';
let componentsJs = '';
if (manifest) {
  const included = [];
  for (const def of COMPONENT_DEFS) {
    const slot = '<!-- COMPONENT:' + def.name + ' -->';
    if (!def.enabled(manifest) || sections.indexOf(slot) === -1) continue;

    let markup = read(path.join(COMPONENTS_DIR, def.name + '.html'));
    if (def.name === 'before-after') {
      const mergeSpec = (manifest.merge && manifest.merge.beforeAfter) || 'niche.beforeImg/afterImg';
      markup = markup.split('{{BEFORE_AFTER_MERGE}}').join(mergeSpec);
    }
    if (def.name === 'hero-photo') {
      /* Optional per-niche override (Task 6): a niche whose real hero file
         does not follow the photos/hero.jpg convention (e.g. landscaping's
         photos/hero-garden-path.jpg) names its actual file in the manifest
         rather than being forced to duplicate the binary under a second
         name. Absent falls back to the convention, unchanged. */
      const heroDefault = manifest.heroDefault || ('/sites/' + slug + '/photos/hero.jpg');
      markup = markup.split('{{HERO_DEFAULT}}').join(heroDefault);
      /* Static alt beside the static src: a JS-only alt left crawlers and
         no-JS renders with an image that had no accessible name at all.
         heroAlt is authored per niche (landscaping keeps the descriptive
         sentence its old hand-built figure carried); absent, the demo
         brand name is honest enough. Escaped for the attribute position. */
      const heroAlt = String(manifest.heroAlt || ((content.brand && content.brand.name) ? content.brand.name + ' — hero photo' : 'Hero photo'))
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      markup = markup.split('{{HERO_ALT}}').join(heroAlt);
    }
    sections = sections.split(slot).join(markup.trim());

    const cssPath = path.join(COMPONENTS_DIR, def.name + '.css');
    if (fs.existsSync(cssPath)) {
      componentsCss += '\n/* -- component: ' + def.name + ' -- */\n' + fs.readFileSync(cssPath, 'utf8').trim() + '\n';
    }
    const jsPath = path.join(COMPONENTS_DIR, def.name + '.js');
    if (fs.existsSync(jsPath)) {
      componentsJs += '\n/* -- component: ' + def.name + ' -- */\n' + fs.readFileSync(jsPath, 'utf8').trim() + '\n';
    }
    included.push(def.name);
  }
  /* The wiring mechanism (runtime.js) hooks window.renderContent; ship it
     (once, ahead of any component's own registration) only when at least
     one component actually got included for this niche. */
  if (included.length) {
    componentsJs = '\n/* -- component runtime -- */\n' +
      fs.readFileSync(path.join(COMPONENTS_DIR, 'runtime.js'), 'utf8').trim() + '\n' + componentsJs;
    console.log('  components included: ' + included.join(', '));
  }
  /* heroWired is a hand-maintained manifest boolean the ADMIN trusts to
     suppress its "shows after its hero update lands" honesty caption. A
     manifest claiming wired while the build did not actually inject the
     component would silently hide that caption while uploads still render
     nowhere — the exact defect the flag exists to prevent — so the build
     fails loudly on the lie rather than shipping it. (Wired-in-build but
     flagged false only leaves a stale-but-honest caption; warn, don't fail.) */
  const heroInjected = included.includes('hero-photo');
  if (manifest.heroWired === true && !heroInjected) {
    console.error(slug + ': manifest.heroWired is true but the hero-photo component was not injected (missing photoSlots "hero" or the sections.html slot comment)');
    process.exit(1);
  }
  if (heroInjected && manifest.heroWired !== true) {
    console.warn('  warning: hero-photo injected but manifest.heroWired is not true — the admin will show a stale "not yet wired" caption');
  }
}

const seo = content.seo || {};
/* priceRange is NOT required: 13 of 23 originals have none, and inventing one
   puts a number we made up into the operator's structured data. Absent is fine. */
const REQUIRED_SEO = ['title', 'description', 'ogTitle', 'ogDescription', 'schemaType', 'canonical', 'themeColor'];
const missing = REQUIRED_SEO.filter(k => !seo[k]);
if (missing.length) { console.error('content.json seo is missing: ' + missing.join(', ')); process.exit(1); }

/* ---- JSON-LD, generated from the same data the page renders ------------ */
function buildJsonLd() {
  const b = content.brand || {};
  const sa = content.serviceArea || {};
  const ld = {
    '@context': 'https://schema.org',
    '@type': seo.schemaType,
    name: b.name || '',
    description: seo.description,
    telephone: '+1' + String(b.phone || '').replace(/[^0-9]/g, ''),
    email: b.email || '',
    areaServed: sa.region || b.city || ''
  };

  /* Use the source's value when it had one — including schema.org's price-TIER
     forms ("$", "$$"). Otherwise derive from pricing[]. Otherwise omit: an
     absent priceRange is honest, an invented one is not. */
  /* pricing may be the percentage model's OBJECT ({commission, minimum,
     note} — spec 2026-09-07 Decision 3, estate-sale first) rather than the
     tier ARRAY. Every array read below must tolerate that: the object form
     has no numeric tiers and no per-item offers, which is honest — a
     commission is not an Offer price. */
  const pricingTiers = Array.isArray(content.pricing) ? content.pricing : [];
  const CUR = String.fromCharCode(36);
  let pr = seo.priceRange;
  if (!pr) {
    const nums = pricingTiers
      .flatMap(p => [p.price, p.priceHigh])
      .filter(n => typeof n === 'number');
    if (nums.length) pr = CUR + Math.min(...nums) + '-' + CUR + Math.max(...nums);
  }
  if (pr) ld.priceRange = pr;
  if (b.tagline) ld.slogan = b.tagline;

  // makesOffer whenever the niche exposes priced items
  const offers = [];
  pricingTiers.forEach(p => {
    if (p && p.label != null && p.price != null) {
      offers.push({ '@type': 'Offer', name: String(p.label), price: String(p.price), priceCurrency: 'USD' });
    }
  });
  (((content.niche || {}).sizes) || content.sizes || []).forEach(s => {
    if (s && s.yd != null && s.price != null) {
      offers.push({ '@type': 'Offer', name: s.yd + ' Yard Roll-Off', price: String(s.price), priceCurrency: 'USD' });
    }
  });
  if (offers.length) ld.makesOffer = offers;
  return JSON.stringify(ld, null, 2);
}

/* ---- demo chrome -------------------------------------------------------
 * The "Demo — this site is for sale" banner is deploy-time chrome for our own
 * catalogue, not niche content: it wears SBV brand colours, not niche tokens.
 * It ships only with --demo, so a buyer's build never carries it and the clone
 * tool has nothing to strip.
 */
const DEMO_BANNER = `<div id="svDemoBanner" role="note" aria-label="Demo site notice">
  <span class="svDemoBanner__dot" aria-hidden="true"></span>
  <span>Demo — this site is for sale</span>
  <a href="/sites/">View all sites →</a>
</div>
<script>
/* Demo chrome removes itself off the catalog: on a tenant subdomain this SAME
   deployed file is an operator's live site — there is no per-buyer build any
   more, middleware rewrites the subdomain here. Hostname, not a header or a
   fetch: a page cannot read its own response headers, and a fetch would flash
   the banner and fail open on a paid site. Synchronous removal right after the
   element parses means it never paints. The apex and www keep the banner (that
   IS the demo); so do vercel.app previews and localhost. */
(function () {
  var h = location.hostname;
  if (h !== 'systemsbyvega.com' && h !== 'www.systemsbyvega.com'
      && h.slice(-18) === '.systemsbyvega.com') {
    var b = document.getElementById('svDemoBanner');
    if (b) b.remove();

    /* Owner login. The tenant IS the hostname's first label — the same value
       middleware routes on — so nothing needs injecting for the page to know
       it. ?tenant= is a hint, not authorisation: /admin/ resolves ownership
       from the sign-in, so a guessed URL gets a login form, nothing more.

       Appended on DOMContentLoaded, not here: this script sits at the TOP of
       body (so the banner removal above beats first paint), and the footer
       does not exist yet at this point in the parse. */
    document.addEventListener('DOMContentLoaded', function () {
      var a = document.createElement('a');
      a.id = 'svOwnerLogin';
      a.href = '/admin/?tenant=' + encodeURIComponent(h.slice(0, -18));
      a.textContent = 'Owner login →';
      var f = document.querySelector('footer');
      if (f) {
        a.style.cssText = 'display:inline-block;margin-top:12px;' +
          'font-size:11.5px;color:inherit;opacity:.6;text-decoration:underline';
        f.appendChild(a);
      } else {
        /* No footer in this niche's markup: a discreet fixed corner beats
           silently having no login path at all. */
        a.style.cssText = 'position:fixed;right:12px;bottom:10px;z-index:50;' +
          'font-size:11.5px;color:inherit;opacity:.55;text-decoration:underline';
        document.body.appendChild(a);
      }
    });
  }
})();
</script>
<style>
#svDemoBanner{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px 9px;background:#161B22;color:#fff;font-family:'IBM Plex Mono',ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:.01em;padding:9px 16px;border-radius:20px;border:1px solid #323A48;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:calc(100vw - 24px);text-align:center}
#svDemoBanner .svDemoBanner__dot{width:7px;height:7px;border-radius:50%;background:#F3922F;flex:none}
#svDemoBanner a{color:#F3922F;font-weight:700;text-decoration:none}
#svDemoBanner a:hover{text-decoration:underline}
@media(max-width:820px){#svDemoBanner{bottom:78px;font-size:11.5px;padding:8px 14px}}
</style>`;

/* ---- assemble ---------------------------------------------------------- */
const subs = {
  SLUG: slug,
  /* Robots moved from baked meta to HTTP headers (Phase B). One artifact
     serves two surfaces — the demo page on systemsbyvega.com AND every
     tenant subdomain via the middleware rewrite — and a baked noindex meta
     always wins Google's most-restrictive-signal tiebreak, which kept live
     tenants unindexable no matter what X-Robots-Tag said. Now: vercel.json
     sends `noindex` for /sites/(.*) on the DEMO hosts (host-conditioned),
     middleware sends all|noindex per tenant, and the body stays silent.
     A buyer's clone build never carried the meta anyway. */
  ROBOTS: '',
  DEMO_BANNER: isDemo ? DEMO_BANNER : '',
  SEO_TITLE: seo.title,
  SEO_DESCRIPTION: seo.description,
  SEO_THEME_COLOR: seo.themeColor,
  SEO_CANONICAL: seo.canonical,
  SEO_OG_TITLE: seo.ogTitle,
  SEO_OG_DESCRIPTION: seo.ogDescription,
  SEO_OG_IMAGE: seo.ogImage || (seo.canonical.replace(/\/$/, '') + '/og.png'),
  FAVICON: seo.favicon || '',
  FONTS_HREF: seo.fontsHref || '',
  JSON_LD: buildJsonLd(),
  NICHE_CSS: nicheCss.trim(),
  BASE_CSS: baseCss.trim(),
  SECTIONS_CSS: sectionCss.trim() + componentsCss,
  SCENE_SVG: sceneSvg.trim(),
  SECTIONS: sections.trim(),
  DEFAULT_CONTENT: JSON.stringify(content, null, 2),
  NICHE_JS: nicheJs.trim() + componentsJs,
  SCENE_JS: sceneJs.trim(),
  BASE_JS: baseJs.trim()
};

/* split/join, never replace(): a replacement STRING containing $ is interpreted
   by replace() as a special pattern. That corrupted this very file once —
   $' expanded to "everything after the match" and duplicated the whole tail. */
let out = shell;
for (const [k, v] of Object.entries(subs)) {
  out = out.split('{{' + k + '}}').join(v == null ? '' : String(v));
}

const leftover = out.match(/\{\{[A-Z_]+\}\}/g);
if (leftover) { console.error('unresolved placeholders: ' + [...new Set(leftover)].join(', ')); process.exit(1); }

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), out, 'utf8');
fs.writeFileSync(path.join(OUT, 'content.json'), contentRaw, 'utf8');

/* The share card. og.png is a COMMITTED ARTIFACT rasterised from og.svg — see
   SITELAB_TEMPLATE.md §8.1. Facebook, X and LinkedIn do not render SVG for
   og:image, so the PNG is what ships and what the <head> points at. */
/* Optional runtime assets a niche ships beside content.json. dj fetches
   gallery-manifest.json to map release cover art; the fetch is guarded and
   falls back to [], but a 404 logs a red console error on every load of a site
   we are selling. Shipping the empty manifest removes it at the source.
   Copied only when the niche actually has one. */
for (const extra of ['gallery-manifest.json']) {
  const from = path.join(SRC, extra);
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(OUT, extra));
}

/* Photography. niches/<slug>/photos/ is the SOURCE for real images the page
   references relatively (photos/hero-garden-path.jpg); without this copy a
   rebuild ships an index.html whose hero 404s — the photos would exist only
   in the inputs. CREDITS.md rides along on purpose: the licence permits use
   without attribution, but the credit costs one file and answers "where did
   this image come from" a year from now. Copied only when the dir exists, so
   the 22 niches without photography build exactly as before. */
const photosDir = path.join(SRC, 'photos');
if (fs.existsSync(photosDir)) {
  fs.mkdirSync(path.join(OUT, 'photos'), { recursive: true });
  for (const f of fs.readdirSync(photosDir)) {
    fs.copyFileSync(path.join(photosDir, f), path.join(OUT, 'photos', f));
  }
}

const ogPng = path.join(THEME_SRC, 'og.png');
if (fs.existsSync(ogPng)) {
  fs.copyFileSync(ogPng, path.join(OUT, 'og.png'));
} else {
  console.warn('  ! no og.png for ' + slug + ' — run: node tools/build-og.js ' + slug + (theme ? ' --theme ' + theme : '') + ', then rasterise (§8.1)');
}

const rel = p => path.relative(REPO, p).replace(/\\/g, '/');
console.log('built ' + slug);
console.log('  ' + rel(path.join(OUT, 'index.html')) + '  ' + out.split('\n').length + ' lines, ' +
            (Buffer.byteLength(out, 'utf8') / 1024).toFixed(1) + ' KB');
console.log('  ' + rel(path.join(OUT, 'content.json')));
