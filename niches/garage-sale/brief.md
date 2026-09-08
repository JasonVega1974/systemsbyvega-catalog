slug:            garage-sale
business:        Sunup Garage Sales (fictional — Phase C, Task C5/C6)
tagline:         Your garage back by Sunday night.
city:            Pocatello, ID — NOTE: brand.city and brand.state are SPLIT
                 in content.json (the estate-sale convention, shared only by
                 these two siblings); renderers compose "City, ST"
                 (niche.js locale helper)
palette:         LIGHT GROUND — "sunup on the driveway": cream morning light
                 #FFF6E9, espresso ink #33241A, sunrise orange #EF8A1F /
                 #FFAD42, morning-sky blue #2F6DA8 used sparingly. The
                 bright, simple sibling of estate-sale's parlor at dusk.
                 Contrast: onAccent #2E1503 on accent 6.80:1, on accentBright
                 9.23:1, on accent-deep 5.48:1; ink on ground 13.93:1;
                 ink-dim on ground 7.58:1; muted on ground 5.03:1;
                 accent-text #A8500A on ground 5.14:1
type:            Bricolage Grotesque / Public Sans / system mono
                 (ui-monospace stack — no third webfont loaded on purpose;
                 labels wear the ticket voice at zero cost)
price anchors:   PERCENTAGE MODEL (C5's recorded ruling — the GSB course
                 teaches commission + minimum as THE fee structure of this
                 trade) — pricing OBJECT {commission "40%", minimum "$200",
                 note}; commission rendered BIG on a fluorescent sale
                 sticker, minimum on a kraft price tag. Fee-structure
                 language only; the note is number-free BY DESIGN — the
                 percentage editor exposes only commission+minimum, so the
                 note is permanent copy and must never go stale against
                 operator-edited values
differentiators: free driveway walkthrough, staffed sale day (early birds to
                 close), corner signs + folding tables supplied, cash & card
                 checkout, leftovers hauled or donated, itemized settlement
                 sheet; six prep-tips cards (tables/waist height,
                 street-facing staging, walkway layout, four-word signs,
                 category pricing + bundling, markdown plan)
tone:            bright, friendly, energetic — the neighbor who's good at
                 this; explicit anti-claim in about ("we'll never guess out
                 loud what your sale will bring")
scene:           7 inline defs (rising-sun marks x2, cardboard-sign
                 gradients, flourishes x2, sun-doodle), all gs- prefixed;
                 scene.svg is a placeholder
animation:       REAL, in CSS (D-S) — gs-signsway (cardboard GARAGE SALE
                 sign on twine), gs-sunhalo (sunrise glow breathing behind
                 the hero photo), gs-drift (morning motes). Unique
                 names/selectors; transform and opacity only; neutralised
                 under prefers-reduced-motion both locally and by base.css's
                 global block
interactive:     static fee card — the percentage model has no configurator,
                 so §9.3's interactive-pricing check correctly reports that
                 gap as a warn (same recorded stance as estate-sale).
                 Before/after: none (manifest beforeAfter none)
components:      hero-photo (heroDefault photos/hero-sunup-clocks.jpg,
                 credit Beyzaa Yurtkuran / Pexels), reviews (honest
                 empty-state), footer-contact — all via manifest flags + slot
                 comments, no inline copies. Bonus wiring: niche.contact
                 flattens to c.contact, so footer-contact's hours line
                 renders niche.contact.hours with zero extra code
