# Bin-Cleaning Prime Rebuild + Editable Prototype — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the bin-cleaning niche as Prime Bin Cleaning's real design and make its photos, logo, prices, and inquiry email operator-editable through the existing admin.

**Architecture:** Extend `sbv_operator_content` with four validated columns; add a Supabase Storage bucket with tenant-scoped RLS for browser-direct uploads; port Prime's single-file site into the `niches/bin-cleaning/` build inputs; overlay operator values in `api/operator-content.mjs`; add upload/price/lead-email sections to `admin/index.html`; dashed placeholder boxes wherever a photo slot is empty.

**Tech Stack:** Vanilla HTML/CSS/JS (no build framework, no libraries), Node 18 build scripts, Supabase (Postgres + Storage, supabase-js 2.114.0 vendored), Vercel static hosting + middleware.

**Spec:** `docs/superpowers/specs/2026-09-05-bin-cleaning-editable-prototype-design.md`

## Global Constraints

- Photo/asset URLs in templates are ABSOLUTE `/sites/bin-cleaning/...` — relative paths 404 on tenant subdomains (document is rewritten to `/`).
- Every SQL validator ships `grant execute ... to authenticated, service_role` in the same section — a CHECK evaluates as the writing role (42501/403 otherwise).
- Prices are display strings (`"$10"`), never cents integers. No server-side money math.
- `lead_email` (lead destination) and `email` (public display) are independent columns; only `lead_email` merges into `brand.leadEmail`.
- Demo testimonials stay empty (`quote:"", name:""`); no fabricated reviews, stats, or credentials anywhere.
- Real Prime branding (name, logo, photos, phone) is authorized by the owner — use it verbatim in demo content.
- `package.json` must NOT gain `"type": "module"` (CommonJS build scripts).
- Preserve template machinery in the rebuilt niche: `<!-- BUILD:* -->` slots consumed by `tools/build-site.js`, consent injection, demo-chrome script (banner + owner login), `.reveal` classes.
- The human runs all SQL files; the plan produces them and stops.
- Landscaping and the other 21 niches must rebuild byte-identical (verify, don't assume).
- All new files LF line endings.
- The Supabase project is `newjbexmvltvtmxollca` only. ESB/GSB projects are never touched.

## Reference facts an implementer cannot infer

- Prime source: `C:\Users\JasonVega\Desktop\Jason\PrimeBinCleaning\index.html` (1,256 lines). Logo base64 PNG lives in CSS var `--logo` at ~line 52; before/after base64 JPEGs are CSS vars `--before-img`/`--after-img` on the `#ba` element at ~line 672; the lead config object `LEAD` is at ~line 1095.
- SiteLab build: `node tools/build-site.js bin-cleaning --demo` reads `niches/bin-cleaning/{sections.html,niche.css,niche.js,scene.svg,scene.js,content.json}` + `_template/*`, writes `sites/bin-cleaning/index.html` + copies `content.json`, `og.png`, and (since 81a844d) the whole `photos/` dir.
- The existing bin-cleaning `niche.js` already posts leads to `https://formsubmit.co/ajax/<brand.leadEmail>` via `applyRuntime(c)` — keep that mechanism, port Prime's form fields onto it.
- The merge endpoint contract: response is shaped like content.json; storefronts fetch `content.json` relative → middleware rewrites `/content.json` → `/api/operator-content?tenant=<label>` on subdomains.
- `sbv_is_tenant(text)` exists (COMMERCE.sql:221), SECURITY DEFINER, granted to authenticated.
- Admin config: `window.SBV_CONFIG = { url:'https://newjbexmvltvtmxollca.supabase.co', key:'sb_publishable_ZNgmFmfr7AHbZSEibo7jqQ_z8-Oazhy', ... }`; vendored SDK at `/assets/vendor/supabase-2.114.0.js`.

---

### Task 1: Schema — four columns + validators (`sql/OPERATOR-CONTENT-2.sql`, part 1)

**Files:**
- Create: `sql/OPERATOR-CONTENT-2.sql`

**Interfaces:**
- Produces: columns `lead_email text`, `logo_url text`, `photos jsonb`, `prices jsonb` on `public.sbv_operator_content`; functions `public.sbv_photos_valid(jsonb)`, `public.sbv_prices_valid(jsonb)`.
- Consumed by: Task 4 (endpoint reads columns), Task 5 (admin writes them).

- [ ] **Step 1: Write the file header and column section**

```sql
-- ============================================================================
-- OPERATOR-CONTENT-2.sql — editable photos, logo, prices, lead email
-- ----------------------------------------------------------------------------
-- RUN AFTER: OPERATOR-CONTENT.sql and ADMIN-FIX.sql. Idempotent throughout.
-- Spec: docs/superpowers/specs/2026-09-05-bin-cleaning-editable-prototype-design.md
--
-- lead_email is DELIBERATELY separate from email: public display address and
-- lead destination are different decisions, and the guard "editing your public
-- email must not silently redirect your leads" survives only if redirecting
-- leads has its own explicitly-labelled field.
-- ============================================================================

-- ================================================== 1. VALIDATORS (no tables
-- touched, so `language sql` body validation cannot 42P01; declared before the
-- ALTERs because the CHECKs reference them).

-- {slot: url} map. Closed slot set for this phase: adding a slot is a spec
-- change, not a data drift. https only, our storage host or /sites/ path.
create or replace function public.sbv_photos_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and (select count(*) from jsonb_object_keys(p)) <= 12
    and not exists (
      select 1 from jsonb_each(p) as e(slot, val)
      where slot not in ('before','after','owner','logo','gallery1','gallery2',
                         'gallery3','gallery4','gallery5','gallery6','gallery7','gallery8')
         or jsonb_typeof(val) <> 'string'
         or length(val #>> '{}') > 500
         or (val #>> '{}') !~ '^https://[a-z0-9.-]+\.supabase\.co/storage/v1/object/public/'
    )
  );
$$;

-- Display-string price tiers, shaped like content.json pricing[]. Unknown keys
-- rejected: junk that arrives silently is junk that renders blank a year later.
create or replace function public.sbv_prices_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null or (
    jsonb_typeof(p) = 'array'
    and jsonb_array_length(p) <= 6
    and not exists (
      select 1 from jsonb_array_elements(p) as t(tier)
      where jsonb_typeof(tier) <> 'object'
         or exists (select 1 from jsonb_object_keys(tier) k
                    where k not in ('label','price_label','per','note','features'))
         or not (tier ? 'label') or length(tier ->> 'label') > 60
         or (tier ? 'price_label' and length(tier ->> 'price_label') > 20)
         or (tier ? 'per'   and length(tier ->> 'per')   > 30)
         or (tier ? 'note'  and length(tier ->> 'note')  > 80)
         or (tier ? 'features' and (
              jsonb_typeof(tier -> 'features') <> 'array'
              or jsonb_array_length(tier -> 'features') > 8
              or exists (select 1 from jsonb_array_elements(tier -> 'features') f(x)
                         where jsonb_typeof(f.x) <> 'string' or length(f.x #>> '{}') > 120)))
    )
  );
$$;

-- A CHECK evaluates AS THE WRITING ROLE (ADMIN-FIX.sql lesson). Same section,
-- not an afterthought.
revoke all    on function public.sbv_photos_valid(jsonb) from public, anon;
revoke all    on function public.sbv_prices_valid(jsonb) from public, anon;
grant execute on function public.sbv_photos_valid(jsonb) to authenticated, service_role;
grant execute on function public.sbv_prices_valid(jsonb) to authenticated, service_role;

-- ==================================================== 2. COLUMNS (idempotent)
alter table public.sbv_operator_content
  add column if not exists lead_email text
    check (lead_email is null or (lead_email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'
                                  and length(lead_email) <= 254)),
  add column if not exists logo_url text
    check (logo_url is null or (length(logo_url) <= 500
           and logo_url ~ '^https://[a-z0-9.-]+\.supabase\.co/storage/v1/object/public/')),
  add column if not exists photos jsonb check (public.sbv_photos_valid(photos)),
  add column if not exists prices jsonb check (public.sbv_prices_valid(prices));
```

- [ ] **Step 2: Append the verify section (part 1 rows)**

```sql
-- ================================================== VERIFY PART 1 (all true)
select 'photos fn: authenticated' as check_name,
       has_function_privilege('authenticated','public.sbv_photos_valid(jsonb)','execute')::text as got
union all
select 'prices fn: authenticated',
       has_function_privilege('authenticated','public.sbv_prices_valid(jsonb)','execute')::text
union all
select 'photos: good row ok',
       public.sbv_photos_valid('{"before":"https://newjbexmvltvtmxollca.supabase.co/storage/v1/object/public/sbv-operator-media/t/x.jpg"}'::jsonb)::text
union all
select 'photos: bad slot rejected',
       (not public.sbv_photos_valid('{"selfie":"https://newjbexmvltvtmxollca.supabase.co/storage/v1/object/public/x"}'::jsonb))::text
union all
select 'prices: good tier ok',
       public.sbv_prices_valid('[{"label":"1 Bin","price_label":"$10","per":"per cleaning"}]'::jsonb)::text
union all
select 'prices: junk key rejected',
       (not public.sbv_prices_valid('[{"label":"x","cents":1000}]'::jsonb))::text;
```

- [ ] **Step 3: Syntax sanity check** — Run: `node -e "const s=require('fs').readFileSync('sql/OPERATOR-CONTENT-2.sql','utf8'); if(!/grant execute on function public.sbv_photos_valid/.test(s)) throw 'grants missing'; console.log('ok, lines:', s.split('\n').length)"`
  Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add sql/OPERATOR-CONTENT-2.sql
git commit -m "feat(sql): operator photos, prices, logo, lead email columns"
```

### Task 2: Storage bucket + tenant-scoped policies (`sql/OPERATOR-CONTENT-2.sql`, part 2)

**Files:**
- Modify: `sql/OPERATOR-CONTENT-2.sql` (append before the verify section; keep verifies last)

**Interfaces:**
- Produces: bucket `sbv-operator-media` (public read, 2MB, image mime types); storage policies letting an operator write only under `<their-client_id>/...`.
- Consumed by: Task 5 (admin uploads to `sbv-operator-media/<client_id>/<slot>.<ext>`).

- [ ] **Step 1: Append the storage section**

```sql
-- ==================================================== 3. STORAGE (uploads)
-- Browser-direct: the admin uploads with the operator's JWT; no server code.
-- Path convention: <client_id>/<slot>.<ext>. The FIRST path segment is the
-- tenant, and sbv_is_tenant() is the whole authorisation story.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sbv-operator-media', 'sbv-operator-media', true,
        2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists sbv_media_read on storage.objects;
create policy sbv_media_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'sbv-operator-media');

