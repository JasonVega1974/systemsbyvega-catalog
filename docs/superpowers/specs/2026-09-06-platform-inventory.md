# Platform Inventory & Audit — Phase 0 checkpoint report

**Date:** 2026-09-06 · Brief: docs/superpowers/briefs/2026-09-06-sitelab-platform-completion-brief.md
Three parallel read-only audits (content folders / heroes / field coverage). **This is the mandatory checkpoint — nothing below has been built.**

---

## Table 1 — Content inventory

Correction to the brief: the content folder is `Desktop\Jason\SiteLab\SiteLab\` (nested, no space); `site labs\` does not exist.

| Content folder | Maps to | Photos | Before/after | Marketing | Copy |
|---|---|---|---|---|---|
| SiteLab\black-anvil-fabrication | metal-fabrication | none on disk | — | — | ✅ content.json + inline |
| SiteLab\cinder-hog-bbq | bbq-food-truck | none on disk | — | — | ✅ |
| SiteLab\sawtooth-dumpster-co | dumpster-rental | none on disk | — | — | ✅ incl. full price table |
| SiteLab\static-rose-tattoo | tattoo-studio | none on disk (gallery refs dangle) | — | — | ✅ |
| SiteLab\summit-stone-contracting | contracting | none on disk | — | — | ✅ incl. testimonials |
| PrimeBinCleaning\ | bin-cleaning | ✅ 2 owner photos | markup only; assets dir missing | ✅ FB PNG + source HTML, print flyer PNG | ✅ |
| Dominic\ + GitHub Clone\domvegz\ | dj | ✅ **large real gallery** (cover + dozens) | — | — | ✅ content.json |
| **EstateSaleBiz\** | **NEW: estate-sale** | ✅ 12 images (items + headshot + logos) | — | ✅ full marketing-kit dir (signs, FB posts, referral) | ✅ heavy (training, pricing-data, case studies) |
| **GarageSaleBiz\** | **NEW: garage-sale** | thin (3 proof webp + og) | — | ✅ signs.html etc. | ✅ course + launch checklist |
| **Desktop\ConsignmentBiz\** | **NEW: consignment** | images\ dir present | — | — | ✅ PLAN.md, consign/intake html |
| systems-by-vega\ (root) | platform | screenshots | — | ✅ FB + flyer **source HTML** — the A3 template pattern | ✅ pricing/landing |

- SiteLab's 5 repos: copy-rich, **zero binary assets** (all image refs dangle).
- **No matched before/after photo pair exists anywhere** except `niches/bin-cleaning/photos/` — every before/after hero needs sourced photography (Pexels/Unsplash per house pattern).
- Repo niches with **no external content anywhere** (15): auto-body, auto-repair, car-detailing, caregiving, child-care, delivery, dog-walking, electrician, hvac, moving, painting, personal-trainer, plumbing, pressure-washing, roofing.
- `New folder\` = ~226 faith/church stock images (kingdom-creatives material, not a niche). `Claude Code Screenshots\` = app screenshots.

## Table 2 — Hero & animation audit (23 niches)

Verdict key: **KEEP** as-is · **PROMOTE** existing below-fold asset into the hero · **PHOTO** replace art with real photo + Ken Burns (landscaping pattern) · **FIX** targeted repair. No niche needs an animation *removed*; every animation is reduced-motion-safe.

| Niche | Hero today | Verdict | Note |
|---|---|---|---|
| bin-cleaning | real logo + drops + drag slider | **KEEP** | the reference |
| landscaping | real photo + Ken Burns | **KEEP** | reference #2; 1 dead `float` keyframe to sweep; 2 unused photos fit the already-wired season slots |
| dj | live canvas visualiser | **KEEP** | untouchable; but see broken wiring #3 below |
| dog-walking | full park scene w/ real physics | **KEEP** | ball gravity + spring tail, decays properly |
| dumpster-rental | painted-steel roll-off illo + spring drop | **KEEP** | 2nd-best illustration; cleanest scene.js contract; only real scene.svg in repo |
| child-care | dusk window vignette, staggered twinkle | **KEEP** | nicest pure-CSS hero |
| caregiving | golden-hour living room illo | **KEEP** | restrained, on-tone |
| personal-trainer | premium athlete illo + spark fountain | **KEEP** | fix: rAF loop never self-terminates (IO stop needed); dead `.portrait__wash` CSS |
| plumbing | chrome faucet icon + drip physics below | **KEEP** | cheap win: animate the already-drawn spout drop |
| auto-body | **no hero art** | **PROMOTE** | its before/after SVG car slider is below the fold |
| auto-repair | **no hero art** (grain wash) | **PROMOTE** | rendered garage bay + spring lives in #sounds |
| delivery | **no hero art** (60px route squiggle) | **PROMOTE** | terrain zone-map quoter is best-in-class, below fold |
| bbq-food-truck | smoke with no smoker | **FIX art** | keep smoke/drift; add the thing the smoke rises from (photo) |
| pressure-washing | procedural mud-gradient canvases | **FIX art, KEEP mechanic** | Jason's flag confirmed; the wand-erase interaction is the only truly interactive hero in the repo — swap drawClean/drawDirty for drawImage of two real photos of the same surface |
| car-detailing | flat teal-outline car, float+halo | **PHOTO** | Jason's flag confirmed; hotspot diagram uses a 2nd car SVG — keep it consistent |
| contracting | logo-as-hero (emblem badge) | **PHOTO** | site itself is well-built; has its own multi-project before/after slider already |
| electrician | flat breaker-panel clip-art + float | **PHOTO** | keep SMIL breaker blink idea; retire `float`/`halo` |
| painting | flat wall/roller clip-art + float | **PHOTO** | byte-identical float to electrician; source typo `x="20 "` |
| hvac | **no hero art** (text card) | **PHOTO** | keep #sysmap house diagram |
| moving | **no hero art** | **PHOTO** | keep Load Builder (has own reduce override) |
| metal-fabrication | **no hero art** (sparks only) | **PHOTO** | keep sparks over the photo |
| tattoo-studio | placeholder glyph wash | **PHOTO** | structural twin of personal-trainer, never got the upgrade; real gallery could come from flash/stock |
| roofing | elaborate shingle/sky illo, **dead animation hooks** | **FIX** | 4 classes/ids (clouds, rain, flash, bolt) have zero CSS/JS — restore a small rAF or strip them |

Interactive features to preserve everywhere (manifest-flagged, never rebuilt): both existing before/after sliders (bin-cleaning, contracting), auto-repair sound picker, delivery zone quoter, dumpster price picker, painting room visualizer, plumbing drip calculator, electrician switchboard, hvac sysmap, roofing self-check, landscaping season wheel, dog-walking week builder, moving load builder, dj everything.

## Table 3 — Field coverage (what operator edits actually render)

Full matrix in the audit transcript; the actionable summary:

| Field | Renders on | Gap |
|---|---|---|
| brand name | 21/23 | **contracting: hardcoded in 6+ places, zero hooks** · **dj: broken (writes "Your Name" over DJ Nova)** |
| phone | 22/23 | dj has no brand.phone at all |
| public email | 13/23 | |
| owner name/bio | ~20/23 | personal-trainer + tattoo-studio have **no owner object**; several niches show owner name only inside the fallback SVG (vanishes when photo uploads) |
| owner photo | 14/23 | electrician/metal-fab/plumbing have the markup + promise-comment but **no code fills it** |
| **hours** | **0/23** | platform-wide gap, confirmed (bbq's per-stop hours are a different field) |
| **address** | **0/23** | same |
| social | 10/23 render | **electrician + painting have the #footSocial slot but no renderer** — saves vanish |
| reviews | 17/23 | **landscaping — our reference site — never renders testimonials**; content.json lacks the key |
| **job details** | **0/23** | stored-only, deferred by design |
| pricing (operator-editable) | **12/23** | 9 niches use non-tier models (hourly/quote/percentage/calculator) where the operator's price editor is a **silent no-op**; 2 more are broken (below) |
| before/after slots | 2 sliders exist | bin-cleaning (wired to operator slots) + **contracting (reads projects[].beforeImg — operator uploads invisible)** |

### Broken wirings found (live demo bugs, all P0 for Phase B batch 1)
1. **bbq-food-truck pricing**: renderer reads `CONTENT.catering.packages` — key doesn't exist; `#pkgGrid` renders empty.
2. **car-detailing pricing**: renderer reads `c.packages` — doesn't exist; `#packageGrid` empty.
3. **dj**: `brand.name` missing from content.json → "Your Name" overwrites DJ Nova sitewide; **`sites/dj/` ships no content.json** (theme variants instead) → operator-content endpoint would 503 `defaults_unavailable` for any dj tenant.
4. **contracting**: brand.name unhookable (see above).
5. **landscaping reviews**: static empty cards, no renderer, no content key — operator reviews invisible on the flagship.

