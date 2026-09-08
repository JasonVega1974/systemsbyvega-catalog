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

   ── MANIFEST-DRIVEN MERGE ROUTING (Phase A-core, 2026-09-06) ───────────────
   niches/<slug>/manifest.json (compiled to assets/data/manifests.json) tells
   this endpoint WHERE an operator's saved prices/photos/reviews/owner fields
   land for a given niche, instead of every niche being forced through the
   same hardcoded paths that only ever matched the tiers-pricing, before/after-
   on-niche, testimonials-everywhere shape. A manifest absent for a niche (the
   index failed to load, or the niche has no entry yet) means applyOperator
   falls back to EXACTLY today's hardcoded behavior — that fallback is the
   regression guard for the rollout, not a re-implementation of it.
   ========================================================================== */
import { json, preflight, pgSelectOne, SITE_URL, assertConfigured } from './_shared.mjs';
import { THEMED_NICHES } from '../assets/data/themes.mjs';

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
      '&is_active=eq.true&select=client_id,niche_slug,theme');
  } catch (e) {
    console.error('operator-content: tenant lookup failed:', e.message);
    return json({ ok: false, error: 'lookup_failed' }, 503);
  }
  if (!tenantRow) return json({ ok: false, error: 'unknown_tenant' }, 404);

  const defaults = await nicheDefaults(tenantRow.niche_slug, tenantRow.theme);
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
     error. They see the demo they were sold until their first save. There is
     also nothing to merge-route in that case, so the manifest index is only
     worth fetching when there is an operator row to lay over the defaults. */
  let manifest = null;
  if (op) {
    const index = await manifestIndex();
    /* hasOwnProperty guard, not a bare `index[slug]`: niche_slug is
       operator-controlled data flowing into a plain-object lookup, and a
       slug that happened to collide with an inherited Object.prototype key
       (e.g. "constructor") would otherwise resolve to that instead of
       undefined — null is the only acceptable "not found" here. */
    manifest = (index && Object.prototype.hasOwnProperty.call(index, tenantRow.niche_slug))
      ? index[tenantRow.niche_slug] : null;
  }
  const body = op ? applyOperator(defaults, op, manifest) : defaults;

  /* The tenant's own id, so the page knows which lead list a form submission
     belongs to. Set from the TENANT row, not the operator-content row: a
     freshly provisioned operator has no content row at all — that is the
     expected state until their first save — and reading it from `op` would
     have left clientId null for exactly the operator most likely to be
     taking their first enquiries.

     It appears only in this merged response. The niche's own content.json on
     the demo path has no clientId, and that absence is how the page tells a
     claimed site from a demo and skips the lead call rather than writing
     rows against a tenant that does not exist. */
  body.clientId = tenantRow.client_id;

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
/* A themed niche's real content lives under sites/<slug>/<theme>/, not at
   sites/<slug>/ -- dj's root is a hand-authored theme picker. Serving the root
   file to a themed tenant would hand their storefront the wrong copy under the
   right palette, which is worse than an obvious failure because it looks fine.

   Same generated whitelist the router uses, and for the same reason: this
   value comes from the database and is pasted into a URL path. An unknown or
   missing theme falls back rather than 404s. Unthemed niches get '' and their
   fetch is byte-identical to before. */
function themePath(niche, theme) {
  const spec = THEMED_NICHES[niche];
  if (!spec) return '';
  return '/' + encodeURIComponent(spec.themes.includes(theme) ? theme : spec.fallback);
}

