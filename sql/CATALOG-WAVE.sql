-- ============================================================================
-- CATALOG-WAVE.sql — publish the eight new territory websites, and rename the
-- three platform rows to the products they actually are.
-- ----------------------------------------------------------------------------
-- WHAT MAKES A NICHE CLAIMABLE: api/create-checkout.mjs:214 gates on
--   website_offer = true AND is_listed = true
-- and nothing else. `status` is display vocabulary for the catalog card; live
-- purchasable niches carry both 'website_only' and 'in_line' today. Stripe is
-- NOT involved: prices are per-TIER (STRIPE_PRICE_ID_LAUNCH / _CUSTOM from the
-- environment, api/_shared.mjs:83) and the checkout line item is
-- TIER_PRICE_ID[tier], so adding a niche creates no Stripe object and changes
-- no price.
--
-- THE RENAME: the plural rows are the real businesses and link out to their own
-- sites; the new singular rows are territory websites for the same trades. Two
-- cards named "Estate Sales" in one family would be unreadable, so the platform
-- rows take their product names. Nothing is removed — the homepage's
-- "open today" count is computed from these rows and is unchanged.
--
-- Idempotent: the insert is ON CONFLICT DO UPDATE, the renames are unconditional
-- writes of a known value. Run against SystemsByVega (newjbexmvltvtmxollca) ONLY.
-- ============================================================================

insert into public.sbv_niches
  (slug, catalog_no, name, family, job_line, status, open_url, price_label, demo_path, website_offer, sort, is_listed)
values
  ('estate-sale', 'SR-06', 'Estate Sales', 'sale-resale', 'Run the sale when a whole household has to be cleared — priced, staffed, and handed back broom-clean.', 'website_only'::sbv_niche_status, null, null, '/sites/estate-sale/', true, 6, true),
  ('garage-sale', 'SR-07', 'Garage Sales', 'sale-resale', 'Run other people''s garage sales for them — sorted, priced, signed, staffed, and cleared by Sunday night.', 'website_only'::sbv_niche_status, null, null, '/sites/garage-sale/', true, 7, true),
  ('residential-cleaning', 'CE-06', 'House Cleaning', 'curb-exterior', 'Clean the same houses on the same days every week, on a route you build.', 'website_only'::sbv_niche_status, null, null, '/sites/residential-cleaning/', true, 25, true),
  ('commercial-cleaning', 'CE-07', 'Office Cleaning', 'curb-exterior', 'Hold the keys to a handful of offices and clean them after everyone goes home.', 'website_only'::sbv_niche_status, null, null, '/sites/commercial-cleaning/', true, 26, true),
  ('window-cleaning', 'CE-08', 'Window Cleaning', 'curb-exterior', 'Inside and out, screens and tracks — priced by the pane or by the house.', 'website_only'::sbv_niche_status, null, null, '/sites/window-cleaning/', true, 27, true),
  ('sprinkler', 'CE-09', 'Sprinkler & Irrigation', 'curb-exterior', 'Install and repair the system that keeps a lawn alive — zones, heads, valves, controllers.', 'website_only'::sbv_niche_status, null, null, '/sites/sprinkler/', true, 28, true),
  ('mechanic', 'AU-04', 'Mobile Mechanic', 'auto', 'Drive the shop to the driveway — the repairs that never needed a lift.', 'website_only'::sbv_niche_status, null, null, '/sites/mechanic/', true, 33, true),
  ('personal-assistant', 'PP-08', 'Personal Assistant', 'people-pets', 'Take the errands, the calendar and the chasing off a busy person''s plate.', 'website_only'::sbv_niche_status, null, null, '/sites/personal-assistant/', true, 57, true)
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

update public.sbv_niches set name = 'EstateSaleBiz', updated_at = now() where slug = 'estate-sales';
update public.sbv_niches set name = 'GarageSaleBiz', updated_at = now() where slug = 'garage-sales';
update public.sbv_niches set name = 'ConsignmentBiz', updated_at = now() where slug = 'consignment-vintage';

-- ================================================ VERIFY ==
select 'new rows claimable' as check_name,
       (count(*) = 8)::text as got
  from public.sbv_niches
 where slug in ('estate-sale', 'garage-sale', 'residential-cleaning', 'commercial-cleaning', 'window-cleaning', 'sprinkler', 'mechanic', 'personal-assistant')
   and website_offer and is_listed
union all select 'platform rows renamed',
       (count(*) = 3)::text
  from public.sbv_niches
 where name in ('EstateSaleBiz','GarageSaleBiz','ConsignmentBiz')
union all select 'platform rows still open (proof line intact)',
       (count(*) = 3)::text
  from public.sbv_niches where status = 'open'
union all select 'total listed',
       count(*)::text from public.sbv_niches where is_listed;
