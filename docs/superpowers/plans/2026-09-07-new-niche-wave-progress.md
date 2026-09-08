# New Niche Wave — Progress Ledger

Brief: SiteLab New Niche Wave (2026-09-07). Prior platform-completion brief's
rules/autonomy carry forward.

- DOG-SITTER OVERLAP CHECK (brief §6): SKIPPED per the brief's own rule.
  dog-walking already covers sitting/boarding as a first-class service:
  "Overnight sitting — from $85 / night" priced row, drop-in visits, brand
  "Bluebird & Biscuit Pet Care", SEO "Dog Walking & Pet Sitting", 3
  sections.html mentions. Building a separate dog-sitter niche would compete
  with an existing demo's own offering.
- COUNT DISCREPANCY NOTED: the brief's header says 9 niches, but the
  enumerated list totals 7 (2 consolidated cleaning + window-cleaning,
  mechanic, sprinkler, personal-assistant, dog-sitter). With dog-sitter
  skipped, SIX niches are specified and will be built: residential-cleaning,
  commercial-cleaning, window-cleaning, mechanic, sprinkler,
  personal-assistant. Flagged at the photo checkpoint for Jason to name any
  missing niches.
- Photo proposal being assembled (no downloads to the repo before approval —
  the mandatory checkpoint).
- PHOTO CHECKPOINT REACHED (brief §3/§6). Two scouts searched Pexels/Unsplash,
  downloaded ~45 candidates to scratch (NOTHING in the repo) and visually
  vetted every one at full resolution. Proposal published as an artifact for
  Jason: 6 niches, 12 recommended frames (heroes + 5 before/after pairs),
  alternates, flags, and the rejection list with reasons.
  Rejections included: Rubbermaid/Aramark branding on janitorial carts, a real
  construction firm's full contact details on a paper bag, a mall logo across
  glass, four identifiable faces, a branded sprinkler arm, an Apple logo on the
  hero-candidate laptop.
  Flags carried to Jason: window-cleaning's best hero is credited to a real
  cleaning business (name would appear in CREDITS.md only); commercial pair's
  before frame has a legible Post-it (croppable); mechanic + sprinkler pairs
  are matched-material, not same-subject (the pressure-washing precedent).
- Stripe question resolved in advance (see plan) so §4 can proceed without a
  stop condition once photos are approved.
- AWAITING: photo approval, plus answers on the dog-sitter skip and the
  9-vs-7 niche count. No repo files written for any new niche yet.

- PHOTOS APPROVED (no swaps). All 16 approved frames cropped to house
  standards and committed with per-niche CREDITS.md. Two deliberate crops:
  the commercial "before" taken from x=1250 of the 6000px original to drop a
  legible Post-it, and the window "after" left-anchored so the worker's head
  leaves frame. Caught mid-crop that the resolver was preferring 1100px
  previews over full-res originals for five images and silently upscaling —
  fixed, everything regenerated from full resolution.
- SIX NICHES BUILT, REVIEWED, FIXED, LIVE. Yarrow & Broom Cleaning Co.
  (Mountain Home), Keyholder Facility Care (Idaho Falls), Pane & Prairie
  Window Co. (Post Falls), Gravel & Gasket Mobile Mechanic (Payette),
  Riserline Irrigation Co. (Fruitland), Wrenfield & Co. (Hailey). Every brand
  web-checked; earlier candidates dropped on real-world collisions. dog-sitter
  SKIPPED — dog-walking already sells overnight sitting as a priced service.
- Three reviews ran on the most capable model (two per-niche, one
  cross-cutting). They independently caught a blocking defect in a feature I
  had added mid-wave: the marketing kit's unit suffix was appended to whichever
  price row was cheapest without checking that row still carried the unit, so
  an operator deleting a per-unit row would print a false unit on their flyer.
  Gated, then re-reviewed, which found my gate's substring match still let
  "/four hours" satisfy "/hour" — now matched as whole words. Also fixed:
  residential-cleaning was claiming a clean its photos do not show; window-
  cleaning was silently discarding an operator's saved hours and address.
- SCOPE EXPANDED DELIBERATELY: nine EXISTING niches were advertising "Most
  booked"/"Most popular" on fictional businesses with no customers. All now
  read "Our pick".
- CATALOG WAVE COMPLETE AND LIVE (sql/CATALOG-WAVE.sql applied to
  SystemsByVega, verify rows all true). 31 niches are now claimable — the six
  new ones plus estate-sale and garage-sale, which you approved exposing. NO
  Stripe work was needed: prices are per-tier from the environment, so
  exposing a niche creates no Stripe object and changes no price.
- The three real businesses were renamed in the catalog to EstateSaleBiz,
  GarageSaleBiz and ConsignmentBiz. Two cards called "Estate Sales" in one
  family would have been unreadable. Their open-today cards and the homepage's
  "Three are open today" proof line are untouched and verified live.
- ESB/GSB/CSB also get their own band below the board, outside the generator's
  markers so a catalog rebuild cannot overwrite it — proven by running the
  real generator and confirming it survives.
- FOR YOUR EYE, nothing blocking: the six new accents all landed in the
  green-to-cyan wedge (a cross-cutting reviewer measured it), and
  residential-cleaning's green is very close to moving's. Cosmetic only —
  catalog cards do not use the accent. Two hex edits would break it up if you
  want more spread across the portfolio.
- BACKLOG, measured: 22 of 31 niche accents fail 4.5:1 as admin link text
  (20 of them pre-date this wave) — the admin should derive a readable link
  colour rather than using the raw theme accent; 15 niches never render the
  public email the admin offers; 18 ship no favicon, which qa already flags.
