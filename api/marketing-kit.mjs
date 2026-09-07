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
// web security off. Angle brackets are the only characters that can change
// the document's structure there — strip them rather than entity-encode,
// so the same value stays legible if a template ever puts it in an
// attribute. Theme tokens are exempt: they land inside <style> and
// legitimately carry quotes and commas.
// keep in sync with mkSafe in admin/index.html
function safe(v) {
  return str(v).replace(/[<>]/g, '');
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
// and that row simply cannot win.
function priceNumber(v) {
  const m = String(v == null ? '' : v).replace(/,/g, '').match(/[0-9]+(\.[0-9]+)?/);
  return m ? parseFloat(m[0]) : NaN;
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
    const model = str(cfg.model) || 'none';
    if (model === 'calculator' || model === 'none') return '';

    const data = getPath(content, str(cfg.mergePath));
    if (data === null || data === undefined) return '';

    if (model === 'tiers' || model === 'flash') {
      if (!Array.isArray(data)) return '';
      let bestLabel = '';
      let bestN = Infinity;
      for (let i = 0; i < data.length; i++) {
        const label = rowPriceLabel(data[i]);
        if (!label) continue;
        const n = priceNumber(label);
        if (Number.isFinite(n) && n < bestN) { bestN = n; bestLabel = label; }
      }
      return bestLabel ? 'From ' + displayPrice(bestLabel) : '';
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
      return displayPrice(rate) + (unit ? ' ' + unit : '');
    }

    if (model === 'quote') {
      if (typeof data !== 'object' || Array.isArray(data)) return '';
      // starting_at is the validator's key; minimum is where the overlay
      // lands it for niches whose quoter speaks that dialect (delivery).
      const v = str(data.starting_at) || str(data.minimum);
      return v ? 'From ' + displayPrice(v) : '';
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
  const logoSrc = /^https?:\/\//i.test(logoCand) ? logoCand : '';

  const host = tenant + '.systemsbyvega.com';

  return Object.assign({
    business_name: safe(brand.name),
    phone: phone,
    phone_href: phoneHref,
    city_state: cityState,
    tagline: safe(brand.tagline),
    price_headline: priceHeadline(manifest, c),
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
    // @sparticuz/chromium's stock args include --single-process and
    // --no-zygote (memory savers for tiny lambdas) plus its own --headless
    // variant. Playwright's target attachment assumes out-of-process
    // renderers — the --single-process pairing is the classic
    // works-with-puppeteer, hangs-with-playwright failure — and Playwright
    // sends its own headless flag. This function has 3GB; the savers buy
    // nothing and risk everything, so they are stripped.
    const launchArgs = chromium.args.filter(function (a) {
      return a !== '--single-process' && a !== '--no-zygote'
        && a.indexOf('--headless') !== 0;
    });
    const browser = await pw.launch({
      args: launchArgs,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    try {
      // waitUntil 'load' (not 'networkidle'): the capture is actually gated
      // by the document.fonts.ready await below, and networkidle's own 30s
      // default timeout would turn one slow font host into an opaque
      // render_failed. fonts.ready resolves to a FontFaceSet Playwright
      // cannot serialize — the .then(true) keeps the await meaningful
      // without the serialization ambiguity.
      const fbPage = await browser.newPage();
      await fbPage.setViewportSize({ width: 1080, height: 1350 });
      await fbPage.setContent(facebookHtml, { waitUntil: 'load' });
      await fbPage.evaluate(function () { return document.fonts.ready.then(function () { return true; }); });
      facebookPng = await fbPage.screenshot({ type: 'png' });
      await fbPage.close();

      const flyPage = await browser.newPage();
      await flyPage.setViewportSize({ width: 816, height: 1056 });
      await flyPage.setContent(flyerHtml, { waitUntil: 'load' });
      await flyPage.evaluate(function () { return document.fonts.ready.then(function () { return true; }); });
      flyerPdf = await flyPage.pdf({ format: 'Letter', printBackground: true });
      flyerPng = await flyPage.screenshot({ type: 'png' });
      await flyPage.close();
    } finally {
      // close() must not mask a render error with its own.
      try { await browser.close(); } catch (e) {
        console.error('marketing-kit: browser close failed:', e.message);
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
    return json({ ok: false, error: 'render_failed: ' + reason }, 500);
  }
}
