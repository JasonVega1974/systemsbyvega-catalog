# SiteLab Platform Completion — Brief for Claude Code

**Date:** 2026-09-06 · **Owner:** Jason Vega · **Repo:** systemsbyvega-catalog (Vercel) · **DB:** Supabase project newjbexmvltvtmxollca (SystemsByVega)
**Status:** brief — run brainstorming → spec → plan → subagent-driven execution, per house process.

---

## 0. The one-sentence goal

Every business niche on systemsbyvega.com is **turnkey**: a buyer claims a territory → a tenant is provisioned and mapped to their account → they land in a **branded, polished admin** where they can edit every visible detail of their site → their live site reflects it → and they get a **downloadable marketing kit** (Facebook image + print flyer, with a working QR code). This is done for **all** niches — the 23 in the catalog today **plus every niche that exists in Jason's content folders but isn't in the catalog yet** (estate sale, garage sale, and any others found in the inventory). 100% coverage, no niche left half-built.

## 1. What is already done — reuse, don't rebuild

The bin-cleaning niche is the finished reference. Everything below exists and is proven live on `primetest`:

- **Editable data layer:** `sbv_operator_content` with columns for name / phone / email / lead_email / address / hours / logo_url / photos (jsonb slots) / prices / social / reviews / job_details, each with a validator + `EXECUTE` grants in the same block. Supabase Storage bucket `sbv-operator-media` with tenant-scoped write policies. Own-row DELETE policy (ADMIN-RESET.sql).
- **Merge endpoint:** `api/operator-content.mjs` overlays the operator row onto the niche `content.json` and serves it at `<tenant>.systemsbyvega.com/content.json` (s-maxage=30, SWR=120).
- **Admin:** `admin/index.html` — single page, per-niche **theme map** resolved at runtime, five sections (Business / Photos / Pricing / Reviews / Details), drag-and-drop uploads, inline validation, dirty tracking + sticky Save bar, three-state omit/null/value save semantics (PGRST204-safe), Danger-zone Reset (type-to-confirm).
- **Site build system:** `niches/<slug>/{sections.html, sections.css, niche.js, content.json, photos/}` compiled by `tools/build-site.js` into `sites/<slug>/`. Photos carried by the build, referenced by **absolute** `/sites/<slug>/photos/…` paths.
- **Landscaping** has the real-photography hero + Ken Burns + fade-in pattern.
- **Bin-cleaning** has the drag before/after slider, per-tier pricing, dashed empty-slot placeholders, and the per-niche theme entry.

**Lessons that are now hard rules** (each cost a live bug this week):
1. Edit `niches/`, never `sites/` (build output).
2. Image/asset paths are absolute (`/sites/<slug>/…`); relative paths 404 on tenant subdomains.
3. Every SQL validator ships with `grant execute … to authenticated, service_role` in the same block.
4. New columns are **omitted** from the save payload when unset — never sent as explicit `null` unless seen-in-load — so deploy order can't break saves.
5. supabase-js builders are thenables with **no `.catch`** — wrap in `Promise.resolve()` first. Every load/save/delete chain has a terminal `.catch` that fails **loudly** in the UI.
6. Never write `*/` inside a block comment (paths and globs included).
7. Compliance: demo niches use **fictional** brands, **empty** testimonials, no fabricated proof. Prime Bin Cleaning is the single authorized real-brand exception and is disclosed on the catalog page. Every other niche stays fictional.
8. Human gates today: Jason runs SQL files and pushes. See §7 for how to relax these for autonomous runs.

## 2. Inventory first (read-only, produce a report before any code)

