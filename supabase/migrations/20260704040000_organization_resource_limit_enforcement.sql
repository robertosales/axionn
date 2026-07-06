-- Axion SaaS — Fase 2A / Lote 4
-- Enforcement transacional dos limites users.max, projects.max e contracts.max.
-- A migration instala os controles com a chave operacional desligada.

insert into public.saas_runtime_settings (key, value)
values ('resource_limit_enforcement', jsonb_build_object('enabled', false))
on conflict (key) do nothing;

create or replace function public.is_organization_resource_limit_enforced()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select lower(setting.value ->> 'enabled') = 'true'
      from public.saas_runtime_settings setting
      where setting.key = 'resource_limit_enforcement'
    ),
    false
  );
$$;

create or replace function public.set_organization_resource_limit_enforcement(
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.saas_runtime_settings (key, value, updated_at, updated_by)
  values (
    'resource_limit_enforcement',
    jsonb_build_object('enabled', p_enabled),
    now(),
    auth.uid()
  )
  on conflict (key) do update
  set value = excluded.value,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
end;
$$;

create or replace function public.assert_organization_resource_capacity(
  p_org_id uuid,
  p_feature_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_status text;
  v_subscription_status text;
  v_enabled boolean;
  v_limit bigint;
  v_used bigint;
begin
  if p_org_id is null then
    raise exception using
      errcode = '22023',
      message = 'organization_required';
  end if;

  if p_feature_key not in ('users.max', 'projects.max', 'contracts.max') then
    raise exception using
      errcode = '22023',
      message = 'organization_resource_limit_unsupported',
      detail = p_feature_key;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      format('axionn:resource-limit:%s:%s', p_org_id, p_feature_key),
      0
    )
  );

  select
    organization.status::text,
    entitlement.subscription_status,
    entitlement.enabled,
    entitlement.limit_value
  into
    v_org_status,
    v_subscription_status,
    v_enabled,
    v_limit
  from public.organizations organization
  left join public.get_effective_organization_entitlements(p_org_id) entitlement
    on entitlement.feature_key = p_feature_key
  where organization.id = p_org_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'organization_not_found';
  end if;

  if v_org_status not in ('active', 'trial')
     or v_subscription_status not in ('active', 'trialing')
     or not coalesce(v_enabled, false) then
    raise exception using
      errcode = 'P0001',
      message = 'organization_entitlement_denied',
      detail = format(
        'org_id=%s feature_key=%s org_status=%s subscription_status=%s',
        p_org_id,
        p_feature_key,
        coalesce(v_org_status, 'missing'),
        coalesce(v_subscription_status, 'missing')
      );
  end if;

  if v_limit is null then
    return;
  end if;

  case p_feature_key
    when 'users.max' then
      select count(*)::bigint
      into v_used
      from public.organization_members member
      where member.org_id = p_org_id
        and member.is_active;

    when 'projects.max' then
      select count(*)::bigint
      into v_used
      from public.projects project
      where project.org_id = p_org_id
        and project.status::text <> 'archived';

    when 'contracts.max' then
      select count(*)::bigint
      into v_used
      from public.contracts contract
      where contract.org_id = p_org_id;
  end case;

  if v_used >= v_limit then
    raise exception using
      errcode = 'P0001',
      message = 'organization_resource_limit_reached',
      detail = format(
        'org_id=%s feature_key=%s used=%s limit=%s',
        p_org_id,
        p_feature_key,
        v_used,
        v_limit
      );
  end if;
end;
$$;

create or replace function public.enforce_organization_member_resource_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_organization_resource_limit_enforced() then
    return new;
  end if;

  if new.is_active
     and (
       tg_op = 'INSERT'
       or not old.is_active
       or new.org_id is distinct from old.org_id
     ) then
    perform public.assert_organization_resource_capacity(new.org_id, 'users.max');
  end if;

  return new;
end;
$$;

create or replace function public.enforce_project_resource_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_counts boolean;
  v_old_counts boolean := false;
begin
  if not public.is_organization_resource_limit_enforced() then
    return new;
  end if;

  v_new_counts := coalesce(new.status::text, '') <> 'archived';
  if tg_op = 'UPDATE' then
    v_old_counts := coalesce(old.status::text, '') <> 'archived';
  end if;

  if v_new_counts
     and (
       tg_op = 'INSERT'
       or not v_old_counts
       or new.org_id is distinct from old.org_id
     ) then
    perform public.assert_organization_resource_capacity(new.org_id, 'projects.max');
  end if;

  return new;
end;
$$;

create or replace function public.enforce_contract_resource_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_organization_resource_limit_enforced() then
    return new;
  end if;

  if tg_op = 'INSERT'
     or new.org_id is distinct from old.org_id then
    perform public.assert_organization_resource_capacity(new.org_id, 'contracts.max');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_zz_organization_member_resource_limit
  on public.organization_members;
