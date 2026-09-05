-- ============================================================================
-- OPERATOR-CONTENT-2.sql — editable photos, logo, prices, lead email
-- ----------------------------------------------------------------------------
-- RUN AFTER: OPERATOR-CONTENT.sql and ADMIN-FIX.sql. Idempotent throughout.
-- Spec: docs/superpowers/specs/2026-09-05-bin-cleaning-editable-prototype-design.md
--
-- lead_email is DELIBERATELY separate from email: public display address and
-- lead destination are different decisions, and the guard "editing your public
-- email must not silently redirect your leads" survives only if redirecting
-- leads has its own explicitly-labelled field.
-- ============================================================================

-- ================================================== 1. VALIDATORS (no tables
-- touched, so `language sql` body validation cannot 42P01; declared before the
-- ALTERs because the CHECKs reference them).

-- {slot: url} map. Closed slot set for this phase: adding a slot is a spec
-- change, not a data drift. https only, our storage host or /sites/ path.
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
      where slot not in ('before','after','owner','logo','gallery1','gallery2',
                         'gallery3','gallery4','gallery5','gallery6','gallery7','gallery8')
         or jsonb_typeof(val) <> 'string'
         or length(val #>> '{}') > 500
         or (val #>> '{}') !~ '^https://[a-z0-9.-]+\.supabase\.co/storage/v1/object/public/'
    )
  );
$$;

-- Display-string price tiers, shaped like content.json pricing[]. Unknown keys
-- rejected: junk that arrives silently is junk that renders blank a year later.
create or replace function public.sbv_prices_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null or (
    jsonb_typeof(p) = 'array'
    and jsonb_array_length(p) <= 6
    and not exists (
      select 1 from jsonb_array_elements(p) as t(tier)
      where jsonb_typeof(tier) <> 'object'
         or exists (select 1 from jsonb_object_keys(tier) k
                    where k not in ('label','price_label','per','note','features'))
         or not (tier ? 'label') or length(tier ->> 'label') > 60
         or (tier ? 'price_label' and length(tier ->> 'price_label') > 20)
         or (tier ? 'per'   and length(tier ->> 'per')   > 30)
         or (tier ? 'note'  and length(tier ->> 'note')  > 80)
         or (tier ? 'features' and (
              jsonb_typeof(tier -> 'features') <> 'array'
              or jsonb_array_length(tier -> 'features') > 8
              or exists (select 1 from jsonb_array_elements(tier -> 'features') f(x)
                         where jsonb_typeof(f.x) <> 'string' or length(f.x #>> '{}') > 120)))
    )
  );
$$;

-- A CHECK evaluates AS THE WRITING ROLE (ADMIN-FIX.sql lesson). Same section,
-- not an afterthought.
revoke all    on function public.sbv_photos_valid(jsonb) from public, anon;
revoke all    on function public.sbv_prices_valid(jsonb) from public, anon;
grant execute on function public.sbv_photos_valid(jsonb) to authenticated, service_role;
grant execute on function public.sbv_prices_valid(jsonb) to authenticated, service_role;

-- ==================================================== 2. COLUMNS (idempotent)
alter table public.sbv_operator_content
  add column if not exists lead_email text
    check (lead_email is null or (lead_email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'
                                  and length(lead_email) <= 254)),
  add column if not exists logo_url text
    check (logo_url is null or (length(logo_url) <= 500
           and logo_url ~ '^https://[a-z0-9.-]+\.supabase\.co/storage/v1/object/public/')),
  add column if not exists photos jsonb check (public.sbv_photos_valid(photos)),
  add column if not exists prices jsonb check (public.sbv_prices_valid(prices));

-- ================================================== VERIFY PART 1 (all true)
select 'photos fn: authenticated' as check_name,
       has_function_privilege('authenticated','public.sbv_photos_valid(jsonb)','execute')::text as got
union all
select 'prices fn: authenticated',
       has_function_privilege('authenticated','public.sbv_prices_valid(jsonb)','execute')::text
union all
select 'photos: good row ok',
       public.sbv_photos_valid('{"before":"https://newjbexmvltvtmxollca.supabase.co/storage/v1/object/public/sbv-operator-media/t/x.jpg"}'::jsonb)::text
union all
select 'photos: bad slot rejected',
       (not public.sbv_photos_valid('{"selfie":"https://newjbexmvltvtmxollca.supabase.co/storage/v1/object/public/x"}'::jsonb))::text
union all
select 'prices: good tier ok',
       public.sbv_prices_valid('[{"label":"1 Bin","price_label":"$10","per":"per cleaning"}]'::jsonb)::text
union all
select 'prices: junk key rejected',
       (not public.sbv_prices_valid('[{"label":"x","cents":1000}]'::jsonb))::text;
