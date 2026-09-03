-- ============================================================================
-- SYSTEMS BY VEGA — COMMERCE LAYER, PART 2 (Phase 2, Item 2 prerequisites)
-- Project: newjbexmvltvtmxollca          Table prefix: sbv_
-- ----------------------------------------------------------------------------
-- CANONICAL SCHEMA RECORD, third file. SETUP.sql owns the catalog and the
-- demand registry; COMMERCE.sql owns territory claims, tenants, operator logins
-- and billing; this file adds what the checkout and provisioning endpoints need
-- and corrects one thing COMMERCE.sql got wrong.
--
-- FENCE: this SQL runs against newjbexmvltvtmxollca and nowhere else. The
-- EstateSaleBiz (cdckozujhrffobragmtm) and GarageSaleBiz (jjocmvhqeiudcwtazbwi)
-- projects are live businesses holding sold territories and are never read
-- from and never written to.
--
-- Idempotent: safe to run repeatedly.
--
-- ----------------------------------------------------------------------------
-- ⚠ RUN ORDER
--
--   1. sql/SETUP.sql      (first, always)
--   2. sql/SEED.sql
--   3. sql/COMMERCE.sql
--   4. sql/COMMERCE-2.sql (this file)
--
-- Same hazard as before: SETUP.sql ends with a schema-wide revoke that knows
-- nothing about any of these objects. Re-running SETUP.sql means re-running
-- COMMERCE.sql AND this file. Verify query 2 detects the broken state.
--
-- ----------------------------------------------------------------------------
-- WHAT THIS FIXES, AND WHY IT MATTERED
--
-- sbv_city_available() gated purchasability on `status = 'open'`. In this
-- catalog `open` does not mean "for sale" — it means "WE DO NOT SELL THIS,
-- go to the sibling platform", and those three rows carry an off-site open_url
-- and the sibling's own price_label:
--
--   estate-sales        -> estatesalebiz.com     '$497 + $39/mo · 3 cities'
--   garage-sales        -> garagesalebiz.com     '$249 once · 3 cities'
--   consignment-vintage -> consignmentbiz.com
--
-- Shipped as written, checkout would have refused all 23 SiteLab niches and
-- happily sold an estate-sales territory for a city that EstateSaleBiz's own
-- registry — in a project this repo is fenced out of — may already have sold.
-- Two registries, one territory, no coordination.
--
-- The gate is now `website_offer and is_listed`, which is the flag the catalog
-- already uses to mean "SBV sells a website for this".
-- ============================================================================

begin;

-- --------------------------------------------------------------------- enums
do $$ begin
  create type public.sbv_intake_status as enum
    ('awaiting_payment','paid','blocked','abandoned');
exception when duplicate_object then null; end $$;


-- ============================================================================
-- A1. THE PURCHASABILITY GATE — makes the dangerous state unrepresentable
-- ============================================================================

-- The gate is `website_offer and is_listed`. That is sufficient today because
-- the three hand-off niches all carry website_offer = false.
--
-- But `sbv_niches` exists precisely so that "flipping a niche to open is a row
-- update, not a deploy" (SETUP.sql:35). One such update — setting status='open'
-- on a row that still has website_offer = true — would put a sibling's
-- territory back on sale here, and nothing in the gate would notice.
--
-- Rather than carry a defensive `status <> 'open'` in every consumer and hope
-- each one remembers, the combination is forbidden outright. A niche is either
-- something we sell a website for, or something we hand off. Never both. This
-- fails at the UPDATE, naming the problem, instead of at a checkout six weeks
-- later that quietly sells what we do not own.
alter table public.sbv_niches drop constraint if exists sbv_niches_handoff_ck;
alter table public.sbv_niches add constraint sbv_niches_handoff_ck
  check (not (status = 'open' and website_offer));

