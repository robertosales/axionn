-- Axion SaaS - administracao global de planos, assinaturas e overrides.
-- Mutations e leituras operacionais exigem platform_admin.

create or replace function public.platform_plan_org_plan_code(p_plan_code text)
returns public.org_plan
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_plan_code
    when 'starter' then 'free'::public.org_plan
    when 'pro' then 'pro'::public.org_plan
    when 'enterprise' then 'enterprise'::public.org_plan
    else 'free'::public.org_plan
  end;
$$;

create or replace function public.platform_plan_org_status_code(p_subscription_status text)
returns public.org_status
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_subscription_status
    when 'trialing' then 'trial'::public.org_status
    when 'active' then 'active'::public.org_status
    when 'past_due' then 'active'::public.org_status
    when 'suspended' then 'suspended'::public.org_status
    when 'canceled' then 'cancelled'::public.org_status
    when 'expired' then 'cancelled'::public.org_status
    else 'suspended'::public.org_status
  end;
$$;

create or replace function public.list_platform_saas_plans_v1(
  p_include_archived boolean
)
returns table (
  id uuid,
  code text,
  name text,
  description text,
  status text,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  entitlements jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_platform_admin_v2();

  return query
  select
    plan.id,
    plan.code,
    plan.name,
    plan.description,
    plan.status,
    plan.metadata,
    plan.created_at,
    plan.updated_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', entitlement.id,
          'feature_key', entitlement.feature_key,
          'enabled', entitlement.enabled,
          'limit_value', entitlement.limit_value,
          'metadata', entitlement.metadata,
          'created_at', entitlement.created_at,
          'updated_at', entitlement.updated_at
        )
        order by entitlement.feature_key
      ) filter (where entitlement.id is not null),
      '[]'::jsonb
    ) as entitlements
  from public.saas_plans plan
  left join public.saas_plan_entitlements entitlement
    on entitlement.plan_id = plan.id
  where p_include_archived or plan.status <> 'archived'
  group by plan.id
  order by
    case plan.code
      when 'starter' then 1
      when 'pro' then 2
      when 'enterprise' then 3
      else 10
    end,
    plan.name;
end;
$$;