## Proposed rollout order

**Phase A additions surfaced by this audit** (beyond the brief's A1–A4):
- The manifest must declare a **pricing model** per niche (`tiers | hourly | quote | percentage | calculator | flash`) and the admin's Pricing section must adapt — 11 of 23 niches otherwise keep a price editor that silently does nothing. This is the single biggest generalization gap found.
- The manifest must declare the **owner-block shape** (some niches have no owner object) and the **before/after target** (single pair vs. contracting's projects[]).
- A **shared social renderer** and the shared footer close social/hours/address in one component, as planned.

**Phase B batches** (parallel-safe after Phase A):
- **B1 — broken-wiring repairs + one-line wins** (bbq, car-detailing, dj, contracting hooks, landscaping reviews, electrician/painting social renderers, 3 dead owner-photo wires, roofing dead hooks, landscaping dead keyframe + season photos). Highest value per hour on the platform; all on already-built sites.
- **B2 — hero promotions** (auto-body, auto-repair, delivery, bbq art): move existing below-fold assets up; minimal new material.
- **B3 — photo heroes, before/after group** (pressure-washing photo-swap into its kept mechanic, car-detailing, painting, contracting): sourced photography, sliders wired to operator slots where the trade is before/after by nature.
- **B4 — photo heroes, remainder** (electrician, hvac, moving, metal-fabrication, tattoo-studio, roofing).
- **KEEP niches** get only manifest + shared components (footer/reviews/job-details), no hero work: bin-cleaning, landscaping, dj (after B1 repair), dog-walking, dumpster-rental, child-care, caregiving, personal-trainer (+IO stop), plumbing.

**Phase C order:** estate-sale first (richest material by far: photos, marketing kit, pricing data — and it validates the percentage/commission pricing model the manifest must support), then garage-sale, then consignment (**new find — needs Jason's confirmation it belongs in the catalog**).

**Marketing kit (A3) note:** the platform's own `systems-by-vega-facebook-v2-source.html` + flyer source confirm the HTML-source→PNG pattern at platform level; Prime's pair is the niche-level reference as briefed.

## Questions for Jason at this checkpoint
1. **Consignment**: in scope as a third new niche, or defer? (ConsignmentBiz exists as a separate product at consignmentbiz.com — adding it to this catalog may or may not be wanted.)
2. **dj photo gallery**: the domvegz gallery is presumably Dominic's real photos — authorized for the dj demo niche the way Prime's were, or keep dj fictional with stock?
3. Confirm B1 (bug repairs) may ship ahead of the full Phase A manifest work — they're independent fixes to live demos.
