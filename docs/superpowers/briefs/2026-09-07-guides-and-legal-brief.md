# SiteLab — Business Guides, Mini-Courses & Legal Pages Brief

**Date:** 2026-09-07 · **Owner:** Jason Vega · **Repo:** systemsbyvega-catalog
**Prerequisite:** All prior briefs carry forward. Same autonomy grants, same rules.

---

## 0. What this brief adds

Three things, built in order:

1. **Platform legal pages** — SystemsByVega's own ToS, Privacy Policy, and territory 
   agreement, wired into every niche's footer.
2. **Operator template legal pages** — ToS and Privacy Policy the operator can use on 
   their own site with their own customers, editable via admin, auto-populated with 
   their business details.
3. **Per-niche "How to Run This Business" guide + mini-course** — a Getting Started 
   tab in the admin plus a linked guide page on the operator's subdomain 
   (`<tenant>.systemsbyvega.com/guide`), covering client acquisition, pricing, 
   operations, and how to use their site to close leads.

---

## 1. Platform legal pages (one set, every niche inherits)

**Who:** Kingdom Creatives LLC, doing business as SystemsByVega. Owner: Jason Vega. 
Nampa, Idaho. Contact: info@kingdom-creatives.com.

**Pages to create:**
- `/legal/terms` — Terms of Service covering: territory exclusivity (one operator per 
  city per niche), what the $299 purchase includes (the site, the admin, the subdomain, 
  the marketing kit), what it doesn't include (the operator's own business license, 
  insurance, etc.), acceptable use, payment terms, refund policy (no refunds after 
  territory is claimed and provisioned), and SystemsByVega's right to revoke for ToS 
  violations.
- `/legal/privacy` — Privacy Policy covering: what data is collected (purchase info, 
  operator content saved via admin), how it's stored (Supabase), who can see it (the 
  operator for their own tenant, SystemsByVega for platform operations), no sale of 
  data to third parties, CCPA/basic compliance.
- `/legal/territory` — Territory Agreement: defines what a "territory" is (a named 
  city), exclusivity terms, what happens if a territory goes unclaimed for 12 months, 
  and the operator's right to the territory as long as their account is in good standing.

**Implementation:**
- Static HTML pages at those paths, styled to match systemsbyvega.com (same nav/footer 
  as the main catalog page).
- Footer of every niche site gets links to Terms, Privacy, and Territory Agreement — 
  wire into `_template/base.css` / the shared footer component so all 32 niches 
  inherit automatically on next rebuild.
- The catalog's own footer (index.html) also links to all three.
- These are platform pages, not operator pages — they don't go through the manifest 
  or content.json system.

**Tone:** Plain English first, legal language second. Jason's other platforms (ESB) 
already have this tone — match it.

---

## 2. Operator template legal pages (per-tenant, editable)

Each operator gets two template legal pages pre-populated with their business details, 
served at their subdomain:
- `<tenant>.systemsbyvega.com/terms` — their customer-facing Terms of Service
- `<tenant>.systemsbyvega.com/privacy` — their customer-facing Privacy Policy

**What these cover (operator ↔ their customers):**
- Terms: what the service is, pricing, booking/cancellation policy, satisfaction 
  guarantee language (operator fills in their own), liability limits.
- Privacy: what customer data the operator collects (name, phone, email from booking 
  form), how it's used (to fulfill the service), not sold to third parties.

**Implementation:**
- These are served by the existing middleware/routing system, same as content.json.
- Content is pre-populated from the operator's merged data (business name, phone, 
  email, city, niche service description) — no new database columns needed for the 
  basic version.
- Add two new optional columns to `sbv_operator_content`: `terms_custom text` and 
  `privacy_custom text` (≤3000 chars each, basic length check) for operators who want 
  to add custom clauses. These go in a new `sql/LEGAL-COLUMNS.sql` file (Jason runs it).
- Add a "Legal" section to the admin (after Details, before Danger Zone) with two 
  textareas: "Add custom terms clauses" and "Add custom privacy clauses" — labeled 
  clearly as additions to the template, not replacements.
- The template pages themselves render: the pre-populated base template + any custom 
  text the operator has added. If no custom text, the base template stands alone.
- Footer of every niche site (both demo and operator subdomain) links to /terms and 
  /privacy — wire into the shared footer.
- Disclaimer on the template pages: "This page was generated from a template by 
  SystemsByVega and is provided for convenience. It is not legal advice. Consult a 
  licensed attorney for your specific situation."

---

## 3. Per-niche "How to Run This Business" guide + mini-course

