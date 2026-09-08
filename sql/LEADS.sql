-- ============================================================================
-- LEADS.sql — the operator's inbound lead record.
-- ----------------------------------------------------------------------------
-- Every booking-form submission on a claimed site lands here as well as in the
-- operator's inbox. FormSubmit still sends the email and remains the delivery
-- path of record; this is the running list, so a lead is not lost the moment
-- an email is archived.
--
-- WHO WRITES WHAT, because the two paths are deliberately different:
--   * a VISITOR filling in the form is not authenticated, so the insert goes
--     through api/submit-lead.mjs with the service_role key. There is no anon
--     policy and no anon grant — a public key must never be able to write rows
--     into an operator's lead list, or the table becomes a spam target with a
--     free API.
--   * an OPERATOR logging a phone call is authenticated, and inserts under RLS
--     scoped to their own tenant, exactly like sbv_operator_content.
--
-- NO DELETE POLICY, and no delete grant. Deletion is `deleted_at`, set by an
-- UPDATE. A lead is a record of somebody who asked for work; losing one to a
-- mis-tap is worse than keeping a hidden row forever, and the same reasoning
-- already governs sbv_operator_content.
--
-- Idempotent: create-if-not-exists, and every policy is dropped before it is
-- recreated. Run against SystemsByVega (newjbexmvltvtmxollca) ONLY.
--
-- ONE TRANSACTION, on purpose, and this is not cosmetic. The verify block at
-- the bottom uses a temp table and `set local role`, both of which are session
-- state. Run as loose statements they are auto-committed one at a time and the
-- runner is free to hand each one a different pooled session — which is
-- exactly what happened on the first attempt: the temp table vanished between
-- being created and being read, and the file died with 42P01.
--
-- So everything lives inside a single begin/commit. Postgres has transactional
-- DDL, so this also makes the migration atomic: it applies completely or not
-- at all. A savepoint separates the two halves — the schema commits, the
-- verify's staged rows are rolled back to the savepoint and never persist.
-- ============================================================================

begin;

create table if not exists public.sbv_leads (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null references public.sbv_tenants(client_id) on delete cascade,
  created_at  timestamptz not null default now(),
  name        text,
  phone       text,
  email       text,
  message     text,
  source      text not null default 'form',
  status      text not null default 'new',
  note        text,
  deleted_at  timestamptz
);

-- Length and vocabulary limits live here, not only in the browser: the admin is
-- not the only thing that can reach PostgREST with a valid JWT, and the public
-- submit route is reachable by anyone who can read the page's JavaScript.
alter table public.sbv_leads drop constraint if exists sbv_leads_status_ck;
alter table public.sbv_leads add  constraint sbv_leads_status_ck
  check (status in ('new', 'contacted', 'booked', 'closed'));

alter table public.sbv_leads drop constraint if exists sbv_leads_source_ck;
alter table public.sbv_leads add  constraint sbv_leads_source_ck
  check (source in ('form', 'manual'));

alter table public.sbv_leads drop constraint if exists sbv_leads_lengths_ck;
alter table public.sbv_leads add  constraint sbv_leads_lengths_ck
  check (
    (name    is null or char_length(name)    <= 120)  and
    (phone   is null or char_length(phone)   <= 40)   and
    (email   is null or char_length(email)   <= 200)  and
    (message is null or char_length(message) <= 4000) and
    (note    is null or char_length(note)    <= 2000)
  );

-- A lead with no way to reach the person back is not a lead, it is noise. The
-- submit route rejects these too; this is the second lock.
alter table public.sbv_leads drop constraint if exists sbv_leads_contactable_ck;
alter table public.sbv_leads add  constraint sbv_leads_contactable_ck
  check (coalesce(phone, '') <> '' or coalesce(email, '') <> '');

-- The admin lists one tenant's leads newest-first and filters by status, so the
-- composite matches the actual query rather than indexing three columns
-- separately and hoping. Partial on deleted_at because the default view never
-- includes soft-deleted rows.
create index if not exists sbv_leads_client_recent_idx
  on public.sbv_leads (client_id, created_at desc)
  where deleted_at is null;
create index if not exists sbv_leads_client_status_idx
  on public.sbv_leads (client_id, status)
  where deleted_at is null;

-- The rate limiter in api/submit-lead.mjs counts recent rows for one tenant.
create index if not exists sbv_leads_client_created_idx
  on public.sbv_leads (client_id, created_at);

alter table public.sbv_leads enable row level security;

drop policy if exists sbv_leads_own_read on public.sbv_leads;
create policy sbv_leads_own_read on public.sbv_leads
  for select to authenticated
  using (public.sbv_is_tenant(client_id));

drop policy if exists sbv_leads_own_insert on public.sbv_leads;
create policy sbv_leads_own_insert on public.sbv_leads
  for insert to authenticated
  with check (public.sbv_is_tenant(client_id));

drop policy if exists sbv_leads_own_update on public.sbv_leads;
create policy sbv_leads_own_update on public.sbv_leads
  for update to authenticated
  using (public.sbv_is_tenant(client_id))
  with check (public.sbv_is_tenant(client_id));

-- ============================================================================
-- GRANTS — scoped to this table only. A policy without the underlying table
-- privilege raises the same 42501 as a missing policy, so these are explicit.
-- ============================================================================
revoke all on public.sbv_leads from anon, authenticated;

grant select, insert on public.sbv_leads to authenticated;

