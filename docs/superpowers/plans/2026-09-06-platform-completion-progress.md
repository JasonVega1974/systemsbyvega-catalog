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
