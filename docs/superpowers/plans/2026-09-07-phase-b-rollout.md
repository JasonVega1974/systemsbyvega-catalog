# Phase B — Per-Niche Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (wave-parallel variant per spec Decision 5). Steps use checkbox syntax.

**Goal:** Every niche's demo reaches launch quality — heroes fixed per the inventory audit, shared components rolled out everywhere the manifests flag them, the remaining pricing no-op reconciliations closed, and tenant artifacts stop shipping the demo's meta-noindex so the X-Robots header becomes live.

**Architecture:** Three parallel implementer waves over disjoint niche dirs (B1-proven no-commit shape: implementers edit `niches/`, controller rebuilds, byte-checks untouched niches, runs qa-site + node --check sweeps, batch-commits, one wave review per batch on the most capable model, pushes after clean review). Plus one cross-cutting infrastructure task (B0) that the waves depend on.

**Spec:** docs/superpowers/specs/2026-09-06-platform-inventory.md (audit verdicts + rollout order, binding) and docs/superpowers/specs/2026-09-06-phase-a-platform-generalization.md (component/manifest machinery).

## Global Constraints
- All brief §1 hard rules (niches-not-sites; absolute `/sites/<slug>/...` asset paths; DOM-property escaping for new sinks; no `*/` inside block comments; fictional demo brands — Prime bin-cleaning is the sole real-brand exception; zero income claims / fabricated proof).
- Photography: stock (Pexels/Unsplash, license-safe) presented as the fictional company's work per the established landscaping/B1 pattern; DJ stays fictional with stock photography — never the domvegz gallery (Jason's ruling).
- Untouched niches rebuild byte-identical (controller byte-check matrix per wave).
- Hero mechanics the audit says KEEP are untouchable; PROMOTE moves existing assets, minimizing new art.
- Reduced-motion safety preserved on every touched hero.
- Implementers never commit; single-writer manifests index (controller only).
- No SQL expected this phase; if a task surfaces a need, controller drafts/applies per brief §7 before dependent pushes.

### Task B0: Cross-cutting infrastructure (sequential, before waves)
**Files:** Modify `tools/build-site.js`, `middleware.js` or build flags as chosen, `api/marketing-kit.mjs`, `admin/index.html`, reference niches as needed.
1. **Tenant artifacts lose meta noindex:** today every tenant serves the `--demo` build whose baked `<meta name="robots" content="noindex">` defeats the live X-Robots-Tag header. Introduce a non-demo build variant for `sites/` output consumed by tenant rewrites — smallest honest mechanism wins; if demo and tenant must share one artifact, strip the meta and rely on the header alone for demo paths too, ONLY if demo pages get `X-Robots-Tag: noindex` from vercel.json headers on `/sites/(.*)` while tenant rewrites override with the middleware header. Verify precedence live before committing to the mechanism (curl both surfaces).
2. **hero-photo component wiring:** niches whose manifest photoSlots include `hero` get the `<!-- COMPONENT:hero-photo -->` slot comment + rebuild, so operator hero uploads (served since A-core) finally render. Landscaping + plumbing first (both already have the slot).
3. **Kit phone prettifying:** `buildTokens`/`mkBuildTokens` format a bare 10/11-digit phone as `(XXX) XXX-XXXX` (leave anything already formatted alone); parity test extended.
4. Verify: full rebuild, byte-check, qa-site sweep, parity + logic tests, live curls.

### Task B-W2 wave: hero PROMOTE + FIX group (one implementer, 4 niches)
auto-body (before/after SVG slider → hero), auto-repair (garage bay + spring from #sounds → hero), delivery (zone-map quoter promoted), bbq-food-truck (add smoker photo under the kept smoke). Per-niche pricing tickets riding along: auto-repair reads `p.range` vs content `p.blurb` (reconcile keys + manifest mergePath), delivery quoter already reconciled (A-core) — verify only.

### Task B-W3 wave: before/after photo group (one implementer, 4 niches)
pressure-washing (drawImage photo-swap into the kept wand-erase mechanic — two real photos of the same surface), car-detailing (photo hero + keep hotspot SVG), painting (photo hero + fix `x="20 "` typo), contracting (photo hero; wire its multi-project slider to operator slots + author `projects[]` demo data — closes the A-core ticket). All four get before/after operator slots wired where the manifest flags them.

### Task B-W4 wave: photo-hero remainder + KEEP-niche component rollout (one implementer, larger file count, mechanical)
electrician (photo hero, keep SMIL blink, retire float/halo; fix array-shipped/object-read pricing drift + manifest mergePath), hvac (photo hero, keep #sysmap; reconcile niche.pricingNote vs root), moving, metal-fabrication (photo hero under kept sparks), tattoo-studio, roofing (photo hero; strip orphaned sky-boltglow filter + bare `<g>` per B1 note). Plus mechanical component rollout to the KEEP niches (footer-contact/reviews/job-details slot comments per manifest flags): dj, dog-walking, dumpster-rental, child-care, caregiving, personal-trainer (+rAF IO stop), plumbing (+animate spout drop cheap win). Pricing reconciliation for dumpster-rental + dog-walking (calculator model keys) and child-care (hourly keys) — after reconciliation, remove the honest-but-sad admin captions A-core added.

### Task B-final: whole-phase verification + review + push (controller)
Full 23 rebuild; byte-check matrix; qa-site 0 real failures; node --check sweep; kit regenerate for one touched niche (templates unaffected but priceHeadline paths changed by reconciliations — parity + live check); X-Robots live verification both surfaces (this time expecting the header to actually govern); final whole-branch review (most capable model); fix wave; push; progress-ledger entry.

## Self-review notes
- Inventory coverage: B2 (W2), B3 (W3), B4 + KEEP rollout (W4), broken-wiring leftovers folded into their niches' waves; robots/hero-render/phone infra in B0.
- Waves are disjoint by niche dir; B0 touches shared files, hence sequential first.
- Every A-core/A-kit residual ticket has a home: electrician/auto-repair/hvac/contracting drift (W2-W4), calculator/hourly reconciliation (W4), hero render (B0), robots (B0), phone (B0). Rate-limit on marketing-kit deliberately NOT here — accepted residual, revisit on real usage.
