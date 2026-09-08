/* ============================================================================
   POST /api/marketing-kit   body: { tenant }   auth: Bearer <supabase JWT>
   ----------------------------------------------------------------------------
   Renders the operator's marketing kit — a Facebook/Instagram portrait PNG
   and a Letter flyer (PDF + PNG preview) — from the same merged content the
   storefront serves, and uploads the results to the sbv-operator-media
   bucket under <tenant>/marketing/ with STABLE names, so a regenerate
   overwrites rather than littering timestamped files.

   AUTHENTICATED, FAIL-CLOSED. Rendering costs real compute (a headless
   chromium in a 3GB lambda) and writes to the bucket, so the caller's JWT
   must map to the tenant via sbv_client_users BEFORE any service-key work —
   the same gate shape the admin page uses. No row, no render.

   TEMPLATES AND CONTENT ARRIVE OVER HTTP, NEVER fs. Vercel only bundles
   files it can trace from an import; _template/marketing/facebook.html is
   reached by neither import nor require and would be absent at runtime.
   Over HTTP they are static CDN assets, always matching the deployment
   serving them (same reasoning as operator-content.mjs's nicheDefaults).

   TOKEN RESOLUTION IS SHARED VOCABULARY. buildTokens / fillTemplate /
   priceHeadline are exported named functions so they can be driven by node
   without a browser; the handler only composes them. fillTemplate has a
   twin inside admin/index.html's inline script — a classic inline script
   cannot import an .mjs lambda without new machinery, so the two copies
   each carry a keep-in-sync comment instead.

   COMPLIANCE: nothing in this file writes marketing copy. Every string it
   renders comes from the operator's own saved content or the niche demo —
   no income claims, no fabricated proof, ever.
   ========================================================================== */
import {
  json, preflight, pgSelectOne, assertConfigured, userFromRequest,
  SITE_URL, SUPABASE_URL, SERVICE_KEY,
} from './_shared.mjs';
import QRCode from 'qrcode';
import chromium from '@sparticuz/chromium';
import { chromium as pw } from 'playwright-core';

export const config = { runtime: 'nodejs' };

// client_id's own shape, from sbv_tenants_reserved_ck in COMMERCE.sql.
const LABEL = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const BUCKET = 'sbv-operator-media';

export default { fetch: handler };

/* ────────────────────────────────────────────────────────── token building */

// The admin's neutral fallback palette — used token-by-token whenever the
// manifest index is unreachable, has no entry for this niche, or an entry's
// theme is missing a key. A partial theme must never leave a raw {{token}}
// (or an empty color) in the rendered artwork.
const NEUTRAL_THEME = {
  ground: '#101318',
  surface: '#171c24',
  accent: '#d9a441',
  accent_bright: '#e6b95c',
  text: '#f2f4f8',
  text_soft: '#aeb6c2',
  on_accent: '#101318',
  fonts_href: 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap',
  font_display: "'Oswald',sans-serif",
  font_label: "'Oswald',sans-serif",
  font_body: "'Inter',sans-serif",
};

// manifest.theme keys are camelCase (built from niches/<slug>/manifest.json);
// the token vocabulary is snake_case. This map is the one place the two meet.
const THEME_KEY_MAP = {
  ground: 'ground',
  surface: 'surface',
  accent: 'accent',
  accentBright: 'accent_bright',
  text: 'text',
  textSoft: 'text_soft',
  onAccent: 'on_accent',
  fontsHref: 'fonts_href',
  display: 'font_display',
  label: 'font_label',
  body: 'font_body',
};

function str(v) {
  return (v === null || v === undefined) ? '' : String(v).trim();
}

