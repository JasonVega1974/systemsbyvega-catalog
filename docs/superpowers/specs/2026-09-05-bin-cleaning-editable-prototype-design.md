# Bin-Cleaning Niche: Prime Design + Editable-Site Prototype

**Date:** 2026-09-05 · **Status:** approved design, pre-implementation
**Scope:** `niches/bin-cleaning/` only. Landscaping and the other 21 niches ship byte-identical.

## Goal

Rebuild the bin-cleaning niche to match Prime Bin Cleaning's real site (design,
before/after slider, bin-count pricing), using Prime's actual branding —
authorized by the owner, so the usual fictional-demo rule does not apply here.
Make its photos, logo, prices, hours, business details, and inquiry email
editable by the operator through the existing admin, extending the pattern
proven on landscaping: jsonb columns + immutable validators + admin fields +
the merge endpoint. This niche is the prototype for making all 23+ niches
editable the same way.

## Source material

`C:\Users\JasonVega\Desktop\Jason\PrimeBinCleaning\index.html` (1,256 lines,
593KB, self-contained). Analyzed 2026-09-05:

- Sections in order: sticky nav · hero (water-drop layer, logo badge, 3 proof
  stats) · 4-item trust strip · **drag before/after slider** (`#ba`,
  role="slider", keyboard-accessible, two image slots) · 3 benefit cards ·
  pricing (3 tiers by bin count) · 3-step process · Meet Micah (placeholder) ·
  5-item FAQ · testimonials (3 empty placeholder cards) · signup form ·
  footer · sticky mobile call/text bar.
- Pricing: per-cleaning, tiered by bin count — 1 bin $10 · 2 bins $18
  ("$9 per bin", best-value tier) · 3 bins $25 ("~$8 per bin") · 4+/street:
  "text for a group rate". Recurrence (One-time / Monthly / Every other month /
  Quarterly) is a form field, not a price.
- Branding: "Prime Bin Cleaning · Clean bins. Fresher homes." Owner Micah,
  Nampa & Caldwell ID. Palette `--midnight:#050f1c` `--navy:#0a2138`
  `--steel:#1c5a93` `--sky:#4ea4e6` `--ice:#bfe3fb`; gold `#f5c14b` sparingly.
  Fonts Anton / Oswald / Inter (Google Fonts). Logo is a ~230KB base64 PNG in a
  CSS variable; before/after pair is ~282KB base64 on one line.
- Leads: backendless FormSubmit AJAX to the configured email; SMS fallback on
  failure; honeypot. **FormSubmit silently drops leads until the recipient
  clicks a one-time activation email.**
- Zero JS libraries; Google Fonts is the only external asset dependency.

## Decisions (each argued during design; recorded here as settled)

1. **Option A + real branding.** The demo niche IS Prime — name, logo, photos,
   phone. Owner authorization on record (conversation, 2026-09-05).
2. **Catalog disclosure amendment.** The Site Shop hero's "Every business name
   below is just an example — none of these are real companies" becomes false
   for this card. Amend to "nearly every…" and add a card-level note:
   "(Prime Bin Cleaning is real — it runs on this exact template.)" A real
   business on the template is a proof asset, not a compliance leak, provided
   the disclosure is exact.
3. **Base64 → real files.** Prime's inline images become files in
   `niches/bin-cleaning/photos/`, referenced by ABSOLUTE
   `/sites/bin-cleaning/photos/…` paths. Relative paths 404 on tenant
   subdomains (the document is rewritten to `/`); learned twice
   (content.json, landscaping hero), not to be learned a third time.
4. **Supabase Storage for operator uploads, browser-direct.** Bucket
   `sbv-operator-media`, public read. Write policies require the object path's
   first segment to be a tenant the caller operates:
   `sbv_is_tenant(split_part(name, '/', 1))`. Uploads go browser → Storage
   with the operator's JWT: no server code, no new secrets. Limits: 2MB,
   jpeg/png/webp, enforced in bucket config and mirrored in the admin.
   *Rejected:* base64 into jsonb (zero backend but ~600KB rows shipped on
   every content fetch); Vercel Blob (new credential surface).
5. **`lead_email` is its own column.** Public display email and lead
   destination stay independent. The existing guard — "editing your public
   email must not silently redirect your leads" — survives; redirecting leads
   becomes possible only through the field whose label says exactly that.
   Admin helper text carries the FormSubmit activation warning.
6. **Prices are display strings.** `prices` jsonb mirrors content.json's
   `pricing[]` convention (D-M): no server-side money math, no cents columns.
   Overlay is per-field skip-empty, so editing one tier's price keeps the
   demo's feature list.
