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
-- Idempotent: create-if-not-exists, and every constraint and policy is dropped
-- or guarded before it is created, so this is safe to re-run against a table
-- that already holds real leads. Run against SystemsByVega
-- (newjbexmvltvtmxollca) ONLY.
--
-- WHAT THE VERIFY BLOCK PROVES, AND WHAT IT DOES NOT. It is plain schema
-- inspection: no temp tables, no role switching, no transaction. Two earlier
-- versions used those and both died with 42P01, because the SQL editor
-- auto-commits each statement and is free to run them on different pooled
-- sessions, so session state does not survive from one statement to the next.
--
-- The consequence is worth stating plainly rather than glossing. These rows
-- prove the policies exist, are attached to the right commands, and are scoped
-- by sbv_is_tenant(client_id) — and that every grant is exactly what was
-- intended, including the ones deliberately withheld. They do NOT execute a
-- query as an operator, so on their own they cannot prove RLS filters at
-- runtime. That proof belongs to a live request carrying a real operator JWT
-- against PostgREST, which is the better test anyway because it exercises the
-- path the admin actually uses. It runs while the Leads tab is built, and its
-- result goes in the progress ledger.
--
-- ============================================================================

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
-- One statement, one result set, catalog reads only. Run it on its own at any
-- time: it changes nothing and depends on no session state.
select 'table exists' as check_name,
       (to_regclass('public.sbv_leads') is not null)::text as got

union all select 'rls is enabled',
       (select relrowsecurity::text
          from pg_class where oid = 'public.sbv_leads'::regclass)

union all select 'exactly three policies, none of them DELETE',
       (select (count(*) = 3 and count(*) filter (where cmd = 'DELETE') = 0)::text
          from pg_policies
         where schemaname = 'public' and tablename = 'sbv_leads')

-- The row that carries the most weight. A policy can exist and still be scoped
-- to something useless, so read the predicate text and confirm all three are
-- gated on sbv_is_tenant(client_id) rather than merely present.
union all select 'every policy is scoped by sbv_is_tenant(client_id)',
       (select (count(*) = 3)::text
          from pg_policies
         where schemaname = 'public' and tablename = 'sbv_leads'
           and coalesce(qual, '') || coalesce(with_check, '')
               like '%sbv_is_tenant(client_id)%')

-- sbv_is_tenant reads sbv_client_users, which authenticated cannot read
-- directly. If it ever stopped being SECURITY DEFINER, every policy above
-- would quietly evaluate false and operators would open an empty lead list
-- with no error to explain it.
union all select 'sbv_is_tenant is SECURITY DEFINER and stable',
       (select (p.prosecdef and p.provolatile = 's')::text
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'sbv_is_tenant')

union all select 'anon holds no privilege of any kind',
       (select (not bool_or(has_table_privilege('anon', 'public.sbv_leads', pr)))::text
          from unnest(array['select','insert','update','delete']) pr)

union all select 'operator cannot edit what the visitor typed',
       (select (not bool_or(
                  has_column_privilege('authenticated', 'public.sbv_leads', c, 'update')))::text
          from unnest(array['id','client_id','created_at',
                            'name','phone','email','message']) c)

union all select 'operator can triage (status, note, deleted_at)',
       (select bool_and(
                 has_column_privilege('authenticated', 'public.sbv_leads', c, 'update'))::text
          from unnest(array['status','note','deleted_at']) c)

union all select 'operator can read and insert, but never delete',
       (has_table_privilege('authenticated', 'public.sbv_leads', 'select')
        and has_table_privilege('authenticated', 'public.sbv_leads', 'insert')
        and not has_table_privilege('authenticated', 'public.sbv_leads', 'delete'))::text

union all select 'service_role can insert (the public submit path)',
       has_table_privilege('service_role', 'public.sbv_leads', 'insert')::text

union all select 'all four check constraints present',
       (select (count(*) = 4)::text
          from pg_constraint
         where conrelid = 'public.sbv_leads'::regclass and contype = 'c'
           and conname in ('sbv_leads_status_ck', 'sbv_leads_source_ck',
                           'sbv_leads_lengths_ck', 'sbv_leads_contactable_ck'))

union all select 'client_id is a real tenant, and cascades on delete',
       (select (count(*) = 1)::text
          from pg_constraint
         where conrelid = 'public.sbv_leads'::regclass and contype = 'f'
           and confrelid = 'public.sbv_tenants'::regclass
           and confdeltype = 'c')

union all select 'all three query indexes present',
       (select (count(*) = 3)::text
          from pg_indexes
         where schemaname = 'public' and tablename = 'sbv_leads'
           and indexname in ('sbv_leads_client_recent_idx',
                             'sbv_leads_client_status_idx',
                             'sbv_leads_client_created_idx'));