// Operator-typed strings land inside markup that chromium executes with
// web security off — and four tokens already sit inside QUOTED ATTRIBUTES
// (logo_src, qr_src, site_host, phone_href), so stripping only angle
// brackets was not enough: a double quote breaks out of the attribute.
// Entity-encode the five HTML-significant characters; in text positions
// the entities render back to the literal characters, so names like
// "Magpie & Mantel" stay legible everywhere. Theme tokens are exempt:
// they land inside <style> and legitimately carry quotes and commas.
// keep in sync with mkSafe in admin/index.html
function safe(v) {
  return str(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// A bare 10-digit number (or 11 with a leading 1) whose only non-digit
// characters are separators (space/dash/dot/paren) is treated as UNFORMATTED
// and gets normalized to "(XXX) XXX-XXXX" for display. Anything carrying a
// character outside that separator set (a leading "+", an extension, letters)
// is left exactly as the operator typed it — reformatting risks mangling a
// deliberate international or extension format we don't understand. Any
// other digit count (7-digit, 12-digit, …) also passes through unchanged.
// phone_href is untouched by this — it already normalizes independently from
// the fully-stripped digit string.
// keep in sync with mkFormatPhoneDisplay in admin/index.html
function formatPhoneDisplay(v) {
  const s = str(v);
  if (!s) return s;
  const stripped = s.replace(/[\s().-]/g, '');
  if (!/^[0-9]+$/.test(stripped)) return s;
  let d = stripped;
  if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
  if (d.length !== 10) return s;
  return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
}

function themeTokens(manifest) {
  const src = (manifest && manifest.theme && typeof manifest.theme === 'object'
    && !Array.isArray(manifest.theme)) ? manifest.theme : {};
  const out = {};
  Object.keys(THEME_KEY_MAP).forEach(function (from) {
    const to = THEME_KEY_MAP[from];
    const v = str(src[from]);
    out[to] = v || NEUTRAL_THEME[to];
  });
  return out;
}

// Resilient dot-path getter for manifest mergePaths ("pricing", "plans",
// "niche.flash", "pricing.ranges"). Returns undefined on ANY miss — a
// missing segment, a non-object intermediate, a prototype-inherited key.
// Pricing resolution must never throw over a shape mismatch.
function getPath(obj, dotPath) {
  if (!obj || typeof obj !== 'object' || !dotPath || typeof dotPath !== 'string') return undefined;
  let cur = obj;
  const parts = dotPath.split('.');
  for (let i = 0; i < parts.length; i++) {
    if (cur === null || typeof cur !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(cur, parts[i])) return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}

// "$10" stays "$10"; a bare numeric like 120 or "16" becomes "$120" / "$16"
// (landscaping's plans and child-care's rates store numbers, not display
// strings). Anything already carrying its own formatting passes through.
function displayPrice(v) {
  const s = str(v);
  if (!s) return '';
  return /^[0-9]+(\.[0-9]+)?$/.test(s) ? '$' + s : s;
}

// First number found in a price label, for picking the LOWEST tier.
// "$1,800 – $3,200" parses as 1800; a label with no number parses as NaN
// and that row simply cannot win. K/M suffixes normalize BEFORE comparison:
// contracting's "$2.5K–$15K" must parse as 2500, or it "wins" against a
// $500 entry tier and the flyer overstates the starting price fivefold.
// keep in sync with mkPriceNumber in admin/index.html
function priceNumber(v) {
  const m = String(v == null ? '' : v).replace(/,/g, '').match(/([0-9]+(\.[0-9]+)?)\s*([kKmM])?/);
  if (!m || !m[1]) return NaN;
  const n = parseFloat(m[1]);
  const suffix = (m[3] || '').toLowerCase();
  return suffix === 'k' ? n * 1000 : suffix === 'm' ? n * 1000000 : n;
}

// A pricing row's display label lives under different keys per niche:
// price_label (the validator's name), blurb (tiers convention), price
// (plans / flash / hvac / sizes), range. First non-empty wins.
function rowPriceLabel(row) {
  if (!row || typeof row !== 'object') return '';
  const keys = ['price_label', 'blurb', 'price', 'range'];
  for (let i = 0; i < keys.length; i++) {
    const s = str(row[keys[i]]);
    if (s) return s;
  }
  return '';
}

// Model-aware one-liner from the merged content's prices, per the manifest's
// pricing.model + pricing.mergePath. NEVER throws over pricing: any missing,
// unshaped, or surprising data resolves to '' and the template hides the
// price badge (its optional block drops). Exported for browserless testing.
export function priceHeadline(manifest, content) {
  try {
    const cfg = (manifest && manifest.pricing && typeof manifest.pricing === 'object')
      ? manifest.pricing : {};
    /* A unit-priced niche states its unit here (see validate-manifest):
       "From $0.08" on a printed flyer reads as the price of the whole job,
       "From $0.08/sq ft" reads as what it is.
       GATED ON THE WINNING ROW, not on the niche. A niche can mix per-unit
       and per-job rows — window-cleaning prices three flat packages plus a
       per-pane rate — and the headline takes whichever row is cheapest. If
       an operator deletes the per-pane row, the cheapest becomes a flat
       $149 package and an ungated suffix would print "From $149/pane" on
       their flyer: a false price, and one that contradicts their own site.
       So the suffix applies only when the row that won still carries that
       unit in its own `per` text (a field the tiers editor does not expose,
       so it always comes from the niche, never from an operator). Anything
       else falls back to the bare number. */
    const suffix = str(cfg.headlineSuffix);
    /* Match WHOLE WORDS in sequence, never a substring: "/four hours" must
       not satisfy a "/hour" suffix (a per-four-hour block is not an hourly
       rate — that printed "From $160/hour" before this was tightened), while
       "per sq ft, monthly" must still satisfy "/sq ft". */
    const words = (v) => str(v).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const suffixWords = words(suffix);
    const withUnit = (v, row) => {
      if (!v || !suffix || !suffixWords.length) return v;
      const perWords = words(row && row.per);
      for (let i = 0; i + suffixWords.length <= perWords.length; i++) {
        let hit = true;
        for (let j = 0; j < suffixWords.length; j++) {
          if (perWords[i + j] !== suffixWords[j]) { hit = false; break; }
        }
        if (hit) return v + suffix;
      }
      return v;
    };
    const model = str(cfg.model) || 'none';
    if (model === 'calculator' || model === 'none') return '';

    const data = getPath(content, str(cfg.mergePath));
    if (data === null || data === undefined) return '';

    if (model === 'tiers' || model === 'flash') {
      if (!Array.isArray(data)) return '';
      let bestLabel = '';
      let bestRow = null;
      let bestN = Infinity;
      for (let i = 0; i < data.length; i++) {
        const label = rowPriceLabel(data[i]);
        if (!label) continue;
        const n = priceNumber(label);
        if (Number.isFinite(n) && n < bestN) { bestN = n; bestLabel = label; bestRow = data[i]; }
      }
      return bestLabel ? withUnit('From ' + displayPrice(bestLabel), bestRow) : '';
    }

    if (model === 'hourly') {
      // Array shape (moving's crewTiers) → first row; object shape
      // (child-care's rates) → the object itself. rate is the validator's
      // key; base is child-care's own dialect for the same idea.
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row !== 'object') return '';
      const rate = str(row.rate) || str(row.base);
      if (!rate) return '';
      const unit = str(row.unit);
      return withUnit(displayPrice(rate) + (unit ? ' ' + unit : ''), row);
    }

    if (model === 'quote') {
      if (typeof data !== 'object' || Array.isArray(data)) return '';
      // starting_at is the validator's key; minimum is where the overlay
      // lands it for niches whose quoter speaks that dialect (delivery).
      const v = str(data.starting_at) || str(data.minimum);
      return v ? withUnit('From ' + displayPrice(v), data) : '';
    }

    if (model === 'percentage') {
      if (typeof data !== 'object' || Array.isArray(data)) return '';
      const v = str(data.commission);
      if (!v) return '';
      return /^[0-9]+(\.[0-9]+)?$/.test(v) ? v + '%' : v;
    }

    return '';
  } catch (e) {
    return '';
  }
}

// The full token vocabulary for one tenant. Every key is always present and
// always a string — fillTemplate substitutes '' for anything unresolved, so
// a raw {{token}} can never survive into the artwork. Exported for
// browserless testing.
export function buildTokens(tenant, content, manifest, qrSrc) {
  const c = (content && typeof content === 'object') ? content : {};
  const brand = (c.brand && typeof c.brand === 'object') ? c.brand : {};
  const photos = (c.photos && typeof c.photos === 'object') ? c.photos : {};

  const phone = safe(brand.phone);
  const digits = phone.replace(/[^0-9]/g, '');
  let phoneHref = '';
  if (digits.length === 10) phoneHref = 'tel:+1' + digits;
  else if (digits.length === 11 && digits.charAt(0) === '1') phoneHref = 'tel:+' + digits;
  else if (digits) phoneHref = 'tel:' + digits;

  // brand.city is often already the display pair ("Nampa, ID") — the overlay
  // writes op.city + ', ' + op.state_code into it. A separate brand.state is
  // honored when a niche carries one; otherwise whichever half exists stands.
  const city = safe(brand.city);
  const state = safe(brand.state);
  const cityState = (city && state) ? city + ', ' + state : (city || state);

  // The logo must be an ABSOLUTE URL: page.setContent renders with no base
  // to resolve a /sites/... path against, and a broken img in the artwork is
  // worse than no logo (the optional block drops cleanly on '').
  // photos.logo is the merged-content slot; brand.logo is where an
  // operator's uploaded logo_url actually lands in the overlay.
  const logoCand = str(photos.logo) || str(brand.logo);
  const logoSrc = /^https?:\/\//i.test(logoCand) ? safe(logoCand) : '';

  const host = tenant + '.systemsbyvega.com';

  return Object.assign({
    business_name: safe(brand.name),
    phone: formatPhoneDisplay(phone),
    phone_href: phoneHref,
    city_state: cityState,
    tagline: safe(brand.tagline),
    price_headline: safe(priceHeadline(manifest, c)),
    site_url: 'https://' + host + '/',
    site_host: host,
    qr_src: str(qrSrc),
    logo_src: logoSrc,
    year: String(new Date().getFullYear()),
  }, themeTokens(manifest));
}

// keep in sync with fillTemplate in admin/index.html
export function fillTemplate(html, tokens) {
  // Remove optional blocks whose token is empty/missing.
  let out = html.replace(
    /<[^>]*data-optional="([a-z_.]+)"[\s\S]*?data-optional-end-->/g,
    (block, name) => (tokens[name] ? block : '')
  );
  // Single-pass token substitution; unresolved -> ''.
  out = out.replace(/\{\{([a-z_.]+)\}\}/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(tokens, name) ? tokens[name] : ''
  );
  return out;
}

/* ─────────────────────────────────────────────────────────── http fetching */

// Every outbound fetch in this file goes through here: hard timeout via
// AbortController, fetch wrapped in Promise.resolve so a synchronous throw
// funnels into the same rejection path as a network one.
async function fetchWithTimeout(url, init, ms) {
  const stop = new AbortController();
  const timer = setTimeout(function () { stop.abort(); }, ms);
  try {
    return await Promise.resolve(
      fetch(url, Object.assign({}, init || {}, { signal: stop.signal })));
  } finally {
    clearTimeout(timer);
  }
}

// JSON over HTTP, null on ANY failure — the caller decides whether null is
// fatal (merged content) or merely a fallback (manifest index).
async function fetchJsonSafe(url, ms) {
  try {
    const res = await fetchWithTimeout(url, null, ms);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('marketing-kit: fetch failed for', url, '-', e.message);
    return null;
  }
}

async function fetchTextSafe(url, ms) {
  try {
    const res = await fetchWithTimeout(url, null, ms);
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.error('marketing-kit: fetch failed for', url, '-', e.message);
    return null;
  }
}

// Template per format: the niche's own override first, 404 → the master.
// Both are static repo files served by this same deployment.
async function fetchTemplate(slug, fmt) {
  const override = await fetchTextSafe(
    SITE_URL + '/niches/' + encodeURIComponent(slug) + '/marketing/' + fmt + '.html', 5000);
  if (override) return override;
  return fetchTextSafe(SITE_URL + '/_template/marketing/' + fmt + '.html', 5000);
}

/* ─────────────────────────────────────────────────────────── bucket upload */

function objectName(tenant, name) {
  return tenant + '/marketing/' + name;
}

async function uploadToBucket(tenant, name, bytes, contentType) {
  const res = await fetchWithTimeout(
    SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/' + objectName(tenant, name),
    {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: 'Bearer ' + SERVICE_KEY,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: bytes,
    },
    30000);
  if (!res.ok) {
    const detail = await res.text().catch(function () { return ''; });
    throw new Error('storage upload failed (' + res.status + ') for ' + name +
      ': ' + detail.slice(0, 200));
  }
}

function publicUrl(tenant, name) {
  return SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + objectName(tenant, name);
}

/* ────────────────────────────────────────────────────────────────── handler */

async function handler(request) {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  try {
    try {
      assertConfigured();
    } catch (e) {
      console.error('marketing-kit: not configured:', e.message);
      return json({ ok: false, error: 'not_configured' }, 503);
    }

    // ── 1. POST body: { tenant }, validated against the label shape ──────
    let body = null;
    try { body = await request.json(); } catch (e) { body = null; }
    const tenant = String((body && body.tenant) || '').toLowerCase();
    if (!LABEL.test(tenant)) {
      return json({ ok: false, error: 'bad_tenant' }, 400);
    }

    // ── 2. Auth gate, fail-closed: the caller's JWT must resolve to a user
    // (verified against Supabase, never decoded locally), and that user must
    // hold a sbv_client_users mapping to THIS tenant, before any service-key
    // work happens. Same shape as the admin gate.
    // userFromRequest never throws — it verifies the JWT against Supabase
    // (a token this process does not verify is just a string the caller
    // chose) and returns { user } or { error }.
    const who = await userFromRequest(request);
    if (!who || !who.user) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }
    let mapping = null;
    try {
      mapping = await pgSelectOne('sbv_client_users',
        'user_id=eq.' + encodeURIComponent(who.user.id) +
        '&client_id=eq.' + encodeURIComponent(tenant) + '&select=client_id');
    } catch (e) {
      console.error('marketing-kit: mapping lookup failed:', e.message);
      return json({ ok: false, error: 'lookup_failed' }, 503);
    }
    if (!mapping) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }

    // ── 3. Resolve the tenant's niche ────────────────────────────────────
    // is_active filter matches operator-content.mjs's read of this same
    // table: a deactivated tenant should not spend a chromium render or
    // overwrite its public marketing files, even with a valid mapping.
    let tenantRow = null;
    try {
      tenantRow = await pgSelectOne('sbv_tenants',
        'client_id=eq.' + encodeURIComponent(tenant)
          + '&is_active=eq.true&select=client_id,niche_slug');
    } catch (e) {
      console.error('marketing-kit: tenant lookup failed:', e.message);
      return json({ ok: false, error: 'lookup_failed' }, 503);
    }
    if (!tenantRow || !tenantRow.niche_slug) {
      return json({ ok: false, error: 'unknown_tenant' }, 404);
    }
    const slug = String(tenantRow.niche_slug);

    // ── 4. Merged content + manifest index + templates, concurrently ─────
    // allSettled so one slow fetch cannot poison the others; each carries
    // its own 5s budget. Content and templates are load-bearing; the
    // manifest index degrades to the neutral palette.
    const settled = await Promise.allSettled([
      fetchJsonSafe(SITE_URL + '/api/operator-content?tenant=' + encodeURIComponent(tenant), 5000),
      fetchJsonSafe(SITE_URL + '/assets/data/manifests.json', 5000),
      fetchTemplate(slug, 'facebook'),
      fetchTemplate(slug, 'flyer'),
    ]);
    const val = function (i) { return settled[i].status === 'fulfilled' ? settled[i].value : null; };
    const content = val(0);
    const index = val(1);
    const facebookTpl = val(2);
    const flyerTpl = val(3);

    if (!content || typeof content !== 'object') {
      console.error('marketing-kit: merged content unavailable for', tenant);
      return json({ ok: false, error: 'content_unavailable' }, 503);
    }
    if (!facebookTpl || !flyerTpl) {
      console.error('marketing-kit: templates unavailable for niche', slug);
      return json({ ok: false, error: 'templates_unavailable' }, 503);
    }

    // hasOwnProperty guard, not a bare index[slug]: a slug colliding with an
    // inherited Object.prototype key must resolve to "no manifest", never to
    // a prototype function.
    const manifest = (index && typeof index === 'object' &&
      Object.prototype.hasOwnProperty.call(index, slug)) ? index[slug] : null;

    // ── 5. Tokens + QR (real data URI; the admin preview uses a gray
    // placeholder square instead — preview never needs a real QR) ─────────
    let qrSrc = '';
    try {
      qrSrc = await QRCode.toDataURL('https://' + tenant + '.systemsbyvega.com/',
        { margin: 1, width: 264 });
    } catch (e) {
      // A missing QR degrades to an empty square in the artwork; it must
      // not sink the whole render.
      console.error('marketing-kit: qr generation failed:', e.message);
    }
    const tokens = buildTokens(tenant, content, manifest, qrSrc);
    const facebookHtml = fillTemplate(facebookTpl, tokens);
    const flyerHtml = fillTemplate(flyerTpl, tokens);

    // ── 6. Render: one browser, one page per format ──────────────────────
    let facebookPng = null;
    let flyerPdf = null;
    let flyerPng = null;
    // chromium.args passes UNFILTERED, on live evidence. A review-prescribed
    // filter stripped --single-process/--no-zygote (the general playwright
    // wisdom), but on this runtime the multi-process browser dies at
    // newPage ("Target crashed" on skewed versions, "browser has been
    // closed" on matched ones) — the sparticuz binary is built to run
    // single-process on serverless filesystems and its own playwright
    // example passes args verbatim. Version pairing does the compatibility
    // work instead: playwright-core is pinned to the release whose CDP
    // driver matches the shipped Chromium major (see package.json).
    // Keep sparticuz's process-model flags (--single-process/--no-zygote —
    // the binary is built for serverless filesystems that cannot spawn its
    // renderer processes) but strip its --headless variant: it carries
    // LITERAL quotes (--headless='shell'), and since it comes after the
    // clean flag playwright adds for headless:true, the broken value wins,
    // chromium starts in a mode that wants a display, and the browser dies
    // the moment newPage creates a window. Live-diagnosed: binary probe ok,
    // launch ok, death at newPage in every args permutation that kept it.
    const launchArgs = chromium.args.filter(function (a) {
      return a.indexOf('--headless') !== 0;
    });
    // Canonical container fix: chromium's default shared-memory transport
    // lives in /dev/shm, which serverless runtimes mount tiny or not at
    // all — the classic silent browser death at first page creation.
    if (launchArgs.indexOf('--disable-dev-shm-usage') === -1) {
      launchArgs.push('--disable-dev-shm-usage');
    }
    // Graphics off: nothing in these templates needs WebGL, and swiftshader
    // initialization is a documented crash-at-page-create culprit for this
    // binary on non-Lambda serverless runtimes.
    chromium.setGraphicsMode = false;
    const exePath = await chromium.executablePath();
    // launchPersistentContext, NOT launch + newPage: playwright's newPage
    // creates an INCOGNITO browser context over CDP, and that call is what
    // kills this binary here — live-diagnosed by spawning the same binary
    // with the same args directly (default context, about:blank): it ran
    // and served DevTools happily while every launch()+newPage permutation
    // died with "browser has been closed". puppeteer works with sparticuz
    // for the same reason (its newPage uses the default context). A
    // persistent context IS the default profile. /tmp is the lambda's only
    // writable path.
    const context = await pw.launchPersistentContext('/tmp/marketing-kit-profile', {
      args: launchArgs,
      executablePath: exePath,
      headless: true,
    }).catch(function (le) {
      throw new Error('launch: ' + String(le && le.message).split('\n')[0]);
    });
    try {
      // waitUntil 'load' (not 'networkidle'): the capture is actually gated
      // by the document.fonts.ready await below, and networkidle's own 30s
      // default timeout would turn one slow font host into an opaque
      // render_failed. fonts.ready resolves to a FontFaceSet Playwright
      // cannot serialize — the .then(true) keeps the await meaningful
      // without the serialization ambiguity.
      const fbPage = await context.newPage();
      await fbPage.setViewportSize({ width: 1080, height: 1350 });
      await fbPage.setContent(facebookHtml, { waitUntil: 'load' });
      await fbPage.evaluate(function () { return document.fonts.ready.then(function () { return true; }); });
      facebookPng = await fbPage.screenshot({ type: 'png' });
      await fbPage.close();

      const flyPage = await context.newPage();
      await flyPage.setViewportSize({ width: 816, height: 1056 });
      await flyPage.setContent(flyerHtml, { waitUntil: 'load' });
      await flyPage.evaluate(function () { return document.fonts.ready.then(function () { return true; }); });
      flyerPdf = await flyPage.pdf({ format: 'Letter', printBackground: true });
      flyerPng = await flyPage.screenshot({ type: 'png' });
      await flyPage.close();
    } finally {
      // close() must not mask a render error with its own.
      try { await context.close(); } catch (e) {
        console.error('marketing-kit: context close failed:', e.message);
      }
    }

    // ── 7. Upload, stable names, x-upsert — regenerate overwrites ────────
    const artifacts = [
      { format: 'facebook-png', name: 'facebook-1080x1350.png', bytes: facebookPng, type: 'image/png' },
      { format: 'flyer-pdf', name: 'flyer-letter.pdf', bytes: flyerPdf, type: 'application/pdf' },
      { format: 'flyer-png', name: 'flyer-letter.png', bytes: flyerPng, type: 'image/png' },
    ];
    // Validate ALL artifacts before uploading ANY: a zero-byte flyer must
    // not leave a fresh facebook PNG behind with the caller told 500.
    for (const a of artifacts) {
      if (!a.bytes || !a.bytes.length) {
        throw new Error('render produced no bytes for ' + a.format);
      }
    }
    const files = [];
    for (const a of artifacts) {
      await uploadToBucket(tenant, a.name, a.bytes, a.type);
      files.push({ format: a.format, url: publicUrl(tenant, a.name) });
    }

    // ── 8. Public URLs back to the caller ────────────────────────────────
    return json({ ok: true, files: files });
  } catch (e) {
    // Terminal catch: log the detail server-side. The response carries a
    // SANITIZED one-line reason — the caller is already authenticated (every
    // path to here is behind the sbv_client_users gate), filesystem paths
    // and anything after a newline are stripped, and the admin shows the
    // code verbatim, which is what makes a field failure diagnosable
    // without log access.
    console.error('marketing-kit: render failed:', e && e.message);
    const reason = String((e && e.message) || 'unknown')
      .split('\n')[0]
      .replace(/[\\/][^\s]*/g, '')
      .slice(0, 140);
    // Build marker so a live retry is attributable to the deploy it hit.
    const build = String(process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7);
    return json({ ok: false, error: 'render_failed@' + build + ': ' + reason }, 500);
  }
}
