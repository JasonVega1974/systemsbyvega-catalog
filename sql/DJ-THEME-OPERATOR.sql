-- ============================================================================
-- DJ-THEME-OPERATOR.sql — let an operator of a themed niche pick their theme.
-- ----------------------------------------------------------------------------
-- THIS REVERSES A DECISION IN sql/DJ-THEME.sql, deliberately and on Jason's
-- instruction (2026-09-08, "option B"). That file withheld the column grant,
-- reasoning that theme repoints which build a subdomain serves and therefore
-- belongs with niche_slug and tier — owner-set, not operator-set.
--
-- Why the reversal is safe, which is the part that matters:
--
--   * middleware.js and api/operator-content.mjs both resolve the theme
--     through THEMED_NICHES in assets/data/themes.mjs, keyed by the tenant's
--     OWN niche. An operator can therefore only ever land on one of their own
--     niche's design variants. There is no value they can write that serves a
--     different niche's build.
--   * an unrecognised value is DISCARDED, not sanitised — both resolvers fall
--     back to the niche's first theme — so a bad write degrades to a working
--     site rather than a 404 or a traversal.
--   * an operator of an UNTHEMED niche can set the column and nothing happens:
--     themeSegment() returns '' when the niche has no themes entry.
--   * the column CHECK in DJ-THEME.sql still bars slashes and dots at the
--     storage layer, so the two locks from that file are both intact.
--
-- What stays withheld: client_id, niche_slug, tier and is_active. Those are
-- what stop an operator promoting themselves or moving to another product, and
-- nothing here touches them.
--
-- The UPDATE policy sbv_tenants_own_update already exists and is scoped by
-- sbv_is_tenant(client_id); only the column privilege was missing.
--
-- Idempotent. Run against SystemsByVega (newjbexmvltvtmxollca) ONLY.
-- ============================================================================

grant update (theme) on public.sbv_tenants to authenticated;

-- ================================================ VERIFY ==
select 'operator can set their theme' as check_name,
       has_column_privilege('authenticated', 'public.sbv_tenants', 'theme', 'update')::text as got

union all select 'the columns that matter are still withheld',
       (select (not bool_or(
                  has_column_privilege('authenticated', 'public.sbv_tenants', c, 'update')))::text
          from unnest(array['client_id','niche_slug','tier','is_active']) c)

union all select 'the own-row UPDATE policy is still in place',
       (select (count(*) = 1)::text
          from pg_policies
         where schemaname = 'public' and tablename = 'sbv_tenants'
           and cmd = 'UPDATE'
           and coalesce(qual, '') || coalesce(with_check, '') like '%sbv_is_tenant%')

union all select 'the format CHECK from DJ-THEME.sql survives',
       (select (count(*) = 1)::text
          from pg_constraint
         where conrelid = 'public.sbv_tenants'::regclass
           and conname = 'sbv_tenants_theme_ck')

union all select 'contact fields the operator already owned are unchanged',
       (select bool_and(
                 has_column_privilege('authenticated', 'public.sbv_tenants', c, 'update'))::text
          from unnest(array['business_name','operator_name',
                            'operator_email','operator_phone']) c);
