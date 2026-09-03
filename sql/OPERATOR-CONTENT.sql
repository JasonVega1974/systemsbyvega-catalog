-- ============================================================================
-- OPERATOR-CONTENT.sql — what an operator may edit about their own storefront
-- ----------------------------------------------------------------------------
-- RUN AFTER: SETUP.sql, COMMERCE.sql, COMMERCE-2.sql.
--
-- Reuses what those files already create rather than adding parallel copies:
--   sbv_tenants             the FK target, and the is_active gate
--   sbv_is_tenant(text)     the ownership predicate for every policy here
--   sbv_touch_updated_at()  the updated_at trigger function
--
-- PHASE A ONLY. The identity block a buyer needs to make the demo site theirs:
-- name, contact, address, hours, owner, bio. No photos — Phase B lands as new
-- columns on THIS table, not a second one.
--
-- ── WHERE THE DEFAULT COMES FROM ────────────────────────────────────────────
-- There is deliberately NO row per tenant at provision time. A storefront with
-- no row here renders the niche's own sites/<niche>/content.json, so a buyer's
-- subdomain shows the demo they were sold from the moment it resolves. The
-- first save creates the row and takes over from the demo, field by field.
-- "No row" is a valid, expected state — never an error, never a 404.
--
-- ── NO ANON GRANTS AT ALL ───────────────────────────────────────────────────
-- Public reads go through api/operator-content.mjs, which runs server-side with
-- the service key. anon therefore needs no privilege here — not on the table,
-- not on any function. One public path, and it is one we control and can cache.
-- ============================================================================


-- ====================================================== 1. HOURS VALIDATOR ==
-- Declared BEFORE the table, because the table's CHECK calls it. That inverts
-- the usual tables-then-helpers ordering and is safe here for one specific
-- reason: this function touches no table, so the `language sql` body validation
-- that runs at CREATE time has nothing to resolve and cannot raise 42P01. A
-- helper that reads a table must still come after it.
--
-- WHY VALIDATE AT ALL: jsonb accepts anything, and the admin page will not
-- always be the only writer. Without a constraint, one bad save puts a
-- storefront into a state no renderer can read, and nothing reports it until a
-- visitor sees a blank panel.
--
--   {"mon": {"open":"08:00","close":"17:00"},
--    "sat": {"open":"09:00","close":"13:00"},
--    "sun": null}
--
-- A day that is MISSING and a day explicitly null both mean closed, so the
-- admin page can send either without a special case. Times are 24-hour "HH:MM"
-- strings: they sort and compare correctly as text and carry no timezone,
-- because a shop's opening time is a wall-clock fact about a place, not an
-- instant. Rendering to "8am" is the storefront's job.
--
-- Exactly `open` and `close`, no other keys. A "by appointment" or "note" field
-- is a Phase B decision deserving a migration and a renderer, not silent
-- arrival as unvalidated junk in a column nothing checks.
create or replace function public.sbv_hours_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and not exists (
      select 1
      from jsonb_each(p) as e(day, val)
      where day not in ('mon','tue','wed','thu','fri','sat','sun')
         or not (
              jsonb_typeof(val) = 'null'
              or (
                jsonb_typeof(val) = 'object'
                and (select count(*) from jsonb_object_keys(val)) = 2
                and val ? 'open' and val ? 'close'
                and jsonb_typeof(val -> 'open')  = 'string'
                and jsonb_typeof(val -> 'close') = 'string'
                and (val ->> 'open')  ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                and (val ->> 'close') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
              )
            )
    )
  );
$$;


