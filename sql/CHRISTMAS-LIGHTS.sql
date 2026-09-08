-- ============================================================================
-- CHRISTMAS-LIGHTS.sql — publish the christmas-lights territory website.
-- ----------------------------------------------------------------------------
-- WHAT MAKES A NICHE CLAIMABLE: api/create-checkout.mjs:214 gates on
--   website_offer = true AND is_listed = true
-- and nothing else. `status` is display vocabulary for the catalog card. Stripe
-- is NOT involved: prices are per-TIER (STRIPE_PRICE_ID_LAUNCH / _CUSTOM from
-- the environment, api/_shared.mjs:83) and the checkout line item is
-- TIER_PRICE_ID[tier], so adding a niche creates no Stripe object and changes
-- no price a buyer pays.
--
-- PLACEMENT: curb-exterior, CE-10, sort 29 — immediately after sprinkler
-- (CE-09, sort 28), which was the last row added to this family. Nothing else
-- occupies sort 29; the next used value in the family ordering is 33 (auto).
--
-- SEASONALITY is deliberately left out of the schema. The job_line says the
-- work is seasonal, which is the honest disclosure a buyer needs; there is no
-- column that hides or shows a niche by month, and inventing one to make this
-- row disappear in July would change what buyers see on the board.
--
-- Idempotent: ON CONFLICT DO UPDATE on a known value. Run against
-- SystemsByVega (newjbexmvltvtmxollca) ONLY.
-- ============================================================================

insert into public.sbv_niches
  (slug, catalog_no, name, family, job_line, status, open_url, price_label, demo_path, website_offer, sort, is_listed)
values
  ('christmas-lights', 'CE-10', 'Christmas Lights', 'curb-exterior', 'Hang the lights in November, service them through December, and take them down in January.', 'website_only'::sbv_niche_status, null, null, '/sites/christmas-lights/', true, 29, true)
on conflict (slug) do update set
  catalog_no    = excluded.catalog_no,
  name          = excluded.name,
  family        = excluded.family,
  job_line      = excluded.job_line,
  status        = excluded.status,
  demo_path     = excluded.demo_path,
  website_offer = excluded.website_offer,
  sort          = excluded.sort,
  is_listed     = excluded.is_listed,
  updated_at    = now();

-- ================================================ VERIFY ==
select 'christmas-lights claimable' as check_name,
       (count(*) = 1)::text as got
  from public.sbv_niches
 where slug = 'christmas-lights' and website_offer and is_listed
union all select 'sort 29 is unique in curb-exterior',
       (count(*) = 1)::text
  from public.sbv_niches
 where family = 'curb-exterior' and sort = 29
union all select 'claimable sites total is 32',
       (count(*) = 32)::text
  from public.sbv_niches
 where website_offer and is_listed;
