\ir ../../operations/20260704_01_saas_entitlements_rollout.sql

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

select is(
  (select count(*)::integer from public.saas_plans where code in ('starter', 'pro', 'enterprise')),
  3,
  'Lovable rollout operation preserves the three canonical plans'
);

select is(
  (
    select count(*)::integer
    from public.saas_plan_entitlements entitlement
    join public.saas_plans plan on plan.id = entitlement.plan_id
    where plan.code in ('starter', 'pro', 'enterprise')
  ),
  24,
  'Lovable rollout operation preserves the entitlement seed catalog'
);

select ok(
  not has_table_privilege('authenticated', 'public.organization_subscriptions', 'insert')
  and not has_table_privilege('authenticated', 'public.organization_subscriptions', 'update')
  and not has_table_privilege('authenticated', 'public.organization_subscriptions', 'delete'),
  'Lovable rollout operation keeps subscription writes restricted'
);

select ok(
  has_function_privilege('authenticated', 'public.get_my_organization_entitlements(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.has_organization_entitlement(uuid,text)', 'execute')
  and has_function_privilege('authenticated', 'public.get_organization_usage_summary(uuid)', 'execute'),
  'Lovable rollout operation exposes tenant-scoped RPCs'
);

select ok(
  not has_function_privilege('anon', 'public.get_my_organization_entitlements(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.has_organization_entitlement(uuid,text)', 'execute')
  and not has_function_privilege('anon', 'public.get_organization_usage_summary(uuid)', 'execute'),
  'Lovable rollout operation does not expose tenant RPCs to anon'
);

select is(
  (select count(*)::integer from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'saas_plans',
        'saas_plan_entitlements',
        'organization_subscriptions',
        'organization_entitlement_overrides'
      )
      and relation.relrowsecurity),
  4,
  'Lovable rollout operation keeps RLS enabled on all domain tables'
);

select * from finish();
rollback;
