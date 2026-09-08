slug:            window-cleaning
business:        Pane & Prairie Window Co. (fictional — New Niche Wave, Task N)
tagline:         Glass you forget is there.
city:            Post Falls, ID — brand.city carries the combined "City, ST"
                 string (the shape api/operator-content.mjs writes); no split
                 state field on this niche
phone:           (208) 555-0247 (reserved fictional range, unused elsewhere)
owner:           Delia Rhoades (fictional)
brand check:     "Pane" and "Prairie" are root-unique against every existing
                 niche brand (grepped "name" across niches/*/content.json).
                 Web-searched for real-world collisions: no business trading as
                 "Pane & Prairie" anywhere in the results, including a targeted
                 Post Falls / North Idaho search. Two earlier candidates were
                 DROPPED on that check — "Selkirk" (Selkirk Cleaning LLC,
                 Sandpoint ID; Selkirk Glass & Cabinets, Sandpoint ID) and
                 "Northlight" (North Light Cleaning Service). "Prairie" is the
                 Rathdrum Prairie the town sits on; "Pane" is the trade.
palette:         LIGHT GROUND — "daylight through clean glass": high-key cool
                 ground #F3F9FB, near-white sky #FCFEFF, clear-water cyan
                 accent #22ACC4 / #5FD2E4, deep slate-teal ink #16272E, and a
                 sparing squeegee brass #96690F lifted from the hero photo.
                 Deliberately the high-key sibling of the darker trade sites;
                 the whole page is white space standing in for light.
                 Contrast (WCAG, computed): onAccent #04262C on accent 5.89:1,
                 on accentBright 8.97:1, on accent-deep 4.60:1; ink on ground
                 14.48:1 and on the white card 15.40:1; ink-dim on ground
                 7.16:1; muted on ground 5.15:1 and on panel 4.81:1;
                 accent-text on ground 5.72:1; accent-alt on ground 4.57:1
type:            Epilogue / Figtree / DM Mono — all three unused elsewhere in the
                 estate, all three requested by seo.fontsHref
price anchors:   TIERS MODEL, display-string contract. pricing is the root
                 ARRAY; each row is {label, blurb, per, note, highlight,
                 features} and **blurb is the price display string** — where
                 ARRAY_FIELD_MAPS.pricing lands an operator's price_label.
                 Rows: up to 15 panes $149 · 16 to 30 panes $249 (highlight) ·
                 31 to 50 panes $379 · over 50 panes and storefront glass
                 $6.50 per pane. Fee-structure language only: what the number
                 covers, what is quoted separately, and that nothing is owed up
                 front. No income claims anywhere.
p.note:          RENDERED on every tier card (.tier__note), and `hidden` when
                 the operator clears it — the admin offers the field and ten
                 existing niches drop it on the floor; this one does not.
differentiators: the four-surface pass (exterior glass, interior glass,
                 screens, tracks and sills) as the spine of the site; screens
                 numbered as they come out; the low-sun walk-through before
                 payment; a pane-counting rule stated plainly so the flat quote
                 is checkable by the visitor
tone:            plain, unhurried, specific — a trade that gets judged the
                 moment the sun hits the glass
scene:           9 inline defs across sections.html (sash mark ×2, the leaning
                 sash-and-squeegee, two section rules), all wc- prefixed;
                 scene.svg is a placeholder, scene.js a documented stub
animation:       REAL, in CSS (D-S) — wc-sweep (a band of daylight travelling
                 across the hero photo card), wc-shaft (two soft shafts
                 crossing the hero as if through a mullion), wc-bead (water
                 beads running down the leaning sash). Unique names and
                 selectors; transform and opacity only; neutralised by the
                 prefers-reduced-motion block at the foot of sections.css and
                 again by base.css's global block
interactive:     pane-count picker (#counter) — the pills are built FROM
                 c.pricing, and clicking one selects a published tier: it
                 echoes that row's own label/blurb/per into the readout and
                 rings the matching card. It computes nothing, so an operator's
                 saved price_label is the only money on screen. It also syncs
                 the quote form's pane dropdown
components:      hero-photo (heroDefault photos/hero-squeegee.jpg, heroWired
                 true), before-after (FIRST niche on the shared component —
                 manifest merge.beforeAfter "niche.beforeImg/afterImg", fed by
                 c.niche.beforeImg / c.niche.afterImg), reviews (honest empty
                 state, testimonials []), footer-contact (hours only; address
                 and social intentionally absent) — all via manifest flags +
                 slot comments, no inline copies
photos:          hero-squeegee.jpg 1200x1500, before-soaped.jpg /
                 after-clear.jpg 1200x1800 (a genuine same-window pair).
                 Pexels License, credits in photos/CREDITS.md
compliance:      testimonials ship []; no income, volume or credential claims;
                 leadEmail info@kingdom-creatives.com; absolute
                 /sites/window-cleaning/... asset paths; disclosure block names
                 the business as fictional
