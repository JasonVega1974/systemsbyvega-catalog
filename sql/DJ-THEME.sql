-- ============================================================================
-- DJ-THEME.sql — let a tenant's subdomain resolve to their chosen theme.
-- ----------------------------------------------------------------------------
-- THE BUG THIS FIXES: dj is a themed niche. Its per-theme builds live at
-- sites/dj/{blue,green,pink}/, and sites/dj/ itself is a hand-authored theme
-- PICKER page, not a storefront. middleware.js rewrites a tenant to
-- /sites/<niche_slug>/ with no theme segment, so a dj operator's subdomain
-- served the picker instead of their site, and /terms and /privacy 404'd
-- because only the themed directories carry those files.
--
-- Nothing recorded which theme a tenant had chosen, so routing could not have
-- worked. This adds that column.
--
-- THE CHECK IS FORMAT ONLY, deliberately. Which names are valid depends on
-- what directories exist under niches/<slug>/themes/, which the database
-- cannot see. The real whitelist is enforced in middleware.js against
-- assets/data/themes.mjs, which tools/build-manifest-index.js generates from
-- those directories. What this constraint guarantees is the security property:
-- no slashes, no dots, no traversal — the value is pasted into a filesystem
-- path, so 'blue/../../etc' must be impossible at the storage layer too and
-- not only at the routing layer.
--
-- NULL means "not chosen". Middleware falls back to the niche's default theme
-- rather than 404ing, so an operator provisioned before this column existed
-- still gets a working site. There are no dj tenants today, so nothing is
-- backfilled and no live row changes.
--
-- Idempotent. Run against SystemsByVega (newjbexmvltvtmxollca) ONLY.
-- ============================================================================

alter table public.sbv_tenants
  add column if not exists theme text;

alter table public.sbv_tenants
  drop constraint if exists sbv_tenants_theme_ck;
alter table public.sbv_tenants
  add  constraint sbv_tenants_theme_ck
  check (theme is null or theme ~ '^[a-z][a-z0-9-]{1,15}$');

-- The routing surface. Adding a column to the return type means dropping the
-- function first: create-or-replace cannot change a function's signature.
--
-- theme is safe to expose. It is a design variant name, not a business fact —
-- the same class of information as niche_slug, which this function has always
-- returned. Nothing about who paid what is added here; the OMITTED ON PURPOSE
-- list above this function in COMMERCE.sql still holds.
drop function if exists public.sbv_public_tenants();

create or replace function public.sbv_public_tenants()
returns table (client_id text, niche_slug text, business_name text, theme text)
language sql stable security definer set search_path = ''
as $$
  select t.client_id, t.niche_slug, t.business_name, t.theme
  from public.sbv_tenants t
  where t.is_active;
$$;

revoke all    on function public.sbv_public_tenants() from public, anon, authenticated;
grant execute on function public.sbv_public_tenants() to anon, authenticated;

-- NOT granted to authenticated as an updatable column. Theme is chosen at
-- provisioning and changed by the owner, exactly like niche_slug and tier —
-- the column-level grant on sbv_tenants deliberately lists only
-- business_name, operator_name, operator_email and operator_phone, and adding
-- theme here would let an operator repoint their own site from a dashboard.

-- ================================================ VERIFY ==
select 'theme column exists' as check_name,
       (count(*) = 1)::text as got
  from information_schema.columns
 where table_schema = 'public' and table_name = 'sbv_tenants'
   and column_name = 'theme'
union all select 'format check present',
       (count(*) = 1)::text
  from pg_constraint
 where conrelid = 'public.sbv_tenants'::regclass
   and conname = 'sbv_tenants_theme_ck'
union all select 'rpc returns four columns',
       (pg_get_function_result(p.oid) like '%theme text%')::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'sbv_public_tenants'
union all select 'anon can execute rpc',
       has_function_privilege('anon', 'public.sbv_public_tenants()', 'execute')::text
union all select 'traversal value rejected',
       (not exists (
         select 1 from pg_constraint
          where conrelid = 'public.sbv_tenants'::regclass
            and conname = 'sbv_tenants_theme_ck'
            and pg_get_constraintdef(oid) !~ 'a-z'
       ))::text
union all select 'operator cannot update theme',
       (not has_column_privilege('authenticated', 'public.sbv_tenants', 'theme', 'update'))::text;
