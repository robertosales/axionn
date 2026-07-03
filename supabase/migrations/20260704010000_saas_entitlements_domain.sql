-- Axion SaaS — Fase 2A / Lote 1
-- Domínio canônico de planos, assinaturas e entitlements por organização.
-- Esta migration é aditiva: preserva licenses, contadores, APF e tenancy enforcement.

create table if not exists public.saas_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saas_plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.saas_plans(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  limit_value bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, feature_key)
);

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.saas_plans(id) on delete restrict,
  status text not null
    check (status in ('trialing', 'active', 'past_due', 'suspended', 'canceled', 'expired')),
  starts_at timestamptz not null default now(),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  source text not null default 'manual'
    check (source in ('manual', 'legacy', 'contract', 'billing_provider')),
  external_customer_id text,
  external_subscription_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_entitlement_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  feature_key text not null,
  enabled boolean,
  limit_value bigint,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, feature_key)
);

create index if not exists idx_saas_plan_entitlements_plan
  on public.saas_plan_entitlements(plan_id);
create index if not exists idx_organization_subscriptions_plan
  on public.organization_subscriptions(plan_id);
create index if not exists idx_organization_subscriptions_status
  on public.organization_subscriptions(status);
create index if not exists idx_organization_entitlement_overrides_org
  on public.organization_entitlement_overrides(org_id);

create or replace function public.touch_saas_entitlements_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_saas_plans_updated_at on public.saas_plans;
create trigger trg_saas_plans_updated_at
before update on public.saas_plans
for each row execute function public.touch_saas_entitlements_updated_at();

drop trigger if exists trg_saas_plan_entitlements_updated_at on public.saas_plan_entitlements;
create trigger trg_saas_plan_entitlements_updated_at
before update on public.saas_plan_entitlements
for each row execute function public.touch_saas_entitlements_updated_at();

drop trigger if exists trg_organization_subscriptions_updated_at on public.organization_subscriptions;
create trigger trg_organization_subscriptions_updated_at
before update on public.organization_subscriptions
for each row execute function public.touch_saas_entitlements_updated_at();

drop trigger if exists trg_organization_entitlement_overrides_updated_at on public.organization_entitlement_overrides;
create trigger trg_organization_entitlement_overrides_updated_at
before update on public.organization_entitlement_overrides
for each row execute function public.touch_saas_entitlements_updated_at();

insert into public.saas_plans (code, name, description, status)
values
  ('starter', 'Starter', 'Plano inicial para operação controlada.', 'active'),
  ('pro', 'Pro', 'Plano para equipes em expansão.', 'active'),
  ('enterprise', 'Enterprise', 'Plano empresarial com limites ampliados.', 'active')
on conflict (code) do nothing;

with entitlement_seed(plan_code, feature_key, enabled, limit_value) as (
  values
    ('starter', 'users.max', true, 5::bigint),
    ('starter', 'projects.max', true, 3::bigint),
    ('starter', 'contracts.max', true, 3::bigint),
    ('starter', 'apf.countings.monthly', true, 20::bigint),
    ('starter', 'ai.calls.monthly', true, 50::bigint),
    ('starter', 'apf.ai_generation', false, null::bigint),
    ('starter', 'reports.advanced', false, null::bigint),
    ('starter', 'audit.access', false, null::bigint),

    ('pro', 'users.max', true, 25::bigint),
    ('pro', 'projects.max', true, 25::bigint),
    ('pro', 'contracts.max', true, 25::bigint),
    ('pro', 'apf.countings.monthly', true, 500::bigint),
    ('pro', 'ai.calls.monthly', true, 1000::bigint),
    ('pro', 'apf.ai_generation', true, null::bigint),
    ('pro', 'reports.advanced', true, null::bigint),
    ('pro', 'audit.access', false, null::bigint),

    ('enterprise', 'users.max', true, null::bigint),
    ('enterprise', 'projects.max', true, null::bigint),
    ('enterprise', 'contracts.max', true, null::bigint),
    ('enterprise', 'apf.countings.monthly', true, null::bigint),
    ('enterprise', 'ai.calls.monthly', true, null::bigint),
    ('enterprise', 'apf.ai_generation', true, null::bigint),
    ('enterprise', 'reports.advanced', true, null::bigint),
    ('enterprise', 'audit.access', true, null::bigint)
)
insert into public.saas_plan_entitlements (
  plan_id,
  feature_key,
  enabled,
  limit_value
)
select
  plan.id,
  seed.feature_key,
  seed.enabled,
  seed.limit_value