7. **Dotted placeholders.** An empty photo slot renders a 2px dashed border
   box with a muted "Photo appears here" label — never a broken image, never
   collapsed space. The before/after slider hides its drag UI until both
   images exist. On the demo this state never shows (Prime's photos fill every
   slot); a fresh operator subdomain shows dashed boxes everywhere a photo
   belongs.
8. **Rollout contract (stated, not built).** A niche's editable surface =
   these columns + a per-niche list of photo-slot keys and merge paths.
   Bin-cleaning hardcodes its slot list; generalization extracts that list
   into a per-niche manifest later. No new tables, no new admin page per niche.

## Schema (`sql/OPERATOR-CONTENT-2.sql`, run by the owner)

Additions to `public.sbv_operator_content`:

| Column | Type | Validation |
|---|---|---|
| `lead_email` | text | same email regex as `email`, ≤254 |
| `logo_url` | text | https URL on our storage host, ≤500 |
| `photos` | jsonb | object; keys in ('before','after','owner') this phase; https URL values; ≤12 entries |
| `prices` | jsonb | array ≤6 of {label ≤60, price_label ≤20, per ≤30, note ≤80, features: array ≤8 of text ≤120}; extra keys rejected |

Every validator: `language sql immutable`, and `grant execute … to
authenticated, service_role` **in the same section** — a CHECK evaluates as the
writing role (the 42501/403 lesson, ADMIN-FIX.sql). RLS policies unchanged.
Storage bucket + policies live in the same file.

## Merge endpoint (`api/operator-content.mjs`)

- `logo_url` → `brand.logo`
- `photos.before` / `photos.after` → the slider's two slots (niche namespace)
- `photos.owner` → `owner.photo`
- `prices[i]` → `pricing[i]`, field-by-field, skip null/empty
- `lead_email` → `brand.leadEmail` (deliberate; see decision 5)
- Existing rules unchanged: null/empty skipped, no row = pure demo, failures
  return non-2xx and the page keeps inlined defaults.

## Admin (`admin/index.html`)

New sections, same fail-closed gate and single upsert on Save:

- **Logo** — file input → Storage upload on pick (progress, thumbnail) → URL
  held in memory → committed on Save.
- **Before/After** — two labeled slots, same upload flow.
- **Prices** — 3 tier rows: label, price, note (features editing deferred;
  demo features persist per skip-empty overlay).
- **Inquiry email** — with helper: "Requests go here. The first time you
  change it, FormSubmit emails that inbox an activation link — click it or
  inquiries will not arrive."

## Niche rebuild (`niches/bin-cleaning/`)

Port Prime's page into the build contract: `sections.html` (all sections
above), `niche.css` (palette, slider, dashed-placeholder styles), `niche.js`
(drag slider port, drops, form wiring via `brand.leadEmail`), `content.json`
(Prime's real copy, prices, brand; testimonials stay empty), photos in
`photos/` (logo, before, after; CREDITS.md notes they are Prime's own,
authorized). Template machinery preserved: consent injection, demo-chrome
script (banner + owner login), SEO slots, `fontsHref` for Anton/Oswald/Inter.
Regenerate `og.png` via `tools/build-og.js`. `serviceArea`: Nampa & Caldwell.

FAQ, trust strip, process, benefits: Prime's copy verbatim. Terms content is
out of scope (the platform has `legal/`; Prime's own terms.html is that
business's document, not the template's).

## Testing

1. `node tools/build-site.js bin-cleaning --demo` → diff: only bin-cleaning
   changes; chrome (banner script, owner-login) and consent survive.
2. Other 22 niches rebuild byte-identical (spot-check two).
3. Provision a test tenant on bin-cleaning via the test-mode claim flow.
4. Operator loop on that tenant: dashed boxes visible → upload before/after +
   logo → save prices + lead email → `content.json` shows the merge → site
   shows photos, slider active, new prices → form submission reaches the new
   address after FormSubmit activation.
5. Demo page: Prime photos everywhere, no dashed state, banner present.
6. `qa-site.js` / `a11y-sweep.js` pass on the rebuilt niche (slider keyboard
   path included).

## Out of scope this session

Other 22 niches · the per-niche manifest generalization · features editing in
tiers · hours *rendering* (stored and served; template slot is a separate
task) · Prime's terms.html · any change to landscaping.

## Open items inherited by this work

The `noindex` meta baked into `--demo` builds also ships on operator
subdomains — unresolved platform-wide; not made worse or better here, but the
first real operator on this niche makes it urgent.
