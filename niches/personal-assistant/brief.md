slug:            personal-assistant
business:        Wrenfield & Co. (fictional — new-niche wave, Task N)
tagline:         The list, off your desk.
city:            Hailey, ID — brand.city is a COMBINED "City, ST" string here
                 (the majority shape; estate-sale's split city/state is the
                 outlier and is deliberately not copied)
phone:           (208) 555-0271 — reserved fictional range, unique in repo
owner:           Nell Prentiss (fictional)
name check:      "Wrenfield" web-searched against "personal assistant",
                 "concierge" and "errand business": no personal-assistant or
                 concierge business of that name exists. Unrelated namesakes
                 found (a UK holding company, a UK electrical contractor, a
                 dormant Massachusetts tax-prep LLC, a loan consultancy, and a
                 Toll Brothers housing development) — none in this trade, same
                 standard as Osprey Moving / Kestrel Detail. Root-unique across
                 all 25 sibling brands; deliberately avoids the
                 "Cora Vale Fitness" person-name register and the word "Vale".
                 Rejected on the way: "Almanac" (Almanac Labs), "Quill &
                 Compass" (several live small businesses, one of them a health
                 coach).

palette:         LIGHT GROUND — "a cleared desk, mid-morning": warm paper
                 #F4F2EC, graphite ink #22201C, ONE ribbon of deep petrol
                 #1C5E59 / #26766F, dry-brass hairline #8C7A4B used only as a
                 rule. No second accent competing for attention.
                 Contrast (computed): onAccent #FFFFFF on accent 7.51:1 and on
                 accentBright 5.38:1 (both clear 4.5:1 — the admin wears this
                 theme); ink on ground 14.53:1; muted #5A625E on ground 5.61:1;
                 accent on ground 6.71:1 for eyebrow and link text.
type:            Newsreader / Manrope / DM Mono

price anchors:   TIERS MODEL, display-string contract. Three rows, each
                 {label, blurb, per, note, features, highlight} where **blurb
                 is the price display string** — $42 /hour, $160 /four hours,
                 $1,200 /month — because ARRAY_FIELD_MAPS.pricing lands an
                 operator's price_label save on `blurb` and a renderer reading
                 any other key is a silent no-op. The ladder is internally
                 consistent: $42/hr hourly, $40/hr inside the half-day, and
                 $37.50/hr inside the 32-hour retainer.
                 **p.note is RENDERED** (pcard__flag on the highlighted row,
                 pcard__note under the features elsewhere) and hidden when
                 empty. Ten existing niches ignore that admin field; this one
                 does not add an eleventh.
                 pricingNote states the pass-through rule (purchases at cost
                 with receipts, no markup) and that retainer hours do not roll
                 over. Fee structure only — no income or time-saved claims
                 anywhere on the page.

differentiators: a grouped services board ("out in the world" / "at the desk" /
                 "for small businesses"); a five-day rail showing how a week
                 actually runs; and an honest boundaries section ("Where I
                 stop") naming the six things the service does not do — no
                 professional advice, no custody of money, no care work, no
                 heavy labour or cleaning, no signing in your name, no
                 open-ended access to your systems. That last section is the
                 trust device this trade actually needs, and it is what keeps
                 the site from reading as caregiving or child-care adjacent.
tone:            calm, plain, slightly dry. First person singular — one person
                 does the work and says so.

photography:     ONE photograph, no gallery and no slider. photos/hero-planner.jpg
                 (1200x1500, Arina Krasnikova / Pexels — see photos/CREDITS.md),
                 wired through the shared hero-photo component with
                 heroDefault + a descriptive heroAlt and heroWired: true.
before/after:    NONE, on purpose. sections.beforeAfter false,
                 merge.beforeAfter "none", no before-after slot comment in
                 sections.html, and NO before/after entries in photoSlots — an
                 admin upload slot the site never renders is a known platform
                 defect, so the slot list is exactly what the page draws:
                 logo (renderMarks swaps the drawn mark for it), hero
                 (hero-photo), owner (meet__photo).
                 With no gallery to carry the page, the STRUCTURE does: five
                 distinct section shapes between hero and form.

scene:           7 inline defs, all wf- prefixed (wf-grad-mark, wf-grad-mark2,
                 wf-grad-tab, wf-grad-clip, wf-rule-a, wf-rule-b) plus the
                 component's own; scene.svg is a placeholder.
animation:       REAL, in CSS (D-S) — wf-settle (three ruled slips settling in
                 sequence beside the photo), wf-breathe (a soft page-glow
                 behind it), wf-tabtilt (a clipped index tab leaning a degree
                 and back). Unique names and selectors; transform and opacity
                 only; long, slow and deliberately easy to miss; neutralised
                 under prefers-reduced-motion both locally and by base.css's
                 global block.
interactive:     REAL — the three tier cards are labels wrapping a radio, so
                 picking one is a keyboard-reachable form control. syncSummary()
                 reads the checked row out of the LIVE pricing array (never off
                 the DOM text) and writes both the picked line under the grid
                 and the read-only "How you would like to work together" field
                 in the intake form, so the choice travels with the lead. A
                 selection survives a re-render when its label survives the
                 operator's edit; otherwise it falls back to the highlighted
                 row, then the first row.
components:      hero-photo (heroDefault photos/hero-planner.jpg), reviews
                 (testimonials ship [] — three honest "real review coming soon"
                 cards, zero fabricated quotes), footer-contact (contact.hours
                 only; no invented street address) — all via manifest flags +
                 slot comments, no inline copies. NOT before-after.
