-- Axion SaaS — Fase 2A / Lote 4B
-- Execute depois de aplicar 20260704040000_organization_resource_limit_enforcement.sql.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:04_enable_organization_resource_limits')
);

do $$
declare
  v_missing text;
  v_over_limit bigint;
begin
  select string_agg(name, ', ' order by name)
  into v_missing
  from (
    values
      ('capacity guard', to_regprocedure('public.assert_organization_resource_capacity(uuid,text)') is not null),
      ('member trigger', exists (select 1 from pg_trigger where tgname = 'trg_zz_organization_member_resource_limit' and not tgisinternal)),
      ('project trigger', exists (select 1 from pg_trigger where tgname = 'trg_zz_project_resource_limit' and not tgisinternal)),
      ('contract trigger', exists (select 1 from pg_trigger where tgname = 'trg_zz_contract_resource_limit' and not tgisinternal))
  ) dependency(name, present)
  where not present;

  if v_missing is not null then
    raise exception 'Lote 4A incompleto: %', v_missing;
  end if;

  with organization_usage as (
    select
      organization.id,
      (select count(*) from public.organization_members member where member.org_id = organization.id and member.is_active)::bigint as users_used,
      (select count(*) from public.projects project where project.org_id = organization.id and project.status::text <> 'archived')::bigint as projects_used,
      (select count(*) from public.contracts contract where contract.org_id = organization.id)::bigint as contracts_used,
      max(entitlement.limit_value) filter (where entitlement.feature_key = 'users.max' and entitlement.enabled) as users_limit,
      max(entitlement.limit_value) filter (where entitlement.feature_key = 'projects.max' and entitlement.enabled) as projects_limit,
      max(entitlement.limit_value) filter (where entitlement.feature_key = 'contracts.max' and entitlement.enabled) as contracts_limit
    from public.organizations organization
    join public.organization_subscriptions subscription
      on subscription.org_id = organization.id
     and subscription.status in ('active', 'trialing')
    left join lateral public.get_effective_organization_entitlements(organization.id) entitlement on true
    where organization.status::text in ('active', 'trial')
    group by organization.id
  )
  select count(*) into v_over_limit
  from organization_usage usage
  where (usage.users_limit is not null and usage.users_used > usage.users_limit)
     or (usage.projects_limit is not null and usage.projects_used > usage.projects_limit)
     or (usage.contracts_limit is not null and usage.contracts_used > usage.contracts_limit);

  if v_over_limit > 0 then
    raise exception 'Existem % organizações acima do limite', v_over_limit;
  end if;

  perform public.set_organization_resource_limit_enforcement(true);
end;
$$;

commit;

select
  public.is_organization_resource_limit_enforced()
    as resource_limit_enforcement_enabled,
  public.is_organization_resource_limit_enforced()
    and to_regprocedure('public.assert_organization_resource_capacity(uuid,text)') is not null
    as organization_resource_limit_enforcement_ok;