drop policy if exists sbv_media_write on storage.objects;
create policy sbv_media_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sbv-operator-media'
              and public.sbv_is_tenant(split_part(name, '/', 1)));

drop policy if exists sbv_media_update on storage.objects;
create policy sbv_media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'sbv-operator-media'
         and public.sbv_is_tenant(split_part(name, '/', 1)))
  with check (bucket_id = 'sbv-operator-media'
              and public.sbv_is_tenant(split_part(name, '/', 1)));

-- No DELETE policy: replacing a photo is an upsert-overwrite of the same path.
```

- [ ] **Step 2: Append storage verify rows to the verify section**

```sql
union all
select 'bucket exists + public',
       (select (public and file_size_limit = 2097152)::text
        from storage.buckets where id = 'sbv-operator-media')
union all
select 'storage policies present',
       (select (count(*) = 3)::text from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
          and policyname like 'sbv_media_%');
```

- [ ] **Step 3: Commit, then HAND THE FILE TO THE OWNER to run.** Execution of later tasks does not depend on it being run yet; Task 7's live test does.

```bash
git add sql/OPERATOR-CONTENT-2.sql
git commit -m "feat(sql): sbv-operator-media bucket with tenant-scoped write"
```

### Task 3: Extract Prime assets + rewrite `content.json`

**Files:**
- Create: `niches/bin-cleaning/photos/{logo.png,before.jpg,after.jpg,CREDITS.md}`
- Create: `C:\...\scratchpad\extract-prime.js` (throwaway)
- Modify: `niches/bin-cleaning/content.json` (full rewrite)

**Interfaces:**
- Produces: photo files whose ABSOLUTE public paths are `/sites/bin-cleaning/photos/logo.png`, `.../before.jpg`, `.../after.jpg`; content.json keys consumed by Task 4's binding table (`brand`, `pricing[4]`, `niche.trust[4]`, `niche.process[3]`, `faq[5]`, `stats[3]`).

- [ ] **Step 1: Write and run the extractor** (scratchpad, throwaway)

```js
// extract-prime.js — pull the three base64 assets out of Prime's index.html
const fs = require('fs');
const src = fs.readFileSync('C:/Users/JasonVega/Desktop/Jason/PrimeBinCleaning/index.html', 'utf8');
const out = 'C:/Users/JasonVega/Desktop/Jason/systems-by-vega/systemsbyvega/niches/bin-cleaning/photos/';
fs.mkdirSync(out, { recursive: true });
const grab = (varName, file) => {
  const m = src.match(new RegExp(varName + String.raw`:\s*url\(['"]?data:image/(png|jpe?g);base64,([A-Za-z0-9+/=]+)`));
  if (!m) throw new Error(varName + ' not found');
  fs.writeFileSync(out + file, Buffer.from(m[2], 'base64'));
  console.log(file, (fs.statSync(out + file).size / 1024).toFixed(0) + 'KB');
};
grab('--logo', 'logo.png');
grab('--before-img', 'before.jpg');
grab('--after-img', 'after.jpg');
```

Run: `node <scratchpad>/extract-prime.js` · Expected: three files, each 50–300KB. If any exceeds 400KB, re-encode: `magick before.jpg -quality 82 -resize 1200x before.jpg` (or accept as-is if magick is unavailable — note it in the commit).

- [ ] **Step 2: Write CREDITS.md**

```markdown
# Prime Bin Cleaning brand assets — used with the owner's authorization
# (recorded 2026-09-05). Not stock; do not reuse in any other niche.
logo.png    Prime Bin Cleaning crown-P logo
before.jpg  Prime's own before shot (drag slider, left)
after.jpg   Prime's own after shot (drag slider, right)
```

- [ ] **Step 3: Rewrite `content.json`.** Keep the existing top-level shape (brand/serviceArea/owner/pricing/stats/testimonials/faq/social/niche/seo). Exact values:

```json
{
  "brand": {
    "name": "Prime Bin Cleaning",
    "tagline": "Clean bins. Fresher homes.",
    "phone": "(208) 249-7296",
    "email": "primebincleaning0@gmail.com",
    "leadEmail": "primebincleaning0@gmail.com",
    "city": "Nampa, ID",
    "logo": "/sites/bin-cleaning/photos/logo.png"
  },
  "serviceArea": { "region": "Nampa & Caldwell, Idaho", "short": "Nampa & Caldwell",
                   "cities": ["Nampa", "Caldwell"] },
  "owner": { "name": "Micah", "heading": "Meet Micah", "bio": "", "photo": "" },
  "pricing": [
    { "label": "1 Bin",  "blurb": "$10", "per": "per cleaning", "note": "Single bin",
      "features": ["Curbside — nothing to do", "Hot power wash + sanitize", "Deodorized & returned"] },
    { "label": "2 Bins", "blurb": "$18", "per": "per cleaning", "note": "Just $9 per bin",
      "features": ["$1 off each bin — save $2", "Same hot wash & sanitize", "Most homes pick this"],
      "highlight": true },
    { "label": "3 Bins", "blurb": "$25", "per": "per cleaning", "note": "Best value · ~$8 per bin",
      "features": ["Lowest per-bin rate", "Priority scheduling", "Trash, recycle & extra"] },
    { "label": "4+ bins / whole street", "blurb": "Group rate", "per": "",
      "note": "Text (208) 249-7296", "features": [] }
  ],
  "stats": [
    { "big": "$10", "small": "starting price" },
    { "big": "100%", "small": "eco-friendly wash" },
    { "big": "Local", "small": "teen-owned & operated" }
  ],
  "testimonials": [ { "quote": "", "name": "" }, { "quote": "", "name": "" }, { "quote": "", "name": "" } ],
  "faq": [
    { "q": "What areas do you serve?", "a": "Nampa and Caldwell — text us if you're nearby and we'll tell you if the route reaches you." },
    { "q": "Do I need to be home?", "a": "No. Leave the bins at the curb after pickup and we handle the rest." },
    { "q": "Is it eco-friendly?", "a": "Yes — water-based, no harsh chemicals, and wash water is captured, never sent down the storm drain." },
    { "q": "Can I set up recurring cleanings?", "a": "Yes — monthly, every other month, or quarterly. Ask about a recurring rate when you text." },
    { "q": "How do I pay?", "a": "Card, cash, or Venmo on the day of service." }
  ],
  "social": [],
  "niche": {
    "trust": [
      { "title": "Kills grime & bacteria", "blurb": "Hot pressure wash, inside and out." },
      { "title": "Eliminates odor", "blurb": "Deodorized — left smelling like nothing." },
      { "title": "Eco-friendly", "blurb": "Water-based wash, captured runoff." },
      { "title": "Teen-owned & local", "blurb": "A Nampa venture you can root for." }
    ],
    "process": [
      { "title": "Text us your address", "blurb": "Or book below — no phone call needed." },
      { "title": "Leave your bin out",   "blurb": "At the curb after pickup day." },
      { "title": "We power-wash it clean", "blurb": "Sanitized, deodorized, rolled back." }
    ],
    "groupNote": "4+ bins or a whole street? Text (208) 249-7296 for a group rate."
  },
  "seo": {
    "title": "Prime Bin Cleaning — Nampa & Caldwell trash bin cleaning",
    "description": "Hot pressure washing for trash and recycle bins in Nampa & Caldwell. From $10 per bin, curbside, eco-friendly, teen-owned and local.",
    "ogTitle": "Prime Bin Cleaning — clean bins, fresher homes",
    "ogDescription": "Curbside bin cleaning in Nampa & Caldwell from $10. Book by text — leave the bin out and we handle the rest.",
    "priceRange": "$10-$25",
    "schemaType": "HomeAndConstructionBusiness",
    "canonical": "https://systemsbyvega.com/sites/bin-cleaning/",
    "themeColor": "#050f1c",
    "favicon": "/sites/bin-cleaning/photos/logo.png",
    "fontsHref": "https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap",
    "ogImage": "https://systemsbyvega.com/sites/bin-cleaning/og.png"
  }
}
```

- [ ] **Step 4: Validate** — Run: `node -e "const j=require('./niches/bin-cleaning/content.json'); if(j.testimonials.some(t=>t.quote)) throw 'fabricated testimonial'; if(!j.brand.logo.startsWith('/sites/bin-cleaning/')) throw 'relative logo path'; console.log('content.json ok')"`

- [ ] **Step 5: Commit**

```bash
git add niches/bin-cleaning/photos niches/bin-cleaning/content.json
git commit -m "feat(bin-cleaning): Prime brand assets and content (authorized)"
```

### Task 4: Niche rebuild — `sections.html`, `niche.css`, `niche.js`

**Files:**
- Modify (full rewrite): `niches/bin-cleaning/sections.html`, `niches/bin-cleaning/niche.css`, `niches/bin-cleaning/niche.js`
- Keep untouched: `scene.svg`, `scene.js` (replace scene usage with an empty placeholder SVG as landscaping's comment pattern shows; the drops layer replaces the scene)

**Interfaces:**
- Consumes: content.json keys from Task 3. Element-id ↔ content binding table (niche.js MUST use exactly these ids):

| Element id | Filled from |
|---|---|
| `#brandName`, `[data-brand]` | `brand.name` |
| `#heroTag` | `brand.tagline` |
| `[data-phone]`, `tel:`/`sms:` hrefs | `brand.phone` |
| `#footEmail` | `brand.email` |
| `#ba` (`--before-img`/`--after-img` CSS vars) | `niche.beforeImg` / `niche.afterImg`, falling back to `/sites/bin-cleaning/photos/before.jpg` / `after.jpg` |
| `.logo-img` elements (background-image) | `brand.logo` |
| `#pricingGrid` | `pricing[]` (render all tiers; `highlight` → best-value class) |
| `#trustGrid` | `niche.trust[]` |
| `#processGrid` | `niche.process[]` |
| `#faqList` | `faq[]` |
| `#ownerName/#ownerBio/#ownerPhoto` | `owner.*` (dashed placeholder when photo empty) |
| `#statsRow` | `stats[]` |
| lead form → FormSubmit | `brand.leadEmail` via existing `applyRuntime` pattern |

