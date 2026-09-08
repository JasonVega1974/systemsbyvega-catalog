-- ============================================================================
-- LEGAL-COLUMNS.sql — let an operator add their own clauses to the generated
-- Terms and Privacy pages served at <tenant>.systemsbyvega.com/{terms,privacy}.
-- ----------------------------------------------------------------------------
-- These are ADDITIONS, never replacements. The generated template always
-- renders above them, and the admin labels the fields that way. The page puts
-- the operator's text in with textContent, so it is displayed as plain text and
-- cannot inject markup into their own page.
--
-- 3000 characters is the same order as the existing long-text columns and is
-- enforced here rather than only in the browser, because the admin is not the
-- only thing that can reach PostgREST with a valid JWT.
--
-- Empty string is normalised to NULL by the check rather than rejected: the
-- admin sends '' when an operator clears the box, and a row that means "no
-- custom clauses" should look the same whether it was never set or was emptied.
--
-- Idempotent: add column if not exists, and each constraint is dropped before
-- being recreated. Run against SystemsByVega (newjbexmvltvtmxollca) ONLY.
-- ============================================================================

alter table public.sbv_operator_content
  add column if not exists terms_custom   text,
  add column if not exists privacy_custom text;

alter table public.sbv_operator_content
  drop constraint if exists sbv_operator_content_terms_custom_ck;
alter table public.sbv_operator_content
  add  constraint sbv_operator_content_terms_custom_ck
  check (terms_custom is null or char_length(terms_custom) between 1 and 3000);

alter table public.sbv_operator_content
  drop constraint if exists sbv_operator_content_privacy_custom_ck;
alter table public.sbv_operator_content
  add  constraint sbv_operator_content_privacy_custom_ck
  check (privacy_custom is null or char_length(privacy_custom) between 1 and 3000);

-- The table's existing column-level grants do not extend to columns added
-- later, so the update grant is re-issued naming them. Without this an operator
-- saving the Legal section gets a 42501 that looks like an RLS failure and is
-- not one — the same trap documented for every other validator in this repo.
grant update (terms_custom, privacy_custom)
  on public.sbv_operator_content to authenticated, service_role;

-- ================================================ VERIFY ==
select 'both columns exist' as check_name,
       (count(*) = 2)::text as got
  from information_schema.columns
 where table_schema = 'public' and table_name = 'sbv_operator_content'
   and column_name in ('terms_custom', 'privacy_custom')
union all select 'both length checks exist',
       (count(*) = 2)::text
  from pg_constraint
 where conrelid = 'public.sbv_operator_content'::regclass
   and conname in ('sbv_operator_content_terms_custom_ck',
                   'sbv_operator_content_privacy_custom_ck')
union all select 'authenticated can update both',
       (count(*) = 2)::text
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'sbv_operator_content'
   and grantee = 'authenticated' and privilege_type = 'UPDATE'
   and column_name in ('terms_custom', 'privacy_custom');
