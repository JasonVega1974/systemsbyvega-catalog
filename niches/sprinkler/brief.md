slug:            sprinkler
business:        Riserline Irrigation Co. (fictional — new-niche wave, Task N)
                 Name checked by web search against "irrigation"/"sprinkler":
                 no business found under Riserline / Riser Line Irrigation;
                 root-unique against all sibling niche brands (no reuse of
                 Ironwood, Rimrock, Cinder, Prime, Kestrel, Hearth, Huckleberry,
                 Summit, Swiftwater, Nova, Bluebird, Sawtooth, Voltridge,
                 Magpie, Sunup, Whitecloud, Larkspur, Anvil, Osprey,
                 Bristlecone, Vale, Cascade, Grit, Storm Ridge, Static Rose).
                 Rejected on the way: Zonewright (real welding co.), Headgate
                 (an Idaho Water Users leadership academy), Truevalve (reads as
                 True Value), Clearvane (the "Clear-" register is crowded with
                 real irrigation firms).
tagline:         Built zone by zone. Tuned head by head.
city:            Fruitland, ID — brand.city is the COMBINED "City, ST" string
                 (the normal shape; estate-sale's split city/state is the one
                 exception in the estate)
phone:           (208) 555-0269 — reserved fictional range, unused elsewhere
palette:         DARK GROUND — "first light on the valve box": pre-dawn
                 slate-teal ground #081419, instrument-green accent #2FB37A /
                 #4FD79A, water cyan #57C7D9 reserved for schematic linework
                 and spray, ink #EAF4F1. Green is the OUTPUT of the system,
                 not a lawn-care signature; the layout voice is a controller
                 faceplate. Contrast (computed, sRGB relative luminance):
                 onAccent #03150C on accent 7.03:1 and on accentBright
                 10.32:1 — both clear 4.5:1, which is what the admin wears.
                 Also: ink on ground 16.64:1, ink-dim 10.58:1, muted 7.02:1,
                 muted on panel-2 5.90:1, accent on ground 6.98:1.
type:            Archivo / Instrument Sans / Azeret Mono — none of the three
                 appears in any sibling niche's font stack
price anchors:   QUOTE MODEL — pricing is a root OBJECT
                 {starting_at "$95", note}. Both keys are the admin's quote
                 editor fields (PRICE_MODEL_FIELDS.quote) and both render:
                 starting_at as the repair-visit figure, note as the
                 fee-structure sentence beneath the card. note is 117 chars,
                 inside sbv_prices_valid's 120-char object-form cap, so an
                 operator's own re-save of the same wording is accepted.
                 Hourly repair pricing is described in COPY (the repair column
                 and repairsNote), never shipped as a second model — the admin
                 can represent one model per niche.
                 The install panel deliberately carries NO figure: a quote
                 niche has none to carry.
differentiators: irrigation ENGINEERING, not lawn care — static pressure and
                 bucket-timed flow read at the meter before a zone is drawn;
                 zones grouped by holdable pressure; valve boxes that open
                 from the surface; wire tagged at both ends; a marked as-built
                 photographed trench-open; the three-visit irrigation year
                 (spring start-up, mid-season tune, fall blow-out); backflow
                 assembly service with the district test left to the
                 purveyor's own tester
tone:            measured, diagnostic, plain — a trade that traces faults
scene:           10 inline illustration defs (two brand monograms, the spray
                 gradient, a droplet glow, two section rules, the valve rule),
                 all sp- prefixed; scene.svg is a placeholder
animation:       REAL, in CSS (D-S) — sp-sweep (the rotor arc oscillating over
                 the hero photo), sp-mist (first-light droplets lifting up
                 through the hero), sp-cycle (a four-zone controller strip
                 stepping one zone at a time). Unique names and selectors;
                 transform and opacity only; neutralised by the
                 prefers-reduced-motion block at the foot of sections.css and
                 again by base.css's global override
interactive:     the scope builder (#plannerCard, updateQuote) — three
                 pickers that compose a plain-language summary of what a walk
                 would be looking at and write it into the lead. It prices
                 NOTHING: the only figure on the page is the operator's own
                 pricing.starting_at
before/after:    YES — the shared component via manifest sections.beforeAfter
                 + merge.beforeAfter "niche.beforeImg/afterImg", fed by
                 niche.beforeImg / niche.afterImg (the same keys an operator's
                 uploads land on). The shipped pair is LANDSCAPE 1500x1000, so
                 sections.css re-proportions the component's 581:376 frame to
                 3:2 and switches it to cover; the overrides sit one level
                 deeper (.sp-ba wrapper) because build-site.js appends
                 component CSS after the niche's own.
                 HONESTY: the pair is two DIFFERENT Payette Valley lawns, a
                 matched-material sample. The section note and the footer
                 disclosure both say so in plain words; no copy anywhere
                 claims one yard before and after our work.
claims:          zero income claims — no water-savings percentage, no bill
                 reduction, no "cuts your usage" of any kind; those are
                 performance claims and are banned. Zero fabricated proof:
                 testimonials ship [] and the reviews component renders its
                 honest empty state. No credential language (nothing
                 licensed/insured/certified), no track-record numbers.
components:      hero-photo (heroDefault photos/hero-spray-head.jpg, credit
                 Qhung999 / Pexels), before-after, job-details, reviews,
                 footer-contact — all via manifest flags + slot comments, no
                 inline copies. contact.hours feeds footer-contact; social
                 ships [] so that line renders nothing at all.
