# New Niche Wave — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Six new niches built to the Phase C standard, then the catalog wave: those six plus estate-sale and garage-sale made purchasable, plus the ESB/GSB/CSB related-products section on the catalog index.

**Architecture:** No new platform plumbing. Each niche is manifest + content + sections/css/js + photos + rebuild, exactly as estate-sale and garage-sale were built. The shared component system (hero-photo, before-after, reviews, footer-contact) supplies everything the manifests flag.

**Brief:** SiteLab New Niche Wave (2026-09-07); prior platform-completion brief's rules, lessons and autonomy grants carry forward unchanged.

## Global Constraints
- All standing hard rules: fictional demo brands (Prime bin-cleaning remains the sole real-brand exception); **zero income claims, zero fabricated testimonials/proof** (testimonials ship `[]`, honest empty-states); absolute `/sites/<slug>/...` asset paths; DOM-property/`esc()` sinks; no `*/` inside block comments; reduced-motion safe; `leadEmail` = `info@kingdom-creatives.com`; fictional `(208) 555-01XX` phones unique in repo; brand names root-unique across ALL sibling niches.
- Phase B/C platform patterns from day one: hero-photo component with `heroDefault`/`heroAlt`/`heroWired:true`; before-after component where the manifest flags it; footer-contact + reviews; the **display-string pricing contract** (`label`/`blurb`/`per`/`highlight`) for every rows-model niche — the reader must consume `blurb`, which is where `ARRAY_FIELD_MAPS.pricing` lands an operator's `price_label`.
- Post-hardening invariants: the operator's saved pricing array is authoritative for length; kit tokens entity-encode; no `$0`-rendering price paths; no star ratings without a real rating behind them.
- Manifests index is controller-only (single writer). Implementers never commit.

## The six niches (dog-sitter skipped — see ledger)

| slug | pricing model | before/after | notes |
|---|---|---|---|
| residential-cleaning | tiers | yes | per-visit + recurring cadence tiers |
| commercial-cleaning | tiers | yes | per-sqft / monthly contract framing |
| window-cleaning | tiers | yes | per-pane or by property size |
| mechanic | tiers | yes | flat-rate common services + note for custom quotes; must not collide with existing auto-repair/auto-body brands or copy |
| sprinkler | quote | yes | install = quote (primary model); repair hourly described in copy, not a second model |
| personal-assistant | tiers | no | hourly / half-day / monthly retainer |

### Task N (one per niche, sequential-ish; parallel only on disjoint niche dirs)
**Files:** Create `niches/<slug>/{manifest.json,content.json,brief.md,sections.html,sections.css,niche.css,niche.js,scene.svg,scene.js,og.svg,og.png,photos/*}`
1. **content.json** — fictional brand/owner/city (Idaho-plausible, unused city), real pricing structure per the table, empty `testimonials`, `seo`/`owner`/`serviceArea`/`contact` families per the Phase C canon (`niches/estate-sale/content.json` is the reference). Money copy is fee-structure only.
2. **manifest.json** — full theme key set (onAccent ≥4.5:1 against accent AND accentBright — the admin wears this theme), photoSlots, sections flags, pricing block, merge paths, hero keys.
3. **Site build** — sections/css/js against the shared components; before-after slider wired to `merge.beforeAfter` where flagged; fee/pricing section renders the model correctly.
4. **Photos** — approved candidates only, into `photos/` + `CREDITS.md` (photographer + source URL + licence).
5. **Gates** — `validate-manifest` exit 0; `build-site <slug> --demo` clean with the expected components and the heroWired gate green; `qa-site <slug>` 0 FAIL; `node --check` on every JS file.
6. **Integration proof** — stub operator row through the merge endpoint: every editable field lands where the renderer reads it (pricing rows on `blurb`; before/after photos on the manifest's target; reviews; owner). Executed evidence, not inspection.

### Task W: wave verification + review + push (controller)
Full rebuild of all 31 niches; byte-check that the existing 25 are untouched; `qa-site` sweep 0 real failures; the Phase D battery extended over the new niches (merge lands, kit tokens resolve, no unresolved `{{`); manifests index rebuilt once; whole-diff review on the most capable model; fix round; push.

### Task C: catalog wave (AFTER the phase gate, §4 of the brief)
1. **Seed rows + cards** for the six new niches AND estate-sale + garage-sale (Jason has approved exposing these). The four-step recipe the final platform review documented: new singular-slug seed row → `tools/build-catalog.js` rebuild → SQL apply (SystemsByVega only) → `sites/index.html` entry (it is a second, ungated catalog and must be updated by hand).
   - `sbv_niches_handoff_ck` forbids reusing the existing plural `estate-sales`/`garage-sales` rows (those are the real ESB/GSB businesses) — new rows required.
   - **Stripe: RESOLVED — no work needed.** Verified in `api/_shared.mjs:83` and `api/create-checkout.mjs:302`: Stripe prices are per-TIER (`STRIPE_PRICE_ID_LAUNCH` / `_CUSTOM` from env), not per-niche; checkout's line item is `TIER_PRICE_ID[tier]`. A niche is claimable when its `sbv_niches` row has `website_offer = true AND is_listed = true` (`create-checkout.mjs:214`) — `status` is display vocabulary only (live purchasable niches carry `website_only` and `in_line` alike). So exposing a niche creates NO Stripe object and changes no price: it is seed row + catalog rebuild + one SQL update + the `sites/index.html` entry. Stop condition #3 is not engaged.
   - Seed shape for a purchasable niche (copy `delivery`): `status` display value, `open_url: null`, `price_label: null`, `demo_path: "/sites/<slug>/"`, `website_offer: true`. Estate-sale/garage-sale get NEW singular-slug rows; the existing plural `estate-sales`/`garage-sales` rows stay exactly as they are (they point at the real ESB/GSB businesses and belong in §4's related-products section instead).
2. **Related-products section** on the catalog index only (`index.html`), below the niche grid, visually distinct, linking estatesalebiz.com / garagesalebiz.com / consignmentbiz.com with the "these are full platforms, not territory sites" framing. Not mixed into the niche grid, not inside any niche.

## Self-review notes
- Brief coverage: §1 niches (six + the documented skip), §2 build rules (Task N steps 1-6), §3 gates (Task W), §4 catalog + links (Task C), §5 ledger (both ledgers live).
- The Stripe question is surfaced rather than assumed — it is the one part of §4 that touches a stop condition.
- Pricing-model note: sprinkler ships `quote` as its single manifest model; hourly repair is described in copy, avoiding a two-model niche the admin cannot represent.
