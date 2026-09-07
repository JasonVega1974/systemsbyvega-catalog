# Phase C — New Niches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** `niches/estate-sale/` and `niches/garage-sale/` exist at full platform standard — demo site, manifest, percentage-model pricing proven end to end, marketing kit working — built and verified but NOT flipped purchasable (catalog/Stripe exposure is Jason's explicit gate).

**Architecture:** Sequential SDD, one niche at a time, creative single-implementer tasks with capable-model reviews. Estate-sale adapts the proven EstateSaleBiz demo layout with a fictional brand; garage-sale is a simpler, brighter sibling.

**Spec:** docs/superpowers/specs/2026-09-07-phase-c-new-niches.md (binding — Decisions 1-5).

## Global Constraints
- All standing hard rules (fictional demo brands; zero income claims / fabricated proof — estate-sale copy is claim-prone: fee-structure language only, never proceeds promises; absolute /sites/<slug>/... paths; DOM-property/esc sinks; no `*/` in block comments; reduced-motion safe; display-string pricing contract; single-writer manifests index).
- The Phase B platform patterns apply from day one: hero-photo component with heroDefault/heroAlt/heroWired:true + credited Pexels photo; footer-contact + reviews (honest empty-state) components; demo disclosure; FormSubmit lead pattern with empty LEAD.email + qa-site expectations (leadEmail = info@kingdom-creatives.com in content).
- NO catalog seed / Stripe / funnel changes (spec Decision 1).
- Implementers never commit; controller batch-commits per task after review.

### Task C1: estate-sale content + copy
**Files:** Create `niches/estate-sale/content.json`
Fictional brand (invented name/owner/city — Idaho-plausible, distinct from Treasure Valley Estate Sales and any real company), distilled from the ESB material at C:/Users/JasonVega/Desktop/Jason/EstateSaleBiz (demo.html copy tone, training/case-study substance): brand block (name/tagline/phone/city/state/leadEmail info@kingdom-creatives.com), hero copy, how-it-works 4 steps (assess → stage & price → sale weekend → broom-clean handoff), `pricing` OBJECT `{"commission":"35%","minimum":"$1,500","note":"<fee-structure sentence, no proceeds promises>"}`, what-sells guide: ~12 fictionalized rows from the pricing catalogue concept (cat/item/range/note — NO eBay links), service area cities, empty testimonials, seo/owner blocks per platform shape (copy a recent niche's content.json for the full key checklist — contracting is current).

### Task C2: estate-sale site build
**Files:** Create `niches/estate-sale/{sections.html,niche.css,niche.js,manifest.json}`, photos/ (hero + CREDITS.md)
Adapt the ESB demo.html visual language (dark teal/amber estate palette or equivalent — implementer's design judgment, contrast ≥4.5:1 for the admin theme) onto the platform template structure (study niches/contracting + niches/landscaping for the current canonical shape, _template/base.js contract, COMPONENT slots). Sections per spec Decision 4. Percentage fee section renders `pricing.commission` + `pricing.minimum` + note. What-sells guide renders the C1 rows (textContent sinks). Manifest: theme (real palette), photoSlots [logo,hero,owner], sections flags (footerContact/reviews true, jobDetails false, beforeAfter none), pricing percentage per spec Decision 3, merge reviews testimonials / ownerShape owner, heroDefault/heroAlt/heroWired true. Hero photo: credited Pexels estate/vintage-interior shot, brand-neutral. Verify: validate-manifest, build --demo clean (heroWired gate), qa-site 0 FAIL, node --check.

### Task C3: estate-sale integration proof (controller-heavy)
- Index rebuild (single-writer) + verify entry.
- Percentage round-trip: merge simulation — operator save `{prices:{commission:"30%",minimum:"$1,200"}}` (admin PRICE_MODEL_FIELDS.percentage object shape) lands where niche.js reads; check OBJECT_FIELD_MAPS needs no new entry (root `pricing` object mergePath) — add one if it does.
- sbv_prices_valid object-form accepts the save (SQL applied in A-core; verify with the live validator via supabase db query if in doubt).
- Marketing kit: priceHeadline renders "35%"; master template fill with the real manifest theme; zero unresolved tokens.
- Admin harness walk: percentage editor loads/saves; theme applies; photo zones correct.

### Task C4: estate-sale review gate
Capable-model review: compliance read of EVERY copy string (claim-prone niche), headless render, design-quality eyeball vs the 23 existing niches' bar, C1-C3 evidence re-execution. Fix round; commit batch.

### Tasks C5-C7: garage-sale (same shape, simpler site)
C5 content (source: GarageSaleBiz material; canonical compliance wording lives on garagesalebiz.com per standing memory — match its posture), C6 site (brighter/simpler; pricing model: quote — "starting at" flat-fee object — garage-sale organizers charge flat/starting fees, not commissions... unless the GSB material says otherwise: implementer verifies against the source and the plan records the answer), C7 integration proof + review gate; commit batch.

### Task C8: whole-phase review + push
Full sweeps (all 25 niches now), byte-check that the 23 existing niches are untouched, final capable-model review, push. Post-deploy: /sites/estate-sale/ live + noindex header, kit generate against a scratch... no tenant exists for these niches (none purchasable) — kit verification stays at the C3 simulation level. Progress-ledger entry ends with the explicit "catalog exposure awaits Jason's go" line.

## Self-review notes
- Spec coverage: D1 (C8 explicitly excludes catalog), D2 (C1/C5 fictionalization), D3 (C3 round-trip), D4 (C2/C6 architecture), D5 (this shape).
- The garage-sale pricing-model question is resolved inside C5/C6 with a recorded answer, not assumed.
- Type consistency: pricing object keys commission/minimum match validator object form and admin percentage editor.
