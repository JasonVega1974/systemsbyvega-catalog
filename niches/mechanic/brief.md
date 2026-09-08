slug:            mechanic
business:        Gravel & Gasket Mobile Mechanic (fictional — New Niche Wave, Task N)
tagline:         The shop comes to your driveway.
city:            Payette, ID — brand.city is the COMBINED "City, ST" string
                 (estate-sale is the only niche that splits city/state)
positioning:     MOBILE mechanic — the shop drives to the vehicle. Driveway,
                 apartment lot, jobsite, work parking space. Deliberately
                 disjoint from the two auto siblings already in the catalog:
                 auto-repair is the bricks-and-mortar shop (Rimrock Garage,
                 Parma) and auto-body is collision work (Ironwood Collision,
                 Emmett). Hero kicker, h1, sub, trust strip and every service
                 line put "we come to you" on the first screen; the copy also
                 says out loud what is NOT a driveway job (lift, alignment
                 rack, paint booth, transmission) and sends it elsewhere.
name check:      Root words Gravel and Gasket are unused across all 25 sibling
                 content.json brand names (and share no root with Rimrock,
                 Garage, Ironwood or Collision). Web-searched
                 "Gravel & Gasket"/"Gravel and Gasket" + mobile mechanic on
                 2026-09-08: no business of that name found; the near hit was
                 an unrelated, closed "The Leaky Gasket" in Kansas City. The
                 obvious alternative ("Torque ...") was searched first and
                 rejected — Torque Mobile Mechanic, Torque Mobile Services,
                 Pro Torque Mobile Repair and Torque Spec Mobile are all real
                 trading names in this exact trade.
phone:           (208) 555-0258 — verified unused across niches/*/content.json
palette:         DARK GROUND — "shop floor at the curb": graphite ground
                 #0D1110, diagnostic go-green accent #2FA85D / #4ACC7C, hazard
                 amber #E2A02A used only for the warning voice (tier notes,
                 before/after disclosure, the beacon and the chevron rail).
                 Green is unclaimed as a primary accent across the estate, and
                 is a deliberate step away from auto-repair (cream + red) and
                 auto-body (plum + magenta).
                 Contrast, computed: onAccent #05170C on accent 6.07:1, on
                 accentBright 9.01:1, on accent-alt 8.19:1; ink on ground
                 16.97:1, on panel 15.17:1, on panel-2 13.36:1; ink-dim on
                 ground 10.30:1; muted on ground 6.29:1 and 4.95:1 on panel-2;
                 accent on ground 6.23:1, accentBright on panel-2 7.28:1.
                 Every pair the admin and the page use clears 4.5:1.
type:            Archivo Black / Barlow / Space Mono. base.css hardcodes
                 'Anybody' and 'IBM Plex Mono' in ~20 structural rules; neither
                 is loaded here, so sections.css re-points every one of those
                 selectors at --display / --mono rather than letting them fall
                 back silently.
price anchors:   TIERS model — seven flat-rate common services (oil & filter,
                 brake pads & rotors, battery, starter/alternator, serpentine
                 belt, scan-tool diagnostic, and an honest "not on this list"
                 row that quotes by text). Every row uses the platform display
                 string contract {label, blurb, per, highlight, features,
                 note}, where blurb IS the price display string — that is where
                 ARRAY_FIELD_MAPS.pricing lands an operator's price_label.
                 No numeric price/priceHigh anywhere, so there is no code path
                 that can render a computed $0.
tier note:       The brief called for a note field for custom quotes and this
                 niche RENDERS it — .gg-rate__note on every card, hidden via
                 the `hidden` property when the operator clears it. Ten sibling
                 niches expose the same admin field and read it nowhere; that
                 stops here.
differentiators: the quote line (an interactive picker that loads a tier's own
                 display strings into a live summary row — invents nothing,
                 computes nothing), the "why mobile" panel with its four
                 points, the what-is-NOT-a-driveway-job honesty, and the
                 workplace / multi-vehicle route stop
tone:            competent, unfussy, small-town. Talks like somebody standing
                 in your driveway with a torque wrench, not a service writer.
scene:           8 inline SVG defs (hex-socket brand mark ×2, the socket ring,
                 its green halo, the beacon cone and lamp), all gg- prefixed;
                 scene.svg is a placeholder and scene.js is the matching stub
animation:       REAL, in CSS (D-S) — gg-spin (the socket ring turning slowly
                 behind the hero photo), gg-sweep (the amber beacon breathing)
                 and gg-roll (hazard chevrons rolling along the shoulder rail
                 under the hero). Unique names and selectors; transform and
                 opacity only; neutralised by a local prefers-reduced-motion
                 block and again by base.css's global override
interactive:     the flat-rate quote line — click or keyboard-activate any tier
                 to load its label, blurb, per and note into a live aria-live
                 summary. Delegated on #priceGrid so it survives the re-render
                 that follows the content.json fetch. §9.3's interactive-pricing
                 check passes on this
before/after:    YES, per bin-cleaning canon — the shared component slot with
                 manifest merge.beforeAfter "niche.beforeImg/afterImg" feeding
                 niche.beforeImg / niche.afterImg. The two frames are DIFFERENT
                 VEHICLES (a matched-material pair, recorded in
                 photos/CREDITS.md), so the surrounding copy says so in a
                 hazard-amber note rather than implying one car
photos:          hero-engine-hands.jpg (hero, Lumierestudiomx / Pexels),
                 before-rusted-hub.jpg (UsbofPhotography / Pexels),
                 after-new-rotor.jpg (Svjae / Pexels). Approved and cropped
                 upstream; photos/CREDITS.md is authoritative and untouched
components:      hero-photo (heroDefault photos/hero-engine-hands.jpg,
                 heroWired true), before-after, reviews (honest empty state —
                 testimonials ships []), footer-contact (hours only; a mobile
                 business has no shop address, so contact.address is absent
                 rather than invented) — all via manifest flags + slot
                 comments, no inline copies