from entitlement_seed seed
join public.saas_plans plan on plan.code = seed.plan_code
on conflict (plan_id, feature_key) do nothing;

insert into public.organization_subscriptions (
  org_id,
  plan_id,
  status,
  starts_at,
  trial_ends_at,
  current_period_start,
  current_period_end,
  source,
  metadata
)
select
  organization.id,
  plan.id,
  case organization.status::text
    when 'trial' then 'trialing'
    when 'active' then 'active'
    when 'suspended' then 'suspended'
    when 'cancelled' then 'canceled'
    else 'suspended'
  end,
  coalesce(organization.created_at, now()),
  organization.trial_ends_at,
  coalesce(organization.created_at, now()),
  case
    when organization.status::text = 'trial' then organization.trial_ends_at
    else null
  end,
  'legacy',
  jsonb_build_object(
    'legacy_org_plan', organization.plan::text,
    'legacy_org_status', organization.status::text
  )
from public.organizations organization
join public.saas_plans plan
  on plan.code = case organization.plan::text
    when 'free' then 'starter'
    when 'pro' then 'pro'
    when 'enterprise' then 'enterprise'
    else 'starter'
  end
where not exists (
  select 1
  from public.organization_subscriptions subscription
  where subscription.org_id = organization.id
);

-- Preserva limites organizacionais já praticados como overrides explícitos.
insert into public.organization_entitlement_overrides (
  org_id,
  feature_key,
  limit_value,
  reason,
  metadata
)
select
  organization.id,
  legacy_limit.feature_key,
  legacy_limit.limit_value,
  legacy_limit.reason,
  jsonb_build_object('source_column', legacy_limit.source_column)
from public.organizations organization
cross join lateral (
  values
    ('users.max'::text, organization.max_users::bigint, 'Limite legado da organização.', 'organizations.max_users'::text),
    ('projects.max'::text, organization.max_projects::bigint, 'Limite legado da organização.', 'organizations.max_projects'::text),
    ('apf.countings.monthly'::text, organization.max_countings_per_month::bigint, 'Limite legado da organização.', 'organizations.max_countings_per_month'::text)
) legacy_limit(feature_key, limit_value, reason, source_column)
where legacy_limit.limit_value is not null
on conflict (org_id, feature_key) do nothing;

