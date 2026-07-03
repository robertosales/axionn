begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(32);

create or replace function pg_temp.authenticate_as(
  p_user_id uuid,
  p_role text default 'authenticated'
)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', p_role, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id, 'role', p_role)::text,
    true
  );
end;
$$;

select public.set_tenancy_enforcement(false);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values
  ('21000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'entitlement-a@axion.test', '', now(), now(), now()),
  ('21000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'entitlement-b@axion.test', '', now(), now(), now()),
  ('21000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'entitlement-platform@axion.test', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.organizations (
  id,
  name,
  slug,
  status,
  plan,
  max_projects,
  max_users,
  max_countings_per_month
)
values
  ('11000000-0000-0000-0000-000000000001', 'Entitlement Tenant A', 'entitlement-tenant-a', 'active', 'pro', 10, 7, 100),
  ('11000000-0000-0000-0000-000000000002', 'Entitlement Tenant B', 'entitlement-tenant-b', 'active', 'enterprise', 100, 100, 1000),
  ('11000000-0000-0000-0000-000000000003', 'Entitlement Tenant Suspended', 'entitlement-tenant-suspended', 'suspended', 'pro', 10, 10, 100)
on conflict (id) do nothing;

insert into public.organization_members (org_id, user_id, role)
values
  ('11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'owner'),
  ('11000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'owner'),
  ('11000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000001', 'member')
on conflict do nothing;

insert into public.platform_user_roles (user_id, role)
values ('21000000-0000-0000-0000-000000000003', 'platform_admin')
on conflict do nothing;

insert into public.organization_subscriptions (
  org_id,
  plan_id,
  status,
  starts_at,
  source
)
select fixture.org_id, plan.id, fixture.status, now(), 'manual'
from (
  values
    ('11000000-0000-0000-0000-000000000001'::uuid, 'pro'::text, 'active'::text),
    ('11000000-0000-0000-0000-000000000002'::uuid, 'enterprise'::text, 'active'::text),
    ('11000000-0000-0000-0000-000000000003'::uuid, 'pro'::text, 'suspended'::text)
) fixture(org_id, plan_code, status)
join public.saas_plans plan on plan.code = fixture.plan_code
on conflict (org_id) do update
set plan_id = excluded.plan_id,
    status = excluded.status;

insert into public.organization_entitlement_overrides (
  org_id,
  feature_key,
  enabled,
  limit_value,
  reason
)
values
  ('11000000-0000-0000-0000-000000000001', 'users.max', null, 7, 'Test override'),
  ('11000000-0000-0000-0000-000000000001', 'audit.access', true, null, 'Test feature override')
on conflict (org_id, feature_key) do update
set enabled = excluded.enabled,
    limit_value = excluded.limit_value,
    reason = excluded.reason;

insert into public.companies (id, name, status, org_id)
values
  ('31000000-0000-0000-0000-000000000001', 'Entitlement Company A', 'active', '11000000-0000-0000-0000-000000000001'),
  ('31000000-0000-0000-0000-000000000002', 'Entitlement Company B', 'active', '11000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

insert into public.licenses (
  id,
  company_id,
  plan,
  pf_quota_month,
  pf_used_month,
  ai_calls_quota,
  ai_calls_used,
  quota_reset_at,
  valid_until,
  status
)
values
  ('71000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'pro', 100, 11, 200, 7, current_date + 10, current_date + 30, 'active'),
  ('71000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', 'enterprise', null, 2, null, 3, current_date + 10, current_date + 30, 'active')
on conflict (id) do nothing;

insert into public.contracts (id, name, status, company_id, org_id)
values
  ('41000000-0000-0000-0000-000000000001', 'Entitlement Contract A', 'active', '31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.projects (
  id,
  name,
  module_type,
  status,
  contract_id,
  org_id
)
values
  ('61000000-0000-0000-0000-000000000001', 'Entitlement Project A', 'agile', 'active', '41000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

select has_table('public', 'saas_plans', 'saas_plans exists');
select has_table('public', 'saas_plan_entitlements', 'saas_plan_entitlements exists');
select has_table('public', 'organization_subscriptions', 'organization_subscriptions exists');
select has_table('public', 'organization_entitlement_overrides', 'organization_entitlement_overrides exists');

select is(
  (select count(*)::integer from public.saas_plans where code in ('starter', 'pro', 'enterprise')),
  3,
  'starter, pro and enterprise are seeded exactly once'
);

select is(
  (
    select count(*)::integer
    from public.saas_plan_entitlements entitlement
    join public.saas_plans plan on plan.id = entitlement.plan_id
    where plan.code in ('starter', 'pro', 'enterprise')
  ),
  24,
  'the three plans contain the initial entitlement catalog'
);

select is(
  (select count(*)::integer from public.saas_plans),
  (select count(distinct code)::integer from public.saas_plans),
  'plan codes are not duplicated'
);

select throws_ok(
  $sql$
    insert into public.organization_subscriptions (org_id, plan_id, status, source)
    select '11000000-0000-0000-0000-000000000001', id, 'active', 'manual'
    from public.saas_plans where code = 'starter'
  $sql$,
  '23505',
  null,
  'an organization cannot have two current subscriptions'
);

select is(
  (
    select limit_value
    from public.get_effective_organization_entitlements('11000000-0000-0000-0000-000000000001')
    where feature_key = 'users.max'
  ),
  7::bigint,
  'organization limit override wins over the plan limit'
);

select is(
  (
    select source
    from public.get_effective_organization_entitlements('11000000-0000-0000-0000-000000000001')
    where feature_key = 'users.max'
  ),
  'organization_override',
  'effective entitlement reports the override source'
);

select is(
  (
    select enabled
    from public.get_effective_organization_entitlements('11000000-0000-0000-0000-000000000001')
    where feature_key = 'audit.access'
  ),
  true,
  'feature override can enable a feature disabled by the plan'
);

select pg_temp.authenticate_as('21000000-0000-0000-0000-000000000001');

select is(
  (select count(*)::integer from public.get_my_organization_entitlements('11000000-0000-0000-0000-000000000001')),
  8,
  'organization member reads the eight effective entitlements of the own organization'
);

select throws_ok(
  $sql$ select * from public.get_my_organization_entitlements('11000000-0000-0000-0000-000000000002') $sql$,
  '42501',
  'organization_entitlements_access_denied',
  'organization member cannot read another organization entitlements'
);

select is(
  public.has_organization_entitlement(
    '11000000-0000-0000-0000-000000000001',
    'reports.advanced'
  ),
  true,
  'active pro organization has advanced reports'
);

select is(
  public.has_organization_entitlement(
    '11000000-0000-0000-0000-000000000003',
    'reports.advanced'
  ),
  false,
  'suspended subscription does not authorize features'
);

select pg_temp.authenticate_as('21000000-0000-0000-0000-000000000003');

select is(
  (select count(*)::integer from public.get_my_organization_entitlements('11000000-0000-0000-0000-000000000002')),
  8,
  'platform administrator can read any organization entitlements'
);

select is(
  (
    select limit_value
    from public.get_effective_organization_entitlements('11000000-0000-0000-0000-000000000002')
    where feature_key = 'users.max'
  ),
  null::bigint,
  'null enterprise limit is represented as unlimited'
);

select pg_temp.authenticate_as('21000000-0000-0000-0000-000000000001');

select is(
  (select users_used from public.get_organization_usage_summary('11000000-0000-0000-0000-000000000001')),
  1::bigint,
  'usage summary counts organization members'
);

select is(
  (select projects_used from public.get_organization_usage_summary('11000000-0000-0000-0000-000000000001')),
  1::bigint,
  'usage summary counts organization projects'
);

select is(
  (select contracts_used from public.get_organization_usage_summary('11000000-0000-0000-0000-000000000001')),
  1::bigint,
  'usage summary counts organization contracts'
);

select is(
  (select apf_countings_used from public.get_organization_usage_summary('11000000-0000-0000-0000-000000000001')),
  11::bigint,
  'usage summary reads the legacy APF counter without changing it'
);

select is(
  (select ai_calls_used from public.get_organization_usage_summary('11000000-0000-0000-0000-000000000001')),
  7::bigint,
  'usage summary reads the legacy AI counter without changing it'
);

select results_eq(
  $query$
    select pf_used_month::bigint, ai_calls_used::bigint
    from public.licenses
    where id = '71000000-0000-0000-0000-000000000001'
  $query$,
  $expected$ values (11::bigint, 7::bigint) $expected$,
  'entitlement reads preserve license usage counters'
);

select is(
  public.is_tenancy_enforced(),
  false,
  'entitlement domain does not change tenancy enforcement'
);

select ok(
  not has_function_privilege('anon', 'public.get_my_organization_entitlements(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.has_organization_entitlement(uuid,text)', 'execute')
  and not has_function_privilege('anon', 'public.get_organization_usage_summary(uuid)', 'execute'),
  'anon cannot execute tenant entitlement RPCs'
);

select ok(
  not has_table_privilege('authenticated', 'public.organization_subscriptions', 'insert')
  and not has_table_privilege('authenticated', 'public.organization_subscriptions', 'update')
  and not has_table_privilege('authenticated', 'public.organization_subscriptions', 'delete'),
  'authenticated cannot write organization subscriptions directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.organization_entitlement_overrides', 'insert')
  and not has_table_privilege('authenticated', 'public.organization_entitlement_overrides', 'update')
  and not has_table_privilege('authenticated', 'public.organization_entitlement_overrides', 'delete'),
  'authenticated cannot write organization overrides directly'
);

select ok(
  has_table_privilege('service_role', 'public.organization_subscriptions', 'select')
  and has_table_privilege('service_role', 'public.organization_subscriptions', 'insert')
  and has_table_privilege('service_role', 'public.organization_entitlement_overrides', 'update'),
  'service role has administrative access to subscription tables'
);

select ok(
  not has_function_privilege('authenticated', 'public.get_effective_organization_entitlements(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.assert_organization_entitlement(uuid,text)', 'execute'),
  'internal entitlement functions are not executable by authenticated'
);

select ok(
  has_function_privilege('authenticated', 'public.get_my_organization_entitlements(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.has_organization_entitlement(uuid,text)', 'execute')
  and has_function_privilege('authenticated', 'public.get_organization_usage_summary(uuid)', 'execute'),
  'authenticated can execute only the tenant-scoped entitlement RPCs'
);

select is(
  (
    select count(*)::integer
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'saas_plans',
        'saas_plan_entitlements',
        'organization_subscriptions',
        'organization_entitlement_overrides'
      )
      and relation.relrowsecurity
  ),
  4,
  'RLS is enabled on all entitlement domain tables'
);

select is(
  (
    select subscription.status
    from public.organization_subscriptions subscription
    where subscription.org_id = '11000000-0000-0000-0000-000000000001'
  ),
  'active',
  'the organization has one active subscription'
);

select is(
  (
    select plan.code
    from public.organization_subscriptions subscription
    join public.saas_plans plan on plan.id = subscription.plan_id
    where subscription.org_id = '11000000-0000-0000-0000-000000000002'
  ),
  'enterprise',
  'the enterprise organization resolves the enterprise plan'
);

select * from finish();
rollback;
