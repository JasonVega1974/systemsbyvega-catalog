slug:            commercial-cleaning
business:        Keyholder Facility Care (fictional — new-niche wave, Task N)
tagline:         Same crew. Every night. On the record.
city:            Idaho Falls, ID — brand.city is a single combined "City, ST"
                 string (the shape operator-content.mjs composes), NOT the
                 split city/state estate-sale uses
phone:           (208) 555-0236 (unused elsewhere in the repo)
owner:           Corinne Ballard (fictional)
brand check:     root "Keyholder" collides with no existing niche brand
                 (grepped brand.name across niches/*/content.json) and is not
                 a cleaning-word pair the residential-cleaning sibling would
                 reach for. Web-searched "Keyholder commercial cleaning
                 janitorial facility services" (2026-09-07): no company of
                 that name; nearest hits are "Key Cleaning Services" and "The
                 Key People", which share only the generic word "key".
palette:         DARK GROUND — "after hours, on the record": cool graphite
                 ground #0E1519, cool paper ink #E8EDF0, muted petrol
                 blue-teal accent #2F9AAC / #45B6C8, steel grey-blue #7C93A6
                 as the secondary hardware colour. Deliberately a different
                 family from the residential-cleaning sibling (corporate
                 graphite rather than its light "line-dry morning" mint) and
                 not the eco-green a cleaning site reaches for by reflex.
                 The accent was moved OFF green late in the build after the
                 parallel siblings landed: sprinkler shipped #081419 + #2FB37A
                 + Archivo and mechanic #0D1110 + #2FA85D, which would have
                 made three near-identical dark-green sites in one wave. The
                 display face moved with it (Archivo -> Manrope) for the same
                 reason.
                 Contrast (WCAG, computed): onAccent #04181C on accent 5.50:1
                 and on accentBright 7.62:1 — both clear 4.5:1, which the
                 admin wears; ink on ground 15.62:1; ink-dim on ground 9.56:1
                 and 7.63:1 on panel-2; muted on ground 6.01:1; accent on
                 ground 5.56:1; accentBright on ground 7.70:1
type:            Manrope / Public Sans / Roboto Mono. base.css hard-codes
                 'Anybody', 'IBM Plex Mono' and 'Inter' family names; this
                 niche uses none of the three, so sections.css re-points every
                 one of those rules at the tokens
price anchors:   TIERS MODEL, B2B framing — per-square-foot monthly contract
                 rates: nightly $0.32, three nights $0.21 (highlight), weekly
                 reset $0.08, plus a "Quoted / after a walkthrough" deep-clean
                 row. Rows follow the display-string contract
                 {label, blurb, per, highlight, features} where BLURB IS THE
                 PRICE DISPLAY STRING — that is where ARRAY_FIELD_MAPS.pricing
                 lands an operator's price_label save. `note` is the third
                 admin-editable field and IS rendered on the card (hidden when
                 empty) rather than ignored. Fee-structure copy only; no
                 income claims anywhere on the page
differentiators: B2B voice throughout — the reader is a facilities manager,
                 not a homeowner. Four written standards (scope, named crew,
                 key log, paperwork-before-signatures), a sector list, an
                 after-hours schedule, and the included/not-included scope
                 block. Staffing is described by PROCESS ("named on the
                 contract", "keys signed in and out each shift") and the
                 paperwork line reframes coverage as something the buyer
                 should ask any company for — no invented credential, licence
                 or certification anywhere
interactive:     square-foot estimator (recalc) — the visitor picks a service
                 level and types their cleanable square footage. Every rate is
                 parsed out of that tier's OWN blurb, so an operator's
                 price_label edit moves the estimate with the card and there is
                 no second copy of the numbers. Tiers whose `per` is not a
                 square-foot rate never enter the picker, a non-numeric blurb
                 is excluded, and the block hides entirely when no row
                 qualifies — no $0 path
scene:           8 inline defs (key-tag mark x2, tower face, tower window
                 fill, bay glow, two section rules, tier badge), all cc-
                 prefixed; scene.svg is a placeholder
animation:       REAL, in CSS (D-S) — kf-lamp (tower floors lighting and going
                 dark as the crew works up the building) and kf-sweep (a slow
                 band of light crossing the hero bay). Unique names and
                 selectors; opacity and transform only; neutralised under
                 prefers-reduced-motion both locally and by base.css's global
                 block
components:      hero-photo (heroDefault photos/hero-desk-wipe.jpg, heroWired
                 true, credit Ron Lach / Pexels), before-after (merge
                 niche.beforeImg/afterImg, pair credit Yan Krukau / Pexels),
                 job-details, reviews (honest empty state — testimonials ship
                 []), footer-contact (contact.hours only; no invented street
                 address) — all via manifest flags + slot comments, no inline
                 copies
before/after:    the shipped pair is 4:3 LANDSCAPE where the component's own
                 rule assumes a 581/376 frame. sections.css re-sets the frame
                 to 4/3 with id-scoped selectors (#proof .ba-cmp) because the
                 build appends component CSS AFTER this niche's, so order
                 alone would not win. Frame and photo at the same ratio means
                 no pillarboxing at any width, desktop or 390px
photos:          niches/commercial-cleaning/photos/ — hero-desk-wipe.jpg
                 (1200x1500), before-cluttered.jpg + after-clear.jpg
                 (1400x1050 each). CREDITS.md was authored with the crops and
                 is left untouched