create or replace function public.create_platform_saas_plan_v1(
  p_code text,
  p_name text,
  p_description text,
  p_status text,
  p_metadata jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan_id uuid;
  v_actor uuid := auth.uid();
  v_code text := lower(trim(p_code));
  v_status text := coalesce(nullif(trim(p_status), ''), 'active');
begin
  perform public.assert_platform_admin_v2();

  if v_code !~ '^[a-z0-9][a-z0-9_-]{1,62}$' then
    raise exception using errcode = '22023', message = 'invalid_plan_code';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception using errcode = '22023', message = 'plan_name_required';
  end if;

  if v_status not in ('active', 'inactive', 'archived') then
    raise exception using errcode = '22023', message = 'invalid_plan_status';
  end if;

  insert into public.saas_plans (code, name, description, status, metadata)
  values (
    v_code,
    trim(p_name),
    nullif(trim(p_description), ''),
    v_status,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_plan_id;

  insert into public.platform_operational_audit_log (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values (
    v_actor,
    'saas_plan_created',
    'saas_plan',
    v_plan_id,
    jsonb_build_object('code', v_code, 'status', v_status)
  );

  return v_plan_id;
end;
$$;

create or replace function public.update_platform_saas_plan_v1(
  p_plan_id uuid,
  p_name text,
  p_description text,
  p_status text,
  p_metadata jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_status text := coalesce(nullif(trim(p_status), ''), 'active');
  v_code text;
begin
  perform public.assert_platform_admin_v2();

  if nullif(trim(p_name), '') is null then
    raise exception using errcode = '22023', message = 'plan_name_required';
  end if;

  if v_status not in ('active', 'inactive', 'archived') then
    raise exception using errcode = '22023', message = 'invalid_plan_status';
  end if;

  update public.saas_plans
  set
    name = trim(p_name),
    description = nullif(trim(p_description), ''),
    status = v_status,
    metadata = coalesce(p_metadata, '{}'::jsonb)
  where id = p_plan_id
  returning code into v_code;

  if v_code is null then
    raise exception using errcode = 'P0002', message = 'plan_not_found';
  end if;

  insert into public.platform_operational_audit_log (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values (
    v_actor,
    'saas_plan_updated',
    'saas_plan',
    p_plan_id,
    jsonb_build_object('code', v_code, 'status', v_status)
  );
end;
$$;

create or replace function public.archive_platform_saas_plan_v1(
  p_plan_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_code text;
begin
  perform public.assert_platform_admin_v2();

  update public.saas_plans
  set status = 'archived'
  where id = p_plan_id
  returning code into v_code;

  if v_code is null then
    raise exception using errcode = 'P0002', message = 'plan_not_found';
  end if;

  insert into public.platform_operational_audit_log (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values (
    v_actor,
    'saas_plan_archived',
    'saas_plan',
    p_plan_id,
    jsonb_build_object('code', v_code)
  );
end;
$$;

create or replace function public.upsert_platform_plan_entitlement_v1(
  p_plan_id uuid,
  p_feature_key text,
  p_enabled boolean,
  p_limit_value bigint,
  p_metadata jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_entitlement_id uuid;
  v_actor uuid := auth.uid();
  v_feature_key text := lower(trim(p_feature_key));
begin
  perform public.assert_platform_admin_v2();

  if not exists (select 1 from public.saas_plans where id = p_plan_id) then
    raise exception using errcode = 'P0002', message = 'plan_not_found';
  end if;

  if v_feature_key !~ '^[a-z0-9][a-z0-9_.-]{1,96}$' then
    raise exception using errcode = '22023', message = 'invalid_feature_key';
  end if;

  if p_limit_value is not null and p_limit_value < 0 then
    raise exception using errcode = '22023', message = 'invalid_limit_value';
  end if;

  insert into public.saas_plan_entitlements (
    plan_id,
    feature_key,
    enabled,
    limit_value,
    metadata
  )
  values (
    p_plan_id,
    v_feature_key,
    coalesce(p_enabled, true),
    p_limit_value,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (plan_id, feature_key) do update
  set
    enabled = excluded.enabled,
    limit_value = excluded.limit_value,
    metadata = excluded.metadata
  returning id into v_entitlement_id;

  insert into public.platform_operational_audit_log (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values (
    v_actor,
    'saas_plan_entitlement_upserted',
    'saas_plan_entitlement',
    v_entitlement_id,
    jsonb_build_object(
      'plan_id', p_plan_id,
      'feature_key', v_feature_key,
      'enabled', coalesce(p_enabled, true),
      'limit_value', p_limit_value
    )
  );

  return v_entitlement_id;
end;
$$;

create or replace function public.delete_platform_plan_entitlement_v1(
  p_plan_id uuid,
  p_feature_key text
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_entitlement_id uuid;
  v_feature_key text := lower(trim(p_feature_key));
begin
  perform public.assert_platform_admin_v2();

  delete from public.saas_plan_entitlements
  where plan_id = p_plan_id
    and feature_key = v_feature_key
  returning id into v_entitlement_id;

  if v_entitlement_id is null then
    raise exception using errcode = 'P0002', message = 'plan_entitlement_not_found';
  end if;

  insert into public.platform_operational_audit_log (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values (
    v_actor,
    'saas_plan_entitlement_deleted',
    'saas_plan_entitlement',
    v_entitlement_id,
    jsonb_build_object('plan_id', p_plan_id, 'feature_key', v_feature_key)
  );
end;
$$;

create or replace function public.list_platform_organization_subscriptions_v1()
returns table (
  org_id uuid,
  org_name text,
  org_slug text,
  org_status text,
  org_plan text,
  subscription_id uuid,
  plan_id uuid,
  plan_code text,
  plan_name text,
  subscription_status text,
  starts_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  source text,
  users_used bigint,
  projects_used bigint,
  contracts_used bigint,
  overrides jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_platform_admin_v2();

  return query
  select
    organization.id,
    organization.name,
    organization.slug,
    organization.status::text,
    organization.plan::text,
    subscription.id,
    plan.id,
    plan.code,
    plan.name,
    subscription.status,
    subscription.starts_at,
    subscription.trial_ends_at,
    subscription.current_period_start,
    subscription.current_period_end,
    subscription.canceled_at,
    subscription.source,
    (select count(*) from public.organization_members member where member.org_id = organization.id)::bigint,
    (select count(*) from public.projects project where project.org_id = organization.id)::bigint,
    (select count(*) from public.contracts contract where contract.org_id = organization.id)::bigint,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', override.id,
            'feature_key', override.feature_key,
            'enabled', override.enabled,
            'limit_value', override.limit_value,
            'reason', override.reason,
            'created_at', override.created_at,
            'updated_at', override.updated_at
          )
          order by override.feature_key
        )
        from public.organization_entitlement_overrides override
        where override.org_id = organization.id
      ),
      '[]'::jsonb
    ) as overrides
  from public.organizations organization
  left join public.organization_subscriptions subscription
    on subscription.org_id = organization.id
  left join public.saas_plans plan
    on plan.id = subscription.plan_id
  order by organization.name;
end;
$$;

create or replace function public.set_platform_organization_subscription_v1(
  p_org_id uuid,
  p_plan_id uuid,
  p_status text,
  p_trial_ends_at timestamptz,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_source text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription_id uuid;
  v_actor uuid := auth.uid();
  v_plan_code text;
  v_status text := coalesce(nullif(trim(p_status), ''), 'active');
  v_source text := coalesce(nullif(trim(p_source), ''), 'manual');
begin
  perform public.assert_platform_admin_v2();

  if v_status not in ('trialing', 'active', 'past_due', 'suspended', 'canceled', 'expired') then
    raise exception using errcode = '22023', message = 'invalid_subscription_status';
  end if;

  if v_source not in ('manual', 'legacy', 'contract', 'billing_provider') then
    raise exception using errcode = '22023', message = 'invalid_subscription_source';
  end if;

  select code into v_plan_code
  from public.saas_plans
  where id = p_plan_id
    and status <> 'archived';

  if v_plan_code is null then
    raise exception using errcode = 'P0002', message = 'plan_not_found';
  end if;

  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception using errcode = 'P0002', message = 'organization_not_found';
  end if;

  insert into public.organization_subscriptions (
    org_id,
    plan_id,
    status,
    starts_at,
    trial_ends_at,
    current_period_start,
    current_period_end,
    canceled_at,
    source,
    metadata
  )
  values (
    p_org_id,
    p_plan_id,
    v_status,
    now(),
    p_trial_ends_at,
    p_current_period_start,
    p_current_period_end,
    case when v_status = 'canceled' then now() else null end,
    v_source,
    jsonb_build_object('updated_by', v_actor)
  )
  on conflict (org_id) do update
  set
    plan_id = excluded.plan_id,
    status = excluded.status,
    trial_ends_at = excluded.trial_ends_at,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    canceled_at = excluded.canceled_at,
    source = excluded.source,
    metadata = organization_subscriptions.metadata || excluded.metadata
  returning id into v_subscription_id;

  update public.organizations
  set
    plan = public.platform_plan_org_plan_code(v_plan_code),
    status = public.platform_plan_org_status_code(v_status)
  where id = p_org_id;

  insert into public.platform_operational_audit_log (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values (
    v_actor,
    'organization_subscription_updated',
    'organization_subscription',
    v_subscription_id,
    jsonb_build_object(
      'org_id', p_org_id,
      'plan_id', p_plan_id,
      'plan_code', v_plan_code,
      'status', v_status,
      'source', v_source
    )
  );

  return v_subscription_id;
end;
$$;

create or replace function public.upsert_platform_organization_entitlement_override_v1(
  p_org_id uuid,
  p_feature_key text,
  p_enabled boolean,
  p_limit_value bigint,
  p_reason text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_override_id uuid;
  v_actor uuid := auth.uid();
  v_feature_key text := lower(trim(p_feature_key));
begin
  perform public.assert_platform_admin_v2();

  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception using errcode = 'P0002', message = 'organization_not_found';
  end if;

  if v_feature_key !~ '^[a-z0-9][a-z0-9_.-]{1,96}$' then
    raise exception using errcode = '22023', message = 'invalid_feature_key';
  end if;

  if p_limit_value is not null and p_limit_value < 0 then
    raise exception using errcode = '22023', message = 'invalid_limit_value';
  end if;

  insert into public.organization_entitlement_overrides (
    org_id,
    feature_key,
    enabled,
    limit_value,
    reason,
    created_by,
    metadata
  )
  values (
    p_org_id,
    v_feature_key,
    p_enabled,
    p_limit_value,
    nullif(trim(p_reason), ''),
    v_actor,
    jsonb_build_object('updated_by', v_actor)
  )
  on conflict (org_id, feature_key) do update
  set
    enabled = excluded.enabled,
    limit_value = excluded.limit_value,
    reason = excluded.reason,
    metadata = organization_entitlement_overrides.metadata || excluded.metadata
  returning id into v_override_id;

  insert into public.platform_operational_audit_log (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values (
    v_actor,
    'organization_entitlement_override_upserted',
    'organization_entitlement_override',
    v_override_id,
    jsonb_build_object(
      'org_id', p_org_id,
      'feature_key', v_feature_key,
      'enabled', p_enabled,
      'limit_value', p_limit_value
    )
  );

  return v_override_id;
end;
$$;

create or replace function public.delete_platform_organization_entitlement_override_v1(
  p_org_id uuid,
  p_feature_key text
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_override_id uuid;
  v_feature_key text := lower(trim(p_feature_key));
begin
  perform public.assert_platform_admin_v2();

  delete from public.organization_entitlement_overrides
  where org_id = p_org_id
    and feature_key = v_feature_key
  returning id into v_override_id;

  if v_override_id is null then
    raise exception using errcode = 'P0002', message = 'organization_entitlement_override_not_found';
  end if;

  insert into public.platform_operational_audit_log (
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values (
    v_actor,
    'organization_entitlement_override_deleted',
    'organization_entitlement_override',
    v_override_id,
    jsonb_build_object('org_id', p_org_id, 'feature_key', v_feature_key)
  );
end;
$$;

revoke all on function public.platform_plan_org_plan_code(text) from public, anon, authenticated;
revoke all on function public.platform_plan_org_status_code(text) from public, anon, authenticated;
revoke all on function public.list_platform_saas_plans_v1(boolean) from public, anon;
revoke all on function public.create_platform_saas_plan_v1(text, text, text, text, jsonb) from public, anon;
revoke all on function public.update_platform_saas_plan_v1(uuid, text, text, text, jsonb) from public, anon;
revoke all on function public.archive_platform_saas_plan_v1(uuid) from public, anon;
revoke all on function public.upsert_platform_plan_entitlement_v1(uuid, text, boolean, bigint, jsonb) from public, anon;
revoke all on function public.delete_platform_plan_entitlement_v1(uuid, text) from public, anon;
revoke all on function public.list_platform_organization_subscriptions_v1() from public, anon;
revoke all on function public.set_platform_organization_subscription_v1(uuid, uuid, text, timestamptz, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.upsert_platform_organization_entitlement_override_v1(uuid, text, boolean, bigint, text) from public, anon;
revoke all on function public.delete_platform_organization_entitlement_override_v1(uuid, text) from public, anon;

grant execute on function public.list_platform_saas_plans_v1(boolean) to authenticated, service_role;
grant execute on function public.create_platform_saas_plan_v1(text, text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.update_platform_saas_plan_v1(uuid, text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.archive_platform_saas_plan_v1(uuid) to authenticated, service_role;
grant execute on function public.upsert_platform_plan_entitlement_v1(uuid, text, boolean, bigint, jsonb) to authenticated, service_role;
grant execute on function public.delete_platform_plan_entitlement_v1(uuid, text) to authenticated, service_role;
grant execute on function public.list_platform_organization_subscriptions_v1() to authenticated, service_role;
grant execute on function public.set_platform_organization_subscription_v1(uuid, uuid, text, timestamptz, timestamptz, timestamptz, text) to authenticated, service_role;
grant execute on function public.upsert_platform_organization_entitlement_override_v1(uuid, text, boolean, bigint, text) to authenticated, service_role;
grant execute on function public.delete_platform_organization_entitlement_override_v1(uuid, text) to authenticated, service_role;

comment on function public.list_platform_saas_plans_v1(boolean) is
  'Lista planos SaaS e entitlements. Exige platform_admin.';
comment on function public.list_platform_organization_subscriptions_v1() is
  'Lista assinaturas organizacionais, uso resumido e overrides. Exige platform_admin.';
