-- ============================================================================
-- PRICING-MODELS.sql — sbv_prices_valid v3: one column, seven pricing models
-- RUN AFTER: ADMIN-RESET.sql. Idempotent. CREATE OR REPLACE keeps grants.
-- Array form (tiers/hourly/flash/calculator rows) OR object form
-- (quote/percentage). Every string typeof-checked; no casts (no CASE needed).
-- ============================================================================
create or replace function public.sbv_prices_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null
    or (
      jsonb_typeof(p) = 'array'
      and jsonb_array_length(p) <= 8
      and not exists (
        select 1 from jsonb_array_elements(p) as t(tier)
        where jsonb_typeof(tier) <> 'object'
           or exists (select 1 from jsonb_object_keys(tier) k
                      where k not in ('label','price_label','per','note','features','unit','rate'))
           or not (tier ? 'label') or jsonb_typeof(tier -> 'label') <> 'string'
           or length(tier ->> 'label') > 60
           or (tier ? 'price_label' and (jsonb_typeof(tier -> 'price_label') <> 'string' or length(tier ->> 'price_label') > 20))
           or (tier ? 'per'   and (jsonb_typeof(tier -> 'per')   <> 'string' or length(tier ->> 'per')   > 30))
           or (tier ? 'note'  and (jsonb_typeof(tier -> 'note')  <> 'string' or length(tier ->> 'note')  > 80))
           or (tier ? 'unit'  and (jsonb_typeof(tier -> 'unit')  <> 'string' or length(tier ->> 'unit')  > 20))
           or (tier ? 'rate'  and (jsonb_typeof(tier -> 'rate')  <> 'string' or length(tier ->> 'rate')  > 20))
           or (tier ? 'features' and (
                jsonb_typeof(tier -> 'features') <> 'array'
                or jsonb_array_length(tier -> 'features') > 8
                or exists (select 1 from jsonb_array_elements(tier -> 'features') f(x)
                           where jsonb_typeof(f.x) <> 'string' or length(f.x #>> '{}') > 120)))
      )
    )
    or (
      jsonb_typeof(p) = 'object'
      and not exists (select 1 from jsonb_object_keys(p) k
                      where k not in ('starting_at','note','commission','minimum'))
      and not exists (
        select 1 from jsonb_each(p) as e(key, val)
        where jsonb_typeof(val) <> 'string' or length(val #>> '{}') > 120
      )
    );
$$;
-- ================================================ VERIFY (all 'true') ==
select 'tiers still ok' as check_name,
       public.sbv_prices_valid('[{"label":"1 Bin","price_label":"$10"}]'::jsonb)::text as got
union all select 'hourly rate row ok',
       public.sbv_prices_valid('[{"label":"2 movers","rate":"$129","unit":"per hour"}]'::jsonb)::text
union all select 'quote object ok',
       public.sbv_prices_valid('{"starting_at":"$45","note":"Most jobs quoted by text"}'::jsonb)::text
union all select 'percentage object ok',
       public.sbv_prices_valid('{"commission":"35%","minimum":"$500"}'::jsonb)::text
union all select 'junk key rejected (array)',
       (not public.sbv_prices_valid('[{"label":"x","cents":1}]'::jsonb))::text
union all select 'junk key rejected (object)',
       (not public.sbv_prices_valid('{"weird":"x"}'::jsonb))::text
union all select 'non-string rejected',
       (not public.sbv_prices_valid('{"starting_at":45}'::jsonb))::text
union all select 'grants survived replace',
       has_function_privilege('authenticated','public.sbv_prices_valid(jsonb)','execute')::text;
