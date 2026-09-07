-- ============================================================================
-- HERO-SLOT.sql — add 'hero' to the photos slot set
-- RUN AFTER: PRICING-MODELS.sql. Idempotent (CREATE OR REPLACE keeps grants).
-- The 23 manifests (Phase A T3) declare a hero photo slot on nearly every
-- niche; sbv_photos_valid's closed set predates them and would 400 the first
-- hero upload. Same validator otherwise, one slot added.
-- ============================================================================
create or replace function public.sbv_photos_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and (select count(*) from jsonb_object_keys(p)) <= 12
    and not exists (
      select 1 from jsonb_each(p) as e(slot, val)
      where slot not in ('hero','before','after','owner','logo','gallery1','gallery2',
                         'gallery3','gallery4','gallery5','gallery6','gallery7','gallery8')
         or jsonb_typeof(val) <> 'string'
         or length(val #>> '{}') > 500
         or (val #>> '{}') !~ '^https://[a-z0-9.-]+\.supabase\.co/storage/v1/object/public/'
    )
  );
$$;
-- ==================================================== VERIFY (all 'true') ==
select 'hero slot accepted' as check_name,
       public.sbv_photos_valid('{"hero":"https://newjbexmvltvtmxollca.supabase.co/storage/v1/object/public/sbv-operator-media/t/hero.jpg"}'::jsonb)::text as got
union all
select 'junk slot still rejected',
       (not public.sbv_photos_valid('{"selfie":"https://newjbexmvltvtmxollca.supabase.co/storage/v1/object/public/x"}'::jsonb))::text
union all
select 'grants survived replace',
       has_function_privilege('authenticated','public.sbv_photos_valid(jsonb)','execute')::text;
