-- ============================================================================
-- INQUIRIES.sql — inbound custom-work inquiries from /services/.
-- ----------------------------------------------------------------------------
-- WHY A NEW TABLE. sbv_leads cannot hold these: its client_id is NOT NULL with
-- an FK to sbv_tenants, because a lead belongs to an operator. A SystemsByVega
-- inquiry has no tenant, and inventing one would pollute the table that the
-- landing page's figures are counted from. sbv_demand cannot hold them either:
-- it requires niche_slug (FK) and a city, and dedupes on (niche, email, city),
-- which is exactly the shape a services inquiry does not have.
--
-- WHO WRITES. Nobody in the browser. api/submit-inquiry.mjs inserts with the
-- service_role key. There is NO anon policy and NO anon grant — a public key
-- must never write into an inbox table, or it becomes a spam target with a
-- free API. sbv_demand stays the only public write surface in this database.
--
-- NO DELETE POLICY, and no delete grant. Deletion is deleted_at, set by an
-- UPDATE. Losing a record of somebody who asked for work to a mis-tap is worse
-- than keeping a hidden row forever — the same reasoning that governs
-- sbv_leads and sbv_operator_content.
--
-- Idempotent: create-if-not-exists, every constraint dropped or guarded before
-- creation, safe to re-run against a table holding real rows. Run against
-- SystemsByVega (newjbexmvltvtmxollca) ONLY.
--
-- THE VERIFY BLOCK IS PLAIN SCHEMA INSPECTION: no temp tables, no role
-- switching, no transaction. LEADS.sql's header records why — the SQL editor
-- auto-commits each statement and is free to run them on different pooled
-- sessions, so session state does not survive from one statement to the next,
-- and two earlier attempts died with 42P01.
--
-- ip_address IS ONE ADDITIVE COLUMN BEYOND THE BRIEF'S ILLUSTRATIVE SCHEMA.
-- Task 4's brief asks api/submit-inquiry.mjs to rate-limit "per IP per hour,
-- counted from sbv_inquiries itself" — since there is no client_id to scope
-- by, IP is the only dimension left, and a per-IP count "from the table
-- itself" is not possible without somewhere on the table to filter by IP. The
-- brief's own sample schema had no such column, so this is the smallest
-- addition that makes the stated behavior actually achievable: no anon
-- exposure, no new policy, nothing else about the table changes.
-- ============================================================================

do $$ begin
  create type public.sbv_inquiry_status as enum ('new', 'replied', 'closed');
exception when duplicate_object then null; end $$;

