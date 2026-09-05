-- ============================================================================
-- ADMIN-FIX.sql — the admin save flow's two 403s, one real cause
-- ----------------------------------------------------------------------------
-- SYMPTOMS:
--   1. "permission denied for function sbv_hours_valid" on save
--   2. 403 on Supabase calls in the browser console
--
-- ONE BUG, TWO FACES. PostgREST reports Postgres 42501 (permission denied) as
-- HTTP 403. The save's INSERT/UPDATE evaluates the hours CHECK constraint AS
-- THE WRITING ROLE — not as the table owner, which is what OPERATOR-CONTENT.sql
-- originally assumed when it revoked EXECUTE from everyone. authenticated
-- calls the function, the revoke denies it, the save dies 42501, the console
-- shows 403. Section 1 is the fix.
--
-- THE RLS POLICIES WERE CHECKED AND ARE NOT THE PROBLEM: own_read/own_insert/
-- own_update all gate on sbv_is_tenant(client_id), which is SECURITY DEFINER
-- (it must read RLS-protected sbv_client_users) and granted to authenticated;
-- the table grants (select, insert, update) are in place. Section 2 re-asserts
-- all of it anyway, idempotently, so if the live database has drifted from the
-- SQL files this run converges it. Section 3 proves the end state.
--
-- OPERATOR-CONTENT.sql has been corrected in the same commit, so a clean
-- re-run of the base file produces this same end state.
-- ============================================================================


-- ============================================ 1. THE FIX: function EXECUTE ==
-- authenticated: the admin page's writes evaluate the CHECK as this role.
-- service_role: a future service-key backfill evaluates it the same way —
-- Supabase's service_role bypasses RLS but NOT function privileges.
-- anon stays revoked: it cannot write this table, so it never runs the CHECK.
grant execute on function public.sbv_hours_valid(jsonb) to authenticated, service_role;


-- ==================================== 2. RE-ASSERT RLS + GRANTS (idempotent) ==
-- Exactly what OPERATOR-CONTENT.sql declares. Running it again is a no-op on a
-- healthy database and a repair on a drifted one; either way the end state is
-- known rather than assumed.
--
-- INSERT and UPDATE stay SEPARATE policies because the admin page upserts:
-- PostgREST's merge-duplicates is INSERT .. ON CONFLICT DO UPDATE, which needs
-- both policies AND both table privileges. With only one of each, the first
-- save works and every later save 403s.
alter table public.sbv_operator_content enable row level security;

drop policy if exists sbv_operator_content_own_read on public.sbv_operator_content;
create policy sbv_operator_content_own_read on public.sbv_operator_content
  for select to authenticated
  using (public.sbv_is_tenant(client_id));

drop policy if exists sbv_operator_content_own_insert on public.sbv_operator_content;
create policy sbv_operator_content_own_insert on public.sbv_operator_content
  for insert to authenticated
  with check (public.sbv_is_tenant(client_id));

drop policy if exists sbv_operator_content_own_update on public.sbv_operator_content;
create policy sbv_operator_content_own_update on public.sbv_operator_content
  for update to authenticated
  using (public.sbv_is_tenant(client_id))
  with check (public.sbv_is_tenant(client_id));

grant select, insert, update on public.sbv_operator_content to authenticated;
grant execute on function public.sbv_is_tenant(text) to authenticated;


-- ================================================== 3. VERIFY (all 'true') ==
select 'hours fn: authenticated' as check_name,
       has_function_privilege('authenticated', 'public.sbv_hours_valid(jsonb)', 'execute')::text as got
union all
select 'hours fn: service_role',
       has_function_privilege('service_role', 'public.sbv_hours_valid(jsonb)', 'execute')::text
union all
select 'is_tenant fn: authenticated',
       has_function_privilege('authenticated', 'public.sbv_is_tenant(text)', 'execute')::text
union all
select 'table insert: authenticated',
       has_table_privilege('authenticated', 'public.sbv_operator_content', 'insert')::text
union all
select 'table update: authenticated',
       has_table_privilege('authenticated', 'public.sbv_operator_content', 'update')::text
union all
select 'three policies present',
       (count(*) = 3)::text
from pg_policies
where schemaname = 'public' and tablename = 'sbv_operator_content';