- Produces: photo-slot markup contract for Task 6 — every photo slot is an element with `data-photo-slot="<slot>"`; empty slot gets class `slot-empty`.

- [ ] **Step 1: Port `sections.html`.** Source map (Prime `index.html` → SiteLab sections; port structure and copy, re-bind content):
  - nav (~L560–600) → keep SiteLab's template nav slot; brand name + logo bind per table.
  - hero (~L600–670): headline "Clean Bins. / Fresher Homes.", drops container `<div id="drops" aria-hidden="true"></div>`, two CTAs (`#book`, `tel:`), stats from `stats[]`, logo badge `<span class="logo-img hero-logo" data-photo-slot="logo"></span>`.
  - trust strip (~L670) → `#trustGrid`.
  - before/after (~L672–700) → port `#ba` slider markup verbatim MINUS the base64 vars (they move to CSS/JS); wrap in `<div class="ba-wrap" data-photo-slot="before" data-photo-slot-b="after">`.
  - benefits, pricing (`#pricingGrid` + `niche.groupNote`), process (`#processGrid`), Meet Micah (`#ownerName/#ownerBio/#ownerPhoto`, photo div `data-photo-slot="owner"`), FAQ (`#faqList` as `<details>`), testimonials (three `.review` cards, empty-quote CSS shows "Real review coming soon."), signup form (fields: name, phone, address, city, cans select with the four tier labels, days checkboxes, frequency select, notes, consent checkbox, `_honey` honeypot), footer, mobile call/text bar.
  - Every `src`/`href` to a niche asset: absolute `/sites/bin-cleaning/photos/...`.
  Verify: `grep -c 'data-photo-slot' sections.html` ≥ 4; `grep -c 'photos/' sections.html` all absolute (`grep -c '"photos/' sections.html` = 0).