### 3a. The guide page (`<tenant>.systemsbyvega.com/guide`)

A standalone page on the operator's subdomain, unindexed (same X-Robots-Tag: noindex 
as the demo sites — this is for the operator, not for SEO). Accessible to anyone who 
has the URL, but not linked from the public site.

**Structure (same for all niches, content differs):**
- **Quick-start checklist** — 5-7 steps to get the first client within the first week. 
  Specific to the niche (bin cleaning: print flyers, hit Nextdoor, knock the block; 
  landscaping: call property managers, post before/after on Facebook, etc.)
- **Pricing guidance** — how to think about pricing in this niche, common mistakes, 
  how to use their site's pricing tiers to anchor client expectations.
- **Client acquisition** — the 3 best channels for this specific niche (varies: some 
  are Nextdoor-heavy, some are Google Maps, some are door-to-door). Specific tactics, 
  not generic marketing advice.
- **Operations** — how to actually run the service day-to-day: what equipment/supplies 
  are needed, how to schedule, how to handle complaints, when to raise prices.
- **Using your site** — how the admin works, how to update photos/prices/reviews, 
  what the marketing flyers are for and how to use them, how the QR code works.
- **Legal & insurance basics** — what licenses and insurance are typically needed for 
  this niche (not legal advice, just orientation). Link to platform /legal/terms.

**Implementation:**
- One `niches/<slug>/guide.html` per niche, compiled into `sites/<slug>/guide.html` 
  by build-site.js (add to the build step).
- Styled to match the niche's own color scheme (uses the same CSS tokens).
- Not linked from the public site — only from the admin's "Getting Started" tab.
- Static content (not operator-editable) — the guide is the same for all operators 
  in a niche regardless of their specific data.

### 3b. The "Getting Started" tab in the admin

Add a "Start here" tab to the admin nav (first position, before Business) that shows:
- A welcome message: "Welcome to your [Niche Name] site. Here's how to get your 
  first client."
- The quick-start checklist (same 5-7 steps as the guide, rendered inline).
- A prominent "Read the full guide →" link to `<tenant>.systemsbyvega.com/guide`.
- A "Download your marketing kit →" link to the Marketing tab.
- A "Set up your site →" link to the Business tab.

This is the first thing an operator sees when they log in. It should feel like a warm 
handoff, not a blank form.

---

## 4. Content for the guides — what Claude Code should write

All 32 niches need guide content. The existing 25 niches have `niches/<slug>/brief.md` 
files with niche context — use those as the primary source. For the 7 newer niches 
(estate-sale, garage-sale, residential-cleaning, commercial-cleaning, window-cleaning, 
mechanic, sprinkler, personal-assistant, christmas-lights), the brief.md and 
content.json have enough context.

Write the guides in Jason's voice: direct, practical, no fluff. Same tone as the 
EstateSaleBiz training materials (which exist on Jason's desktop at 
`C:\Users\JasonVega\Desktop\Jason\site labs\` — reference them for tone if accessible, 
but don't block on it). Zero fabricated statistics. Zero income claims ("you could 
make $X"). Focus on actions, not outcomes.

**Compliance rule (non-negotiable):** No income claims, no earnings projections, no 
"most operators make X" language. The guide teaches how to run the business, not what 
it will pay. This is the same posture as every other piece of content on the platform.

---

## 5. Build and rollout order

1. Platform legal pages (`/legal/terms`, `/legal/privacy`, `/legal/territory`) — 
   static, no dependencies, ship first.
2. `sql/LEGAL-COLUMNS.sql` — two new columns, Jason runs it.
3. Operator template legal pages (middleware routes, template renderer, admin Legal 
   section) — depends on step 2.
4. Guide content for all 32 niches (parallel subagents, one per niche or batched) — 
   no dependencies, can run alongside step 3.
5. Guide page build integration (build-site.js addition, Getting Started admin tab) — 
   depends on step 4.
6. Footer wiring for all legal links — rebuild all 32 niches, verify no regressions.
7. Full review pass (most capable model), then push.

**Stop condition:** Any change to the platform ToS content (§1) that touches what 
buyers are promised about territory exclusivity or refund policy — flag for Jason 
before pushing. Everything else runs per the standing autonomy grant.

---

## 6. Kickoff

Read this brief and all prior briefs. Start with step 1 — draft the three platform 
legal pages in plain English and show them to Jason before wiring them into the 
footer. This is the one mandatory checkpoint in this brief: legal copy Jason hasn't 
approved shouldn't go live on its own.
