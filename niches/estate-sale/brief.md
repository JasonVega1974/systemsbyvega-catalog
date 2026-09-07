slug:            estate-sale
business:        Magpie & Mantel Estate Sales (fictional — Phase C, Task C1/C2)
tagline:         The whole house, handled with care.
city:            Twin Falls, ID — NOTE: brand.city and brand.state are SPLIT
                 in content.json, the only niche that does; renderers compose
                 "City, ST" (niche.js locale helper)
palette:         DARK GROUND — "parlor at dusk": teal-ink ground #0C1614,
                 parchment ink #F2EDE0, brass accent #C89A3F / #E3B95F,
                 estate teal #3FBFA5 used sparingly. Adapted from the
                 EstateSaleBiz demo's teal + brass system, re-tuned dark.
                 Contrast: onAccent #20160A on accent 6.90:1, on accentBright
                 9.63:1; ink on ground 15.75:1; muted on ground 6.71:1
type:            Fraunces / Karla / IBM Plex Mono
price anchors:   PERCENTAGE MODEL (the platform's first) — pricing OBJECT
                 {commission "35%", minimum "$1,500", note}; rendered big in
                 the settlement-sheet fee section. Fee-structure language
                 only, never proceeds promises (claim-prone niche)
differentiators: free walkthrough, itemized settlement sheet, broom-clean
                 handoff, family keeps what matters; the what-sells pricing
                 ledger (12 fictionalized rows grouped by category) with a
                 prominent no-promises disclaimer
tone:            warm, steady, respectful — families call in hard seasons
scene:           7 inline defs (brass monogram seals, key gradients, ledger
                 flourishes), all mm- prefixed; scene.svg is a placeholder
animation:       REAL, in CSS (D-S) — mm-keysway (brass key on its thread),
                 mm-halo (breathing glow behind the hero photo), mm-drift
                 (attic-light dust motes). Unique names/selectors; transform
                 and opacity only; neutralised under prefers-reduced-motion
                 both locally and by base.css's global block
interactive:     static fee sheet — the percentage model has no configurator,
                 so §9.3's interactive-pricing check correctly reports that
                 gap as a warn. Before/after: none (manifest beforeAfter none)
components:      hero-photo (heroDefault photos/hero-heirloom-table.jpg,
                 credit Tima Miroshnichenko / Pexels), reviews (honest
                 empty-state), footer-contact — all via manifest flags + slot
                 comments, no inline copies