- [ ] **Step 2: Port `niche.css`.** Prime's palette vars verbatim (`--midnight:#050f1c` etc.), slider CSS (~L280–340 in Prime), tier cards, trust strip, drops keyframes, mobile bar — adapted to SiteLab's class conventions where the template requires (`.reveal`, `.section`). Add the dashed-placeholder rules (exact code in Task 6, referenced here so the file compiles once).

- [ ] **Step 3: Port `niche.js`.** Keep the existing file's `LEAD`/`applyRuntime`/honeypot/FormSubmit submit handler (it already matches Prime's). Add, with this exact shape:

```js
/* photo slots: operator URLs (merged content) or dashed placeholders */
function applyPhotos(c){
  var n = c.niche || {};
  var ba = document.getElementById('ba');
  var before = n.beforeImg || '/sites/bin-cleaning/photos/before.jpg';
  var after  = n.afterImg  || '/sites/bin-cleaning/photos/after.jpg';
  if (ba) {
    ba.style.setProperty('--before-img', 'url("' + before + '")');
    ba.style.setProperty('--after-img',  'url("' + after  + '")');
    /* the slider is meaningless with a placeholder on either side */
    var wrap = ba.closest('.ba-wrap');
    if (wrap) wrap.classList.toggle('slot-empty', !n.beforeImg && !before);
  }
  var logo = (c.brand || {}).logo;
  [].forEach.call(document.querySelectorAll('.logo-img'), function (el) {
    if (logo) el.style.backgroundImage = 'url("' + logo + '")';
    el.classList.toggle('slot-empty', !logo);
  });
  var op = document.getElementById('ownerPhoto');
  if (op) {
    var ph = (c.owner || {}).photo;
    if (ph) op.innerHTML = '<img src="' + ph.replace(/"/g,'') + '" alt="' + ((c.owner||{}).name||'The owner') + '" loading="lazy">';
    op.classList.toggle('slot-empty', !ph);
  }
}
```
  and Prime's slider driver (pointer + keyboard, `--pos` variable, auto-nudge on first view; port from Prime ~L1130–1200) and drops generator (~L1100), both under the template's `reduce` guard.

