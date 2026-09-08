-- ============================================================================
-- URL-ANCHOR.sql — anchor the operator URL constraints end-to-end
-- ----------------------------------------------------------------------------
-- Final platform review #6/#C: logo_url's CHECK and sbv_photos_valid's URL
-- test both used an ANCHORED-PREFIX regex only, leaving ~450 free characters
-- after the storage prefix. A value like
--   https://<ref>.supabase.co/storage/v1/object/public/x.png" onerror="...
-- passed both gates; the render layers escape now too, but the database is
-- the boundary and its constraint should state the whole shape.
--
-- The tail set [A-Za-z0-9._~%/-] covers every character Supabase storage
-- object paths use (the admin builds them from client_id + slot + extension)
-- and excludes quotes, spaces, angle brackets and parens outright; the
-- one query form the admin actually writes (?v=<epoch> cache-buster on
-- logo_url — see the primetest row that surfaced at first apply) is
-- allowed explicitly and nothing looser.
--
-- PRE-CHECK before applying: the first statement counts existing rows that
-- would violate the tightened shape — must be 0 (verified 0 at apply time).
-- Idempotent: drop-and-re-add for the named constraint; CREATE OR REPLACE
-- for the function (grants survive replace).
-- ============================================================================

-- 0. Existing data must already satisfy the tightened shape (expect 0 / 0).
select
  (select count(*) from public.sbv_operator_content
    where logo_url is not null
      and logo_url !~ '^https://[a-z0-9.-]+\.supabase\.co/storage/v1/object/public/[A-Za-z0-9._~%/-]*(\?v=[0-9]+)?$')
    as logo_violations,
  (select count(*) from public.sbv_operator_content
    where photos is not null and exists (
      select 1 from jsonb_each(photos) e(slot, val)
      where (val #>> '{}') !~ '^https://[a-z0-9.-]+\.supabase\.co/storage/v1/object/public/[A-Za-z0-9._~%/-]*(\?v=[0-9]+)?$'))
    as photo_violations;

-- 1. logo_url: replace the column CHECK with the anchored form.
alter table public.sbv_operator_content
  drop constraint if exists sbv_operator_content_logo_url_check;
alter table public.sbv_operator_content
  add constraint sbv_operator_content_logo_url_check
  check (logo_url is null or (length(logo_url) <= 500
         and logo_url ~ '^https://[a-z0-9.-]+\.supabase\.co/storage/v1/object/public/[A-Za-z0-9._~%/-]*(\?v=[0-9]+)?$'));

-- 2. sbv_photos_valid: same anchoring inside the function (v3).
create or replace function public.sbv_photos_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null
    or (
    jsonb_typeof(p) = 'object'
    and (select count(*) from jsonb_object_keys(p)) <= 12
    and not exists (
      select 1 from jsonb_each(p) as e(slot, val)
      where slot not in ('hero','before','after','owner','logo','gallery1','gallery2',
                         'gallery3','gallery4','gallery5','gallery6','gallery7','gallery8')
         or jsonb_typeof(val) <> 'string'
         or length(val #>> '{}') > 500
         or (val #>> '{}') !~ '^https://[a-z0-9.-]+\.supabase\.co/storage/v1/object/public/[A-Za-z0-9._~%/-]*(\?v=[0-9]+)?$'
    )
  );
$$;

-- ================================================ VERIFY (all 'true') ==
select 'clean url accepted' as check_name,
       public.sbv_photos_valid('{"hero":"https://newjbexmvltvtmxollca.supabase.co/storage/v1/object/public/sbv-operator-media/t/hero.jpg"}'::jsonb)::text as got
union all select 'attribute-breakout rejected',
       (not public.sbv_photos_valid('{"hero":"https://newjbexmvltvtmxollca.supabase.co/storage/v1/object/public/x.png\" onerror=\"alert(1)"}'::jsonb))::text
union all select 'space rejected',
       (not public.sbv_photos_valid('{"hero":"https://newjbexmvltvtmxollca.supabase.co/storage/v1/object/public/a b.png"}'::jsonb))::text
union all select 'grants survived replace',
       has_function_privilege('authenticated','public.sbv_photos_valid(jsonb)','execute')::text;
