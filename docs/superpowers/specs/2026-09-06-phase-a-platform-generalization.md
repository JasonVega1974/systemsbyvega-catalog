# Phase A — Platform Generalization Spec

**Date:** 2026-09-06 · Brief: docs/superpowers/briefs/2026-09-06-sitelab-platform-completion-brief.md §3
**Status:** decisions made under §7 autonomy (the brief's three open questions + Jason's pricing-model ruling); Jason reads, objects, or lets it ride — work proceeds.

## Decision 1 — Manifest schema (`niches/<slug>/manifest.json`)

One file per niche, read by three consumers: the admin (theme + which editors to show + pricing model), the merge endpoint (where operator fields land), and the build (which shared components to include). Schema:

```json
{
  "v": 1,
  "theme": {
    "ground": "#050f1c", "surface": "#0a2138", "card": "#0d2a47",
    "accent": "#4ea4e6", "accentBright": "#67baf5",
    "text": "#e6f4f2", "textSoft": "#bfe3fb",
    "ok": "#4FD695", "bad": "#FF8A75", "onAccent": "#050f1c",
    "fontsHref": "https://fonts.googleapis.com/...",
    "display": "'Anton',sans-serif", "label": "'Oswald',sans-serif", "body": "'Inter',sans-serif",
    "logo": "/sites/<slug>/photos/logo.png"
  },
  "photoSlots": ["logo", "hero", "before", "after", "owner", "gallery1"],
  "sections": {
    "pricing": true, "beforeAfter": true, "jobDetails": false,
    "reviews": true, "social": true, "footerContact": true, "ownerBlock": true
  },
  "pricing": {
    "model": "tiers | hourly | quote | percentage | calculator | flash | none",
    "editableFields": ["label", "price_label", "note"],
    "mergePath": "pricing"
  },
  "merge": {
    "beforeAfter": "niche.beforeImg/afterImg | projects[0] | none",
    "reviews": "testimonials | none",
    "ownerShape": "owner | none"
  }
}
```

- **Validation:** `tools/validate-manifest.js` (run inside build-site.js) — a manifest error fails the build loudly, never ships a half-wired niche.
- **Admin consumption:** the browser can't read niches/ at runtime; `tools/build-manifest-index.js` compiles all manifests into `assets/data/manifests.json` (one fetch, built artifact). The hardcoded `THEMES` map in admin/index.html is replaced by this file; absent entry → neutral theme, exactly today's fallback.
- **Endpoint consumption:** `api/operator-content.mjs` reads the same built index (HTTP fetch, same pattern as niche defaults) to resolve per-niche merge paths — this is what fixes "operator uploads invisible on contracting" class bugs generically.
- **dj note (from B1 review):** before any tool emits root content.json for themed niches, `niches/dj/content.json` must gain the owner/seo fields the shipped artifact carries, or the emit regresses dj.

## Decision 2 — Pricing models (first-class, per Jason's ruling)

`pricing.model` drives all three layers:

| model | admin Pricing section shows | merge behavior | render |
|---|---|---|---|
| `tiers` | tier cards (today's editor) | overlay pricing[] by index | existing grids |
| `hourly` | rate rows (label + rate + unit) | overlay the niche's rate structure (mergePath) | crew/rate tables (moving, child-care) |
| `quote` | "starting at" single field + note | overlay minimum/note fields | quote-based niches (delivery, metal-fab) |
| `percentage` | commission % + minimum | overlay commission fields | estate-sale (Phase C validates this) |
| `calculator` | base-rate fields the calculator consumes | overlay calculator inputs | dumpster, dog-walking week builder |
| `flash` | per-item price list | overlay flash[] | tattoo-studio |
| `none` | section hidden with honest caption | no-op | auto-body insurance model |

Admin renders the matching editor from the manifest; the 11-niche silent no-op class dies here. DB stays display-strings in the existing `prices` jsonb (shape loosened per model — validator gains a model-agnostic "array of {label, price_label, note} OR object" form; exact SQL in the plan).

## Decision 3 — Marketing-kit pipeline (brief's open question)

**Server-side render on Vercel: `api/marketing-kit.mjs` using `playwright-core` + `@sparticuz/chromium`** (the standard serverless-chromium pairing), rendering one HTML template per format per niche (`niches/<slug>/marketing/{facebook.html,flyer.html}` with `{{token}}` substitution from merged operator content), to PNG (1080×1350 social) and PDF+PNG (Letter flyer). QR via the `qrcode` npm package at render time encoding the tenant's live URL — no external service. Output uploaded with the service key to `sbv-operator-media/<tenant>/marketing/`, URLs returned; admin gets a **Marketing** tab with live iframe preview (the same HTML, client-side, cheap) + "Generate downloads" (the render call, on demand only).

Rejected: client-side canvas rendering (quality/typography too poor for print), local-only tools/ rendering (operators need self-serve). Cost accepted: 3 new deps (`playwright-core`, `@sparticuz/chromium`, `qrcode`) in package.json — no `"type":"module"` change; function needs `maxDuration` headroom and ~50MB lambda, standard for this pattern. Fallback if the lambda proves too heavy in practice: pre-render at build for demo defaults + on-demand only for operator data.

Prime's two finished pieces land in `niches/bin-cleaning/marketing/` as reference; the platform's own `systems-by-vega-facebook-v2-source.html` is the template-structure exemplar.

## Decision 4 — Shared components (`_template/components/`)

Five components, each included by build-site.js when the manifest flags it: footer-contact (hours+address+social — closes the 0/23 gap), before-after slider (extracted from bin-cleaning; target configurable per manifest merge.beforeAfter), job-details block, reviews block (textContent, empty-state preserved — the B1 lesson baked in: fallback strings live in the component), hero-photo (Ken Burns, from landscaping). Escaping standard: **DOM-property assignment** (the painting pattern the B1 review called stricter) for all new component sinks.

## Decision 5 — Parallelism (brief's open question)

Phase B rolls out with the **B1-proven shape**: parallel implementers on disjoint niche dirs, no-commit contract, controller cross-verifies (byte-check untouched niches, node --check sweep, qa-site), one wave review per batch on the most capable model, controller commits and pushes per batch. Batch size 3–4 niches per implementer wave; B2→B4 order from the inventory. Phase A itself is sequential SDD (shared files).

## A4 housekeeping (in scope, from brief)
- noindex rule: operator sites get `noindex` REMOVED only when the tenant has a saved operator row (a proxy for "went live deliberately") — implemented in middleware via a response header... **correction:** middleware can't alter static body meta; rule becomes: `--demo` keeps meta noindex; tenant pages get `X-Robots-Tag: all` header from middleware when an operator row exists, overriding the meta. Details in plan.
- qa-site real-brand allowlist (bin-cleaning documented exception).
- testerson resend: still gated on `npx vercel login` (interactive — genuinely needs Jason; carried, not blocking).
- Prime-in-aria-labels: bin-cleaning's baked aria-labels/eyebrow become brand-bound during its manifest conversion.
- Reset storage wipe: deferred (Jason approved photos-not-wiped earlier).

## Out of scope for Phase A
Hero redesigns (Phase B), new niches (Phase C), any Stripe/pricing/catalog-copy change (stop condition #3/#5).