async function nicheDefaults(niche, theme) {
  const stop = new AbortController();
  const timer = setTimeout(function () { stop.abort(); }, 2000);
  try {
    const res = await fetch(SITE_URL + '/sites/' + encodeURIComponent(niche)
      + themePath(niche, theme) + '/content.json',
      { signal: stop.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* Same HTTP-over-fs reasoning as nicheDefaults: assets/data/manifests.json is
   a built, static artifact (tools/build-manifest-index.js, controller-run),
   always matching the deployment serving it. Module-level cache with a TTL
   because the index only changes on deploy — no point re-fetching it on every
   request for the lifetime of a warm lambda. fetch() is wrapped in
   Promise.resolve() and everything funnels through one terminal catch: a
   flaky or slow index must never turn into a 5xx here, only into the legacy
   fallback path in applyOperator. */
let manifestCache = { data: null, at: 0 };
const MANIFEST_TTL_MS = 5 * 60 * 1000;

async function manifestIndex() {
  const now = Date.now();
  if (manifestCache.data && (now - manifestCache.at) < MANIFEST_TTL_MS) {
    return manifestCache.data;
  }
  const stop = new AbortController();
  const timer = setTimeout(function () { stop.abort(); }, 2000);
  try {
    const res = await Promise.resolve(
      fetch(SITE_URL + '/assets/data/manifests.json', { signal: stop.signal }));
    if (!res.ok) return null;
    const data = await res.json();
    manifestCache = { data: data, at: now };
    return data;
  } catch (e) {
    console.error('operator-content: manifest index fetch failed:', e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ── Pricing overlay field maps (manifest-driven path only) ────────────────
   The admin's saved shape is validator-constrained (sbv_prices_valid, Task 1)
   to a small fixed key set — label/price_label/per/note/features/unit/rate
   for the array form, starting_at/note/commission/minimum for the object
   form — but a niche's OWN pricing rows don't always use those names. Where
   they line up, the map is the identity; where they don't, the mapping is a
   deliberate decision, recorded here:
     - "pricing" (the tiers default most niches use): price_label -> blurb.
       That is today's convention (a display string, not a machine value) —
       unchanged by this task.
     - "plans" (landscaping): label -> tier, price_label -> price ONLY.
       plans[] rows also carry freq ("Weekly, April - October") and a best
       flag the admin's tiers editor has no field for; guessing either from a
       price label would be worse than leaving the demo's copy standing, so
       this decision leaves both alone.
     - "niche.flash" (tattoo-studio): label -> title, price_label -> price.
       The flash board's cards are titled/priced, not labeled/price_labeled.
     - everything else (niche.crewTiers, niche.walkServices, niche.rates,
       sizes, pricing.ranges, ...) uses the identity map. Several of these
       targets already use label/rate/unit directly (moving's crewTiers is
       exactly {label, rate, unit} among other fields); where a niche's row
       shape uses names the validator doesn't even allow saving yet, identity
       is a safe no-op rather than an invented mapping. */
const ARRAY_FIELD_MAPS = {
  pricing: { label: 'label', price_label: 'blurb', per: 'per', note: 'note', features: 'features' },
  plans: { label: 'tier', price_label: 'price' },
  'niche.flash': { label: 'title', price_label: 'price' },
};
const DEFAULT_ARRAY_FIELD_MAP = {
  label: 'label', price_label: 'price_label', per: 'per', note: 'note',
  unit: 'unit', rate: 'rate', features: 'features',
};

/* Resolves a manifest mergePath ("pricing", "plans", "sizes", "niche.X",
   "pricing.ranges") against base/out. mergePaths in the wild are at most two
   segments, so this does not attempt a general-purpose deep-path walker.
   Returns null when the path is unusable against THIS niche's actual content
   shape (an intermediate segment missing, or not a plain object) — the
   caller's job is to skip and warn, never to throw or to coerce the shape. */
function pricingTarget(out, base, mergePath) {
  const parts = mergePath.split('.');
  if (parts.length === 1) {
    const key = parts[0];
    return { baseVal: base[key], set: function (v) { out[key] = v; } };
  }
  const outerKey = parts[0];
  const innerKey = parts[1];
  const outerBase = base[outerKey];
  if (outerBase === null || typeof outerBase !== 'object' || Array.isArray(outerBase)) {
    return null;
  }
  out[outerKey] = Object.assign({}, out[outerKey] || {});
  return {
    baseVal: outerBase[innerKey],
    set: function (v) { out[outerKey][innerKey] = v; },
  };
}

/* By-index field-merge for the array pricing shape (tiers/hourly/calculator/
   flash). The SAVED array is authoritative for row count (final-platform-
   review #1): iterate op's rows, not the base's. A saved row at an index the
   demo also has merges field-by-field onto the demo row, keeping base-only
   fields the admin never edits (features, tagline, highlight) — exactly the
   old per-row behavior. A saved row PAST the demo's length becomes a pure
   operator row built from the field map alone, so an operator with more
   packages than the demo publishes all of them. A saved array SHORTER than
   the demo truncates: the admin compacts cleared rows out before saving, so
   a 2-row save from a 3-row demo means the operator removed a tier — the
   demo's fictional extra tier must not stay live on their real site.
   Callers only reach here with a non-empty array (overlayPricingManifest
   guards), so a never-saved or cleared operator still gets the full demo. */
function overlayArrayByIndex(baseArr, opArr, fieldMap) {
  return opArr.map(function (o, i) {
    const merged = (i < baseArr.length) ? Object.assign({}, baseArr[i]) : {};
    if (!o || typeof o !== 'object') return merged;
    Object.keys(fieldMap).forEach(function (fromKey) {
      const toKey = fieldMap[fromKey];
      const v = o[fromKey];
      if (fromKey === 'features') {
        if (Array.isArray(v) && v.length) merged[toKey] = v;
      } else if (v !== null && v !== undefined && String(v).trim() !== '') {
        merged[toKey] = v;
      }
    });
    return merged;
  });
}

/* Object-shape counterpart to ARRAY_FIELD_MAPS, same bug class it exists
   for: the admin's quote/percentage editor saves the operator-facing key
   (sbv_prices_valid's object form — "starting_at" is what an operator
   means by "starting at", and stays the stored key on the DB/validator
   side). A niche's own quoterSettings speaks its own dialect — delivery's
   quote calculator reads its floor as `minimum`, not `starting_at` — so
   without a rename the operator's edit lands under a key the consumer
   never reads: a silent no-op (or an orphan key sitting unread next to the
   real one) exactly like an unmapped ARRAY_FIELD_MAPS entry would be.
   Only mergePaths that need a rename are listed; every other object
   mergePath (today, none) falls through unmapped in overlayObjectKeys. */
const OBJECT_FIELD_MAPS = {
  'niche.quoterSettings': { starting_at: 'minimum' },
};

/* Key-merge for the object pricing shape (quote/percentage): whatever the
   operator saved lands on the target object under fieldMap's renamed key
   when one is given (CONSUMING the saved key, not duplicating it alongside
   a mapped copy), or under its own name when fieldMap has no entry for it —
   those keys are already display-ready strings, no renaming decision needed
   for the ones that already line up. */
function overlayObjectKeys(baseObj, opObj, fieldMap) {
  fieldMap = fieldMap || {};
  const merged = Object.assign({}, baseObj);
  Object.keys(opObj).forEach(function (k) {
    const v = opObj[k];
    if (v === null || v === undefined || String(v).trim() === '') return;
    const toKey = fieldMap[k] || k;
    merged[toKey] = v;
  });
  return merged;
}

/* Routes op.prices to manifest.pricing.mergePath, model-aware: pricing.model
   decides whether the saved shape SHOULD be an array (tiers/hourly/
   calculator/flash) or an object (quote/percentage) — matching the two
   shapes sbv_prices_valid actually allows (Task 1). A saved shape that
   doesn't match (a legacy tiers array sitting on a niche whose manifest now
   says "quote", or a mergePath whose own target isn't the shape the manifest
   claims) is a real possibility during rollout, not a bug to crash on: warn
   and leave the demo's pricing standing. */
function overlayPricingManifest(out, base, op, manifest) {
  const cfg = manifest.pricing || {};
  const mergePath = cfg.mergePath;
  if (!mergePath || mergePath === 'none') return;
  if (op.prices === null || op.prices === undefined) return;

  const target = pricingTarget(out, base, mergePath);
  if (!target) {
    console.warn('operator-content: pricing mergePath "' + mergePath +
      '" has no usable target in this niche\'s content — skipping');
    return;
  }

  const wantsObject = cfg.model === 'quote' || cfg.model === 'percentage';
  const gotArray = Array.isArray(op.prices);

  if (wantsObject) {
    if (gotArray || target.baseVal === null || typeof target.baseVal !== 'object' ||
        Array.isArray(target.baseVal)) {
      console.warn('operator-content: saved prices do not match pricing.model "' +
        cfg.model + '" for mergePath "' + mergePath + '" — skipping');
      return;
    }
    target.set(overlayObjectKeys(target.baseVal, op.prices, OBJECT_FIELD_MAPS[mergePath]));
  } else {
    if (!gotArray || !Array.isArray(target.baseVal)) {
      console.warn('operator-content: saved prices do not match pricing.model "' +
        cfg.model + '" for mergePath "' + mergePath + '" — skipping');
      return;
    }
    /* Only a NON-EMPTY saved array becomes length-authoritative. An empty
       array is not a shape the admin ever writes (readPriceRows() returns
       null, never [], and collectRow() sends that null so the column truly
       clears) — but if one is ever in the column, treat it exactly like
       "never saved" and leave the demo pricing standing, which is also what
       the old base-length merge did with []. Truncating the demo to zero
       rows on a value that means "nothing entered" would be the silent-wipe
       failure class this platform exists to avoid. */
    if (!op.prices.length) return;
    const fieldMap = ARRAY_FIELD_MAPS[mergePath] || DEFAULT_ARRAY_FIELD_MAP;
    target.set(overlayArrayByIndex(target.baseVal, op.prices, fieldMap));
  }
}

/* Lay the operator's saved fields over the niche defaults.
   Null and empty are SKIPPED rather than written: null in the database means
   "not set", and copying it across would erase a demo value the operator never
   asked to remove. This is what makes the fall-back work field by field rather
   than all-or-nothing.

   `manifest` is the compiled niches/<slug>/manifest.json entry for this
   tenant's niche, or null. Null means "behave exactly as before manifests
   existed" — every hardcoded path below is unchanged from the original,
   untouched inside the `if (!manifest)` branches, on purpose: that is the
   regression guard for the whole rollout, not a re-implementation of the
   old behavior via the new generic machinery. */
function applyOperator(base, op, manifest) {
  const out = Object.assign({}, base);
  out.brand   = Object.assign({}, base.brand || {});
  out.owner   = Object.assign({}, base.owner || {});
  out.contact = Object.assign({}, base.contact || {});
  out.niche   = Object.assign({}, base.niche || {});

  const set = function (obj, key, val) {
    if (val !== null && val !== undefined && String(val).trim() !== '') obj[key] = val;
  };

  set(out.brand, 'name',  op.business_name);
  set(out.brand, 'phone', op.phone);
  set(out.brand, 'email', op.email);

  /* Editable-prototype additions (spec 2026-09-05). All skip-empty, so a
     tenant that has set only a logo keeps the demo's photos and prices. */
  set(out.brand, 'logo', op.logo_url);
  /* lead_email is the ONLY path to brand.leadEmail — the public `email`
     column deliberately cannot redirect the lead flow. */
  set(out.brand, 'leadEmail', op.lead_email);

  /* Operator-added legal clauses (brief 2026-09-07 §2). These are ADDITIONS
     to the generated template, never replacements: the admin labels them that
     way and the rendered page keeps the whole template above them. The row is
     selected with select=*, so these arrive automatically once the columns
     exist and are simply absent until then — set() skips undefined, so a
     deploy before sql/LEGAL-COLUMNS.sql is applied behaves as if no operator
     had written any. */

  out.legal = Object.assign({}, base.legal || {});
  set(out.legal, 'termsCustom',   op.terms_custom);
  set(out.legal, 'privacyCustom', op.privacy_custom);

  const ph = (op.photos && typeof op.photos === 'object') ? op.photos : {};

  /* ── beforeAfter photos ─────────────────────────────────────────────── */
  if (!manifest) {
    set(out.niche, 'beforeImg', ph.before);
    set(out.niche, 'afterImg',  ph.after);
  } else {
    const beforeAfter = manifest.merge && manifest.merge.beforeAfter;
    if (beforeAfter === 'niche.beforeImg/afterImg') {
      set(out.niche, 'beforeImg', ph.before);
      set(out.niche, 'afterImg',  ph.after);
    } else if (beforeAfter === 'projects[0]') {
      /* Some niches (contracting) show their before/after as the first
         signature project rather than a single before/after slot. The PAGE
         reads CONTENT.projects — but only after base.js's SLflat() has
         flattened c.niche onto the top level, so in the RAW json this array
         can live at either projects or niche.projects (contracting nests
         it; Phase B W3 authored its demo data there). Overlay onto
         whichever one exists and write back to the SAME spot, so the
         client-side flatten keeps resolving it. Neither present -> skip
         and warn rather than inventing a projects array from nothing. */
      const topProjects = Array.isArray(base.projects) && base.projects.length
        ? base.projects : null;
      const nestedProjects = !topProjects && base.niche
        && Array.isArray(base.niche.projects) && base.niche.projects.length
        ? base.niche.projects : null;
      if (topProjects || nestedProjects) {
        const arr = (topProjects || nestedProjects).slice();
        arr[0] = Object.assign({}, arr[0]);
        set(arr[0], 'beforeImg', ph.before);
        set(arr[0], 'afterImg',  ph.after);
        if (topProjects) out.projects = arr;
        else set(out.niche, 'projects', arr);
      } else {
        console.warn('operator-content: beforeAfter mergePath "projects[0]" ' +
          'requested but this niche has no projects[] at either level — skipping');
      }
    }
    /* "none" (auto-body, dj, and every quote/calculator/flash niche without a
       before/after slot): no-op by design — there is nothing to merge. */

    /* ── hero photo (Phase A-core F2 fix) ─────────────────────────────────
       Manifest-present only, deliberately: renderPhotoZones() in admin/
       index.html only renders a hero upload zone when manifest.photoSlots
       includes 'hero' (tools/build-site.js gates its hero-photo module the
       same way), so a legacy/no-manifest niche can never produce ph.hero in
       the first place — there is no "before" to keep this consistent with
       there. Writing it into out.niche.heroImg here is the same
       stored-now-render-later pattern as jobDetails below — and as of
       Phase B, _template/components/hero-photo.js DOES read niche.heroImg
       on every heroWired niche, so saved hero uploads render there. Before this fix, an
       operator's hero upload landed in sbv_operator_content.photos.hero and
       simply never left this function. */
    set(out.niche, 'heroImg', ph.hero);
  }

  /* ── owner photo/name/bio ───────────────────────────────────────────── */
  const ownerShape = manifest ? (manifest.merge && manifest.merge.ownerShape) : 'owner';
  if (ownerShape !== 'none') {
    set(out.owner, 'photo', ph.owner);
  }

  /* ── prices ──────────────────────────────────────────────────────────
     prices overlay pricing[] BY INDEX, field-by-field: editing one tier's
     price keeps the demo's feature list. price_label maps onto the template's
     `blurb` key (display-string convention). This is the legacy, manifest-
     absent behavior, kept verbatim as the fallback. */
  if (!manifest) {
    if (Array.isArray(op.prices) && Array.isArray(base.pricing)) {
      out.pricing = base.pricing.map((tier, i) => {
        const o = op.prices[i];
        if (!o) return tier;
        const merged = Object.assign({}, tier);
        const setT = (k, v) => { if (v !== null && v !== undefined && String(v).trim() !== '') merged[k] = v; };
        setT('label', o.label); setT('blurb', o.price_label);
        setT('per', o.per); setT('note', o.note);
        if (Array.isArray(o.features) && o.features.length) merged.features = o.features;
        return merged;
      });
    }
  } else {
    overlayPricingManifest(out, base, op, manifest);
  }

  /* ── reviews ─────────────────────────────────────────────────────────
     Overlay the demo's (empty) testimonial cards. author -> name is the
     template's key. Only a non-empty array overlays: empty means "not set",
     and the demo's deliberate empty cards stand. Manifests can turn this
     off entirely (merge.reviews === "none") for niches with no reviews
     section at all — today's behavior always overlaid, unconditionally. */
  const reviewsOff = manifest && manifest.merge && manifest.merge.reviews === 'none';
  if (!reviewsOff && Array.isArray(op.reviews) && op.reviews.length) {
    out.testimonials = op.reviews.map(r => ({
      quote: r.quote || '', name: r.author || '', rating: r.rating || null,
    }));
  }
  if (Array.isArray(op.social) && op.social.length) out.social = op.social;
  /* Stored-only until a template slot exists (deferred 2026-09-05). Served
     so the day the slot lands, saved data appears without a migration. */
  if (op.job_details && typeof op.job_details === 'object') out.jobDetails = op.job_details;

  /* brand.city is a single display string in the template — "Meridian, ID". */
  /* estate-sale/garage-sale carry a SPLIT brand.city + brand.state and
     compose the pair themselves (niche.js locale, marketing-kit cityState).
     Writing the combined string into brand.city there would render
     "Boise, ID, ID" on the site AND the kit — so a niche whose defaults
     declare brand.state gets the split write; everyone else keeps the
     combined form their pages were built around. */
  if (base.brand && base.brand.state) {
    set(out.brand, 'city',  op.city);
    set(out.brand, 'state', op.state_code);
  } else if (op.city && op.state_code) {
    out.brand.city = op.city + ', ' + op.state_code;
  } else {
    set(out.brand, 'city', op.city);
  }

  if (ownerShape !== 'none') {
    set(out.owner, 'name', op.owner_name);
    set(out.owner, 'bio',  op.bio);
  }

  /* No template renders these yet — content.json has no slot for a street
     address, a postal code, or opening hours, and adding one means editing all
     23 site templates. They are namespaced under `contact` so the data is
     stored, served, and ready the day the templates learn to show it. Serving
     a key nothing reads costs nothing; losing what an operator typed does. */
  set(out.contact, 'address', op.address_line);
  set(out.contact, 'postal',  op.postal_code);
  /* Hours are either a plain string ("Monday - Friday 8am-5pm") or the
     structured per-day object — the validator accepts both, so both pass
     through. The object-only check this replaced silently dropped every
     string an operator saved. */
  if (op.hours != null && op.hours !== '') out.contact.hours = op.hours;

  return out;
}