-- CREATE OR REPLACE preserves the existing ACL, so the grant issued in
-- COMMERCE.sql survives this. It is re-issued at the end anyway, because a
-- silent privilege loss here would take the whole storefront down.
create or replace function public.sbv_city_available(
  p_niche_slug text,
  p_city_label text,
  p_state_code text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_niche_slug is null or p_city_label is null or p_state_code is null
      then jsonb_build_object('available', false, 'reason', 'incomplete')
    when public.sbv_norm_city(p_city_label) is null
      then jsonb_build_object('available', false, 'reason', 'unrecognised_city')
    when upper(btrim(p_state_code)) !~ '^[A-Z]{2}$'
      then jsonb_build_object('available', false, 'reason', 'bad_state')
    /* THE CHANGED LINE. Was `n.status = 'open'`, which is the hand-off flag,
       not the for-sale flag. sbv_niches_handoff_ck above guarantees this can
       never be true for a niche we hand off. */
    when not exists (
      select 1 from public.sbv_niches n
      where n.slug = p_niche_slug and n.website_offer and n.is_listed
    ) then jsonb_build_object('available', false, 'reason', 'niche_not_for_sale')
    when exists (
      select 1 from public.sbv_city_claims cc
      where cc.niche_slug = p_niche_slug
        and cc.city_norm  = public.sbv_norm_city(p_city_label)
        and cc.state_code = upper(btrim(p_state_code))
        and cc.status in ('claimed','reserved')
    ) then jsonb_build_object('available', false, 'reason', 'claimed')
    else jsonb_build_object('available', true)
  end;
$$;


-- ============================================================================
-- A2. RECORD THE MONEY FIRST
-- ============================================================================

-- sbv_billing.client_id was `not null`, which forced tenant-before-money in the
-- webhook. GarageSaleBiz records the money first, deliberately: the row saying
-- a payment arrived must exist even if provisioning then breaks — otherwise a
-- failed provision leaves the payment visible only inside Stripe, which is the
-- one blind spot this whole design exists to avoid.
--
-- The foreign key stays. It simply permits NULL now: money lands immediately
-- after the refund gate, and client_id is filled in once the tenant exists.
alter table public.sbv_billing alter column client_id drop not null;

-- Who paid, independent of whether a tenant was ever created for them. Without
-- this, a payment that fails provisioning has no link to a person at all.
alter table public.sbv_billing add column if not exists user_id uuid
  references auth.users(id) on delete set null;

create index if not exists sbv_billing_user_idx on public.sbv_billing (user_id);


-- ============================================================================
-- A3. sbv_intake — what the buyer typed, parked before payment
-- ============================================================================

-- ONE CITY PER PURCHASE (decided 2026-08-27). That is why this holds
-- city_label/state_code rather than a cities[] array, and why there is no batch
-- claim function: sbv_claim_city() is already atomic for exactly one city, and
-- it is the function COMMERCE.sql's VERIFY 9 proves against every run.
--
-- The webhook trusts THIS ROW, not Stripe metadata. Metadata caps at 50 keys
-- and 500 characters per value and cannot reliably carry contact details plus
-- a territory plus an acceptance record.
--
-- The browser never writes here. /api/create-checkout does, with the service
-- role, which is why this table needs no anon policy and the public write
-- surface of the whole database stays at sbv_demand.
create table if not exists public.sbv_intake (
  id                 uuid primary key default extensions.gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  niche_slug         text not null references public.sbv_niches(slug) on update cascade,
  -- The subdomain the buyer asked for. NOT a foreign key to sbv_tenants: the
  -- tenant does not exist yet and may never, and it can be renamed on collision
  -- during provisioning.
  client_id          text not null
                       check (client_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
                              and length(client_id) between 3 and 40),
  business_name      text not null check (length(btrim(business_name)) between 2 and 120),
  operator_name      text check (length(operator_name) <= 120),
  operator_email     text not null
                       check (operator_email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'
                              and length(operator_email) <= 254),
  operator_phone     text check (length(operator_phone) <= 40),
  city_label         text not null check (length(btrim(city_label)) between 2 and 120),
  state_code         text not null check (state_code ~ '^[A-Z]{2}$'),
  tier               text not null check (tier in ('launch','custom')),
  -- What they agreed to, and proof of the exact text. The version alone would
  -- not survive an edit to the document; the hash pins the bytes.
  acceptance_version text not null,
  acceptance_hash    text not null check (acceptance_hash ~ '^[0-9a-f]{64}$'),
  status             public.sbv_intake_status not null default 'awaiting_payment',
  stripe_session_id  text unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists sbv_intake_user_idx   on public.sbv_intake (user_id, created_at desc);
create index if not exists sbv_intake_status_idx on public.sbv_intake (status, created_at desc);
create index if not exists sbv_intake_niche_idx  on public.sbv_intake (niche_slug);

drop trigger if exists sbv_intake_touch on public.sbv_intake;
create trigger sbv_intake_touch before update on public.sbv_intake
  for each row execute function public.sbv_touch_updated_at();


-- ============================================================================
-- A5. sbv_blocked_purchases — paid, but the territory was gone
-- ============================================================================

-- The race sbv_claim_city() is designed to lose safely. Two buyers can both
-- pass the availability check and both pay; one of them loses at the atomic
-- claim, having already been charged.
--
-- EstateSaleBiz built this table after it happened to real buyers. We build it
-- before the first sale. A row here means a human must refund or reassign — it
-- is not something the webhook can resolve, which is why the webhook returns
-- 200 for this case rather than letting Stripe retry a permanent failure three
-- hundred times and bury the alert.
create table if not exists public.sbv_blocked_purchases (
  id                uuid primary key default extensions.gen_random_uuid(),
  stripe_session_id text not null unique,
  user_id           uuid references auth.users(id) on delete set null,
  niche_slug        text,
  client_id         text,
  requested_city    text,
  requested_state   text,
  -- Who actually holds it, so a person knows what to offer the loser.
  holder_client_id  text,
  amount_cents      integer check (amount_cents >= 0),
  buyer_email       text check (length(buyer_email) <= 254),
  reason            text not null default 'already_claimed',
  resolved          boolean not null default false,
  resolved_at       timestamptz,
  note              text,
  created_at        timestamptz not null default now(),
  constraint sbv_blocked_resolved_ck check ((resolved = false) = (resolved_at is null))
);

create index if not exists sbv_blocked_open_idx
  on public.sbv_blocked_purchases (created_at desc) where not resolved;

-- Foreign keys are not indexed automatically, and verify query 4 fails without
-- this one. It also backs the lookup that matters operationally: "what else has
-- gone wrong for this buyer".
create index if not exists sbv_blocked_user_idx
  on public.sbv_blocked_purchases (user_id);


-- ============================================================================
-- A6. sbv_release_territory() — charge.refunded puts the city back
-- ============================================================================

-- Keyed on the STRIPE SESSION, not the client_id. A buyer may own territories
-- in several niches (multi-niche purchasing, decided 2026-08-27), and releasing
-- by client_id would release every one of them for a refund of one.
-- sbv_city_claims.stripe_session_id is what ties a claim to the payment.
--
-- Service-role only: called from the webhook on charge.refunded.
create or replace function public.sbv_release_territory(p_stripe_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id text;
  v_released  integer := 0;
begin
  if p_stripe_session_id is null or btrim(p_stripe_session_id) = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;

  -- Read the owner BEFORE the update rather than with RETURNING INTO. One
  -- purchase is one city today, but `RETURNING ... INTO` raises if the update
  -- ever touches more than one row, and a refund handler that throws is a
  -- refund that never releases the territory.
  select cc.client_id into v_client_id
    from public.sbv_city_claims cc
   where cc.stripe_session_id = p_stripe_session_id
     and cc.status in ('claimed','reserved')
   limit 1;

  update public.sbv_city_claims
     set status = 'released', released_at = now()
   where stripe_session_id = p_stripe_session_id
     and status in ('claimed','reserved');
  get diagnostics v_released = row_count;

  -- Take the storefront down. Deliberately not deleted: the tenant row is the
  -- record that this person was once an operator, and the claims that named
  -- their city are still here marked released.
  if v_client_id is not null then
    update public.sbv_tenants set is_active = false where client_id = v_client_id;
  end if;

  update public.sbv_billing
     set status = 'refunded'
   where stripe_session_id = p_stripe_session_id;

  update public.sbv_intake
     set status = 'abandoned'
   where stripe_session_id = p_stripe_session_id
     and status <> 'blocked';

  return jsonb_build_object('ok', true, 'released', v_released, 'client_id', v_client_id);
end $$;

revoke all on function public.sbv_release_territory(text) from public, anon, authenticated;


-- ============================================================================
-- RLS + GRANTS — revoke-then-grant, LAST, scoped to this file's objects
-- ============================================================================

alter table public.sbv_intake            enable row level security;
alter table public.sbv_blocked_purchases enable row level security;
alter table public.sbv_intake            force  row level security;
alter table public.sbv_blocked_purchases force  row level security;

-- Neither table gets a policy of any kind, exactly like sbv_billing,
-- sbv_settings and sbv_digest_log. Nothing outside the service role reads or
-- writes them. sbv_intake in particular holds an email address and a phone
-- number for someone who has not bought anything yet.

revoke all on public.sbv_intake            from anon, authenticated;
revoke all on public.sbv_blocked_purchases from anon, authenticated;

-- Re-issued rather than assumed. CREATE OR REPLACE FUNCTION preserves the ACL,
-- but this is the grant the entire public storefront depends on, and inheriting
-- it silently is not worth the two lines saved.
revoke all    on function public.sbv_city_available(text,text,text)
  from public, anon, authenticated;
grant execute on function public.sbv_city_available(text,text,text)
  to anon, authenticated;

commit;


-- ============================================================================
-- VERIFY — run after applying. Every query states its own pass condition.
-- Nothing here writes outside a rolled-back transaction.
-- ============================================================================

-- 1. RLS on and forced for both new tables. Expect 2 rows, both flags true.
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
  and relname in ('sbv_intake','sbv_blocked_purchases')
order by relname;

-- 2. THE RUN-ORDER CHECK, extended. Expect FOUR rows — the whole public
--    surface. A short count means SETUP.sql was re-run after the commerce
--    files and stripped these; fix by re-running COMMERCE.sql then this file.
select routine_name, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public' and grantee = 'anon'
  and routine_name in ('sbv_public_claimed_cities','sbv_public_tenants',
                       'sbv_city_available','sbv_claim_counts')
order by routine_name;

-- 3. anon and authenticated hold nothing on the new tables. Expect ZERO rows.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated')
  and table_name in ('sbv_intake','sbv_blocked_purchases');

-- 4. Every foreign key indexed, across all commerce tables. Expect ZERO rows.
select conrelid::regclass as tbl, a.attname as fk_column
from pg_constraint c
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
where c.contype = 'f'
  and conrelid::regclass::text like 'sbv_%'
  and not exists (select 1 from pg_index i
                  where i.indrelid = c.conrelid and a.attnum = any (i.indkey));

-- 5. THE FIX, AND THE GUARD. Self-checking: `pass` must be true on every row.
--    This is the whole reason the file exists — that a hand-off niche cannot be
--    sold here, and that the 23 SiteLab niches can.
begin;

create function pg_temp.sbv_avail(p_slug text) returns text
language sql as $av$
  select public.sbv_city_available(p_slug, 'Twin Falls', 'ID')->>'available';
$av$;

create function pg_temp.sbv_try(p_sql text) returns text
language plpgsql as $try$
begin
  execute p_sql;
  return 'ALLOWED';
exception when others then
  return 'REJECTED (' || sqlstate || ')';
end $try$;

-- Delist a for-sale niche, ask whether it is still purchasable, put it back.
-- The enclosing transaction rolls back regardless; restoring keeps the later
-- checks in this same block reading an unmodified catalog.
create function pg_temp.sbv_delist_probe() returns text
language plpgsql as $d$
declare v_slug text; v_answer text;
begin
  select slug into v_slug from public.sbv_niches
   where website_offer and is_listed order by slug limit 1;
  if v_slug is null then return 'no-listed-niche'; end if;

  update public.sbv_niches set is_listed = false where slug = v_slug;
  select public.sbv_city_available(v_slug, 'Twin Falls', 'ID')->>'available'
    into v_answer;
  update public.sbv_niches set is_listed = true  where slug = v_slug;

  return v_answer;
end $d$;

with r(check_name, got, expected) as (
  values
    ('a hand-off niche is NOT for sale',
      coalesce((select pg_temp.sbv_avail(slug) from public.sbv_niches
                where status = 'open' limit 1), 'no-open-niche'), 'false'),
    ('a website_only niche IS for sale',
      coalesce((select pg_temp.sbv_avail(slug) from public.sbv_niches
                where status = 'website_only' and website_offer and is_listed limit 1),
               'none-found'), 'true'),
    ('an in_line niche with a demo IS for sale',
      coalesce((select pg_temp.sbv_avail(slug) from public.sbv_niches
                where status = 'in_line' and website_offer and is_listed limit 1),
               'none-found'), 'true'),
    -- Delisting must take a niche off sale, not merely hide it in the catalog.
    -- Done in a helper rather than inline: a data-modifying CTE is only legal at
    -- the top level of a statement, so the obvious `with hidden as (update ...)`
    -- inside this VALUES list is a syntax error, not a subtle bug.
    ('delisting a niche takes it off sale', pg_temp.sbv_delist_probe(), 'false'),
    -- demo_path is set too, so sbv_niches_offer_ck is satisfied and the ONLY
    -- constraint left to reject this is the hand-off guard. Without that the
    -- test would pass against the wrong constraint and prove nothing.
    ('the guard forbids open + website_offer',
      pg_temp.sbv_try($g$update public.sbv_niches
                          set website_offer = true, demo_path = '/sites/x/'
                          where status = 'open'$g$), 'REJECTED (23514)'),
    ('the guard forbids the reverse too',
      pg_temp.sbv_try($g$update public.sbv_niches
                          set status = 'open', open_url = 'https://example.com'
                          where website_offer and is_listed$g$), 'REJECTED (23514)'),
    ('billing accepts a row with NO tenant yet',
      pg_temp.sbv_try($g$insert into public.sbv_billing
                          (stripe_session_id, amount_cents, tier)
                          values ('cs_verify_moneyfirst', 29900, 'launch')$g$), 'ALLOWED')
)
select check_name, got, expected, (got = expected) as pass from r
union all
select 'TOTAL', count(*) filter (where got is distinct from expected)::text, '0',
       count(*) filter (where got is distinct from expected) = 0
from r;

rollback;

-- 6. REFUND RELEASES THE TERRITORY. Buy a city, confirm it reads taken, refund
--    it, confirm it reads free again and the storefront went down.
--    PASS: every `pass` true.
begin;

insert into auth.users (id, email)
values ('33333333-3333-3333-3333-333333333333','verify-refund@example.com');

insert into public.sbv_tenants (client_id, niche_slug, business_name, operator_email, is_active)
select 'op-refund', slug, 'Refund Co', 'info@kingdom-creatives.com', true
from public.sbv_niches where website_offer and is_listed limit 1;

insert into public.sbv_billing (client_id, user_id, stripe_session_id, amount_cents, tier)
values ('op-refund','33333333-3333-3333-3333-333333333333','cs_verify_refund',29900,'launch');

select public.sbv_claim_city(
  (select slug from public.sbv_niches where website_offer and is_listed limit 1),
  'Twin Falls','ID','op-refund','cs_verify_refund');
stripe charges list --limit 1 | findstr "\"id\""