- [ ] **Step 4: Build and inspect** — Run: `node tools/build-site.js bin-cleaning --demo` then `grep -c "Demo chrome removes itself\|svOwnerLogin\|consent" sites/bin-cleaning/index.html` (all ≥1) and open `sites/bin-cleaning/index.html` in a browser: hero, slider dragging between Prime's real before/after, prices $10/$18/$25, empty testimonials, no dashed boxes anywhere (demo is fully populated).

- [ ] **Step 5: Regenerate og** — Run: `node tools/build-og.js bin-cleaning` then rasterize per its instructions; if the rasterize step needs manual action, note it in the commit and proceed.

- [ ] **Step 6: Commit**

```bash
git add niches/bin-cleaning sites/bin-cleaning
git commit -m "feat(bin-cleaning): rebuild as Prime Bin Cleaning design"
```

### Task 5: Merge endpoint additions

**Files:**
- Modify: `api/operator-content.mjs` (the `applyOperator` function)

**Interfaces:**
- Consumes: columns from Task 1; content shape from Task 3.
- Produces: merged keys the rebuilt niche.js reads: `brand.logo`, `brand.leadEmail`, `niche.beforeImg`, `niche.afterImg`, `owner.photo`, `pricing[]`.

- [ ] **Step 1: Extend `applyOperator`** — add after the existing contact block:

