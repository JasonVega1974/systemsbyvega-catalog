# Admin UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild `admin/index.html` as a polished, per-business-themed product for non-technical owners, covering every editable field, with three new jsonb columns backing social/reviews/job-details.

**Architecture:** One admin page, all tenants. A niche→theme map resolves brand tokens at runtime (bin-cleaning → Prime navy/sky; every other niche → current neutral). Sectioned card layout with sticky topbar (logo + saved-state) and dirty-tracked sticky save bar. Save stays a single upsert. Reviews overlay the niche's existing testimonial render; social gets a small footer slot; job_details is stored-only (deferred render, approved).

**Tech Stack:** Vanilla HTML/CSS/JS, vendored supabase-js 2.114.0, Supabase Postgres + Storage, no build step for admin.

**Spec:** The approved chat plan (2026-09-05, this session) supplemented by docs/superpowers/specs/2026-09-05-bin-cleaning-editable-prototype-design.md for platform rules.

## Global Constraints

- Validators: `language sql immutable`, `grant execute ... to authenticated, service_role` in the same section (CHECK runs as writing role).
- Prices/labels are display strings; every jsonb string field gets `jsonb_typeof = 'string'` checks (the F-SQL lesson).
- `lead_email` remains the only path to `brand.leadEmail`.
- Compliance: reviews editor helper text "Only reviews real customers gave you — these appear on your public site." No fabricated content anywhere; demo testimonials stay empty.
- Theme map: bin-cleaning entry only this session; other niches MUST render the current neutral theme unchanged.
- Fail-closed auth gate, `?tenant=` hint-only, RLS-as-boundary, single-upsert save: unchanged.
- Upload flow stays browser→Storage direct; NEW: store the cache-busted (`?v=` timestamped) public URL in the row (fixes the stale-CDN minor from the prior review; validator regex only anchors the prefix, so query strings pass; keep total ≤500 chars).
- Absolute paths for any niche asset reference. LF endings. No `"type":"module"`. Never enter user credentials anywhere; login-required verification is handed to the owner.
- Only these files may change: `sql/OPERATOR-CONTENT-3.sql` (new), `admin/index.html`, `api/operator-content.mjs`, `niches/bin-cleaning/{sections.html,niche.js,sections.css}`, `sites/bin-cleaning/index.html` (rebuild), and the SDD workspace. The human runs all SQL.

## Reference facts

- Current admin: single card, fields in `FIELDS` array, `resolve()→paint()→load()`, `save()` builds one row, upload sections from the prior plan. Read it fully before editing.
- Tenant's niche comes from `sb.rpc('sbv_public_tenants')` (already called in `load()` — returns client_id/niche_slug/business_name).
- Bin-cleaning theme tokens: ground `#050f1c`, surface `#0a2138`/`#0d2a47`, accent `#4ea4e6`, accent-bright `#67baf5`, text `#e6f4ff`/`#bfe3fb`, fonts Anton (display) / Oswald (labels) / Inter (body) via Google Fonts.
- Demo logo fallback: `/sites/<niche_slug>/photos/logo.png` exists only for bin-cleaning; theme map carries `logo` per niche, absent → text brand.
- Niche testimonials already render from `c.testimonials[]` (empty cards today); merge overlay is what makes operator reviews appear.
- `sbv_prices_valid` (OPERATOR-CONTENT-2.sql) is the validator style exemplar including typeof checks.

---

### Task 1: `sql/OPERATOR-CONTENT-3.sql` — social, reviews, job_details

**Files:** Create `sql/OPERATOR-CONTENT-3.sql`

**Interfaces:** Produces columns `social jsonb`, `reviews jsonb`, `job_details jsonb` on `public.sbv_operator_content`; validators `sbv_social_valid(jsonb)`, `sbv_reviews_valid(jsonb)`, `sbv_job_details_valid(jsonb)`. Consumed by Tasks 3 (admin save) and 4 (merge).

