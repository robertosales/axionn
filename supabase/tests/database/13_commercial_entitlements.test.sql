begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(30);

select public.set_tenancy_enforcement(false);

-- ============================================================
-- FIXTURES
-- ============================================================

-- Test users
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('31100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'comm-a@axion.test', '', now(), now(), now()),
  ('31100000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'comm-b@axion.test', '', now(), now(), now()),
  ('31100000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'comm-admin@axion.test', '', now(), now(), now())
on conflict (id) do nothing;

-- Test organizations (ENUM values: free/pro/enterprise/trial)
-- Actual plan resolution uses organization_subscriptions → saas_plans, not this legacy field
insert into public.organizations (id, name, slug, status, plan, max_projects, max_users, max_countings_per_month)
values
  ('21100000-0000-0000-0000-000000000001', 'Comm Org Core', 'comm-org-core', 'active', 'pro', 10, 15, 100),
  ('21100000-0000-0000-0000-000000000002', 'Comm Org Intel', 'comm-org-intel', 'active', 'enterprise', 100, 100, 1000),
  ('21100000-0000-0000-0000-000000000003', 'Comm Org Suspended', 'comm-org-suspended', 'active', 'pro', 10, 10, 100)
on conflict (id) do nothing;

-- Subscriptions BEFORE members (trigger checks entitlements on member INSERT)
insert into public.organization_subscriptions (org_id, plan_id, status, starts_at, source)
select fixture.org_id, plan.id, fixture.status, now(), 'manual'
from (
  values
    ('21100000-0000-0000-0000-000000000001'::uuid, 'core'::text, 'active'::text),
    ('21100000-0000-0000-0000-000000000002'::uuid, 'enterprise'::text, 'active'::text),
    ('21100000-0000-0000-0000-000000000003'::uuid, 'core'::text, 'suspended'::text)
) fixture(org_id, plan_code, status)
join public.saas_plans plan on plan.code = fixture.plan_code
on conflict (org_id) do update
set plan_id = excluded.plan_id, status = excluded.status;

-- Override for org A
insert into public.organization_entitlement_overrides (org_id, feature_key, enabled, limit_value, reason, source_type)
values
  ('21100000-0000-0000-0000-000000000001', 'users.max', null, 20, 'Test override', 'manual')
on conflict (org_id, feature_key) do update
set enabled = excluded.enabled, limit_value = excluded.limit_value, reason = excluded.reason;

-- Organization members (AFTER subscriptions so resource limit trigger works)
insert into public.organization_members (org_id, user_id, role)
values
  ('21100000-0000-0000-0000-000000000001', '31100000-0000-0000-0000-000000000001', 'owner'),
  ('21100000-0000-0000-0000-000000000002', '31100000-0000-0000-0000-000000000002', 'owner'),
  ('21100000-0000-0000-0000-000000000003', '31100000-0000-0000-0000-000000000001', 'member')
on conflict do nothing;

-- Platform admin
insert into public.platform_user_roles (user_id, role)
values ('31100000-0000-0000-0000-000000000003', 'platform_admin')
on conflict do nothing;

-- ============================================================
-- 1. SCHEMA INTEGRITY (8 tests)
-- ============================================================

select has_table('public', 'saas_plans', 'saas_plans exists');
select has_table('public', 'saas_plan_versions', 'saas_plan_versions exists');
select has_table('public', 'saas_plan_version_features', 'saas_plan_version_features exists');
select has_table('public', 'organization_subscriptions', 'organization_subscriptions exists');
select has_table('public', 'organization_entitlement_overrides', 'organization_entitlement_overrides exists');
select has_table('public', 'product_modules', 'product_modules exists');
select has_table('public', 'product_features', 'product_features exists');
select has_table('public', 'commercial_enforcement_events', 'commercial_enforcement_events exists');

-- ============================================================
-- 2. CATALOG DATA INTEGRITY (3 tests)
-- ============================================================

select is(
  (select count(*)::integer from public.saas_plans where code in ('core', 'intelligence', 'enterprise')),
  3,
  'core, intelligence and enterprise plans exist'
);

select is(
  (select count(*)::integer from public.product_modules where status = 'active'),
  29,
  '29 active product modules seeded'
);

select is(
  (select count(*)::integer from public.product_features where status = 'active'),
  95,
  '95+ active product features seeded'
);

-- ============================================================
-- 3. PLAN VERSIONING (3 tests)
-- ============================================================

select is(
  (select count(*)::integer from public.saas_plan_versions where status = 'active'),
  3,
  'each plan has one active version'
);

select is(
  (
    select count(*)::integer
    from public.saas_plan_version_features pvf
    join public.saas_plan_versions pv on pv.id = pvf.plan_version_id
    join public.saas_plans p on p.id = pv.plan_id
    where p.code = 'enterprise' and pv.version = 1 and pv.status = 'active'
  ),
  (select count(*)::integer from public.product_features where status = 'active'),
  'enterprise version covers all features'
);

select is(
  (select version from public.saas_plan_versions pv join public.saas_plans p on p.id = pv.plan_id where p.code = 'core' and pv.status = 'active'),
  1,
  'core plan version is 1'
);

-- ============================================================
-- 4. ENTITLEMENT RESOLUTION (4 tests)
-- ============================================================

-- Core org should get plan entitlements
select ok(
  exists(
    select 1 from public.get_effective_organization_entitlements('21100000-0000-0000-0000-000000000001')
    where feature_key = 'users.max'
  ),
  'core org has users.max entitlement'
);

-- Override should take precedence
select is(
  (
    select limit_value
    from public.get_effective_organization_entitlements('21100000-0000-0000-0000-000000000001')
    where feature_key = 'users.max'
  ),
  20::bigint,
  'override limit_value wins over plan limit'
);

-- Override source should be reported
select is(
  (
    select source
    from public.get_effective_organization_entitlements('21100000-0000-0000-0000-000000000001')
    where feature_key = 'users.max'
  ),
  'organization_override',
  'effective entitlement reports override source'
);

-- Enterprise org should have unlimited (null) limits
select is(
  (
    select limit_value
    from public.get_effective_organization_entitlements('21100000-0000-0000-0000-000000000002')
    where feature_key = 'users.max'
  ),
  null::bigint,
  'enterprise null limit means unlimited'
);

-- ============================================================
-- 5. SUBSCRIPTION STATUS ENFORCEMENT (2 tests)
-- ============================================================

select is(
  public.has_organization_entitlement('21100000-0000-0000-0000-000000000001', 'reports.basic'),
  true,
  'active subscription authorizes features'
);

select is(
  public.has_organization_entitlement('21100000-0000-0000-0000-000000000003', 'reports.basic'),
  false,
  'suspended subscription blocks entitlements'
);

-- ============================================================
-- 6. USAGE SUMMARY (3 tests)
-- ============================================================

select pg_temp.authenticate_as('31100000-0000-0000-0000-000000000001');

select is(
  (select count(*)::integer from public.get_my_organization_entitlements('21100000-0000-0000-0000-000000000001')),
  8,
  'member reads own organization entitlements'
);

select throws_ok(
  $sql$ select * from public.get_my_organization_entitlements('21100000-0000-0000-0000-000000000002') $sql$,
  '42501',
  'organization_entitlements_access_denied',
  'member cannot read another organization entitlements'
);

select is(
  (select users_used from public.get_organization_usage_summary('21100000-0000-0000-0000-000000000001')),
  2::bigint,
  'usage summary counts members correctly'
);

-- ============================================================
-- 7. AUDIT LOGS TABLE (2 tests)
-- ============================================================

select has_table('public', 'commercial_audit_logs', 'commercial_audit_logs exists');

select is(
  (
    select count(*)::integer
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'commercial_audit_logs'
      and relation.relrowsecurity
  ),
  1,
  'commercial_audit_logs has RLS enabled'
);

-- ============================================================
-- 8. ENFORCEMENT EVENTS TABLE (2 tests)
-- ============================================================

select has_table('public', 'organization_usage_records', 'organization_usage_records exists');

select is(
  (
    select count(*)::integer
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'commercial_enforcement_events',
        'organization_usage_records'
      )
      and relation.relrowsecurity
  ),
  2,
  'enforcement and usage tables have RLS enabled'
);

-- ============================================================
-- 9. ACCESS CONTROL (3 tests)
-- ============================================================

select ok(
  not has_function_privilege('anon', 'public.get_effective_organization_entitlements(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.check_commercial_usage_v1(uuid,text,numeric,uuid)', 'execute'),
  'anon cannot execute commercial enforcement functions'
);

select ok(
  not has_table_privilege('authenticated', 'public.organization_subscriptions', 'insert')
  and not has_table_privilege('authenticated', 'public.organization_subscriptions', 'update')
  and not has_table_privilege('authenticated', 'public.organization_entitlement_overrides', 'insert'),
  'authenticated cannot write commercial tables directly'
);

select ok(
  has_function_privilege('authenticated', 'public.get_my_organization_entitlements(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.has_organization_entitlement(uuid,text)', 'execute')
  and has_function_privilege('authenticated', 'public.get_my_commercial_usage_v1(uuid)', 'execute'),
  'authenticated can execute tenant-scoped commercial RPCs'
);

-- ============================================================
-- 10. UNIQUE CONSTRAINTS (2 tests)
-- ============================================================

select is(
  (select count(*)::integer from public.saas_plans),
  (select count(distinct code)::integer from public.saas_plans),
  'plan codes are unique'
);

select throws_ok(
  $sql$
    insert into public.organization_subscriptions (org_id, plan_id, status, source)
    select '21100000-0000-0000-0000-000000000001', id, 'active', 'manual'
    from public.saas_plans where code = 'core'
  $sql$,
  '23505',
  null,
  'one current subscription per organization enforced'
);

-- ============================================================
-- DONE
-- ============================================================

select * from finish();
rollback;