-- ================================================================= 2. TABLE ==
create table if not exists public.sbv_operator_content (
  client_id     text primary key
                  references public.sbv_tenants(client_id)
                  on update cascade on delete cascade,

  business_name text check (length(btrim(business_name)) between 2 and 120),

  -- Contact details the operator CHOOSES to publish. sbv_public_tenants()
  -- deliberately omits sbv_tenants.operator_email/phone because those are
  -- billing contacts nobody opted to publish; these are the opposite — typed
  -- into an admin form for the express purpose of appearing on a storefront.
  phone         text check (length(phone) <= 40),
  email         text check (email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'
                            and length(email) <= 254),

  address_line  text check (length(address_line) <= 200),
  city          text check (length(city) <= 100),
  state_code    text check (state_code ~ '^[A-Z]{2}$'),
  postal_code   text check (postal_code ~ '^[0-9]{5}(-[0-9]{4})?$'),

  hours         jsonb check (public.sbv_hours_valid(hours)),

  owner_name    text check (length(owner_name) <= 120),
  bio           text check (length(bio) <= 2000),

  updated_at    timestamptz not null default now(),
  -- Stamped by the trigger below, never sent by the client.
  --
  -- Not a DEFAULT, for two separate reasons. `default (select auth.uid())` is
  -- rejected outright — Postgres forbids subqueries in DEFAULT expressions
  -- (0A000). The bare `default auth.uid()` that does parse would fire on INSERT
  -- only, so every later save would keep the original creator's id.
  -- sbv_client_users allows a 'staff' role alongside 'operator', which makes
  -- "who saved this" a real question, and a stale answer is worse than none.
  --
  -- Not client-supplied either: a caller free to send this column is a caller
  -- free to name somebody else as the editor.
  updated_by    uuid references auth.users(id)
);

-- Invoker rights, deliberately not SECURITY DEFINER: the entire job is to read
-- the calling session's own JWT claim. auth.uid() returns null for a
-- service-key write, which is correct — those have no user behind them.
create or replace function public.sbv_stamp_updated_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists sbv_operator_content_touch on public.sbv_operator_content;
create trigger sbv_operator_content_touch
  before update on public.sbv_operator_content
  for each row execute function public.sbv_touch_updated_at();

-- INSERT OR UPDATE, unlike the touch trigger above. A DEFAULT would have
-- covered the insert alone, and the update is the case that matters: the admin
-- page upserts, so the second save onwards is the normal path.
drop trigger if exists sbv_operator_content_stamp on public.sbv_operator_content;
create trigger sbv_operator_content_stamp
  before insert or update on public.sbv_operator_content
  for each row execute function public.sbv_stamp_updated_by();


-- =================================================================== 3. RLS ==
-- No ownership helper is defined here: sbv_is_tenant() already answers "does
-- the calling user operate this tenant?", and it is SECURITY DEFINER precisely
-- because sbv_client_users is itself RLS-protected. A second implementation
-- that drifted from it would be a silent authorisation bug.
alter table public.sbv_operator_content enable row level security;

drop policy if exists sbv_operator_content_own_read on public.sbv_operator_content;
create policy sbv_operator_content_own_read on public.sbv_operator_content
  for select to authenticated
  using (public.sbv_is_tenant(client_id));

-- INSERT and UPDATE are separate policies because the admin page upserts:
-- PostgREST's merge-duplicates resolution is INSERT .. ON CONFLICT DO UPDATE,
-- which needs both, plus both table privileges below. One without the other
-- succeeds on the first save and returns 42501 on every save after — a bug
-- that passes a smoke test and then fails in front of the operator.
drop policy if exists sbv_operator_content_own_insert on public.sbv_operator_content;
create policy sbv_operator_content_own_insert on public.sbv_operator_content
  for insert to authenticated
  with check (public.sbv_is_tenant(client_id));

drop policy if exists sbv_operator_content_own_update on public.sbv_operator_content;
create policy sbv_operator_content_own_update on public.sbv_operator_content
  for update to authenticated
  using (public.sbv_is_tenant(client_id))
  with check (public.sbv_is_tenant(client_id));

-- No DELETE policy, deliberately. Clearing a field is an UPDATE; dropping the
-- row would silently republish the niche demo under the operator's name, which
-- is not something a delete button should be able to do by accident.


-- ================================================================ 4. GRANTS ==
-- Scoped to this file's objects only, matching COMMERCE.sql's note: a blanket
-- revoke here would strip grants this file knows nothing about.
--
-- A policy WITHOUT the underlying table grant fails with the same 42501 as a
-- missing policy, so both are stated explicitly rather than left to a default.
revoke all on public.sbv_operator_content from anon, authenticated;
grant select, insert, update on public.sbv_operator_content to authenticated;

-- The validator runs inside a CHECK, which evaluates as the table owner, so no
-- caller needs EXECUTE. Revoked explicitly rather than relying on the public
-- default, which grants EXECUTE to everyone.
revoke all on function public.sbv_hours_valid(jsonb) from public, anon, authenticated;