- [ ] **Step 1: Write the file** — exactly:

```sql
-- ============================================================================
-- OPERATOR-CONTENT-3.sql — social links, customer reviews, job details
-- ----------------------------------------------------------------------------
-- RUN AFTER: OPERATOR-CONTENT-2.sql. Idempotent throughout.
-- Every string field is jsonb_typeof-checked: a nested object passing a
-- length()-only check renders as "[object Object]" a year later (the
-- sbv_prices_valid lesson, fixed 2026-09-05).
-- ============================================================================

-- ================================================== 1. VALIDATORS ==
-- [{label, url}] — https only. ≤6: a footer, not a directory.
create or replace function public.sbv_social_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null or (
    jsonb_typeof(p) = 'array'
    and jsonb_array_length(p) <= 6
    and not exists (
      select 1 from jsonb_array_elements(p) as s(row)
      where jsonb_typeof(row) <> 'object'
         or exists (select 1 from jsonb_object_keys(row) k where k not in ('label','url'))
         or not (row ? 'label') or jsonb_typeof(row -> 'label') <> 'string'
         or length(row ->> 'label') > 40
         or not (row ? 'url') or jsonb_typeof(row -> 'url') <> 'string'
         or length(row ->> 'url') > 300
         or (row ->> 'url') !~ '^https://'
    )
  );
$$;

-- [{rating, quote, author}] — operator-entered testimonials from REAL
-- customers (the admin says so in so many words; the database cannot verify
-- honesty, only shape). rating is a jsonb number 1..5.
create or replace function public.sbv_reviews_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null or (
    jsonb_typeof(p) = 'array'
    and jsonb_array_length(p) <= 6
    and not exists (
      select 1 from jsonb_array_elements(p) as r(row)
      where jsonb_typeof(row) <> 'object'
         or exists (select 1 from jsonb_object_keys(row) k where k not in ('rating','quote','author'))
         or not (row ? 'quote') or jsonb_typeof(row -> 'quote') <> 'string'
         or length(row ->> 'quote') > 300 or length(btrim(row ->> 'quote')) < 1
         or not (row ? 'author') or jsonb_typeof(row -> 'author') <> 'string'
         or length(row ->> 'author') > 80
         or (row ? 'rating' and (
              jsonb_typeof(row -> 'rating') <> 'number'
              or (row ->> 'rating')::numeric not between 1 and 5))
    )
  );
$$;

-- {included: [], notIncluded: []} — stored now, rendered when the niche
-- template grows a slot (deferred by decision, 2026-09-05).
create or replace function public.sbv_job_details_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and not exists (select 1 from jsonb_object_keys(p) k where k not in ('included','notIncluded'))
    and not exists (
      select 1 from jsonb_each(p) as e(side, arr)
      where jsonb_typeof(arr) <> 'array'
         or jsonb_array_length(arr) > 10
         or exists (select 1 from jsonb_array_elements(arr) i(item)
                    where jsonb_typeof(item) <> 'string' or length(item #>> '{}') > 120)
    )
  );
$$;

revoke all    on function public.sbv_social_valid(jsonb)      from public, anon;
revoke all    on function public.sbv_reviews_valid(jsonb)     from public, anon;
revoke all    on function public.sbv_job_details_valid(jsonb) from public, anon;
grant execute on function public.sbv_social_valid(jsonb)      to authenticated, service_role;
grant execute on function public.sbv_reviews_valid(jsonb)     to authenticated, service_role;
grant execute on function public.sbv_job_details_valid(jsonb) to authenticated, service_role;

-- ==================================================== 2. COLUMNS ==
alter table public.sbv_operator_content
  add column if not exists social      jsonb check (public.sbv_social_valid(social)),
  add column if not exists reviews     jsonb check (public.sbv_reviews_valid(reviews)),
  add column if not exists job_details jsonb check (public.sbv_job_details_valid(job_details));

-- ==================================================== 3. VERIFY (all true) ==
select 'social fn: authenticated' as check_name,
       has_function_privilege('authenticated','public.sbv_social_valid(jsonb)','execute')::text as got
union all
select 'reviews fn: authenticated',
       has_function_privilege('authenticated','public.sbv_reviews_valid(jsonb)','execute')::text
union all
select 'job_details fn: authenticated',
       has_function_privilege('authenticated','public.sbv_job_details_valid(jsonb)','execute')::text
union all
select 'social: good row ok',
       public.sbv_social_valid('[{"label":"Facebook","url":"https://facebook.com/x"}]'::jsonb)::text
union all
select 'social: http rejected',
       (not public.sbv_social_valid('[{"label":"x","url":"http://x.com"}]'::jsonb))::text
union all
select 'reviews: good row ok',
       public.sbv_reviews_valid('[{"rating":5,"quote":"Great work","author":"J. Smith"}]'::jsonb)::text
union all
select 'reviews: rating 6 rejected',
       (not public.sbv_reviews_valid('[{"rating":6,"quote":"x","author":"y"}]'::jsonb))::text
union all
select 'reviews: non-string quote rejected',
       (not public.sbv_reviews_valid('[{"quote":{"a":1},"author":"y"}]'::jsonb))::text
union all
select 'job_details: good row ok',
       public.sbv_job_details_valid('{"included":["Curbside pickup"],"notIncluded":["Hazardous waste"]}'::jsonb)::text
union all
select 'job_details: junk key rejected',
       (not public.sbv_job_details_valid('{"extras":["x"]}'::jsonb))::text;
```

