# SiteLab Platform Completion — progress ledger

Brief: docs/superpowers/briefs/2026-09-06-sitelab-platform-completion-brief.md
Rule: append after every task — what shipped, rulings made, what's blocked.

## Phase 0 — inventory (read-only)

- 2026-09-06: Phase 0 started. Three parallel read-only investigators dispatched:
  (1) content-folder inventory of Desktop\Jason\site labs\ + adjacent folders,
  diffed against repo niches/; (2) hero/animation audit, niches A–D batch;
  (3) hero audit E–T batch + the 23-niche field-coverage matrix.
- Checkpoint ahead: the inventory report is the ONE mandatory stop — no Phase A
  work before Jason reviews it.
- Content inventory DONE. Highlights: real path is Desktop\Jason\SiteLab\SiteLab\
  (brief's "site labs" doesn't exist); 5 SiteLab site repos map to existing
  niches (metal-fab, bbq, dumpster, tattoo, contracting) but carry COPY ONLY —
  zero image assets on disk; NEW NICHE CANDIDATES: estate-sale (rich: 12 images,
  marketing kit, training assets), garage-sale (thin photos, signs/marketing),
  consignment (Desktop\ConsignmentBiz — unexpected third find); DJ has a large
  real gallery at Desktop\GitHub Clone\domvegz\; 15 of 23 repo niches have no
  external content folder; NO matched before/after photo pair exists anywhere
  except bin-cleaning's repo photos — every before/after hero needs sourced
  photography. Platform-level marketing sources exist (systems-by-vega FB +
  flyer source HTML) — good templates for the A3 kit generator.
- Hero audit batch 1 (12 niches) DONE. KEEP: bin-cleaning (ref), dumpster-rental
  (2nd ref-quality illo + cleanest scene.js contract), dj (canvas visualiser,
  untouchable), dog-walking (physics park scene), child-care, caregiving.
  FIX: car-detailing (Jason's flag CONFIRMED — flat teal outline car, float+halo
  amplifies it; hotspot diagram depends on a matching 2nd car SVG), auto-body,
  auto-repair, bbq-food-truck, delivery (all four have NO hero art but strong
  assets below the fold — promote, don't invent), contracting (logo-as-hero).
  REMOVE: none; all reduce-safe. Declared scene.js Phase-3 gaps: auto-body,
  bbq, car-detailing, caregiving(arguably satisfied). Interactive features to
  preserve everywhere (sliders, sound picker, zone quoter, price picker).
- Hero audit batch 2 + field-coverage matrix DONE. Major finds: hours/address/
  job-details render 0/23 (confirmed); operator price editor is a SILENT NO-OP
  on 11 of 23 niches (9 non-tier pricing models + 2 broken renderers); 5 broken
  wirings on live demos (bbq + car-detailing pricing read nonexistent keys, dj
  brand.name broken + sites/dj has no content.json -> endpoint 503, contracting
  brand unhookable, landscaping reviews invisible); contracting has a SECOND
  before/after slider (brief said only bin-cleaning); 2 dead footSocial slots.
- Phase 0 report written: docs/superpowers/specs/2026-09-06-platform-inventory.md
  (3 tables, rollout order B1-B4 + C order, Phase-A additions: per-niche pricing
  MODEL in manifest is the biggest generalization gap). STOPPED at the mandatory
  checkpoint with 3 questions for Jason (consignment scope, dj gallery
  authorization, B1-ahead-of-A permission).
- CHECKPOINT ANSWERED by Jason: (1) consignment DEFERRED — new niches are
  estate-sale + garage-sale only; (2) dj stays FICTIONAL with stock — domvegz
  gallery must NOT be used; (3) B1 ships ahead of Phase A; per-niche pricing
  models are a first-class Phase A requirement.
- B1 starting. Scope (from inventory): [A] bbq + car-detailing pricing-renderer
  fixes, dj repair (brand.name + sites/dj content.json 503); [B] social
  renderers (electrician, painting) + dead owner-photo wires (electrician,
  metal-fab, plumbing) + painting source typo; [C] landscaping (reviews render,
  season photos, dead float keyframe), roofing dead animation hooks strip,
  personal-trainer rAF self-termination. Deferred to Phase B proper:
  owner-name-in-SVG-caption issue, missing owner objects (PT/tattoo),
  contracting brand hooks (touches many strings — fold into its B3 slot? NO —
  it IS B1; assigned to batch A).
  Ruling: 3 parallel implementers on DISJOINT niche sets; they do NOT commit —
  controller commits once after cross-verification (parallel git racing).
- B1-C DONE: landscaping reviews render (textContent, empty per compliance) +
  season photos wired (pruning->spring, mowing->summer — judgment call, flag
  for Jason's eye) + dead float keyframe removed; roofing 4 dead hooks + false
  comment + 2 inert opacity-0 targets stripped (art untouched); PT spark loop
  IO-gated + dead .portrait__wash CSS removed. qa-site 0 new failures across
  all 3. Awaiting A and B.
- B1-B DONE: footSocial renderers ported (scheme-gated, both spans upgraded to
  hidden pattern) electrician+painting; owner-photo wires live in electrician,
  metal-fab, plumbing (safeUrl+esc, fallbacks byte-identical); painting typo
  fixed. qa-site 0 failures before AND after all four. Deferred note: painting's
  PRE-EXISTING owner-photo code lacks safeUrl/esc — for B1 review to weigh.
  Awaiting A (bbq/car-detailing pricing, dj, contracting).
- B1-A DONE (pricing repoints provably correct — surrounding code already spoke
  the pricing schema; dj brand.name + root content.json artifact, documented
  hand-copy limitation; contracting 4 brand hooks, defaults byte-preserved).
- B1 WAVE REVIEW (opus): FIX FIRST -> 1 MEDIUM fixed (landscaping review__who
  fallback '' erased the demo placeholder — reviewer-prescribed electrician
  pattern applied by controller, rebuilt, 4 occurrences in built output;
  Ruling: controller applied the reviewer's own verbatim line, deviation from
  dispatch-a-fixer ledgered). LOW notes deferred: roofing orphaned sky-boltglow
  filter + bare <g> (strip on next touch); dj NICHE content.json still lacks
  owner/seo fields the shipped root artifact has — a future build-tool root
  emit would REGRESS dj unless niche source is filled first (Phase A note);
  three-escaping-patterns-for-one-sink -> Phase A shared-component cleanup.
  Weigh items: painting owner-photo note = FALSE POSITIVE (DOM-property
  assignment is stricter than innerHTML; reverse-convert new wires in Phase A);
  season photos KEEP as shipped (mowing->Summer unambiguous, pruning->Spring
  best available; shown to Jason here rather than blocking). Adjacent note:
  stock photos framed as the fictional company's own work now on 3 slots.
- B1 pushed after review + fix.
