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
import { THEMED_NICHES } from './assets/data/themes.mjs';

export const config = { matcher: ['/', '/content.json', '/terms', '/terms/', '/terms.html',
                                 '/privacy', '/privacy/', '/privacy.html',
                                 '/guide', '/guide/', '/guide.html'] };

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
   nothing depends on the cache being warm or shared. Each entry now carries
   BOTH answers this file needs about a label — niche and hasContent — so a
   home-page visit costs one cache slot and one 1.5s budget, not two. */
const TTL_MS = 60000;
const cache = new Map();


/* -- theme resolution --------------------------------------------------------
   A themed niche has no storefront at sites/<slug>/ -- dj's is a hand-authored
   theme picker -- so a tenant has to be routed to sites/<slug>/<theme>/ or
   they get the picker, and their /terms and /privacy 404 because only the
   themed directories carry those files.

   THEMED_NICHES is generated from the niches/<slug>/themes/ directories by
   tools/build-manifest-index.js, so it is the same list the build itself uses.
   It is a WHITELIST, not a hint: the value comes from the database and is
   pasted into a filesystem path, so anything not in the list is discarded
   rather than sanitised. The column's CHECK in sql/DJ-THEME.sql already bars
   slashes and dots; this is the second of the two locks, and the one that
   matters if the first is ever loosened.

   An unthemed niche returns '' and every existing route is byte-identical to
   before. A themed niche with no recorded theme falls back rather than 404s,
   so a tenant provisioned before the column existed still gets a working
   site. */
function themeSegment(niche, theme) {
  const spec = THEMED_NICHES[niche];
  if (!spec) return '';
  return '/' + (spec.themes.includes(theme) ? theme : spec.fallback);
}