- [ ] **Step 2: Sanity check** — `node -e "const s=require('fs').readFileSync('sql/OPERATOR-CONTENT-3.sql','utf8'); ['sbv_social_valid','sbv_reviews_valid','sbv_job_details_valid'].forEach(f=>{if(!(new RegExp('grant execute on function public.'+f)).test(s)) throw f+' grant missing'}); console.log('ok')"`
- [ ] **Step 3: Commit** — `git add sql/OPERATOR-CONTENT-3.sql && git commit -m "feat(sql): social, reviews, job_details columns with typed validators"`

### Task 2: Admin shell — theme map, topbar, section nav, dirty tracking, save bar

**Files:** Modify `admin/index.html` (structure + CSS + state layer; existing field sections survive into Task 3's regroup)

**Interfaces:** Produces: `THEMES` map keyed by niche_slug (`{ground,surface,accent,accentBright,text,textSoft,fonts,logo}`), applied as CSS custom properties on `:root` once the tenant's niche is known; `markDirty()`/`markSaved()` state API driven by a snapshot diff; `#saveBar` sticky bottom bar shown only when dirty; `#topbar` with logo/business-name/saved-dot/sign-out. Consumed by Task 3.

- [ ] **Step 1: Theme layer.** `THEMES = { 'bin-cleaning': { ground:'#050f1c', surface:'#0a2138', card:'#0d2a47', accent:'#4ea4e6', accentBright:'#67baf5', text:'#e6f4ff', textSoft:'#bfe3fb', fontsHref:'https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap', display:"'Anton',sans-serif", label:"'Oswald',sans-serif", body:"'Inter',sans-serif", logo:'/sites/bin-cleaning/photos/logo.png' } }`. All page CSS refactored onto `var(--adm-*)` custom properties whose DEFAULTS are the current neutral palette; `applyTheme(nicheSlug)` overwrites the properties and injects the fontsHref `<link>` only when a map entry exists. No entry → pixel-identical current look (verify by diffing computed tokens).
- [ ] **Step 2: Topbar.** Sticky; tenant logo (theme logo → `logo_url` when saved → text fallback), business name, saved-state dot (`● Saved` green / `● Unsaved changes` amber), sign-out. Replaces the current header inside the panel state only — the sign-in gate keeps the neutral look (theme applies after resolve, when niche is known).
- [ ] **Step 3: Section nav.** Five anchors — Business / Photos / Pricing / Reviews / Details — horizontal scrollable pill row under the topbar on desktop AND mobile (simpler than accordion, thumb-friendly); each section is a `.card` with an `id`; nav highlights the section in view (IntersectionObserver, reduced-motion safe).
- [ ] **Step 4: Dirty tracking.** On successful `load()`, serialize a snapshot (`snapshot = collectRow()` — factor row-building OUT of `save()` into `collectRow()` so save and diff share it). Any `input`/`change` in `#panel` → compare `JSON.stringify(collectRow())` vs snapshot → `markDirty()`/`markSaved()`. `save()` success resets the snapshot. `beforeunload` guard when dirty. Photo uploads mark dirty via the same path (they mutate `photoUrls` then call the comparator).
- [ ] **Step 5: Save bar.** Fixed bottom, hidden unless dirty; big Save button (44px+), inline result message. Old in-card save button removed.
- [ ] **Step 6:** `node --check` the extracted inline JS; commit `feat(admin): themed shell, section nav, dirty-tracked save bar`.

### Task 3: Admin sections — full field coverage, uploads, inline validation

**Files:** Modify `admin/index.html`

**Interfaces:** Consumes Task 1 columns + Task 2 state API. Produces `collectRow()` covering: business_name, phone, email, lead_email, hours, address_line, city, state_code, postal_code, owner_name, bio, logo_url, photos{before,after,owner}, prices[3], social[≤6], reviews[≤6], job_details{included[],notIncluded[]} — all nullable-when-empty exactly as today.

- [ ] **Step 1: Regroup fields** into the five cards: **Business** (name/phone/public email/inquiry email+activation note/hours/address trio), **Photos** (4 drop-zones), **Pricing** (3 tier cards with live preview chip rendering `label — price_label`), **Reviews** (up to 6 collapsible rows: 1–5 star select, quote textarea w/ counter, author; compliance helper text verbatim from Global Constraints), **Details** (social rows label+url with add/remove up to 6; job-details two textareas one-item-per-line with the "appears when your site's next update adds this section" caption; owner name/bio/photo pointer).
- [ ] **Step 2: Uploads.** Drop-zones accept drag-and-drop (`dragover`/`drop`, highlight state) AND click; thumbnail after upload; progress text; Replace/Remove (remove clears the slot from `photoUrls` → merge falls back to demo). Store the **cache-busted** public URL (`publicUrl + '?v=' + Date.now()`) in `photoUrls` (Global Constraints). 2MB/type guards stay; errors inline in the zone.
- [ ] **Step 3: Inline validation on blur:** email fields (regex from the page's own conventions), state_code 2 letters, postal 5/9 digits, social URLs must be https, quote/author lengths, phone loose (anything ≤40). Invalid field: red border + message under field; Save disabled while any invalid AND dirty. Never block on empty (empty = clear).
- [ ] **Step 4:** `node --check`; manual mobile pass at 360px via Playwright or DevTools emulation if available (no horizontal scroll, 44px targets) — note evidence in report; commit `feat(admin): grouped sections, drag-drop uploads, inline validation`.

### Task 4: Merge endpoint — reviews/social/job_details overlay

**Files:** Modify `api/operator-content.mjs` (`applyOperator`)

**Interfaces:** `reviews[]` → `out.testimonials` mapped `{quote, name: author, rating}` (the niche renders quote/name; rating carried for future star render); `social[]` → `out.social` (same shape as content.json); `job_details` → `out.jobDetails` (stored-only passthrough). All only when non-empty arrays/objects — empty keeps demo values (demo testimonials are empty cards; an operator with 2 reviews shows 2 filled + 1 empty card, acceptable).

- [ ] **Step 1:** Add after the prices block:

```js
  /* Reviews overlay the demo's (empty) testimonial cards. author -> name is
     the template's key. Only a non-empty array overlays: empty means "not
     set", and the demo's deliberate empty cards stand. */
  if (Array.isArray(op.reviews) && op.reviews.length) {
    out.testimonials = op.reviews.map(r => ({
      quote: r.quote || '', name: r.author || '', rating: r.rating || null,
    }));
  }
  if (Array.isArray(op.social) && op.social.length) out.social = op.social;
  /* Stored-only until a template slot exists (deferred 2026-09-05). Served
     so the day the slot lands, saved data appears without a migration. */
  if (op.job_details && typeof op.job_details === 'object') out.jobDetails = op.job_details;
```

- [ ] **Step 2:** `node --check`; commit `feat(api): merge operator reviews, social, job details`.

### Task 5: Niche wiring — social footer slot + testimonials verification

**Files:** Modify `niches/bin-cleaning/sections.html`, `niche.js`, `sections.css`; rebuild `sites/bin-cleaning/index.html`

**Interfaces:** Consumes `c.social[]` (label/url) and existing `c.testimonials`.

- [ ] **Step 1:** Footer social row: `<p id="footSocial" hidden></p>` in the footer block; `niche.js` renderContent fills it from `c.social` — `esc(label)` linked `esc/safeUrl(url)`, `rel="noopener noreferrer" target="_blank"`, ` · ` separated, unhide only when non-empty (landscaping's footSocial is the exemplar). Muted styling consistent with the footer.
- [ ] **Step 2:** Verify (no code expected): testimonials render path handles operator-filled quote/name — confirm `esc()` on both (they're operator-controlled now; if the current render uses textContent it's safe as-is — check and state which).
- [ ] **Step 3:** Rebuild; qa-site (leadEmail failure remains ruled-intentional; nothing NEW); landscaping byte-check; commit `feat(bin-cleaning): social footer slot; reviews render verified`.

### Task 6: Live test — provision a REAL bin-cleaning test tenant (controller + owner)

Controller-executed (DB writes via the linked CLI stay with the controller): create tenant `primetest` (`sbv_tenants`: niche_slug bin-cleaning, business_name "Prime Test", is_active true) + `sbv_client_users` mapping to user 635d7526-4e35-400e-b185-7e9f86fdf6b4 (jasonvega1974@gmail.com), on-conflict-do-nothing. Then verify WITHOUT credentials: `primetest.systemsbyvega.com` serves the Prime template (curl marker greps), `/content.json` returns demo-pure merge, dashed owner slot present in page logic. Then hand the owner the login checklist: admin themed navy, upload/edit/save loop, verify merge + site, FormSubmit activation. Owner runs `sql/OPERATOR-CONTENT-3.sql` BEFORE using the Reviews/Details sections (Business/Photos/Pricing sections work without it — collectRow must OMIT the three new keys when their sections are empty? NO — same PGRST204 hazard as before: **Task 3's collectRow must not send social/reviews/job_details keys at all when null** — wait, sending explicit null for a nonexistent column also 204s. RULING baked into Task 3: `collectRow()` includes `social/reviews/job_details` keys ONLY when non-null, so the admin works before AND after the SQL runs. This constraint is part of Task 3's requirements.)

---

## Self-review notes
- Coverage: schema (T1), shell/theme (T2), sections/uploads/validation (T3), merge (T4), niche wiring (T5), live test + provisioning (T6). Job-details render correctly absent (deferred). Hours/address render absent (platform gap, out of scope).
- Consistency: column names social/reviews/job_details identical in T1 (SQL), T3 (collectRow), T4 (merge). author→name mapping stated in T4 and T5. Cache-busted-URL rule stated in Global Constraints and T3.
- PGRST204 lesson applied forward: T3 omits new-column keys when empty so deploy order can't break saves (T6 note).
