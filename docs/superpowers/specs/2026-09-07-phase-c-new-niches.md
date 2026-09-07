# Phase C — New Niches: Estate-Sale, then Garage-Sale

**Date:** 2026-09-07 · Brief: docs/superpowers/briefs/2026-09-06-sitelab-platform-completion-brief.md (Phase C deliverable; Phase 0 checkpoint scoped new niches to these two — consignment deferred by Jason's ruling)
**Status:** decisions made under brief §7 autonomy; Jason reads, objects, or lets it ride.

## What Phase C is

Two new catalog niches built to the platform's Phase A/B standard: `niches/estate-sale/` first (it validates the percentage pricing model — the one model no live niche exercises), then `niches/garage-sale/`. Each ships a complete demo site (sections.html/css/js + content.json + manifest.json), builds through the standard pipeline, gets marketing-kit coverage automatically via the shared master templates, and passes qa-site.

## Decision 1 — Catalog exposure is JASON'S GATE, not this phase's

Building the niche makes it exist at `/sites/estate-sale/` (demo, noindex like every demo). Flipping it OPEN — purchasable in the catalog with a Stripe mapping — changes what customers see and pay, which is brief stop-condition territory. Phase C delivers the niches fully built and verified but NOT flipped open; the catalog seed/Stripe wiring is a one-line follow-up Jason triggers explicitly. Cost if wrong: none — the demo is reachable by direct URL for his review either way.

## Decision 2 — Source material and fictionalization

- **estate-sale**: design adapted from `C:/Users/JasonVega/Desktop/Jason/EstateSaleBiz/demo.html` (Treasure Valley Estate Sales — a polished, proven layout) and copy distilled from ESB's training/case-study material. The demo brand must be FICTIONAL (Prime bin-cleaning remains the sole real-brand exception): invent a name/owner/city distinct from TVES and from any real estate-sale company; stock photography or ESB's item photos ONLY if they are Jason's own license-safe shots presented neutrally — default to Pexels per house pattern, since provenance of the ESB images folder is unverified.
- The ESB pricing catalogue concept (what items typically fetch) is a differentiating content feature; a trimmed, fictionalized version (a dozen representative rows, no eBay comp links — external links rot and read as endorsements) becomes a "what things typically sell for" section.
- **garage-sale**: thinner source material by design; a simpler, brighter site. Same rules.
- Compliance is unchanged and absolute: zero income claims, zero fabricated testimonials/proof, service-descriptive copy only. Estate-sale copy is claim-prone (it is a money business) — commission language must describe the FEE STructure, never promise proceeds or outcomes.

## Decision 3 — Percentage pricing, end to end (the model's first live exercise)

- `manifest.json`: `pricing: { model: "percentage", editableFields: ["commission","minimum"], mergePath: "pricing" }` with `pricing` as an OBJECT in content.json: `{ "commission": "35%", "minimum": "$1,500" }` (the validator's object form, keys commission/minimum/starting_at/note).
- Admin: the percentage editor already exists (A-core `PRICE_MODEL_FIELDS.percentage`: commission + minimum). The niche.js renders those two values in a fee-structure section.
- Endpoint: `OBJECT_FIELD_MAPS` — verify whether `pricing` (object at root) needs a map entry or passes through identity; the phase's verification MUST include the operator round-trip merge simulation (save commission/minimum → renders).
- Marketing kit: `priceHeadline` percentage branch renders `"35%"` — verified in A-kit tests against fixtures; this phase proves it against the real niche.

## Decision 4 — Site architecture (both niches)

Platform-standard: `_template/base.js` runtime, absolute asset paths, DOM-property/esc sinks, reduced-motion-safe animation, demo disclosure, the B-phase display-string pricing contract where arrays appear, shared components via manifest flags (footerContact true, reviews true with honest empty-states, jobDetails where it fits), hero-photo component wired from day one (photoSlots includes hero, heroDefault + heroAlt + heroWired:true, credited stock photo) — no retrofit debt. Sections for estate-sale: hero, how-it-works (assess → stage → sale weekend → clean-out), fee structure (percentage), what-sells guide (trimmed catalogue), reviews (empty-state), service area, booking/contact form (FormSubmit pattern), footer-contact. Garage-sale: hero, how-it-works, flat/percentage-lite fee section, signs/prep tips, contact, footer-contact.

## Decision 5 — Execution shape

Sequential SDD per niche (creative single-implementer tasks with heavy review, not parallel waves): C1 estate-sale content + copy, C2 estate-sale site build, C3 estate-sale manifest/pricing/kit verification incl. percentage round-trip, C4 estate-sale review gate; C5-C7 garage-sale same; C8 whole-phase review + push. Reviews on capable models; the C4/C7 gates include a headless render pass and the compliance read (claim-prone copy).

## Out of scope
Catalog/Stripe exposure (Decision 1 — Jason's gate). Consignment (deferred by ruling). Any change to existing niches.
