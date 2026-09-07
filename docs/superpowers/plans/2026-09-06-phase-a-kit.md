# Phase A-kit — Marketing Kit Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Every tenant can preview and download a branded marketing kit (1080×1350 social PNG + Letter flyer PDF/PNG with a QR to their live site) from a new Marketing tab in the admin.

**Architecture:** Shared master templates in `_template/marketing/` themed by manifest + merged operator content via `{{token}}` substitution, with optional per-niche overrides at `niches/<slug>/marketing/`; `api/marketing-kit.mjs` renders them with playwright-core + @sparticuz/chromium, stamps a `qrcode`-generated QR, uploads to `sbv-operator-media/<tenant>/marketing/` with the service key, and returns URLs. Admin previews the same template client-side in an iframe (srcdoc) for free.

**Tech Stack:** playwright-core, @sparticuz/chromium, qrcode (the only 3 new deps). No `"type":"module"` change — the endpoint is `.mjs`.

**Spec:** docs/superpowers/specs/2026-09-06-phase-a-platform-generalization.md (Decision 3, binding).

**Spec refinement (ruling, ledger it):** the spec says "one HTML template per format per niche." That is 46 hand-authored files. Refined to: one shared master pair themed from the manifest (covers all 23 immediately — the brief's actual deliverable) + per-niche override capability; bin-cleaning ships the Prime-derived override as the reference, proving the override path. Phase B waves may add bespoke overrides where a niche deserves one. Cost if wrong: shared-template output is generic-looking for some niches until B — acceptable, honest, reversible.

## Global Constraints
- All brief §1 hard rules (niches-not-sites, absolute `/sites/...` paths, omit-unset columns, Promise.resolve-wrapped builders + terminal catch, no `*/` inside block comments, fictional demo brands, DOM-property escaping for new sinks).
- **Compliance: zero income claims, zero fabricated proof** in every template string — marketing copy describes services, never earnings or invented testimonials.
- `package.json` must NOT gain `"type":"module"` (build-catalog.js + api/*.js are CommonJS).
- Endpoint auth: the caller's Supabase JWT must map to the tenant via `sbv_client_users` before any service-key work — no unauthenticated render endpoint (it costs real compute and writes to the bucket).
- Templates are static repo files (repo root is Vercel's outputDirectory), fetched over HTTP by both consumers — no fs reads in the lambda.
- Implementers never commit; controller batch-commits. No SQL in this plan (bucket + tables already exist).

## Token vocabulary (single source of truth)

`{{business_name}} {{phone}} {{phone_href}} {{city_state}} {{tagline}} {{price_headline}} {{site_url}} {{site_host}} {{qr_src}} {{logo_src}} {{accent}} {{accent_bright}} {{ground}} {{surface}} {{text}} {{text_soft}} {{on_accent}} {{fonts_href}} {{font_display}} {{font_label}} {{font_body}} {{year}}`

Resolution rules (identical in endpoint and admin):
- Theme tokens come from the manifest `theme` object (index entry); manifest absent → the admin's neutral fallback palette.
- `price_headline`: model-aware one-liner from merged prices — tiers/flash: lowest `price_label` prefixed "From "; hourly: first row `rate + " " + unit`; quote/percentage: `starting_at`/`commission` with note; calculator/none: empty string (template hides the element when empty).
- `qr_src` is a data URI (endpoint: `qrcode.toDataURL`; admin preview: a gray placeholder square data URI — preview never needs a real QR).
- Unresolved tokens are replaced with `''`, never left visible.
- Substitution is one function: `fillTemplate(html, tokens)` doing a single-pass `replace(/\{\{([a-z_.]+)\}\}/g, ...)`. It lives twice — `api/marketing-kit.mjs` and inside admin's inline script — each copy carrying the comment `// keep in sync with fillTemplate in <other file>` (10 lines; a shared module can't be imported by both a classic inline script and an .mjs lambda without new machinery).

---

### Task 1: Shared master templates + bin-cleaning override + reference copies

**Files:**
- Create: `_template/marketing/facebook.html` (1080×1350), `_template/marketing/flyer.html` (8.5×11 @ 816×1056 CSS px, print-safe)
- Create: `niches/bin-cleaning/marketing/facebook.html`, `niches/bin-cleaning/marketing/flyer.html` (Prime-derived, tokenized)
- Create: `niches/bin-cleaning/marketing/reference/` — copy of `C:/Users/JasonVega/Desktop/Jason/PrimeBinCleaning/prime-bin-cleaning-facebook-source.html` + the two finished PNGs (spec: Prime's finished pieces land as reference)

**Interfaces:**
- Produces: template files whose ONLY dynamic surface is the token vocabulary above; every template hides `price_headline`/`logo_src` elements when the token is empty (CSS `:has` not available in print contexts — use a `data-empty` attribute set by the renderer? No: simplest is `<span class="tok-price">{{price_headline}}</span>` and a `<style>` rule is impossible for emptiness — instead the substitutor removes any element carrying `data-optional="price_headline"` when that token is empty; `fillTemplate` implements this with one regex removing `<[^>]*data-optional="NAME"[\s\S]*?data-optional-end-->` blocks, each optional element wrapped as `<div data-optional="price_headline">...</div><!--data-optional-end-->`).

Structure exemplars (style, not copy verbatim): `C:/Users/JasonVega/Desktop/Jason/systems-by-vega/systems-by-vega-facebook-v2-source.html` and `...print-v2-source.html`. Replace their `node_modules/@fontsource/...` @font-face blocks with `<link href="{{fonts_href}}" rel="stylesheet">` + `preconnect` (serverless chromium has network; fonts must load before capture — the endpoint waits on `document.fonts.ready`).

- [ ] Master `facebook.html`: 1080×1350 fixed frame, theme-token palette, business name display-font headline, tagline, price_headline (optional block), phone CTA bar, site_host + QR footer (QR `<img src="{{qr_src}}" width="132" height="132">`), `{{year}}` small print. All copy service-descriptive; zero income claims.
- [ ] Master `flyer.html`: light "paper" variant, same tokens, tear-off-style bottom strip with phone + site_host + QR.
- [ ] bin-cleaning overrides: start from Prime facebook source; strip JSON-LD/meta/favicon head baggage to a bare render page; replace every Prime literal (name, phone, prices, city) with tokens; flyer.html adapted from the master with Prime's palette baked copy style.
- [ ] Copy Prime reference pieces into `niches/bin-cleaning/marketing/reference/`.
- [ ] Verify: open both masters + both overrides with a scratch HTML that inlines `fillTemplate` and sample tokens (write `scratch-preview.html` in the SDD workspace, not the repo); screenshot-free eyeball via browser is fine; `node --check` n/a (no JS files).

### Task 2: `api/marketing-kit.mjs` + deps + function config

**Files:**
- Create: `api/marketing-kit.mjs`
- Modify: `package.json` (add `playwright-core`, `@sparticuz/chromium`, `qrcode` to dependencies — nothing else)
- Modify: `vercel.json` (add `"functions": { "api/marketing-kit.mjs": { "memory": 3009, "maxDuration": 300 } }`)

**Interfaces:**
- Consumes: `GET /api/operator-content?tenant=<id>` (merged content, same-deployment HTTP fetch via `PUBLIC_SITE_URL` — the pattern already in operator-content.mjs:140), `assets/data/manifests.json`, template files over HTTP (`/niches/<slug>/marketing/<fmt>.html` → 404 → `/_template/marketing/<fmt>.html`).
- Produces: `POST /api/marketing-kit` body `{ tenant }`, auth `Bearer <supabase JWT>` → `{ ok:true, files:[{format:'facebook-png',url},{format:'flyer-pdf',url},{format:'flyer-png',url}] }`.

Endpoint flow (write it in this order, commented):
1. POST only; parse `{tenant}`; validate against the label regex `^[a-z0-9]+(-[a-z0-9]+)*$`.
2. Auth: `GET ${SUPABASE_URL}/auth/v1/user` with the caller's bearer + apikey publishable → user id; then service-key REST read of `sbv_client_users?user_id=eq.<id>&client_id=eq.<tenant>` → must return a row, else 403. (Same fail-closed shape as the admin gate.)
3. Resolve niche: service-key read of `sbv_tenants` (or the public RPC) → `niche_slug`; 404 if none.
4. Fetch merged content + manifests index concurrently (Promise.allSettled, 5s budget); template per format with override-then-master fallback.
5. Build tokens (the vocabulary + resolution rules above); `qr_src = await QRCode.toDataURL('https://<tenant>.systemsbyvega.com/', {margin:1, width:264})`.
6. Launch: `const browser = await pw.launch({args: chromium.args, executablePath: await chromium.executablePath(), headless: true})`; one browser, one page per format; `page.setViewportSize({width:1080,height:1350})` / flyer `{width:816,height:1056}`; `page.setContent(filled, {waitUntil:'networkidle'})`; `await page.evaluate(() => document.fonts.ready)`; facebook: `page.screenshot({type:'png'})`; flyer: `page.pdf({format:'Letter', printBackground:true})` AND `page.screenshot({type:'png'})`.
7. Upload each via `POST ${SUPABASE_URL}/storage/v1/object/sbv-operator-media/<tenant>/marketing/<name>` with service key, `x-upsert: true`, correct content-type. Names: `facebook-1080x1350.png`, `flyer-letter.pdf`, `flyer-letter.png` (stable names — regenerate overwrites; no timestamp litter).
8. Return public URLs (`${SUPABASE_URL}/storage/v1/object/public/sbv-operator-media/<tenant>/marketing/<name>`); `finally { await browser.close() }`; terminal catch → `{ok:false,error}` 500 with no internals leaked.

- [ ] Write endpoint per the flow; every fetch wrapped with timeout + terminal catch; no `*/` inside block comments.
- [ ] `npm install` the 3 deps (lockfile updated); `node --check api/marketing-kit.mjs`.
- [ ] Local logic test (no chromium locally required): extract `buildTokens` + `fillTemplate` into the file with `export` and drive them with `node -e` against real merged-content JSON for primetest — assert price_headline "From $10"-style, optional-block removal when empty, zero unresolved `{{` in output.
- [ ] Verify vercel.json still parses (node -e JSON.parse) and no other keys changed.

### Task 3: Admin Marketing tab

**Files:**
- Modify: `admin/index.html`

**Interfaces:**
- Consumes: the template fetch fallback (`/niches/<niche>/marketing/facebook.html` → `/_template/marketing/facebook.html`), manifests index (already loaded), current saved fields (already in memory), `POST /api/marketing-kit`.

- [ ] New nav section "Marketing" (same section pattern as the existing five; theme-aware).
- [ ] Preview: two iframes (facebook 1080×1350 scaled to fit via `transform:scale`, flyer 816×1056 likewise), `srcdoc = fillTemplate(templateHtml, tokens)` where tokens come from the SAME resolution rules using the admin's already-loaded merged view of content (`// keep in sync with fillTemplate in api/marketing-kit.mjs`); QR placeholder data URI in preview with caption "The download embeds a working QR code to your live site."
- [ ] "Generate downloads" button → POST with the session JWT → render returned file links (target _blank, download attributes); busy state + error surface matching the existing Save UX; button disabled with honest caption while tenant is unresolved.
- [ ] No dirty-tracking interaction: the tab reads state, never writes it — Reset/Save flows untouched.
- [ ] Verify: `node --check` the extracted inline script; harness stub walk — serve a stub template + stub endpoint, confirm preview substitution (no `{{` visible), optional-block removal, generate flow happy + error paths.

### Task 4: Live verification + review + push (controller)

- [ ] Deploy rides the push; verify template fallback URLs live (curl override 200 for bin-cleaning, master 200, absent-niche 404→master logic in endpoint only).
- [ ] Live end-to-end on primetest (real tenant, real JWT via browser admin): Generate → 3 files in bucket → open URLs, eyeball PNG/PDF (fonts loaded, QR scans to https://primetest.systemsbyvega.com/, no `{{` residue, no Prime literals other than tenant data).
- [ ] Landscaping/startest master-template render sanity (proves the all-23 shared path) — startest has no saved content: confirm defaults-only kit renders honestly.
- [ ] qa-site sweep unchanged (marketing files are outside sites/); full-repo `node --check` sweep.
- [ ] Final whole-branch review (most capable model), fix wave if needed, push after clean review.

## Self-review notes
- Spec Decision 3 coverage: render stack (T2), per-niche templates (T1 refined per ruling), QR (T2), bucket upload (T2), admin Marketing tab + preview + on-demand generate (T3), Prime reference pieces landed (T1), fallback note (pre-render at build) not needed unless T4 shows the lambda too heavy.
- Token vocabulary defined once here; T1/T2/T3 all reference it — no drift surface.
- Auth gate closes the open-compute hole the spec didn't mention; ledgered as a ruling.
- No SQL, no Stripe, no catalog copy → no stop conditions triggered.
