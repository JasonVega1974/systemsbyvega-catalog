slug:            residential-cleaning
business:        Yarrow & Broom Cleaning Co. (fictional — new-niche wave, Task N)
tagline:         A house that feels like a fresh start.
city:            Mountain Home, ID — brand.city carries the combined
                 "City, ST" string (the majority shape; estate-sale's split
                 city/state is the one-off, not the pattern)
owner:           Nell Prescott (invented; no collision with any sibling owner)
phone:           (208) 555-0224 — reserved fictional range, unique in repo
palette:         LIGHT GROUND — "line-dry morning", deliberately the opposite
                 of estate-sale's dusk: sunwashed mint-white ground #F2FAF6,
                 white surface, mint panel #E7F6EE, deep spring-green accent
                 #08694A / #0B855B, citrus #F2A007 as the energy colour,
                 near-black-green ink #10251D.
                 Contrast (WCAG, computed): onAccent #FFFFFF on accent 6.71:1
                 and on accentBright 4.65:1 — both clear 4.5:1, which is what
                 the admin wears. Also: ink on ground 15.16:1, textSoft on
                 ground 5.61:1 and on card 5.33:1, accent as TEXT on ground
                 6.32:1 / on card 6.01:1 (the admin uses --adm-accent for
                 links, so it had to read as body text too), bad on ground
                 5.00:1.
                 Why a dark onAccent was rejected: white-on-green forces both
                 accents below 0.184 relative luminance, which is exactly what
                 also makes the accent legible as link text on a light card.
                 A bright-mint accent with dark onAccent would have passed the
                 stated gate and failed the admin's link contrast.
type:            Outfit (display) / Manrope (body) / Space Mono (label)
price anchors:   TIERS MODEL — pricing is the display-string ARRAY,
                 {label, blurb, per, note, highlight, features} where **blurb
                 IS the price display string** (that is where
                 ARRAY_FIELD_MAPS.pricing lands an operator's admin
                 price_label). Four rows: Standard Clean $149 per visit /
                 First Deep Clean $289 one-time / Every Other Week $129 per
                 visit (highlight) / Move-In · Move-Out "Flat quote" after a
                 walkthrough. No numeric `price` keys at all, so nothing can
                 render a $0; seo.priceRange "$129–$289" is the honest span
                 and is printed in visible copy.
                 The tier card RENDERS p.note and hides it when empty — the
                 admin's tiers editor offers that field and ten existing
                 niches drop it on the floor (known platform defect). This
                 niche does not add an eleventh.
differentiators: flat per-visit price agreed at a free walkthrough, the same
                 crew on the same weekday, a household-written checklist that
                 gets adjusted after each visit, no contract; deep clean
                 required only ahead of a recurring plan, and said so plainly
tone:            plain, unhurried, slightly wry — "one evening a week back"
scene:           7 inline defs (leaf marks, broom + bristle gradients, two
                 flourishes) plus the shared suds radial in scene.svg; every
                 id yb- prefixed
animation:       REAL, in CSS (D-S) — yb-rise (soap bubbles drifting up the
                 hero), yb-glowpulse (daylight bloom behind the photo plate),
                 yb-sheen-run (a slow light sweep across the frame). Unique
                 names and selectors; transform and opacity only; neutralised
                 by the prefers-reduced-motion block at the foot of
                 sections.css and by base.css's global override
interactive:     the tier picker — pills built from the SAME pricing array as
                 the cards, click drives renderPrice(i), which updates the
                 live readout and the picked-card outline. It only ever
                 repeats values already present in pricing[], so it cannot
                 invent a figure, and it never assumes a row count (the
                 operator's saved array is length-authoritative)
components:      hero-photo (heroDefault photos/hero-mopping.jpg, heroWired
                 true, credit Tima Miroshnichenko / Pexels), before-after
                 (merge "niche.beforeImg/afterImg", photos before-clutter.jpg
                 + after-tidy.jpg, credit Ron Lach / Pexels), job-details,
                 reviews (honest empty state — testimonials ship []),
                 footer-contact (hours only; no street address is invented) —
                 all via manifest flags + slot comments, no inline copies
light-scheme
note:            _template/base.css was authored for a dark ground and carries
                 literal dark rgba() values (page backdrop, nav scrim, form
                 wells, sticky bar, the select chevron data-URI, the date
                 input's color-scheme). sections.css re-points every one of
                 them; nothing structural is changed. Component CSS is
                 appended AFTER sections.css by build-site.js, so component
                 overrides here wear an extra ancestor class
                 (.hero__frame .hero-photo-cmp, .results .ba-cmp) to win on
                 specificity rather than on order.