-- Column-level UPDATE. An operator triages a lead; they do not rewrite what
-- the visitor actually typed. Leaving name/phone/email/message out means a
-- lead cannot be quietly edited into saying something else after the fact.
grant update (status, note, deleted_at) on public.sbv_leads to authenticated;

-- service_role bypasses RLS by definition; this is the table privilege the
-- public submit route needs behind it.
grant select, insert on public.sbv_leads to service_role;

-- anon gets nothing. Stated rather than assumed.
revoke all on public.sbv_leads from anon;

-- ================================================ VERIFY ==
-- The isolation rows are the ones that matter. They do not merely assert that
-- a policy exists — they impersonate a real operator by setting the JWT claim
-- sbv_is_tenant() reads, switch to the `authenticated` role so RLS actually
-- applies, and then try to read another tenant's lead. No user id is written
-- into this file; it is looked up from sbv_client_users at run time.
--
-- Results accumulate in a temp table so a single result set comes back at the
-- end — a client that shows only the last statement would otherwise hide every
-- check but one.
--
-- Everything runs inside a transaction that is rolled back. No lead row, and
-- no change of any kind, survives this file.
savepoint before_verify;

create temp table _leads_verify (ord int, check_name text, got text) on commit drop;
-- The role switch below changes who is inserting, so the temp table has to be
-- writable by that role too.
grant all on _leads_verify to public;

-- Two leads owned by two different tenants, staged as the table owner. RLS does
-- not apply to us here, which is the point: we are setting up the test, and the
-- interesting question is what the OPERATOR can see afterwards.
--
-- 'testy' specifically, and this matters: every OTHER test tenant
-- (primetest, startest, testerson, testy2) is mapped to the SAME operator
-- account in sbv_client_users, so sbv_is_tenant() is legitimately true for all
-- of them and a lead staged under any of them would be visible here. That
-- would look like an RLS failure and would not be one. 'testy' and 'test2'
-- have no operator mapping at all, which makes 'testy' the only honest choice
-- of "a tenant this operator does not own".
insert into public.sbv_leads (client_id, name, phone, message, source)
values ('primetest', 'Verify Mine',   '208-555-0000', 'belongs to primetest', 'manual'),
       ('testy',     'Verify Theirs', '208-555-1111', 'belongs to a tenant this operator does not own', 'manual');

insert into _leads_verify
select 1, 'table exists',
       (to_regclass('public.sbv_leads') is not null)::text
union all select 2, 'rls is enabled',
       (select relrowsecurity::text from pg_class where oid = 'public.sbv_leads'::regclass)
union all select 3, 'three policies, none of them DELETE',
       (select (count(*) = 3 and count(*) filter (where cmd = 'DELETE') = 0)::text
          from pg_policies where schemaname = 'public' and tablename = 'sbv_leads')
union all select 4, 'anon has no privilege at all',
       (select (count(*) = 0)::text from information_schema.table_privileges
         where table_schema = 'public' and table_name = 'sbv_leads' and grantee = 'anon')
union all select 5, 'operator cannot edit what the visitor typed',
       (select (not bool_or(has_column_privilege('authenticated', 'public.sbv_leads', c, 'update')))::text
          from unnest(array['name','phone','email','message','client_id','created_at']) c)
union all select 6, 'operator can triage (status, note, deleted_at)',
       (select bool_and(has_column_privilege('authenticated', 'public.sbv_leads', c, 'update'))::text
          from unnest(array['status','note','deleted_at']) c)
union all select 7, 'status vocabulary enforced',
       (select (count(*) = 1)::text from pg_constraint
         where conrelid = 'public.sbv_leads'::regclass and conname = 'sbv_leads_status_ck');

-- ---- become a real operator ------------------------------------------------
select set_config('request.jwt.claims',
                  json_build_object('sub', cu.user_id, 'role', 'authenticated')::text,
                  true)
  from public.sbv_client_users cu
 where cu.client_id = 'primetest'
 limit 1;

set local role authenticated;

insert into _leads_verify
select 8, 'operator sees their own lead',
       (select (count(*) = 1)::text from public.sbv_leads where name = 'Verify Mine')
union all select 9, 'operator CANNOT see the other tenant''s lead',
       (select (count(*) = 0)::text from public.sbv_leads where name = 'Verify Theirs')
union all select 10, 'operator sees NO row belonging to another tenant',
       -- Scoped to the other tenant rather than counting the whole table: this
       -- file is idempotent and will be re-run once real leads exist, and an
       -- absolute count would then fail for a reason that has nothing to do
       -- with isolation.
       (select (count(*) = 0)::text from public.sbv_leads where client_id = 'testy');

update public.sbv_leads set deleted_at = now() where name = 'Verify Mine';

insert into _leads_verify
select 11, 'operator can soft-delete their own',
       (select (count(*) = 1)::text from public.sbv_leads
         where name = 'Verify Mine' and deleted_at is not null);

reset role;

-- ---- and now somebody who is nobody ---------------------------------------
-- A well-formed session whose subject is mapped to no tenant at all. This is
-- the shape of a stolen or stale token, and it must see nothing.
select set_config('request.jwt.claims',
                  json_build_object('sub', '00000000-0000-0000-0000-000000000000',
                                    'role', 'authenticated')::text,
                  true);
set local role authenticated;

insert into _leads_verify
select 12, 'a session mapped to no tenant sees nothing',
       (select (count(*) = 0)::text from public.sbv_leads);

reset role;

select check_name, got from _leads_verify order by ord;

-- The staged leads and the temp table are discarded here. The schema above the
-- savepoint is untouched by this and is what commits.
rollback to savepoint before_verify;

commit;
