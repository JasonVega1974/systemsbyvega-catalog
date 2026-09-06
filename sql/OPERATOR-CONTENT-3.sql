-- ============================================================================
-- OPERATOR-CONTENT-3.sql — social links, customer reviews, job details
-- ----------------------------------------------------------------------------
-- RUN AFTER: OPERATOR-CONTENT-2.sql. Idempotent throughout.
-- Every string field is jsonb_typeof-checked: a nested object passing a
-- length()-only check renders as "[object Object]" a year later (the
-- sbv_prices_valid lesson, fixed 2026-09-05).
-- ============================================================================

-- ================================================== 1. VALIDATORS ==
-- [{label, url}] — https only. ≤6: a footer, not a directory.
create or replace function public.sbv_social_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null or (
    jsonb_typeof(p) = 'array'
    and jsonb_array_length(p) <= 6
    and not exists (
      select 1 from jsonb_array_elements(p) as s(row)
      where jsonb_typeof(row) <> 'object'
         or exists (select 1 from jsonb_object_keys(row) k where k not in ('label','url'))
         or not (row ? 'label') or jsonb_typeof(row -> 'label') <> 'string'
         or length(row ->> 'label') > 40
         or not (row ? 'url') or jsonb_typeof(row -> 'url') <> 'string'
         or length(row ->> 'url') > 300
         or (row ->> 'url') !~ '^https://'
    )
  );
$$;

-- [{rating, quote, author}] — operator-entered testimonials from REAL
-- customers (the admin says so in so many words; the database cannot verify
-- honesty, only shape). rating is a jsonb number 1..5.
create or replace function public.sbv_reviews_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null or (
    jsonb_typeof(p) = 'array'
    and jsonb_array_length(p) <= 6
    and not exists (
      select 1 from jsonb_array_elements(p) as r(row)
      where jsonb_typeof(row) <> 'object'
         or exists (select 1 from jsonb_object_keys(row) k where k not in ('rating','quote','author'))
         or not (row ? 'quote') or jsonb_typeof(row -> 'quote') <> 'string'
         or length(row ->> 'quote') > 300 or length(btrim(row ->> 'quote')) < 1
         or not (row ? 'author') or jsonb_typeof(row -> 'author') <> 'string'
         or length(row ->> 'author') > 80
         or (row ? 'rating' and (
              jsonb_typeof(row -> 'rating') <> 'number'
              or case when jsonb_typeof(row -> 'rating') = 'number'
                      then (row ->> 'rating')::numeric not between 1 and 5
                      else true end))
    )
  );
$$;

-- {included: [], notIncluded: []} — stored now, rendered when the niche
-- template grows a slot (deferred by decision, 2026-09-05).
create or replace function public.sbv_job_details_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and not exists (select 1 from jsonb_object_keys(p) k where k not in ('included','notIncluded'))
    and not exists (
      select 1 from jsonb_each(p) as e(side, arr)
      where jsonb_typeof(arr) <> 'array'
         or jsonb_array_length(arr) > 10
         or exists (select 1 from jsonb_array_elements(arr) i(item)
                    where jsonb_typeof(item) <> 'string' or length(item #>> '{}') > 120)
    )
  );
$$;

revoke all    on function public.sbv_social_valid(jsonb)      from public, anon;
revoke all    on function public.sbv_reviews_valid(jsonb)     from public, anon;
revoke all    on function public.sbv_job_details_valid(jsonb) from public, anon;
grant execute on function public.sbv_social_valid(jsonb)      to authenticated, service_role;
grant execute on function public.sbv_reviews_valid(jsonb)     to authenticated, service_role;
grant execute on function public.sbv_job_details_valid(jsonb) to authenticated, service_role;

-- ==================================================== 2. COLUMNS ==
alter table public.sbv_operator_content
  add column if not exists social      jsonb check (public.sbv_social_valid(social)),
  add column if not exists reviews     jsonb check (public.sbv_reviews_valid(reviews)),
  add column if not exists job_details jsonb check (public.sbv_job_details_valid(job_details));

-- ==================================================== 3. VERIFY (all true) ==
select 'social fn: authenticated' as check_name,
       has_function_privilege('authenticated','public.sbv_social_valid(jsonb)','execute')::text as got
union all
select 'reviews fn: authenticated',
       has_function_privilege('authenticated','public.sbv_reviews_valid(jsonb)','execute')::text
union all
select 'job_details fn: authenticated',
       has_function_privilege('authenticated','public.sbv_job_details_valid(jsonb)','execute')::text
union all
select 'social: good row ok',
       public.sbv_social_valid('[{"label":"Facebook","url":"https://facebook.com/x"}]'::jsonb)::text
union all
select 'social: http rejected',
       (not public.sbv_social_valid('[{"label":"x","url":"http://x.com"}]'::jsonb))::text
union all
select 'reviews: good row ok',
       public.sbv_reviews_valid('[{"rating":5,"quote":"Great work","author":"J. Smith"}]'::jsonb)::text
union all
select 'reviews: rating 6 rejected',
       (not public.sbv_reviews_valid('[{"rating":6,"quote":"x","author":"y"}]'::jsonb))::text
union all
select 'reviews: non-string quote rejected',
       (not public.sbv_reviews_valid('[{"quote":{"a":1},"author":"y"}]'::jsonb))::text
union all
select 'job_details: good row ok',
       public.sbv_job_details_valid('{"included":["Curbside pickup"],"notIncluded":["Hazardous waste"]}'::jsonb)::text
union all
select 'job_details: junk key rejected',
       (not public.sbv_job_details_valid('{"extras":["x"]}'::jsonb))::text
union all
select 'reviews: string rating rejected',
       (not public.sbv_reviews_valid('[{"rating":"five","quote":"x","author":"y"}]'::jsonb))::text;