create or replace function public.get_effective_organization_entitlements(
  p_org_id uuid
)
returns table (
  org_id uuid,
  plan_code text,
  subscription_status text,
  feature_key text,
  enabled boolean,
  limit_value bigint,
  source text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with subscription_context as (
    select
      subscription.org_id,
      subscription.status as subscription_status,
      plan.id as plan_id,
      plan.code as plan_code
    from public.organization_subscriptions subscription
    join public.saas_plans plan on plan.id = subscription.plan_id
    where subscription.org_id = p_org_id
  ),
  feature_keys as (
    select entitlement.feature_key
    from subscription_context context
    join public.saas_plan_entitlements entitlement
      on entitlement.plan_id = context.plan_id
    union
    select override.feature_key
    from public.organization_entitlement_overrides override
    where override.org_id = p_org_id
  )
  select
    context.org_id,
    context.plan_code,
    context.subscription_status,
    feature.feature_key,
    coalesce(override.enabled, entitlement.enabled, false) as enabled,
    case
      when override.limit_value is not null then override.limit_value
      else entitlement.limit_value
    end as limit_value,
    case
      when override.id is not null
        and (override.enabled is not null or override.limit_value is not null)
        then 'organization_override'
      when entitlement.id is not null then 'plan'
      else 'missing'
    end as source
  from subscription_context context
  join feature_keys feature on true
  left join public.saas_plan_entitlements entitlement
    on entitlement.plan_id = context.plan_id
   and entitlement.feature_key = feature.feature_key
  left join public.organization_entitlement_overrides override
    on override.org_id = context.org_id
   and override.feature_key = feature.feature_key
  order by feature.feature_key;
$$;

create or replace function public.get_my_organization_entitlements(
  p_org_id uuid
)
returns table (
  org_id uuid,
  plan_code text,
  subscription_status text,
  feature_key text,
  enabled boolean,
  limit_value bigint,
  source text
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
      message = 'organization_entitlements_access_denied';
  end if;

  return query
  select *
  from public.get_effective_organization_entitlements(p_org_id);
end;
$$;

create or replace function public.has_organization_entitlement(
  p_org_id uuid,
  p_feature_key text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and public.is_organization_member(p_org_id, auth.uid())
    and exists (
      select 1
      from public.organizations organization
      join public.organization_subscriptions subscription
        on subscription.org_id = organization.id
      join public.get_effective_organization_entitlements(p_org_id) entitlement
        on entitlement.feature_key = p_feature_key
      where organization.id = p_org_id
        and organization.status::text in ('active', 'trial')
        and subscription.status in ('active', 'trialing')
        and entitlement.enabled
    );
$$;

create or replace function public.assert_organization_entitlement(
  p_org_id uuid,
  p_feature_key text
)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_allowed boolean;
begin
  select exists (
    select 1
    from public.organizations organization
    join public.organization_subscriptions subscription
      on subscription.org_id = organization.id
    join public.get_effective_organization_entitlements(p_org_id) entitlement
      on entitlement.feature_key = p_feature_key
    where organization.id = p_org_id
      and organization.status::text in ('active', 'trial')
      and subscription.status in ('active', 'trialing')
      and entitlement.enabled
  )
  into v_allowed;

  if not coalesce(v_allowed, false) then
    raise exception using
      errcode = 'P0001',
      message = 'organization_entitlement_denied',
      detail = format('org_id=%s feature_key=%s', p_org_id, p_feature_key);
  end if;
end;
$$;

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
    select
      subscription.org_id,
      subscription.status,
      plan.code
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
    (select count(*) from public.organization_members member where member.org_id = p_org_id)::bigint,
    limits.users_limit,
    (select count(*) from public.projects project where project.org_id = p_org_id)::bigint,
    limits.projects_limit,
    (select count(*) from public.contracts contract where contract.org_id = p_org_id)::bigint,
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

alter table public.saas_plans enable row level security;
alter table public.saas_plan_entitlements enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.organization_entitlement_overrides enable row level security;

drop policy if exists saas_plans_authenticated_select on public.saas_plans;
create policy saas_plans_authenticated_select
on public.saas_plans
for select to authenticated
using (true);

drop policy if exists saas_plan_entitlements_authenticated_select on public.saas_plan_entitlements;
create policy saas_plan_entitlements_authenticated_select
on public.saas_plan_entitlements
for select to authenticated
using (true);

revoke all on table public.saas_plans from public, anon, authenticated;
revoke all on table public.saas_plan_entitlements from public, anon, authenticated;
revoke all on table public.organization_subscriptions from public, anon, authenticated;
revoke all on table public.organization_entitlement_overrides from public, anon, authenticated;

grant select on table public.saas_plans to authenticated;
grant select on table public.saas_plan_entitlements to authenticated;
grant select, insert, update, delete on table public.saas_plans to service_role;
grant select, insert, update, delete on table public.saas_plan_entitlements to service_role;
grant select, insert, update, delete on table public.organization_subscriptions to service_role;
grant select, insert, update, delete on table public.organization_entitlement_overrides to service_role;

revoke all on function public.touch_saas_entitlements_updated_at() from public, anon, authenticated;
revoke all on function public.get_effective_organization_entitlements(uuid) from public, anon, authenticated;
revoke all on function public.get_my_organization_entitlements(uuid) from public, anon;
revoke all on function public.has_organization_entitlement(uuid, text) from public, anon;
revoke all on function public.assert_organization_entitlement(uuid, text) from public, anon, authenticated;
revoke all on function public.get_organization_usage_summary(uuid) from public, anon;

grant execute on function public.get_effective_organization_entitlements(uuid) to service_role;
grant execute on function public.get_my_organization_entitlements(uuid) to authenticated, service_role;
grant execute on function public.has_organization_entitlement(uuid, text) to authenticated, service_role;
grant execute on function public.assert_organization_entitlement(uuid, text) to service_role;
grant execute on function public.get_organization_usage_summary(uuid) to authenticated, service_role;

comment on table public.saas_plans is
  'Catálogo canônico de planos SaaS do Axion.';
comment on table public.saas_plan_entitlements is
  'Recursos e limites padrão de cada plano SaaS.';
comment on table public.organization_subscriptions is
  'Assinatura corrente da organização, independente das licenças legadas por empresa.';
comment on table public.organization_entitlement_overrides is
  'Overrides explícitos de recursos e limites por organização.';
comment on function public.get_effective_organization_entitlements(uuid) is
  'Resolve entitlements efetivos com precedência de override organizacional sobre plano.';
comment on function public.get_my_organization_entitlements(uuid) is
  'RPC tenant-scoped para leitura dos entitlements da organização autenticada.';
comment on function public.get_organization_usage_summary(uuid) is
  'RPC tenant-scoped de uso e limites, preservando os contadores legados em licenses.';
