-- ============================================================================
-- ADMIN-RESET.sql — own-row DELETE for the admin's "Reset to defaults"
-- ----------------------------------------------------------------------------
-- RUN AFTER: OPERATOR-CONTENT-3.sql. Idempotent.
--
-- REVERSAL, ON PURPOSE. OPERATOR-CONTENT.sql deliberately shipped no DELETE
-- policy: "dropping the row would silently republish the niche demo under the
-- operator's name, which is not something a delete button should be able to do
-- by accident." That guard was against ACCIDENT. The admin now has a deliberate
-- reset feature behind a type-to-confirm gate ("RESET"), which satisfies the
-- guard's intent; the policy below is what makes the confirmed path work.
-- "No row" remains the platform's documented clean state — a reset returns the
-- tenant to exactly the state a fresh provision starts in.
--
-- Scope: the same sbv_is_tenant() predicate as every other policy on this
-- table. A caller can only ever delete their own tenant's row; RLS enforces it
-- regardless of what the client sends.
-- ============================================================================

drop policy if exists sbv_operator_content_own_delete on public.sbv_operator_content;
create policy sbv_operator_content_own_delete on public.sbv_operator_content
  for delete to authenticated
  using (public.sbv_is_tenant(client_id));

-- A policy without the table grant fails with the same 42501 as a missing
-- policy (the standing lesson) — both stated explicitly.
grant delete on public.sbv_operator_content to authenticated;

-- ==================================================== VERIFY (all 'true') ==
select 'delete policy present' as check_name,
       (count(*) = 1)::text as got
from pg_policies
where schemaname = 'public' and tablename = 'sbv_operator_content'
  and policyname = 'sbv_operator_content_own_delete'
union all
select 'table delete: authenticated',
       has_table_privilege('authenticated', 'public.sbv_operator_content', 'delete')::text
union all
select 'anon still has nothing',
       (not has_table_privilege('anon', 'public.sbv_operator_content', 'delete'))::text;
