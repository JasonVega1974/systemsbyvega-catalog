/* ============================================================================
   GET /api/operator-content?tenant=<client_id>
   ----------------------------------------------------------------------------
   The content a tenant storefront renders: the niche's own content.json with
   that operator's saved fields laid over the top.

   PUBLIC. No bearer token, no account. Anyone visiting an operator's site has
   to be able to load it, so this is a read with no auth by design. Everything
   it can return is already meant to be on a public web page.

   ── IT SLOTS INTO A MECHANISM THAT ALREADY EXISTS ───────────────────────────
   Every storefront already boots like this (see any sites/<niche>/index.html):

     1. render window.DEFAULT_CONTENT, inlined at build from content.json
     2. fetch('content.json', {cache:'no-store'})
     3. merge over the defaults and re-render

   Step 2 is a RELATIVE fetch. On the demo path /sites/landscaping/ it resolves
   to the niche's own file. On a tenant subdomain the root is rewritten, so
   middleware.js points /content.json here instead — and the page needs no
   change at all. The override hook the storefront was already built around
   becomes the operator hook.

   That is also why the response is shaped exactly like content.json rather
   than like the database row. The page merges whatever it gets straight over
   DEFAULT_CONTENT; a different shape would silently render nothing.

   ── FAILURE IS SAFE, ON PURPOSE ─────────────────────────────────────────────
   The caller does `r.ok ? r.json() : null` and keeps its inlined defaults on
   null. So every failure path here returns a non-2xx and the visitor sees the
   demo content — never a blank page, never an error. There is no failure mode
   worth breaking a storefront over.
   ========================================================================== */
import { json, preflight, pgSelectOne, SITE_URL, assertConfigured } from './_shared.mjs';

export const config = { runtime: 'nodejs' };

/* client_id's own shape, from sbv_tenants_reserved_ck in COMMERCE.sql. */
const LABEL = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export default { fetch: handler };

async function handler(request) {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'GET') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  try {
    assertConfigured();
  } catch (e) {
    console.error('operator-content: not configured:', e.message);
    return json({ ok: false, error: 'not_configured' }, 503);
  }

  const tenant = String(new URL(request.url).searchParams.get('tenant') || '').toLowerCase();
  if (!LABEL.test(tenant)) {
    return json({ ok: false, error: 'bad_tenant' }, 400);
  }

  /* is_active is part of the filter, not a field to inspect afterwards: a
     deactivated storefront should serve nothing rather than serve stale
     content to the public. The operator can still edit it — the admin page
     reads the base table under RLS for exactly that reason. */
  let tenantRow;
  try {
    tenantRow = await pgSelectOne('sbv_tenants',
      'client_id=eq.' + encodeURIComponent(tenant) +
      '&is_active=eq.true&select=client_id,niche_slug');
  } catch (e) {
    console.error('operator-content: tenant lookup failed:', e.message);
    return json({ ok: false, error: 'lookup_failed' }, 503);
  }
  if (!tenantRow) return json({ ok: false, error: 'unknown_tenant' }, 404);

  const defaults = await nicheDefaults(tenantRow.niche_slug);
  if (!defaults) {
    /* Without the defaults there is nothing to lay operator fields over, and a
       partial object would blank out every key the page had already rendered.
       Better to say nothing and let the inlined copy stand. */
    console.error('operator-content: could not read defaults for', tenantRow.niche_slug);
    return json({ ok: false, error: 'defaults_unavailable' }, 503);
  }

  let op = null;
  try {
    op = await pgSelectOne('sbv_operator_content',
      'client_id=eq.' + encodeURIComponent(tenant) + '&select=*');
  } catch (e) {
    /* A read failure here is not fatal: the niche demo is a valid, intended
       thing for this subdomain to show. Log it and serve the defaults. */
    console.error('operator-content: content read failed:', e.message);
  }

  /* No row is the EXPECTED state for a freshly provisioned operator, not an
     error. They see the demo they were sold until their first save. */
  const body = op ? applyOperator(defaults, op) : defaults;

  /* Short shared cache with a longer stale window. An operator who saves and
     refreshes should see the change quickly, and every other visitor should be
     served from the edge. max-age=0 keeps the browser honest; the page already
     asks with cache:'no-store' anyway. */
  return json(body, 200, {
    'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=120',
  });
}

/* Fetched over HTTP rather than read with fs. Vercel only bundles files it can
   trace from an import, and sites/<niche>/content.json is reached by neither
   import nor require — it would be absent at runtime. Over HTTP it is a static
   CDN asset, always matching the deployment that is serving it, with no
   includeFiles config to keep in step as niches are added. */
async function nicheDefaults(niche) {
  const stop = new AbortController();
  const timer = setTimeout(function () { stop.abort(); }, 2000);
  try {
    const res = await fetch(SITE_URL + '/sites/' + encodeURIComponent(niche) + '/content.json',
      { signal: stop.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* Lay the operator's saved fields over the niche defaults.
   Null and empty are SKIPPED rather than written: null in the database means
   "not set", and copying it across would erase a demo value the operator never
   asked to remove. This is what makes the fall-back work field by field rather
   than all-or-nothing. */
function applyOperator(base, op) {
  const out = Object.assign({}, base);
  out.brand   = Object.assign({}, base.brand || {});
  out.owner   = Object.assign({}, base.owner || {});
  out.contact = Object.assign({}, base.contact || {});

  const set = function (obj, key, val) {
    if (val !== null && val !== undefined && String(val).trim() !== '') obj[key] = val;
  };

  set(out.brand, 'name',  op.business_name);
  set(out.brand, 'phone', op.phone);
  set(out.brand, 'email', op.email);

  /* brand.leadEmail is deliberately NOT touched. It is where the site's contact
     form delivers, and it is info@kingdom-creatives.com for every property in
     this family. An operator editing their public email must not silently
     redirect their own lead flow. */

  /* brand.city is a single display string in the template — "Meridian, ID". */
  if (op.city && op.state_code) out.brand.city = op.city + ', ' + op.state_code;
  else set(out.brand, 'city', op.city);

  set(out.owner, 'name', op.owner_name);
  set(out.owner, 'bio',  op.bio);
  /* owner.photo stays on the demo image: photo upload is Phase B. */

  /* No template renders these yet — content.json has no slot for a street
     address, a postal code, or opening hours, and adding one means editing all
     23 site templates. They are namespaced under `contact` so the data is
     stored, served, and ready the day the templates learn to show it. Serving
     a key nothing reads costs nothing; losing what an operator typed does. */
  set(out.contact, 'address', op.address_line);
  set(out.contact, 'postal',  op.postal_code);
  if (op.hours && typeof op.hours === 'object') out.contact.hours = op.hours;

  return out;
}
