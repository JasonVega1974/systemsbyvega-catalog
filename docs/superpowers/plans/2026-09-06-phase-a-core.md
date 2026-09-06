# Phase A-core — Platform Generalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Manifests drive theme/sections/pricing-model/merge for every niche; admin and endpoint consume them; five shared components exist; the pricing silent no-op class is dead.

**Architecture:** `niches/<slug>/manifest.json` (schema in the spec) validated at build and compiled to `assets/data/manifests.json`; admin fetches the index (replacing THEMES) and renders the pricing editor per `pricing.model`; `api/operator-content.mjs` fetches the index to resolve merge paths; `_template/components/` holds five build-included components; A4 housekeeping rides along.

**Spec:** docs/superpowers/specs/2026-09-06-phase-a-platform-generalization.md (binding). Inventory matrix: docs/superpowers/specs/2026-09-06-platform-inventory.md (authority for per-niche model/slot facts).

## Global Constraints
- All prior hard rules (brief §1: niches-not-sites, absolute paths, validator grants same block, omit-unset columns, Promise.resolve builders, no */ in comments, fictional demos, DOM-property escaping for new sinks).
- SQL applied by controller via `supabase db query --linked` (SystemsByVega only) BEFORE dependent code pushes.
- Untouched niches rebuild byte-identical unless a manifest flag deliberately includes a component.
- Manifest absent → everything behaves exactly as today (admin neutral theme, endpoint current hardcoded paths). Rollout stays incremental.
- Implementers never commit; controller batch-commits after cross-verification (B1-proven).
- The manifests index is REGENERATED ONLY BY THE CONTROLLER (parallel implementers write manifest files; index build is a single-writer step).

### Task 1: SQL — model-agnostic prices validator (controller applies)
**Files:** Create `sql/PRICING-MODELS.sql`
Full SQL (verbatim):
```sql
-- ============================================================================
-- PRICING-MODELS.sql — sbv_prices_valid v3: one column, seven pricing models
-- RUN AFTER: ADMIN-RESET.sql. Idempotent. CREATE OR REPLACE keeps grants.
-- Array form (tiers/hourly/flash/calculator rows) OR object form
-- (quote/percentage). Every string typeof-checked; no casts (no CASE needed).
-- ============================================================================
create or replace function public.sbv_prices_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null
    or (
      jsonb_typeof(p) = 'array'
      and jsonb_array_length(p) <= 8
      and not exists (
        select 1 from jsonb_array_elements(p) as t(tier)
        where jsonb_typeof(tier) <> 'object'
           or exists (select 1 from jsonb_object_keys(tier) k
                      where k not in ('label','price_label','per','note','features','unit','rate'))
           or not (tier ? 'label') or jsonb_typeof(tier -> 'label') <> 'string'
           or length(tier ->> 'label') > 60
           or (tier ? 'price_label' and (jsonb_typeof(tier -> 'price_label') <> 'string' or length(tier ->> 'price_label') > 20))
           or (tier ? 'per'   and (jsonb_typeof(tier -> 'per')   <> 'string' or length(tier ->> 'per')   > 30))
           or (tier ? 'note'  and (jsonb_typeof(tier -> 'note')  <> 'string' or length(tier ->> 'note')  > 80))
           or (tier ? 'unit'  and (jsonb_typeof(tier -> 'unit')  <> 'string' or length(tier ->> 'unit')  > 20))
           or (tier ? 'rate'  and (jsonb_typeof(tier -> 'rate')  <> 'string' or length(tier ->> 'rate')  > 20))
           or (tier ? 'features' and (
                jsonb_typeof(tier -> 'features') <> 'array'
                or jsonb_array_length(tier -> 'features') > 8
                or exists (select 1 from jsonb_array_elements(tier -> 'features') f(x)
                           where jsonb_typeof(f.x) <> 'string' or length(f.x #>> '{}') > 120)))
      )
    )
    or (
      jsonb_typeof(p) = 'object'
      and not exists (select 1 from jsonb_object_keys(p) k
                      where k not in ('starting_at','note','commission','minimum'))
      and not exists (
        select 1 from jsonb_each(p) as e(key, val)
        where jsonb_typeof(val) <> 'string' or length(val #>> '{}') > 120
      )
    );
$$;
-- ================================================ VERIFY (all 'true') ==
select 'tiers still ok' as check_name,
       public.sbv_prices_valid('[{"label":"1 Bin","price_label":"$10"}]'::jsonb)::text as got
union all select 'hourly rate row ok',
       public.sbv_prices_valid('[{"label":"2 movers","rate":"$129","unit":"per hour"}]'::jsonb)::text
union all select 'quote object ok',
       public.sbv_prices_valid('{"starting_at":"$45","note":"Most jobs quoted by text"}'::jsonb)::text
union all select 'percentage object ok',
       public.sbv_prices_valid('{"commission":"35%","minimum":"$500"}'::jsonb)::text
union all select 'junk key rejected (array)',
       (not public.sbv_prices_valid('[{"label":"x","cents":1}]'::jsonb))::text
union all select 'junk key rejected (object)',
       (not public.sbv_prices_valid('{"weird":"x"}'::jsonb))::text
union all select 'non-string rejected',
       (not public.sbv_prices_valid('{"starting_at":45}'::jsonb))::text
union all select 'grants survived replace',
       has_function_privilege('authenticated','public.sbv_prices_valid(jsonb)','execute')::text;
```
Steps: write file → sanity grep → controller applies via CLI, verify rows all true → commit.