```js
  /* Editable-prototype additions (spec 2026-09-05). All skip-empty, so a
     tenant that has set only a logo keeps the demo's photos and prices. */
  set(out.brand, 'logo', op.logo_url);
  /* lead_email is the ONLY path to brand.leadEmail — the public `email`
     column deliberately cannot redirect the lead flow. */
  set(out.brand, 'leadEmail', op.lead_email);

  const ph = (op.photos && typeof op.photos === 'object') ? op.photos : {};
  out.niche = Object.assign({}, base.niche || {});
  set(out.niche, 'beforeImg', ph.before);
  set(out.niche, 'afterImg',  ph.after);
  set(out.owner, 'photo',     ph.owner);

  /* prices overlay pricing[] BY INDEX, field-by-field: editing one tier's
     price keeps the demo's feature list. price_label maps onto the template's
     `blurb` key (display-string convention). */
  if (Array.isArray(op.prices) && Array.isArray(base.pricing)) {
    out.pricing = base.pricing.map((tier, i) => {
      const o = op.prices[i];
      if (!o) return tier;
      const merged = Object.assign({}, tier);
      const setT = (k, v) => { if (v !== null && v !== undefined && String(v).trim() !== '') merged[k] = v; };
      setT('label', o.label); setT('blurb', o.price_label);
      setT('per', o.per); setT('note', o.note);
      if (Array.isArray(o.features) && o.features.length) merged.features = o.features;
      return merged;
    });
  }
```

  Also DELETE the now-stale line `/* brand.leadEmail is deliberately NOT touched ... */` comment block and replace with a pointer to the lead_email rule above.

- [ ] **Step 2: Check** — Run: `node --check api/operator-content.mjs` · Expected: clean.

- [ ] **Step 3: Unit-exercise the merge locally**

```bash
node -e "
const base={brand:{name:'X',leadEmail:'a@b.co'},owner:{},pricing:[{label:'1 Bin',blurb:'\$10',features:['a']}],niche:{}};
// simulate applyOperator by importing is impractical (module env); paste-test the map logic:
const op={prices:[{price_label:'\$12'}],photos:{before:'https://newjbexmvltvtmxollca.supabase.co/storage/v1/object/public/sbv-operator-media/t/before.jpg'},lead_email:'leads@x.co'};
console.log('shape stands in for endpoint test; real verification is Task 7 step 4');
"
```
  (The real assertion is end-to-end in Task 7; this step exists to force reading the merge logic once more before commit.)

- [ ] **Step 4: Commit**

```bash
git add api/operator-content.mjs
git commit -m "feat(api): merge operator photos, logo, prices, lead email"
```

### Task 6: Dashed placeholders (CSS contract)

**Files:**
- Modify: `niches/bin-cleaning/niche.css` (append), rebuild output

**Interfaces:**
- Consumes: `slot-empty` class set by Task 4's `applyPhotos`.

- [ ] **Step 1: Append to `niche.css`**

