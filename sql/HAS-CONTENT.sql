-- ============================================================================
-- HAS-CONTENT.sql — the one signal middleware.js needs for the noindex rule
-- ----------------------------------------------------------------------------
-- RUN AFTER: SETUP.sql, COMMERCE.sql, COMMERCE-2.sql, OPERATOR-CONTENT.sql,
-- OPERATOR-CONTENT-2.sql, OPERATOR-CONTENT-3.sql.
--
-- ── WHY THIS FILE EXISTS (Phase A-core, Task 8, A4 housekeeping) ───────────
-- middleware.js needs to know, per tenant subdomain and on every request, one
-- boolean: does this tenant have a saved row in sbv_operator_content? A "yes"
-- means the operator deliberately took the storefront over from the demo, so
-- the response gets `X-Robots-Tag: all`, overriding the `--demo` build's baked
-- <meta name="robots" content="noindex">. A "no" (or any error) keeps
-- `X-Robots-Tag: noindex` — conservative default, fail closed.
--
-- OPERATOR-CONTENT.sql is explicit and deliberate that anon gets NO grants at
-- all on sbv_operator_content — "One public path, and it is one we control and
-- can cache" (api/operator-content.mjs, service key, server-side only). That
-- reasoning is sound and this file does not relitigate it: it does not grant
-- anon anything on the table. It adds one narrow, boolean-only, SECURITY
-- DEFINER function — same shape as sbv_public_tenants() in COMMERCE.sql — that
-- answers exactly one question and leaks nothing else: not which fields are
-- set, not their values, not updated_at, not who saved them. That is the
-- established pattern in this repo for "anon needs a fact that lives behind
-- RLS it may never read directly."
--
-- Options considered and rejected (see Task 8 report for the full reasoning):
--   (a) extend sbv_public_tenants() to also return has_content — rejected;
--       out of scope for a non-controller pass and mixes an unrelated concern
--       into an existing public function's contract.
--   (b) middleware HEAD/GETs /api/operator-content?tenant=<label> itself —
--       rejected; circular (middleware calling back into the same deployment)
--       and heavier than one PostgREST round trip.
--   (c) middleware queries sbv_operator_content directly over PostgREST with
--       the anon key — rejected outright; anon has zero grants on that table
--       by design (verified against OPERATOR-CONTENT.sql section 4 below),
--       so this would 401/42501 on every request, not silently degrade.
--   (d) this file — a tiny SECURITY DEFINER boolean function, anon-granted,
--       modeled on the one already-public sbv_public_tenants().
-- ============================================================================


-- ============================================================== 1. FUNCTION ==
-- `stable`, not `volatile`: reads only, and it lets PostgREST serve it over
-- GET (same reasoning as sbv_public_tenants()'s comment in COMMERCE.sql).
-- `security definer set search_path = ''` so it can read a table anon holds
-- no privilege on, and so it cannot be tricked by a search_path override into
-- resolving `sbv_operator_content` to some other schema's object — every
-- identifier below is schema-qualified for that same reason.
--
-- Deliberately does NOT check sbv_tenants.is_active: a deactivated tenant's
-- subdomain already fails to resolve in middleware.js's nicheFor() (niche
-- comes back null from sbv_public_tenants(), which DOES filter on is_active),
-- so this function is invoked but its answer discarded before headers are set for that client_id. Duplicating the
-- filter here would be dead code, not defense in depth.
create or replace function public.sbv_public_has_content(p_client_id text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.sbv_operator_content oc
    where oc.client_id = p_client_id
  );
$$;


-- ================================================================ 2. GRANTS ==
-- Scoped to this one function, matching COMMERCE.sql's and OPERATOR-CONTENT.sql's
-- note: a blanket revoke here would strip grants those files' objects depend on.
revoke all    on function public.sbv_public_has_content(text)
  from public, anon, authenticated;
grant execute on function public.sbv_public_has_content(text)
  to anon, authenticated;

-- The table itself is UNTOUCHED by this file. No grant is added here, and none
-- should ever be: the function above is the only door, and it opens onto
-- exactly one boolean.


-- ============================================================================
-- VERIFY — run after applying. Every query below states its own pass condition.
-- Nothing here writes.
-- ============================================================================

-- 1. The function exists, is SECURITY DEFINER, and runs with an empty
--    search_path. Expect 1 row: security_type = 'DEFINER'.
select routine_name, security_type, data_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'sbv_public_has_content';

-- 2. anon and authenticated can EXECUTE the function. Expect 2 rows
--    (anon, authenticated), privilege_type = 'EXECUTE'.
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name = 'sbv_public_has_content'
  and grantee in ('anon', 'authenticated');

-- 3. anon's TABLE footprint on sbv_operator_content is still ZERO — this file
--    must not have widened OPERATOR-CONTENT.sql's "no anon grants at all"
--    rule. Expect ZERO rows.
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'sbv_operator_content'
  and grantee = 'anon';

-- 4. Smoke test over PostgREST once deployed (run from a shell, not this SQL
--    file — included here so the controller has it in one place):
--      curl -s "$SUPABASE_URL/rest/v1/rpc/sbv_public_has_content" \
--        -H "apikey: $ANON_KEY" -H "authorization: Bearer $ANON_KEY" \
--        -H "content-type: application/json" \
--        -d '{"p_client_id":"some-real-client-id"}'
--    Expect `true` for a client_id with a saved sbv_operator_content row,
--    `false` for one without, and a clean 200 either way — no 42501, no 401.
