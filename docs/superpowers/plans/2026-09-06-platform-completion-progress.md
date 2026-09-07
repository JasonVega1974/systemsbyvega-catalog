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
- Phase A spec written (docs/superpowers/specs/2026-09-06-phase-a-platform-
  generalization.md). Rulings under brief SS7 (the three open questions +
  pricing): manifest schema v1 with built manifests index consumed by admin +
  endpoint; pricing.model enum (tiers/hourly/quote/percentage/calculator/
  flash/none) drives admin editor + merge + render — kills the 11-niche silent
  no-op; marketing kit = serverless playwright-core + @sparticuz/chromium +
  qrcode, per-niche HTML templates, on-demand render to bucket, admin Marketing
  tab with client-side preview; shared components use DOM-property escaping
  standard; Phase B parallelism = B1-proven no-commit wave shape. noindex rule:
  X-Robots-Tag from middleware when operator row exists. Costs if wrong:
  serverless-chromium weight (fallback documented), pricing validator loosening
  (plan carries exact SQL). Next: Phase A implementation plan, then SDD.
- PHASE A-CORE COMPLETE AND PUSHED (949c66d..413d939, 12 commits; SQL applied
  live before push: PRICING-MODELS.sql 8/8 verify, HERO-SLOT.sql 3/3,
  HAS-CONTENT.sql smoked primetest->true/startest->false as anon). Delivered:
  23 validated manifests + built index (single-writer tool); admin fully
  manifest-driven (theme, photo zones from photoSlots, sections gating, 7
  pricing-model editors incl. hidden/caption for none); endpoint manifest-
  driven merge (field maps both dialects, contracting projects[0], legacy
  path byte-identical); 5 shared components (DOM-property escaping) wired in
  bin-cleaning + landscaping; qa-site realBrand allowlist (bin-cleaning green
  first time); X-Robots-Tag live-verified post-deploy (primetest all,
  startest noindex; likely inert vs baked meta noindex until Phase B —
  ticketed). Final review (opus) FIX FIRST -> 8 findings fixed + re-review
  clean; blocking one was controller's own stale index (single-writer rule
  broken by its writer — rebuilt, now verified byte-stable).
- Phase A-core rulings needing Jason's eyeball (none blocking): roofing admin
  onAccent flipped to black + accent nudged, dog-walking onAccent -> dark navy
  (largest admin-theme visual swaps); demo jobDetails uses generic scope copy.
- Phase A-core residuals ticketed to Phase B/C: dumpster + dog-walking
  (calculator) and child-care (hourly) pricing editors still partially/fully
  no-op until those niches' Phase B key reconciliation (captions are honest
  about it); hero photo uploads saved + served but no template renders
  niche.heroImg until Phase B wires the hero-photo component; percentage
  model unverifiable until estate-sale (Phase C); electrician/auto-repair/
  hvac/contracting demo-side content mismatches (pre-existing, grep-found).
- Next: Phase A-kit plan (marketing kit pipeline), then Phase B rollout waves.
- PHASE A-KIT COMPLETE AND LIVE (6ece36d..HEAD). Marketing kit shipping for
  all 23 niches: shared master templates (manifest-themed, spec refined from
  46 bespoke files) + per-niche override path (bin-cleaning ships the
  Prime-derived pair; Prime's finished pieces landed as reference);
  api/marketing-kit.mjs (JWT->mapping gate, active-tenant only, manifest
  token build across all 7 pricing models, QR, chromium render, stable-name
  bucket uploads); admin Marketing tab (live scaled previews from the same
  merged answer the download uses — 27-assertion parity proof — plus
  honest failure surfaces). SQL applied live: MARKETING-BUCKET.sql
  (bucket +application/pdf, 10MB — additive).
- Live-verified end to end in the browser: startest (master templates,
  landscaping theme, defaults-only) AND primetest (bin-cleaning override,
  operator's saved data) both generate 3 real files (PNG 1080x1350, Letter
  PDF, flyer PNG) — downloaded, structurally verified, eyeballed: fonts,
  themes, working QR codes, zero unresolved tokens, compliance-clean copy.
- Hard-won runtime finding (ledgered in detail): playwright's newPage
  (incognito context) kills the sparticuz chromium binary on Vercel in
  every args permutation — launchPersistentContext (default profile) is
  the fix; playwright-core pinned 1.61.0 to match the Chromium 149 binary.
  The final review's arg-filter prescription was reversed on live evidence.
- Phase B pickup list additions: phone prettifying in kit tokens; per-niche
  template overrides where a niche deserves bespoke art; rate-limit /
  cooldown on the render endpoint (accepted residual).
- PHASE B COMPLETE AND LIVE (5efee85..4255d80, 8 commits). Every niche's demo
  at launch quality: B0 infra (robots via host-conditioned headers — tenant
  X-Robots-Tag:all now EFFECTIVE, meta noindex retired platform-wide; hero
  uploads render on wired niches with parse-time src/alt + heroWired admin
  honesty + a build gate that fails on a heroWired lie; kit phone
  prettifying); W2 hero promotions (auto-body reveal slider, auto-repair
  garage bay, delivery zone-map quoter, bbq smoker photo); W3 before/after
  photo group (pressure-washing wand now erases real pavers; car-detailing/
  painting/contracting photo heroes; contracting operator before/after
  upload chain closed end-to-end at the endpoint); W4a photo-hero remainder
  (electrician/hvac/moving/metal-fab/tattoo/roofing) with electrician+hvac
  pricing landed on operator-reachable keys; W4b KEEP rollout (footer
  hours/address everywhere, job-details/reviews where flagged, dog-walking/
  dumpster/child-care calculator+hourly reconciliation with picker-math
  proof, plumbing drip, PT rAF stop). B-final opus gate then caught 4 [H]
  broken demo price sections (painting/plumbing/roofing/pressure-washing
  reading keys their rows never carried) — the whole tiers class is now on
  one label/blurb/per/highlight display-string contract, car-detailing's
  kit headline un-broken, K/M suffix math fixed (contracting flyer was 5x
  overstated), before/after zones honest, PRICE_ROWS 6.
- FOR JASON'S EYEBALL (photo table, all Pexels-credited, ship+flag per B1
  precedent): bbq smoker (pass); pw dirty/clean paver pair (disclosed
  matched-pair, not same-surface); car-detailing polisher-on-hood (pass);
  painting roller (pass); contracting framing + fence before/after (after
  retagged "Restained cedar, a season in" for photo-honesty); hvac mini-
  split bedroom (pass); moving boxes (pass); metal-fab weld sparks (pass);
  tattoo machines still-life (pass); roofing storm roof (pass);
  ELECTRICIAN FLAGGED: masked side-profile at a breaker panel — possibly
  identifiable person; say the word and it's swapped in minutes.
- Accepted residuals (ledgered): tenant-host direct /sites/ URLs carry no
  robots signal (unlinked duplicates; header-merge precedence untested);
  dog-walking week-builder matrix demo-managed (caption scoped truthfully);
  plumbing hero-photo unwired pending a designed placement; 27-char blurb
  vs 20-char operator cap edge.
- Next: Phase C (estate-sale — validates percentage pricing — then
  garage-sale), Phase D turnkey verification table, final platform review.
