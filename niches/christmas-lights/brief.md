slug:            christmas-lights
business:        Cedar & Filament Holiday Lighting (fictional)
tagline:         Hung in November. Serviced all season. Gone by mid-January.
city:            Sandpoint, ID — brand.city carries the combined "City, ST"
                 string (the shape api/operator-content.mjs writes); no split
                 state field on this niche
phone:           (208) 555-0164 (reserved fictional range)
owner:           NOT NAMED. owner.name and owner.bio ship empty on purpose —
                 the section renders its heading plus base.css's own
                 add-a-bio / add-a-photo placeholders. Nothing invents a
                 founder, a history or a photo.
palette:         DARK GROUND — "warm light against a cold evening": winter-dusk
                 blue-green ground #0C1A20, surface #12262F, card #173039, one
                 warm C9 gold accent #E8B04B / #FFD98A, type #EAF2F5, soft
                 #9DB4BE, and a frost blue #8FBFC9 held back for the cold half
                 of the picture. Chosen because the subject is literally a warm
                 filament photographed against a cold sky.
                 Contrast (WCAG, computed): ink on ground 16.1:1; ink-dim on
                 ground 12.1:1; muted on ground 8.5:1 and on card 6.4:1; accent
                 on ground 9.3:1; accent-ink #241703 on accent 8.9:1 and on
                 accent-deep 5.8:1.
                 muted is a DARK-GROUND token only — it falls to 1.1:1 on the
                 accent, so it is never placed on gold or on a light surface.
type:            Fraunces / Source Sans 3 / IBM Plex Mono — all three requested
                 by seo.fontsHref
price anchors:   TIERS MODEL, display-string contract. pricing is the root
                 ARRAY; each row is {label, blurb, per, note, highlight,
                 features} and **blurb is the price display string** — where
                 ARRAY_FIELD_MAPS.pricing lands an operator's price_label.
                 Rows: Small home $695 · Large home $1,285 (highlight) ·
                 Commercial "Quoted". The third row's blurb is a WORD, not a
                 figure, so no renderer or stylesheet here prefixes a currency
                 symbol, parses a number, or assumes numeric content.
                 Fee-structure language only. No income claims anywhere.
p.note:          RENDERED on every tier card (.tier__note), and `hidden` when
                 the operator clears it.
highlight badge: "Our pick" (sections.css, .tier--best::after). Never "most
                 popular" / "most booked" — a fictional business with no
                 customers cannot claim booking volume.
differentiators: the SEASON is the product, not the afternoon — one price
                 covers design, install, every in-season service call,
                 takedown and off-season storage. Clips, never staples.
tone:            plain, unhurried, a little wry about ladders in December
hero:            heroWired — the shared hero-photo component, slot comment
                 inside .hero__stage. Real licensed photography of a genuine
                 professional install (photos/hero-roofline.jpg, Unsplash,
                 4:5 at 1200x1500). See photos/CREDITS.md for the crop and the
                 rejected candidates.
before/after:    NONE, and deliberately so. No honest same-house pair exists —
                 stock does not carry the undecorated "before" of a lit house,
                 and the closest candidates were two different buildings. The
                 slider was dropped rather than captioned around, so the site
                 makes no same-house claim it cannot support. manifest
                 sections.beforeAfter is false, merge.beforeAfter is "none",
                 and sections.html carries NO before-after slot comment.
                 Do not reintroduce it in any form.
reviews:         testimonials is [] and stays []. The shared reviews component
                 owns the empty state ("Real review coming soon"). No quote,
                 name, star rating or review count anywhere.
social:          manifest sections.social is true; content.json has no `social`
                 array yet, so the footer-contact component's fc-social line
                 stays hidden. Nothing is invented to fill it — add real
                 profile URLs to content.social when they exist.
scene:           scene.svg is a real shared <defs> block — 8 defs (2 radial
                 gradients, 4 linear gradients, 2 filters), all cl- prefixed,
                 referenced by the brand mark, the hero garland and the
                 section rules. Passes §6.1.
animation:       CSS, in sections.css (D-S): cl-twinkle (each lamp's filament
                 glow warming in turn along the hero garland), cl-breathe (the
                 bloom behind the photo) and cl-fall (a few flakes crossing
                 it). Opacity/transform only, neutralised in the
                 prefers-reduced-motion block at the foot of that file.
                 scene.js is a stub by design; there is nothing per-frame for
                 JavaScript to compute.
interactive:     package picker (.picker). It SELECTS one of the published
                 tiers and echoes that row's own label / blurb / per — it never
                 computes a figure. It also syncs the quote form's package
                 dropdown.
niche data:      hero, heroImg, about, howItWorks[], included[], pricingNote,
                 faq[]  (all under the `niche` namespace, flattened by base.js)

AUTHORED UI STRINGS (not in content.json — structural chrome, no claims):
                 nav links "How it works / Included / Pricing / FAQ";
                 section headings "How it works", "What a season includes",
                 "Pricing", "Reviews", "Questions", "Get a quote";
                 picker label "Which package fits your house?" and its empty
                 readout; tier CTA "Get this quote"; the quote-form field
                 labels, placeholders, submit button, error and success
                 messages; the footer disclosure inside SWAP:DISCLOSURE.
                 The service-area heading and the owner heading are NOT in this
                 list — they render serviceArea.region and owner.heading
                 straight from content.json.

KNOWN GATE FAILURES (both outside this niche's authorable surface):
                 1. brand.leadEmail is "hello@cedarandfilament.com". qa-site
                    requires info@kingdom-creatives.com for every niche that
                    is not manifest-flagged realBrand. content.json was handed
                    over as approved and final, so it was NOT edited here.
                    Fix is one of: set brand.leadEmail to
                    info@kingdom-creatives.com, or add "realBrand": true to
                    manifest.json if this address is intentional.
                 2. og.png is not committed. og.svg is generated by
                    tools/build-og.js; the raster step (§8.1) needs a headless
                    browser and is run by the controller, not here.