async function nicheFor(label) {
  const hit = cache.get(label);
  if (hit && hit.at + TTL_MS > Date.now()) return hit;

  /* Hard 1.5s ceiling, shared by both requests below (they run concurrently,
     so one budget covers both). This sits in front of every tenant home page,
     so a slow database has to degrade to the funnel rather than hold the
     request open. */
  const stop = new AbortController();
  const timer = setTimeout(function () { stop.abort(); }, 1500);
  const authHeaders = { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON };

  try {
    /* sbv_public_tenants() is SECURITY DEFINER, already granted to anon, and
       already returns exactly client_id / niche_slug / business_name for active
       tenants. It is `stable`, which is what lets PostgREST serve it over GET
       and filter the result set. No new SQL was needed for routing.

       sbv_public_has_content(text) is the SAME pattern (SECURITY DEFINER,
       `stable`, anon-granted) added by sql/HAS-CONTENT.sql — see that file's
       header for why it exists and why the alternatives (extending
       sbv_public_tenants, calling /api/operator-content, or querying
       sbv_operator_content directly with the anon key) were rejected. It
       answers nothing except "does this client_id have a saved row",
       nothing about the row's contents. Until that SQL is applied, this call
       fails (function not found) and hasContent falls back to false below —
       every tenant just keeps today's noindex behavior, so JS can ship ahead
       of SQL without breaking anything; it simply grants nobody `all` yet. */
    const [nicheRes, contentRes] = await Promise.allSettled([
      fetch(
        SUPABASE_URL + '/rest/v1/rpc/sbv_public_tenants'
          + '?client_id=eq.' + encodeURIComponent(label)
          + '&select=niche_slug,theme&limit=1',
        { headers: authHeaders, signal: stop.signal }
      ),
      fetch(
        SUPABASE_URL + '/rest/v1/rpc/sbv_public_has_content'
          + '?p_client_id=' + encodeURIComponent(label),
        { headers: authHeaders, signal: stop.signal }
      ),
    ]);

    /* The niche lookup keeps its original fail-OPEN behavior exactly: a
       rejected/aborted/non-2xx response returns uncached, so the caller falls
       through to the funnel and the NEXT request gets a fresh try rather than
       being stuck behind a bad cache entry. This is the routing-critical
       answer — nothing here should make it worse than before this task. */
    if (nicheRes.status !== 'fulfilled' || !nicheRes.value.ok)
      return { niche: null, theme: null, hasContent: false };

    const rows = await nicheRes.value.json();
    const niche = (Array.isArray(rows) && rows.length) ? rows[0].niche_slug : null;
    /* Validated against the generated whitelist at use, not here — this is
       just the raw column. */
    const theme = (Array.isArray(rows) && rows.length) ? rows[0].theme : null;

    /* hasContent fails CLOSED, on purpose, and independently of the niche
       result above: any missing function, timeout, non-2xx, or malformed body
       leaves it false, i.e. noindex — the conservative default the spec
       calls for, never "all" on an unknown answer. */
    let hasContent = false;
    if (contentRes.status === 'fulfilled' && contentRes.value.ok) {
      try {
        const val = await contentRes.value.json();
        hasContent = val === true;
      } catch (e) { /* malformed body — stays false */ }
    }

    /* Cached either way. A niche miss is a real answer — an unknown or
       deactivated subdomain — and re-asking on every request would make a
       mistyped hostname the most expensive traffic on the site. Same logic
       covers hasContent: a transient failure is cached as noindex for one TTL
       window rather than retried on every request. */
    const result = { niche: niche, theme: theme, hasContent: hasContent };
    cache.set(label, { niche: result.niche, theme: result.theme,
                       hasContent: result.hasContent, at: Date.now() });
    return result;
  } catch (e) {
    /* Fail open on the niche (caller falls through to the funnel, a far
       better failure for a real visitor than a 500) and closed on
       hasContent (noindex), uncached either way so the next request retries. */
    return { niche: null, theme: null, hasContent: false };
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

  const { niche, theme, hasContent } = await nicheFor(label);

  /* NO DEFAULT TENANT, EVER. An unresolved hostname shows the funnel; it must
     never fall back to some other operator's storefront. */
  if (!niche) return next();

  /* The headers are for reading routing decisions with `curl -I`, nothing more.
     The page itself cannot see them — a document's own response headers are not
     exposed to its JavaScript — so the storefront resolves its tenant from
     location.hostname instead.

     X-Robots-Tag is the ONLY signal now. tools/build-site.js sets ROBOTS: ''
     for every built page, and none of the 32 tenant artifacts carries a
     baked <meta name="robots"> tag — the header/body conflict this comment
     used to warn about no longer exists. `all` only when hasContent says
     this tenant has a saved sbv_operator_content row (a proxy for "went live
     deliberately"); every other case — no row, lookup failure, RPC not yet
     deployed — stays `noindex`. See sql/HAS-CONTENT.sql and nicheFor() above
     for how hasContent is resolved and why it fails closed. */
  /* The operator's own legal pages. Built per niche by tools/build-site.js and
     served from the same directory as the storefront, so the tenant sees them
     at /terms and /privacy. Always noindex: these are 32 near-identical
     template documents, and letting them compete with the storefront in search
     would be the opposite of useful. Unlike the storefront rewrite there is no
     hasContent condition — a template policy is not something a tenant opts
     into publishing, it is just there. */
  /* Both spellings are matched because the built page links to these
     RELATIVELY. That same index.html is served at /sites/<slug>/ on the
     catalog and at / on a tenant, so a relative "terms.html" resolves to
     /sites/<slug>/terms.html in one place and /terms.html in the other. The
     bare /terms is what an operator would type or print on a card. */
  /* vercel.json sets trailingSlash:true, so a visitor typing /terms is
     308'd to /terms/ before this ever runs. Comparing the raw path meant
     /terms/ missed the branch below and fell through to the storefront
     rewrite -- the tenant's own site served under the Terms URL, 200 and
     all. Normalise BOTH decorations, and leave '/' alone so stripping does
     not turn the storefront path into an empty string. */
  const legal = path === '/' ? '/' : path.replace(/\/+$/, '').replace(/\.html$/, '');
  if (legal === '/terms' || legal === '/privacy' || legal === '/guide') {
    return rewrite(new URL('/sites/' + niche + themeSegment(niche, theme)
                           + legal + '.html', request.url), {
      headers: {
        'x-niche-slug': niche,
        'x-tenant': label,
        'X-Robots-Tag': 'noindex',
      },
    });
  }

  return rewrite(new URL('/sites/' + niche + themeSegment(niche, theme) + '/', request.url), {
    headers: {
      'x-niche-slug': niche,
      'x-tenant': label,
      'X-Robots-Tag': hasContent ? 'all' : 'noindex',
    },
  });
}
