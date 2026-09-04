/* ============================================================================
   Routing Middleware — <client_id>.systemsbyvega.com serves sites/<niche>/
   ----------------------------------------------------------------------------
   Runs BEFORE the cache and before the filesystem, which is the only reason
   this works at all. vercel.json `rewrites` cannot do it: they are fallback-only
   (applied when no file matches the path), so a rewrite whose source is "/" is
   silently skipped, because "/" already serves index.html.

   Two paths are matched, and only two. "/" is the storefront rewrite.
   "/content.json" exists because every storefront boots by fetching that path
   RELATIVE — on the demo page it resolves to the niche's own file, but on a
   tenant subdomain the root was rewritten, so nothing is there; it is sent to
   /api/operator-content instead, which serves the same shape with the
   operator's saved fields laid over the niche defaults. Every other path on a
   tenant subdomain is a real file at that same path and already serves
   correctly, so intercepting it would burn compute to change nothing.

   ── A NOTE ABOUT package.json ───────────────────────────────────────────────
   This file is the only reason package.json exists in this repo. That file must
   NOT gain "type": "module". tools/build-catalog.js — the Vercel buildCommand —
   plus api/demand.js, api/digest.js and api/owner.js are all CommonJS, and the
   flag would break the build on the next deploy. Extensions already carry the
   distinction: .mjs is ESM, .js is CommonJS. Middleware is bundled separately
   as an Edge Function and is unaffected either way.
   ========================================================================== */
import { next, rewrite } from '@vercel/functions';

export const config = { matcher: ['/', '/content.json'] };

const APEX = 'systemsbyvega.com';

/* Hardcoded rather than read from process.env, matching EstateSaleBiz. The
   publishable key is public by design — it ships in every HTML page in this
   repo and RLS is the boundary. Pulling it from the environment would add a
   failure mode and buy no security: one unset variable on a preview deployment
   would route every tenant subdomain to the funnel, silently. */
const SUPABASE_URL  = 'https://newjbexmvltvtmxollca.supabase.co';
const SUPABASE_ANON = 'sb_publishable_ZNgmFmfr7AHbZSEibo7jqQ_z8-Oazhy';

/* client_id's own shape, from sbv_tenants_reserved_ck in COMMERCE.sql. Checked
   before the label is ever concatenated into a URL, and it rejects a dot, so a
   deeper name like a.b.systemsbyvega.com cannot pose as a tenant. */
const LABEL = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/* Per-instance and best-effort. Every visitor to every operator's home page
   hits this lookup, and the answer changes roughly once per sale, so a short
   TTL turns thousands of identical reads into one. A cold instance just misses;
   nothing depends on the cache being warm or shared. */
const TTL_MS = 60000;
const cache = new Map();

async function nicheFor(label) {
  const hit = cache.get(label);
  if (hit && hit.at + TTL_MS > Date.now()) return hit.niche;

  /* Hard 1.5s ceiling. This sits in front of every tenant home page, so a slow
     database has to degrade to the funnel rather than hold the request open. */
  const stop = new AbortController();
  const timer = setTimeout(function () { stop.abort(); }, 1500);

  try {
    /* sbv_public_tenants() is SECURITY DEFINER, already granted to anon, and
       already returns exactly client_id / niche_slug / business_name for active
       tenants. It is `stable`, which is what lets PostgREST serve it over GET
       and filter the result set. No new SQL was needed for routing. */
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/rpc/sbv_public_tenants'
        + '?client_id=eq.' + encodeURIComponent(label)
        + '&select=niche_slug&limit=1',
      {
        headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON },
        signal: stop.signal,
      }
    );
    if (!res.ok) return null;

    const rows = await res.json();
    const niche = (Array.isArray(rows) && rows.length) ? rows[0].niche_slug : null;

    /* Cached either way. A miss is a real answer — an unknown or deactivated
       subdomain — and re-asking on every request would make a mistyped hostname
       the most expensive traffic on the site. */
    cache.set(label, { niche: niche, at: Date.now() });
    return niche;
  } catch (e) {
    /* Fail open. The caller falls through to the funnel, which is a far better
       failure for a real visitor than a 500. */
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function middleware(request) {
  const host = (request.headers.get('host') || '').toLowerCase().split(':')[0];

  /* Apex, www, preview and local are the funnel, untouched. www is excluded
     here in JS rather than in the matcher because Vercel's RE2 matcher has no
     lookahead. */
  if (host === APEX || host === 'www.' + APEX
      || host.endsWith('.vercel.app') || host === 'localhost') {
    return next();
  }

  if (!host.endsWith('.' + APEX)) return next();

  const label = host.slice(0, -(APEX.length + 1));
  if (!LABEL.test(label)) return next();

  /* The storefront's own boot fetch. No tenant lookup needed here: the
     endpoint validates the label and resolves the niche itself, and it already
     answers non-2xx for an unknown tenant — which the page treats as "keep the
     inlined defaults". Passing it through the lookup would just double the
     database reads per page view. */
  const path = new URL(request.url).pathname;
  if (path === '/content.json') {
    return rewrite(new URL('/api/operator-content?tenant=' + label, request.url));
  }

  const niche = await nicheFor(label);

  /* NO DEFAULT TENANT, EVER. An unresolved hostname shows the funnel; it must
     never fall back to some other operator's storefront. */
  if (!niche) return next();

  /* The headers are for reading routing decisions with `curl -I`, nothing more.
     The page itself cannot see them — a document's own response headers are not
     exposed to its JavaScript — so the storefront resolves its tenant from
     location.hostname instead. */
  return rewrite(new URL('/sites/' + niche + '/', request.url), {
    headers: { 'x-niche-slug': niche, 'x-tenant': label },
  });
}