1. **Content inventory.** Walk `C:\Users\JasonVega\Desktop\Jason\site labs\` (and adjacent folders under `Desktop\Jason\`, e.g. `PrimeBinCleaning\`). List every niche/business that has content there. Diff against `niches/` in the repo. Output: a table of *niche → in catalog? / has content folder? / has before-after material? / has marketing assets?*. Expect at minimum **estate sale** and **garage sale** to be missing from the catalog; report whatever else is.
2. **Site quality audit** of all 23 built niches. Score each hero on: real photo vs. generic SVG/icon art, animation quality (keep / fix / remove), mobile behavior, and whether the niche's work is *before/after in nature* (cleaning, washing, detailing, painting, junk removal, restoration, landscaping cleanup, etc. → **needs the slider**; DJ, delivery, child care, personal trainer → doesn't). Jason has already flagged pressure-washing (smeared brown wand-reveal panel) and car-detailing (crude car outline) as examples of heroes that read badly.
3. **Field coverage audit.** For each niche, which of the operator fields actually render today (name/phone/email/owner/bio do; hours/address/job_details mostly don't). Output the gap list.
4. Produce `docs/superpowers/specs/<date>-platform-inventory.md` with the three tables and a **proposed rollout order** (niches with the most reusable structure first, before/after niches grouped). **Stop and show Jason this report** before Phase A. This is the one mandatory checkpoint.

## 3. Phase A — platform generalization (build once, every niche inherits)

A1. **Per-niche manifest** (`niches/<slug>/manifest.json`): theme tokens for the admin, photo slot keys (hero, before, after, owner, gallery[n]…), which sections the niche has (pricing tiers, before/after slider, job details, service list), and where each operator field merges into `content.json`. This is the "rollout contract" already named in the bin-cleaning plan — make it real. The admin theme map and the merge endpoint read from manifests instead of hardcoded entries.

A2. **Shared template components in `_template/`** with per-niche styling hooks:
   - Footer with hours + address + social (closes the platform-wide hours gap).
   - Before/after slider (extracted from bin-cleaning; keyboard-accessible; both-or-neither fallback; dashed pair when empty).
   - "What's included / not included" job-details block.
   - Reviews block that fills from operator reviews and stays empty on demos.
   - Hero photo block with Ken Burns + reveal (from landscaping).
   Each enabled per niche via the manifest, so adding a component to a niche is a manifest flag + rebuild, not a hand edit.

A3. **Marketing kit generator.** Reference: Prime's two pieces — `prime-bin-cleaning-facebook-1080x1350.png` (1080×1350 social) and `prime-bin-cleaning-flyer-print-8.5x11.png` (Letter print). There is a `prime-bin-cleaning-facebook-source.html` in the Prime folder — that HTML-source approach is the pattern: **one HTML template per format per niche**, populated from the operator's merged content (brand name, tagline, 3 service points, price tiers, phone, city list), rendered to PNG (social) and PDF+PNG (print) with Playwright, and served from a new **Marketing** tab in the admin with download buttons and a live preview.
   - **QR code:** generated at render time (a Node `qrcode`-style dependency in the render step, or a small client-side lib for preview), encoding the tenant's live site URL (subdomain today; custom domain if that field exists later). No external QR service.
   - Storage: rendered files go to `sbv-operator-media/<tenant>/marketing/…` (same bucket, same tenant-scoped policies). Re-render on demand, not on every save.
   - For bin-cleaning, add Prime's two finished images into `niches/bin-cleaning/marketing/` as the demo/reference output, and make the template reproduce that design from data.
   - Every niche ships a **default** template pair styled to its theme; operators only change data, not design.

A4. **Platform housekeeping that is now overdue:** `noindex` on operator sites that haven't gone live / are test tenants (decide the rule, implement it); the qa-site.js real-brand-niche check; the testerson welcome-email resend (`npx vercel login`); the Prime-name-in-aria-labels leak so future bin-cleaning operators don't inherit Prime's name; storage wipe on Reset (one storage DELETE policy) if Jason wants it.

## 4. Phase B — per-niche rollout (one subagent per niche, in the inventory order)

For each existing niche:
1. Write the manifest (theme, slots, sections, merges).
2. **Hero redesign** where the audit says fix: real, commercially-licensed photography (Pexels/Unsplash, credit in `photos/CREDITS.md`, absolute paths), Ken Burns + reveal, remove animations that don't earn their place. Keep animations that genuinely work.
3. Enable the before/after slider where the niche is before/after work; wire operator `before`/`after` slots to it.
4. Wire footer (hours/address/social), reviews, job details via the shared components.
5. Rebuild; verify: `node --check`, byte-identical output for untouched niches, qa-site.js green (except the documented real-brand exception), zero console errors in a headless browser load of the built page, and a **merge test** — a stub row for the niche renders every field in the right slot.
6. Commit per niche with a message naming the niche and what changed.

## 5. Phase C — new niches (estate sale, garage sale, + whatever the inventory finds)

Same pipeline as Phase B, but starting from a niche brief in `niches/<slug>/brief.md`: fictional demo brand, fictional owner, real-photo hero, sections chosen by the manifest, empty testimonials, pricing model that fits the trade (estate sales are typically commission/percentage, not per-unit — the pricing component must support "starting at / percentage / call for quote" labels, not just tiers). Add the catalog card on `systemsbyvega.com/sites/`. Add the Stripe product / provisioning entries so it is actually purchasable, not just visible.

## 6. Phase D — turnkey verification (per niche, no exceptions)

For every niche, run the **full purchase-to-live loop** in test mode: claim → webhook provisions tenant + `sbv_client_users` mapping in one transaction → admin loads with the niche theme → upload photos, set prices/hours/review/social → Save → `content.json` merges → live subdomain renders every field → marketing kit renders with a scannable QR → Reset returns to demo. Record the result per niche in `docs/superpowers/specs/<date>-turnkey-verification.md`. A niche is "done" only when this table row is all-green.

## 7. Autonomy — how to run this without waiting on Jason

Jason wants this to run as assignments while he's away, with many workers. To make that real:
- **Use subagent-driven development** for every phase (it already ran 1.5-hour unattended stretches successfully). Dispatch Phase B niches **in parallel** where they don't touch shared files (they shouldn't after Phase A — that's the point of manifests). Cheapest tier for transcription tasks, standard for judgment tasks, most capable model for whole-branch reviews.
- **SQL:** Jason authorizes Claude Code to apply SQL files itself via the working non-interactive path (`supabase db query --linked -f <file>`) against the linked SystemsByVega project **only** — never ESB or GSB. Still write every change as a file under `sql/` with verify rows, and run the verify rows after applying.
- **Push:** Jason authorizes push to `catalog/main` after each phase's final whole-branch review comes back clean. Deploy order rule stands: SQL applied before the code that depends on it is pushed.
- **Stop conditions (the only reasons to pause and ask):** (1) the Phase 0 inventory checkpoint; (2) anything that would touch a Supabase project other than SystemsByVega; (3) a change to pricing, Stripe products, or the public catalog disclosure copy; (4) a destructive operation on real (non-test) tenant data; (5) a decision that changes what a *customer* pays or sees on the catalog page. Everything else: decide, ledger the ruling, keep going.
- **Reporting:** append to `docs/superpowers/plans/<date>-platform-completion-progress.md` after every task — what shipped, rulings made, what's blocked. Jason reads this instead of being interrupted.
- **Scheduling:** if a run is cut off (usage limit, stall), resume from the ledger with `claude --continue`; do not restart from scratch.

## 8. Deliverables, in order

1. Inventory + audit report (Phase 0) — **checkpoint with Jason**
2. Platform spec + implementation plan for Phase A (house process: spec → plan → SDD)
3. Phase A shipped, reviewed, pushed
4. Phase B per-niche rollout, parallel subagents, pushed in batches with a progress ledger
5. Phase C new niches, purchasable
6. Phase D verification table — all rows green
7. Final whole-platform review: security (RLS, storage policies, XSS sinks), compliance (fictional brands, disclosure), and a one-page "how a buyer goes from purchase to a managed site" walkthrough for Jason.

## 9. Kickoff instruction

Read this brief in full. Use the brainstorming skill only for the questions this brief leaves open (manifest schema details, marketing-kit render pipeline choice, parallelism strategy) — not to re-litigate decisions already made here. Then produce the Phase 0 inventory and audit and stop for the checkpoint.
