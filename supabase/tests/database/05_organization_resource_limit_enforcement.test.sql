\ir ../../migrations/20260704040000_organization_resource_limit_enforcement.sql

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
)
values
  ('22300000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'limit-one@test.local', '', now(), now(), now()),
  ('22300000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'limit-two@test.local', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, status, plan)
values (
  '12300000-0000-0000-0000-000000000001',
  'Resource Limit Tenant',
  'resource-limit-tenant',
  'active',
  'pro'
)
on conflict (id) do nothing;

insert into public.organization_subscriptions (
  org_id, plan_id, status, source
)
select
  '12300000-0000-0000-0000-000000000001'::uuid,
  plan.id,
  'active',
  'manual'
from public.saas_plans plan
where plan.code = 'pro'
on conflict (org_id) do update
set plan_id = excluded.plan_id,
    status = excluded.status;

insert into public.organization_entitlement_overrides (
  org_id, feature_key, enabled, limit_value, reason
)
values
  ('12300000-0000-0000-0000-000000000001', 'users.max', true, 1, 'pgTAP fixture'),
  ('12300000-0000-0000-0000-000000000001', 'projects.max', true, 1, 'pgTAP fixture'),
  ('12300000-0000-0000-0000-000000000001', 'contracts.max', true, 1, 'pgTAP fixture')
on conflict (org_id, feature_key) do update
set enabled = excluded.enabled,
    limit_value = excluded.limit_value,
    reason = excluded.reason;

select public.set_organization_resource_limit_enforcement(true);

select is(
  public.is_organization_resource_limit_enforced(),
  true,
  'resource limit enforcement can be enabled'
);

select lives_ok(
  $sql$
    insert into public.organization_members (org_id, user_id, role, is_active)
    values (
      '12300000-0000-0000-0000-000000000001',
      '22300000-0000-0000-0000-000000000001',
      'owner',
      true
    )
  $sql$,
  'first active member fits users.max'
);

select throws_ok(
  $sql$
    insert into public.organization_members (org_id, user_id, role, is_active)
    values (
      '12300000-0000-0000-0000-000000000001',
      '22300000-0000-0000-0000-000000000002',
      'member',
      true
    )
  $sql$,
  'P0001',
  'organization_resource_limit_reached',
  'second active member is blocked by users.max'
);

select lives_ok(
  $sql$
    insert into public.contracts (id, name, status, org_id)
    values (
      '32300000-0000-0000-0000-000000000001',
      'Limit Contract One',
      'active',
      '12300000-0000-0000-0000-000000000001'
    )
  $sql$,
  'first contract fits contracts.max'
);

select throws_ok(
  $sql$
    insert into public.contracts (id, name, status, org_id)
    values (
      '32300000-0000-0000-0000-000000000002',
      'Limit Contract Two',
      'active',
      '12300000-0000-0000-0000-000000000001'
    )
  $sql$,
  'P0001',
  'organization_resource_limit_reached',
  'second contract is blocked by contracts.max'
);

select lives_ok(
  $sql$
    insert into public.projects (
      id, contract_id, name, status, org_id
    )
    values (
      '42300000-0000-0000-0000-000000000001',
      '32300000-0000-0000-0000-000000000001',
      'Limit Project One',
      'active',
      '12300000-0000-0000-0000-000000000001'
    )
  $sql$,
  'first non-archived project fits projects.max'
);

select throws_ok(
  $sql$
    insert into public.projects (
      id, contract_id, name, status, org_id
    )
    values (
      '42300000-0000-0000-0000-000000000002',
      '32300000-0000-0000-0000-000000000001',
      'Limit Project Two',
      'active',
      '12300000-0000-0000-0000-000000000001'
    )
  $sql$,
  'P0001',
  'organization_resource_limit_reached',
  'second non-archived project is blocked by projects.max'
);

select lives_ok(
  $sql$
    insert into public.projects (
      id, contract_id, name, status, org_id
    )
    values (
      '42300000-0000-0000-0000-000000000003',
      '32300000-0000-0000-0000-000000000001',
      'Archived Project',
      'archived',
      '12300000-0000-0000-0000-000000000001'
    )
  $sql$,
  'archived project does not consume projects.max'
);

select public.set_organization_resource_limit_enforcement(false);

select lives_ok(
  $sql$
    insert into public.contracts (id, name, status, org_id)
    values (
      '32300000-0000-0000-0000-000000000003',
      'Contract With Enforcement Off',
      'active',
      '12300000-0000-0000-0000-000000000001'
    )
  $sql$,
  'rollback switch disables resource limit blocking'
);

select is(
  public.is_organization_resource_limit_enforced(),
  false,
  'resource limit enforcement can be disabled'
);

select * from finish();
rollback;
