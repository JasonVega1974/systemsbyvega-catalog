# Guides, mini-courses & legal pages — progress

Brief: `docs/superpowers/briefs/2026-09-07-guides-and-legal-brief.md`
Prior briefs and their autonomy grants carry forward unchanged.

---

## OPEN ITEMS FOR JASON

- **Get an attorney to review the franchise / FTC posture before launch.**
  Jason's instruction, 2026-09-08, and I agree with it. The catalog and the
  legal pages together take a deliberate position: not a franchise, not a
  business opportunity, no brand licence, no royalty, no control over how an
  operator works, no earnings claims. That position is doing real regulatory
  work under the FTC Franchise Rule (16 CFR 436) and state business-opportunity
  statutes, and the fee levels and territory language are exactly what those
  rules turn on. Every edit I have made is written to preserve the position
  rather than test it, but I am not a lawyer and cannot tell you it is
  sufficient. **Blocking for launch, not for further building.**
  - Worth putting in front of them together: `/legal/terms.html`,
    `/legal/operator-agreement.html` (the territory licence), the catalog's
    "Is this a franchise?" and "How much can I make?" answers, and the
    footer disclosure paragraph.
  - Also worth their eye: the operator template legal pages from §2, which
    are generated copy served to an operator's own customers under the
    operator's name.

- **Decided 2026-09-08, recorded so it is not relitigated:** platform legal
  links go in the admin and on the catalog only, NOT in the operator's public
  footer. A visitor to an operator's site is that operator's customer, not
  SystemsByVega's; the operator's own /terms and /privacy from §2 are what
  that footer needs.

- **Decided 2026-09-08:** no territory exclusivity language goes into the
  Terms for a website purchase. Terms §4 and the catalog both already say a
  website purchase is not a territory. Brief §1 asked for the opposite; it was
  flagged and overruled by Jason rather than silently followed.

---

## Step 1 — platform legal pages · DONE

The three pages the brief asked me to draft already existed. Four did, live
since 26 August: `terms.html`, `privacy.html`, `refund.html`,
`operator-agreement.html`. The brief's `/legal/territory` is the Operator
Agreement; it was not duplicated. Reviewed all four, drafted only the gaps,
showed Jason before touching anything, applied on his approval.

Applied in `bd57864`:
- **Terms, new §6 "Your admin panel and your subdomain."** Neither was
  mentioned anywhere in the document. Covers what the panel edits, that
  self-service edits are free and the Care Plan is for work handed to us,
  that entered content stays the buyer's, that the subdomain is a convenience
  and not a domain they own, and that both are "as is" under the hosting
  section.
- **Terms §8, marketing kit.** Two sentences under the licence split already
  in that section: the generated social image, flyer and QR code are the
  operator's to use; the templates remain ours.
- **Privacy §2, the data model.** It described a service-desk model — "the
  edits you request, and a record of what we changed" — which stopped being
  true when the admin shipped. Now describes the operator writing their own
  details, prices, review text, photographs and logo into a record scoped to
  their site, cleared with the uploaded images by the admin's Reset, plus the
  generated marketing files. The Supabase processor line now says file storage
  as well as database.

Sections 6-17 shifted by one. Verified: numbering contiguous 1..18 with no
duplicates (I initially truncated my own heading survey at 15 and left a
duplicate 16 — caught by asserting contiguity, not by eye), the one internal
cross-reference that moved was updated, no other legal page cites Terms
section numbers, tags balanced, both pages render at HTTP 200 with zero
horizontal overflow and no console errors.

Untouched by instruction: `refund.html`, `operator-agreement.html`, and
Terms §4 (territory).

**Noted, not fixed (out of the approved scope):** none of the four legal
pages carries a `<link rel="icon">`, so each triggers a `/favicon.ico` 404.
Same class as the niche-favicon backlog item.

---

## Step 2 — operator template legal pages · IN PROGRESS
