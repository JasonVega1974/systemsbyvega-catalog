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

## Step 2 — operator template legal pages · BUILT, one blocker

Shipped in `042b674`. `/terms` and `/privacy` on every operator subdomain,
built per niche so they carry that niche's palette and demo brand, overlaid at
runtime with the operator's saved details.

**The drafting position, because it explains why the copy reads as it does.**
These pages are a contract between the OPERATOR and THEIR customer, generated
from a template. Every concrete commercial term the template states is a term
the operator never agreed to — so it states none. It describes the shape of
the relationship and defers notice periods, deposits, cancellation fees and
guarantees to what the operator actually agreed, or to the clauses they add
themselves. Nothing claims they are licensed, insured, bonded, or that they
guarantee their work; only they can truthfully say that. This is the same trap
as the fabricated certificate-of-insurance line caught on christmas-lights,
except here it would have been replicated across all 32 niches at once.

**Rulings made while building:**
- *Relative hrefs, not root-relative.* One built `index.html` is served both at
  `/sites/<slug>/` on the catalog and at `/` on a tenant, so there is one file
  and one href. `terms.html` resolves correctly in both; `/terms` would break
  the demo. Middleware therefore matches four paths, the bare and `.html`
  spellings of each.
- *Footer links injected by the build, not by footer-contact.* Only 18 of 32
  niches enable that component and these pages exist for all of them. The
  build now fails loudly if a niche has no `</footer>`.
- *Custom clauses go through `maybeClearable()`, not `FIELDS`.* `FIELDS` sends
  its column on every save, so adding these to it would have taken the entire
  save down with PGRST204 until the SQL was applied. This is house rule 4 and
  it very nearly caught me.
- *"Last updated" is a pinned constant, not the build date.* Deriving it from
  the build would restamp all 32 niches on any unrelated rebuild and tell every
  operator's customers the policy changed when it had not.

**Verified:** 34 builds, 0 qa failures across all niches, all 62 legal pages
return 200, custom clauses render with correct per-document field and preserved
line breaks, and an `<img onerror>` + inline `<script>` payload in the operator
text renders as literal characters and does not execute.

**NOT APPLIED, waiting on Jason:** `sql/LEGAL-COLUMNS.sql`. The brief says
"Jason runs it" for this one, which overrides the standing SQL grant, so I
wrote it and stopped. Until it runs, the columns are absent, the admin omits
them from the payload, and every operator sees the template alone — no error,
no half state. Say the word and I will apply it; the verify rows are in the
file.

### dj themed routing · FIXED (`d0e5942`, `a718ae1`) — dj stays on sale

`sbv_tenants` gained a `theme` column, `sbv_public_tenants()` returns it, and
both the router and the merge endpoint resolve a themed niche's tenant to
`sites/<slug>/<theme>/`.

The whitelist is `assets/data/themes.mjs`, generated by
`tools/build-manifest-index.js` from the `niches/<slug>/themes/` directories —
the same list the build itself reads. Hand-listing "dj" in the router is
exactly what would misroute silently the day a second themed niche appears.
The column's CHECK is format-only because the database cannot know which names
are legal; the whitelist is the real gate, and it DISCARDS an unrecognised
value rather than sanitising it, so a hostile theme falls back instead of
escaping into a path.

The merge endpoint was the less obvious half: it fetched
`sites/<slug>/content.json`, so a themed tenant would have been served the
picker's copy under their own palette — worse than an obvious failure, because
it looks fine.

**Found only by testing live, not in review:** `vercel.json` sets
`trailingSlash: true`, so `/terms` is 308'd to `/terms/` before middleware
runs. Vercel folds that into the `/terms` matcher, but the handler compared the
raw pathname, so `/terms/` missed the legal branch and fell through to the
storefront rewrite — the tenant's own site served under the Terms URL, 200 and
with tenant headers attached. Fixed in `a718ae1`.

Verified live against a temporary `djroutetest` tenant, since no dj tenants
exist: all three themes serve the right storefront, `/terms`, `/privacy` and
`content.json` (Bloom/Pulse/Nova each matching), a null theme falls back to
blue rather than the picker, an unthemed tenant is byte-identically unaffected,
and every path either resolver can produce exists on disk. The test tenant was
deleted; the table is back to its original 6 rows.

**STILL OPEN — nothing captures the buyer's theme choice.** The dj demo page is
a picker, but it only links to the three demos; there are no checkout hooks in
it. So a dj buyer today gets the fallback (blue/Nova) until someone sets the
column. Two ways to close it, both yours to pick: capture the choice at
checkout, or grant operators update on the column and add a theme selector to
the admin. I did not grant it — the SQL deliberately matches `niche_slug` and
`tier`, since the column repoints which build their subdomain serves — but for
a cosmetic variant of their own niche that restriction is arguable.

---

## PAUSED 2026-09-08 — where this stands

Jason went offline here. Work resumed under a third brief in the meantime, so
the live position is split across two ledgers:

- **This file** — platform legal pages (done), operator legal pages (done), dj
  themed routing (done).
- **`2026-09-07-leads-crm-progress.md`** — the Leads CRM. `sql/LEADS.sql` is
  written, verified and **already applied**; `api/submit-lead.mjs` is the next
  thing to write. That file also carries the resume point for the two items
  below.

Two things Jason agreed on 2026-09-08 that are queued and NOT started:

1. **DJ theme selector in the admin — option B**, chosen explicitly over
   capturing the choice at checkout. Requirements are listed in the leads
   ledger.
2. **Guides + mini-course content for all 32 niches** — step 3 below, still
   not started.

---

## Step 3 — per-niche guides · NOT STARTED