create table if not exists public.sbv_inquiries (
  id            uuid primary key default extensions.gen_random_uuid(),
  name          text not null,
  email         text not null,
  company       text,
  project       text not null,
  budget_range  text,
  source        text not null default 'services',
  status        public.sbv_inquiry_status not null default 'new',
  ip_address    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Table already existed before ip_address was added (see header note above);
-- IF NOT EXISTS makes this re-runnable against either the old or new shape.
alter table public.sbv_inquiries add column if not exists ip_address text;

alter table public.sbv_inquiries drop constraint if exists sbv_inquiries_lengths_ck;
alter table public.sbv_inquiries add  constraint sbv_inquiries_lengths_ck
  check (
    char_length(btrim(name))    between 2 and 120  and
    char_length(email)          <= 254             and
    (company is null or char_length(company) <= 160) and
    char_length(btrim(project)) between 10 and 4000  and
    char_length(source)         <= 40             and
    (ip_address is null or char_length(ip_address) <= 64)
  );

alter table public.sbv_inquiries drop constraint if exists sbv_inquiries_email_ck;
alter table public.sbv_inquiries add  constraint sbv_inquiries_email_ck
  check (email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$');

-- A fixed list, not free text: the form offers exactly these and a mismatch
-- means the form and the table have drifted. NULL is allowed — the brief makes
-- budget optional, and an optional field must be able to be absent.
alter table public.sbv_inquiries drop constraint if exists sbv_inquiries_budget_ck;
alter table public.sbv_inquiries add  constraint sbv_inquiries_budget_ck
  check (budget_range is null or budget_range in
         ('under-5k', '5k-15k', '15k-40k', '40k-plus', 'not-sure'));

create index if not exists sbv_inquiries_open_idx
  on public.sbv_inquiries (created_at desc) where deleted_at is null;

-- The rate limiter in api/submit-inquiry.mjs counts recent rows for one IP.
create index if not exists sbv_inquiries_ip_created_idx
  on public.sbv_inquiries (ip_address, created_at);

-- Reused from sbv_leads; see sql/LEADS.sql for the trigger body.
drop trigger if exists sbv_inquiries_touch on public.sbv_inquiries;
create trigger sbv_inquiries_touch before update on public.sbv_inquiries
  for each row execute function public.sbv_touch_updated_at();

alter table public.sbv_inquiries enable row level security;
alter table public.sbv_inquiries force row level security;

-- Deliberately empty: no policy for anon, no policy for authenticated. The
-- service role bypasses RLS, and it is the only writer and the only reader.
revoke all on public.sbv_inquiries from anon, authenticated;

-- ================================================ VERIFY ==
-- One statement, one result set, catalog reads only. Run it on its own at any
-- time: it changes nothing and depends on no session state.
select 'table exists' as check_name,
       (to_regclass('public.sbv_inquiries') is not null)::text as got

union all select 'rls is enabled and forced',
       (select (relrowsecurity and relforcerowsecurity)::text
          from pg_class where oid = 'public.sbv_inquiries'::regclass)

union all select 'enum sbv_inquiry_status exists with the three expected values',
       (select (array_agg(enumlabel::text order by enumsortorder)
                 = array['new','replied','closed'])::text
          from pg_enum
         where enumtypid = 'public.sbv_inquiry_status'::regtype)

union all select 'all three check constraints present',
       (select (count(*) = 3)::text
          from pg_constraint
         where conrelid = 'public.sbv_inquiries'::regclass and contype = 'c'
           and conname in ('sbv_inquiries_lengths_ck', 'sbv_inquiries_email_ck',
                           'sbv_inquiries_budget_ck'))

union all select 'the open partial index exists',
       (select (count(*) = 1)::text
          from pg_indexes
         where schemaname = 'public' and tablename = 'sbv_inquiries'
           and indexname = 'sbv_inquiries_open_idx')

union all select 'ip_address column exists and is text',
       (select (data_type = 'text')::text
          from information_schema.columns
         where table_schema = 'public' and table_name = 'sbv_inquiries'
           and column_name = 'ip_address')

union all select 'the ip/created rate-limit index exists',
       (select (count(*) = 1)::text
          from pg_indexes
         where schemaname = 'public' and tablename = 'sbv_inquiries'
           and indexname = 'sbv_inquiries_ip_created_idx')

union all select 'no policy exists for anyone',
       (select (count(*) = 0)::text
          from pg_policies
         where schemaname = 'public' and tablename = 'sbv_inquiries')

union all select 'anon holds no privilege of any kind',
       (select (not bool_or(has_table_privilege('anon', 'public.sbv_inquiries', pr)))::text
          from unnest(array['select','insert','update','delete']) pr)

union all select 'authenticated holds no privilege of any kind',
       (select (not bool_or(has_table_privilege('authenticated', 'public.sbv_inquiries', pr)))::text
          from unnest(array['select','insert','update','delete']) pr)

union all select 'service_role can select and insert',
       (has_table_privilege('service_role', 'public.sbv_inquiries', 'select')
        and has_table_privilege('service_role', 'public.sbv_inquiries', 'insert'))::text

union all select 'touch trigger is attached',
       (select (count(*) = 1)::text
          from pg_trigger
         where tgrelid = 'public.sbv_inquiries'::regclass
           and tgname = 'sbv_inquiries_touch' and not tgisinternal);