create trigger trg_zz_organization_member_resource_limit
before insert or update of org_id, is_active
on public.organization_members
for each row execute function public.enforce_organization_member_resource_limit();

drop trigger if exists trg_zz_project_resource_limit on public.projects;
create trigger trg_zz_project_resource_limit
before insert or update of org_id, status
on public.projects
for each row execute function public.enforce_project_resource_limit();

drop trigger if exists trg_zz_contract_resource_limit on public.contracts;
create trigger trg_zz_contract_resource_limit
before insert or update of org_id
on public.contracts
for each row execute function public.enforce_contract_resource_limit();

create or replace function public.get_organization_usage_summary(
  p_org_id uuid
)
returns table (
  organization_id uuid,
  plan_code text,
  subscription_status text,
  users_used bigint,
  users_limit bigint,
  projects_used bigint,
  projects_limit bigint,
  contracts_used bigint,
  contracts_limit bigint,
  apf_countings_used bigint,
  apf_countings_limit bigint,
  ai_calls_used bigint,
  ai_calls_limit bigint,
  quota_reset_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or not public.is_organization_member(p_org_id, auth.uid()) then
    raise exception using
      errcode = '42501',
      message = 'organization_usage_access_denied';
  end if;

  return query
  with subscription_context as (
    select subscription.org_id, subscription.status, plan.code
    from public.organization_subscriptions subscription
    join public.saas_plans plan on plan.id = subscription.plan_id
    where subscription.org_id = p_org_id
  ),
  limits as (
    select
      max(entitlement.limit_value) filter (where entitlement.feature_key = 'users.max') as users_limit,
      max(entitlement.limit_value) filter (where entitlement.feature_key = 'projects.max') as projects_limit,
      max(entitlement.limit_value) filter (where entitlement.feature_key = 'contracts.max') as contracts_limit,
      max(entitlement.limit_value) filter (where entitlement.feature_key = 'apf.countings.monthly') as apf_countings_limit,
      max(entitlement.limit_value) filter (where entitlement.feature_key = 'ai.calls.monthly') as ai_calls_limit
    from public.get_effective_organization_entitlements(p_org_id) entitlement
  ),
  legacy_usage as (
    select
      coalesce(sum(license.pf_used_month), 0)::bigint as apf_countings_used,
      coalesce(sum(license.ai_calls_used), 0)::bigint as ai_calls_used,
      case
        when count(*) = 0 then null
        when count(distinct license.quota_reset_at) = 1
          then min(license.quota_reset_at)::timestamptz
        else null
      end as quota_reset_at
    from public.licenses license
    join public.companies company on company.id = license.company_id
    where company.org_id = p_org_id
  )
  select
    context.org_id,
    context.code,
    context.status,
    (
      select count(*)
      from public.organization_members member
      where member.org_id = p_org_id
        and member.is_active
    )::bigint,
    limits.users_limit,
    (
      select count(*)
      from public.projects project
      where project.org_id = p_org_id
        and project.status::text <> 'archived'
    )::bigint,
    limits.projects_limit,
    (
      select count(*)
      from public.contracts contract
      where contract.org_id = p_org_id
    )::bigint,
    limits.contracts_limit,
    usage.apf_countings_used,
    limits.apf_countings_limit,
    usage.ai_calls_used,
    limits.ai_calls_limit,
    usage.quota_reset_at
  from subscription_context context
  cross join limits
  cross join legacy_usage usage;
end;
$$;

revoke all on function public.is_organization_resource_limit_enforced()
  from public, anon, authenticated;
revoke all on function public.set_organization_resource_limit_enforcement(boolean)
  from public, anon, authenticated;
revoke all on function public.assert_organization_resource_capacity(uuid, text)
  from public, anon, authenticated;
revoke all on function public.enforce_organization_member_resource_limit()
  from public, anon, authenticated;
revoke all on function public.enforce_project_resource_limit()
  from public, anon, authenticated;
revoke all on function public.enforce_contract_resource_limit()
  from public, anon, authenticated;

grant execute on function public.is_organization_resource_limit_enforced()
  to service_role;
grant execute on function public.set_organization_resource_limit_enforcement(boolean)
  to service_role;
grant execute on function public.assert_organization_resource_capacity(uuid, text)
  to service_role;

comment on function public.assert_organization_resource_capacity(uuid, text) is
  'Valida capacidade transacional da organização com lock por tenant e recurso.';
comment on function public.is_organization_resource_limit_enforced() is
  'Indica se os limites organizacionais estão sendo aplicados nos inserts e reativações.';