```css
/* ---- empty photo slots (editable prototype) ----------------------------
   A slot with no image shows a dashed outline and a label — never a broken
   image, never collapsed space. The demo never shows this (every slot is
   filled); a fresh operator subdomain shows it everywhere a photo belongs. */
.slot-empty{position:relative;border:2px dashed rgba(78,164,230,.55) !important;
  border-radius:14px;background:rgba(78,164,230,.06) !important;min-height:120px}
.slot-empty::after{content:"Photo appears here — add it in your admin";
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  text-align:center;padding:12px;font:600 12px/1.5 'Oswald',sans-serif;
  letter-spacing:.08em;text-transform:uppercase;color:#4ea4e6;opacity:.85}
.ba-wrap.slot-empty .ba-ui{display:none} /* no drag handle over a placeholder */
.logo-img.slot-empty::after{content:"Logo"}
```

- [ ] **Step 2: Rebuild + visual check** — Run: `node tools/build-site.js bin-cleaning --demo`; in a browser, temporarily blank `--before-img` via DevTools and confirm the dashed state renders and the drag UI hides.

- [ ] **Step 3: Commit**

```bash
git add niches/bin-cleaning/niche.css sites/bin-cleaning
git commit -m "feat(bin-cleaning): dashed placeholders for empty photo slots"
```

### Task 7: Admin — uploads, prices, lead email

**Files:**
- Modify: `admin/index.html`

**Interfaces:**
- Consumes: bucket from Task 2 (path `<clientId>/<slot>.<ext>`), columns from Task 1.
- Produces: upsert rows now including `lead_email`, `logo_url`, `photos`, `prices`.

- [ ] **Step 1: Add markup** inside `#panel`, after the bio field:

```html
    <p class="ty-label" style="margin:22px 0 10px">Photos</p>
    <div class="up-grid">
      <div class="up" data-slot="logo"><span>Logo</span><img alt="" hidden><input type="file" accept="image/jpeg,image/png,image/webp"><p class="up-msg"></p></div>
      <div class="up" data-slot="before"><span>Before photo</span><img alt="" hidden><input type="file" accept="image/jpeg,image/png,image/webp"><p class="up-msg"></p></div>
      <div class="up" data-slot="after"><span>After photo</span><img alt="" hidden><input type="file" accept="image/jpeg,image/png,image/webp"><p class="up-msg"></p></div>
      <div class="up" data-slot="owner"><span>Owner photo</span><img alt="" hidden><input type="file" accept="image/jpeg,image/png,image/webp"><p class="up-msg"></p></div>
    </div>

    <p class="ty-label" style="margin:22px 0 10px">Prices</p>
    <div id="priceRows"></div>

    <label style="margin-top:22px"><span>Inquiry email <span class="hint">&mdash; where booking requests go</span></span>
      <input type="email" id="lead_email" maxlength="254"></label>
    <div class="note"><strong>One-time step when you change this:</strong> our form
      service (FormSubmit) emails the new inbox an activation link on the first
      request. Click it, or inquiries will not arrive.</div>
```

  With CSS (same `<style>` block): `.up{border:2px dashed var(--hair);border-radius:10px;padding:12px;text-align:center} .up img{max-width:100%;border-radius:8px;margin-bottom:8px} .up-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px} .pr-row{display:grid;grid-template-columns:1.2fr .7fr 1.4fr;gap:10px;margin-bottom:10px}`.

- [ ] **Step 2: Add JS.** Upload on file-pick; three price rows; extend load/save:

```js
  var photoUrls = {};        /* slot -> public URL, committed on Save */
  var PRICE_ROWS = 3;

  function initUploads() {
    [].forEach.call(document.querySelectorAll('.up'), function (box) {
      var slot = box.getAttribute('data-slot');
      var input = box.querySelector('input[type=file]');
      var img = box.querySelector('img');
      var msg = box.querySelector('.up-msg');
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) { msg.textContent = 'Max 2MB.'; return; }
        var ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[f.type];
        if (!ext) { msg.textContent = 'JPG, PNG or WebP only.'; return; }
        msg.textContent = 'Uploading…';
        var path = clientId + '/' + slot + '.' + ext;
        sb.storage.from('sbv-operator-media').upload(path, f, { upsert: true, contentType: f.type })
          .then(function (r) {
            if (r.error) { msg.textContent = 'Upload failed. ' + (r.error.message || ''); return; }
            var pub = sb.storage.from('sbv-operator-media').getPublicUrl(path);
            /* cache-bust: same path overwrites, and the CDN would happily
               serve the old bytes to the operator checking their work */
            photoUrls[slot] = pub.data.publicUrl;
            img.src = pub.data.publicUrl + '?v=' + Date.now();
            img.hidden = false;
            msg.textContent = 'Uploaded — press Save to publish.';
          });
      });
    });
  }

  function initPriceRows(saved) {
    var host = document.getElementById('priceRows');
    var html = '';
    for (var i = 0; i < PRICE_ROWS; i++) {
      var p = (saved && saved[i]) || {};
      html += '<div class="pr-row">'
        + '<input type="text" maxlength="60" placeholder="Tier name (e.g. 1 Bin)" data-pk="label" value="' + esc(p.label || '') + '">'
        + '<input type="text" maxlength="20" placeholder="$10" data-pk="price_label" value="' + esc(p.price_label || '') + '">'
        + '<input type="text" maxlength="80" placeholder="Note (e.g. Best value)" data-pk="note" value="' + esc(p.note || '') + '">'
        + '</div>';
    }
    host.innerHTML = html;
  }
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}

  function readPrices() {
    var rows = [].map.call(document.querySelectorAll('.pr-row'), function (row) {
      var o = {};
      [].forEach.call(row.querySelectorAll('input'), function (inp) {
        var v = inp.value.trim();
        if (v) o[inp.getAttribute('data-pk')] = v;
      });
      return o;
    }).filter(function (o) { return Object.keys(o).length; });
    return rows.length ? rows : null;
  }
```

  In `load()`: after filling FIELDS, add `$('#lead_email').value = r.data && r.data.lead_email || ''; photoUrls = (r.data && r.data.photos) || {}; initPriceRows(r.data && r.data.prices);` and for each slot with a URL, show the thumbnail. Call `initUploads()` once from `paint()` when the panel first shows.
  In `save()`: extend the row: `row.lead_email = $('#lead_email').value.trim() || null; row.logo_url = photoUrls.logo || null; var ph = {}; ['before','after','owner'].forEach(function(s){ if (photoUrls[s]) ph[s] = photoUrls[s]; }); row.photos = Object.keys(ph).length ? ph : null; row.prices = readPrices();`
  NOTE: `logo` lives in `logo_url`, not in `photos` — mirror Task 1's columns.

- [ ] **Step 3: Check** — extract inline JS and `node --check` it (the awk pattern used for this file previously):
  `awk 'f && /^<\/script>$/{exit} f{print} /^<script defer>$/{f=1}' admin/index.html > /tmp/adm.js && node --check /tmp/adm.js`

- [ ] **Step 4: Commit**

```bash
git add admin/index.html
git commit -m "feat(admin): photo uploads, price tiers, inquiry email"
```

### Task 8: Catalog disclosure amendment + full verification

**Files:**
- Modify: `sites/index.html` (hero disclosure + bin-cleaning card note)

- [ ] **Step 1: Amend the disclosure.** In the hero paragraph reading `<strong ...>Every business name below is just an example.</strong>`, change to `<strong ...>Nearly every business name below is just an example.</strong>` and append to that paragraph: ` One exception: <b>Prime Bin Cleaning</b> is a real operator running on this exact template.` On the bin-cleaning card, add under the title: `<p class="sc-note">Real business — live on this template.</p>` (reuse an existing small-note class if one fits better on inspection).

- [ ] **Step 2: Rebuild-all byte-check** — Run: `for s in landscaping roofing moving; do node tools/build-site.js $s --demo; done && git status --short sites/` · Expected: only `sites/bin-cleaning/` and `sites/index.html` modified; landscaping/roofing/moving byte-identical (no diff lines).

- [ ] **Step 3: End-to-end live test** (requires the owner to have run `sql/OPERATOR-CONTENT-2.sql`; if not yet run, stop here and say so):
  1. Owner runs the SQL; all verify rows `true`.
  2. Push; provision a bin-cleaning test tenant via the test-mode claim flow (as testy2 was for landscaping).
  3. On `<tenant>.systemsbyvega.com`: dashed boxes at logo/before/after/owner.
  4. In `/admin/?tenant=<tenant>`: upload before + after + logo, set tier 1 price to `$12`, set inquiry email; Save → 201.
  5. `curl <tenant>.systemsbyvega.com/content.json` → shows `niche.beforeImg` (storage URL), `brand.logo`, `pricing[0].blurb === "$12"`, `brand.leadEmail`.
  6. Site refresh: photos live, slider drags, dashed boxes gone, price shows $12.
  7. Submit the booking form once → confirm FormSubmit activation email arrives at the new address; click it; submit again → lead arrives.

- [ ] **Step 4: Commit + push**

```bash
git add sites/index.html sites/
git commit -m "feat(catalog): Prime disclosure amendment; bin-cleaning rebuild artifacts"
git push catalog main
```

---

## Self-review notes (completed before saving)

- Spec coverage: schema (T1), storage (T2), assets+content (T3), niche rebuild (T4), merge (T5), placeholders (T6), admin (T7), disclosure+testing (T8). Hours *rendering* and 22-niche rollout are spec'd out of scope — no task, correctly.
- Type consistency: `photos` slots `before/after/owner` everywhere; `logo` in `logo_url` (T1/T5/T7 all agree; T7 carries an explicit NOTE). `price_label` → template `blurb` mapping stated in both T5 and T3's shape.
- The porting steps (T4) reference exact Prime line ranges and end in greppable/visual verifications rather than reproduced HTML; this is deliberate — the source file is the single truth for copy.