### Task 2: Manifest tooling + reference manifests
**Files:** Create `tools/validate-manifest.js`, `tools/build-manifest-index.js`, `niches/bin-cleaning/manifest.json`, `niches/landscaping/manifest.json`; Modify `tools/build-site.js` (call validator when manifest exists; NO index regen here — controller-only step).
- validate-manifest: CommonJS, checks the spec's schema (v===1, theme keys hex/strings, photoSlots⊆known set, sections booleans, pricing.model∈enum, merge paths∈enum); exit 1 with named errors.
- build-manifest-index: reads all niches/*/manifest.json → writes `assets/data/manifests.json` `{ "<slug>": {theme, photoSlots, sections, pricing:{model,editableFields}, merge} }` sorted keys, stable output.
- bin-cleaning manifest content: theme = current THEMES entry verbatim + ok/bad/onAccent; photoSlots [logo,before,after,owner]; sections all true except jobDetails false... (jobDetails stored-only: sections.jobDetails=false until component lands in Task 5 — then flipped for reference niches in Task 6); pricing tiers; merge beforeAfter niche.beforeImg/afterImg, reviews testimonials, ownerShape owner.
- landscaping manifest: neutral-theme OMITTED? No — theme REQUIRED per schema; landscaping gets its real palette (read niche.css tokens) but admin behavior must stay neutral until… RULING: theme in manifest is authoritative; landscaping admin GAINS its green theme (improvement, in scope). pricing tiers (plans caveat from matrix note 20 — verify which array renders; set mergePath accordingly). Steps include verifying landscaping's plans-vs-pricing question with a grep and recording the answer in the manifest.
Verify: node --check both tools; validator rejects a mutated bad manifest; index builds stable; build-site with manifest present validates + still byte-identical site output.

### Task 3: 21 remaining manifests (3 parallel implementers × 7 niches, manifest files ONLY)
Source of truth per niche: the inventory matrix (pricing model column notes 1–27) + each niche's niche.css tokens for theme + sections.html for slots/sections. Models per inventory: tiers → auto-repair, caregiving, electrician, hvac, painting, plumbing, pressure-washing, roofing, bbq, car-detailing; hourly → moving, child-care; quote → delivery, metal-fabrication; calculator → dumpster-rental, dog-walking; flash → tattoo-studio; none → auto-body; dj → none+special (no brand.phone; sections minimal). personal-trainer → tiers. contracting → tiers + merge.beforeAfter projects[0].
Controller afterwards: run build-manifest-index once, validate all 23, commit batch.

### Task 4: Admin consumes the index
**Files:** Modify `admin/index.html`
- Replace THEMES with fetch of `/assets/data/manifests.json` (Promise.resolve-wrapped, terminal catch → neutral theme + visible note if a themed niche fails to load).
- applyTheme(manifest.theme) — same property mapping, now data-driven.
- Photos section renders zones from photoSlots (fallback to today's four when manifest absent).
- Pricing section per pricing.model: tiers=today's editor; hourly=label/rate/unit rows; quote=starting_at+note fields; percentage=commission+minimum; calculator=label/price_label rows with caption "feeds your site's calculator"; flash=label/price_label list; none=hidden with caption. collectRow writes array or object per model (validator Task 1 accepts both). seenInLoad/maybeClearable semantics unchanged.
- Sections flags hide Reviews/Details editors when the niche lacks the section (caption explains).
Harness-verified: extend the stub to serve a manifests.json; walk one model of each editor shape saving the right JSON.

### Task 5: Shared components ×5
**Files:** Create `_template/components/{footer-contact.html,before-after.html,job-details.html,reviews.html,hero-photo.html}` + a small `components.js` runtime; Modify `tools/build-site.js` (inject component markup when manifest sections flag true and the niche's sections.html carries the slot comment `<!-- COMPONENT:<name> -->`).
- Escaping standard: DOM-property assignment throughout components.js.
- footer-contact renders contact.hours/address + social (scheme-gated) — closes hours/address 0/23.
- reviews component carries its own fallback strings (B1 lesson).
- before-after extracted from bin-cleaning verbatim behavior; target element/config from manifest merge.beforeAfter.
Verify: components included ONLY where flagged; a no-flag niche rebuilds byte-identical.

### Task 6: Reference-niche wiring proof
Flip bin-cleaning + landscaping manifests to include footer-contact (+ jobDetails for bin-cleaning); replace bin-cleaning's hand-built social footer with the component; de-brand Prime aria-labels/eyebrow in bin-cleaning to brand-bound text (A4 item). Rebuild, verify hours/address/social render from a stub merge, qa-site clean, Prime name only where brand-bound.

### Task 7: Endpoint consumes the index
**Files:** Modify `api/operator-content.mjs` — fetch manifests index (cached module-level with TTL, same HTTP pattern as defaults); merge paths per manifest (beforeAfter target incl. contracting's projects[0], pricing mergePath, ownerShape none→skip); manifest absent → exactly today's behavior (regression guard).

### Task 8: A4 housekeeping
- middleware.js: on tenant rewrite, add `X-Robots-Tag: all` header ONLY when the operator row exists (one cached lookup — reuse/extend nicheFor's cache to carry has_content), else `X-Robots-Tag: noindex`. Demo pages untouched (meta stays).
- tools/qa-site.js: real-brand allowlist keyed on a `realBrand: true` manifest field (bin-cleaning only) replacing the failing leadEmail expectation for that niche.
Verify: curl -I both states; qa-site bin-cleaning fully green for the first time.

### Task 9: Whole-phase verification + wave review + push (controller)
Full rebuild of all 23; byte-check matrix (only manifest-flagged niches changed); node --check sweep; harness admin walk (one pricing model each); endpoint stub-merge test for contracting beforeAfter + a quote-model niche; final whole-branch review (most capable model); fix wave if needed; controller commits per task batches along the way, pushes after clean review (SQL already applied at Task 1).

## Self-review notes
- Spec coverage: manifests(T2/T3), pricing models(T1/T4/T7), components(T5/T6), endpoint(T7), A4(T6/T8), verification(T9). A-kit deliberately split out.
- Consistency: pricing model enum identical in spec/T1 keys/T4 editors; index is single-writer (T3 rule); manifest-absent fallback stated in T2/T4/T7.
- The landscaping plans-vs-pricing open fact is resolved inside T2 with a recorded answer, not assumed.
