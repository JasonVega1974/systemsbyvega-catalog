# Parked follow-ups — opened by the 2026-09-10 site reorganization

Items deliberately deferred, with enough detail to pick up cold. Nothing here
blocks the reorg.

---

## F1 — Spanish re-translation (Jason: "park it", Q5)

**Status:** parked by decision. Not broken — degraded to English, on purpose.

`assets/i18n.js` keys translations by **normalised English source text** and falls
back to English on a miss (`i18n.js:102`). Matching is whole-text-node exact, so a
stale key never fires and never mangles. Correcting the English on `/` therefore
retired the wrong Spanish numbers automatically: those sentences now render in
correct English rather than incorrect Spanish.

**Dead keys in `assets/lang/es.js`** (each needs a new key matching the new English,
then a fresh translation):

| es.js line | Stale English key, now unmatched |
|---|---|
| 266 | `Two of these are finished.` |
| 278 | `Twenty-seven entries in the catalog are either a website or a line you can join…` |
| 308 | `. You can click into both right now… list twenty-nine I have not built.` |
| 319 | `Twenty-three trades, twenty-three sites already built…` |
| 330 | `See all twenty-three sites →` |

Also newly untranslated (new or changed English on `/`): "Three you can buy today",
"Click any of them", "the three businesses that are open", the ConsignmentBiz proof
caption, and the "Everything else / thirty-five entries" line.

`'Three are open today'` (es.js:42) already exists and still matches — the ledger
and thesis are translated correctly today.

**When picked up:** decide scope first (`/` only, or `/` + the merged `/sites/`).
The reorg rewrites most of this copy again, so doing it before the reorg lands is
wasted work — that is why it is parked.

---

## F2 — `build-catalog.js --check` fails on Windows working copies

**Status:** open, cosmetic to production, real papercut for local work.

**Not a production problem.** `git config core.autocrlf=true` gives the Windows
working copy CRLF (722 CRLF / 0 LF), while the committed blob and Vercel's Linux
checkout are LF (0 CRLF / 711 LF). `build-catalog.js` injects bare `\n` around the
`BUILD:` markers, so the rebuilt string never matches a CRLF file.

Verified both directions on 2026-09-10:
- CRLF working copy → `index.html is out of date with the seed`, exit 1
- `git show HEAD:index.html` (LF) → `index.html is in sync with the seed`, exit 0

So the Vercel `buildCommand` passes, deploys are not failing, and the live site is
not a stale build.

**Why it matters anyway:** running `node tools/build-catalog.js` locally rewrites
the whole file and mixes LF into a CRLF document. T2 retargets this tool at the
merged catalog, so whoever runs it locally will hit this.

**Fix when convenient:** add `.gitattributes` with `* text=auto eol=lf`. Deliberately
not done during the reorg — it re-normalises every file in the working tree and
would pollute every diff in the branch. Do it as its own commit, before or after.

---

## F3 — The last hand-typed count on `/`

`#proof`'s "The other **thirty-five** entries" is 38 listed − 3 open, typed by hand.
Every other figure on the page comes from the seed via `catalog-render.js`. When the
catalog moves in T2, give it a `BUILD:` marker (`R.figures()` already computes
`total` and `open`; the derived figure is one subtraction).

---

## F4 — `middleware.js` stale comment

Lines ~210–220 explain at length that tenant pages still ship a baked
`<meta name="robots" content="noindex">` that wins Google's most-restrictive
tiebreak. They do not: `build-site.js` sets `ROBOTS: ''` and zero of the 32 built
pages contain a robots meta. The header is the only signal now. Harmless, but it
describes a world that no longer exists and will mislead the next reader.

---

## F5 — Analytics gaps

No Vercel Analytics tag on `/demo/`, `/showcase/`, `/portfolio/`, `/claim/`, or
`/claim/thank-you.html`. The two `/claim/` pages are the Stripe cancel and success
landings — the highest-value pages in the funnel are invisible in reporting.
Folded into T7.

---

## F6 — disclose the hashed-IP abuse record in the privacy policy

**Status:** open, needs Jason's decision on wording. Not blocking.

`sbv_inquiries` stores a salted SHA-256 of the submitter's IP (`ip_hash`) to rate-limit
the `/services/` form across serverless instances (Ruling R15). The raw address is never
stored.

`legal/privacy.html` §3 currently discloses only:

> Our hosting provider keeps standard server logs, including IP addresses, for security
> and troubleshooting.

That is a statement about Vercel's logs. It does not cover a record SystemsByVega keeps
in its own database, even a hashed one. The policy is not *false* today, but it is
incomplete, and the whole posture of this site is that published statements are true and
checkable.

**Suggested sentence for §3**, for Jason to approve or reword:

> When you send an enquiry through the site we also keep a one-way scrambled form of your
> network address, which lets us block abuse of the form. It cannot be turned back into
> your address and we never store the address itself.

Deliberately not written into the file by an agent: the brief's stop conditions say to
flag compliance-adjacent copy rather than guess at it.
