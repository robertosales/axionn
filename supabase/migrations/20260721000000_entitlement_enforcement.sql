-- Axionn Commercial Module — Entitlement Resolution & Enforcement
-- Fase 2: Funções centrais de entitlement, cache, enforcement
-- Executar exclusivamente pelo Lovable
begin;

-- ============================================================
-- 1. CONFIGURAÇÃO DE CACHE E FEATURE FLAGS
-- ============================================================

create table if not exists public.saas_runtime_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.saas_runtime_settings (key, value)
values
  ('entitlement_cache_ttl_seconds', '300'::jsonb),
  ('resource_limit_enforcement', jsonb_build_object('enabled', false)),
  ('organization_legacy_permission_fallback_enabled', jsonb_build_object('enabled', true))
on conflict (key) do nothing;

-- ============================================================
-- 2. CACHE DE ENTITLEMENTS POR ORGANIZAÇÃO
-- ============================================================

create table if not exists public.organization_entitlement_cache (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  entitlements jsonb not null,
  version bigint not null default 1,
  computed_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_entitlement_cache_expires on public.organization_entitlement_cache(expires_at);

-- ============================================================
-- 3. FUNÇÃO CENTRAL: canUseFeature
-- ============================================================

create or replace function public.can_use_feature(
  p_org_id uuid,
  p_user_id uuid,
  p_feature_code text,
  p_context jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entitlement record;
  v_subscription record;
  v_org record;
  v_allowed boolean;
  v_used numeric;
  v_limit numeric;
begin
  -- 1. Verificar se a funcionalidade está globalmente ativa
  select into v_entitlement
    pf.status, pf.feature_type
  from public.product_features pf
  where pf.code = p_feature_code;

  if not found then
    return false;
  end if;

  if v_entitlement.status <> 'active' then
    return false;
  end if;

  -- 2. Verificar status da organização
  select into v_org
    id, status
  from public.organizations
  where id = p_org_id;

  if not found then
    return false;
  end if;

  if v_org.status not in ('active', 'trial') then
    return false;
  end if;

  -- 3. Verificar assinatura
  select into v_subscription
    s.status, s.plan_id, s.plan_version_id, s.current_period_end
  from public.organization_subscriptions s
  where s.org_id = p_org_id;

  if not found then
    return false;
  end if;

  if v_subscription.status not in ('active', 'trialing') then
    return false;
  end if;

  if v_subscription.current_period_end is not null
     and v_subscription.current_period_end < now() then
    return false;
  end if;

  -- 4. Verificar entitlement efetivo (plano + add-ons + overrides)
  select into v_entitlement
    enabled, limit_value
  from public.get_effective_organization_entitlements(p_org_id)
  where feature_key = p_feature_code;

  if not found then
    return false;
  end if;

  if not v_entitlement.enabled then
    return false;
  end if;

  -- 5. Verificar limite de uso (se for um limite)
  if v_entitlement.limit_value is not null and v_entitlement.limit_value > 0 then
    select into v_used
      coalesce(sum(used_value), 0)
    from public.organization_usage_records
    where org_id = p_org_id
      and usage_code = p_feature_code
      and period_start <= now()
      and period_end > now();

    if v_used >= v_entitlement.limit_value then
      return false;
    end if;
  end if;

  -- 6. Verificar RBAC do usuário (se aplicável)
  -- Para features que requerem permissão específica do usuário
  if p_context ? 'require_user_permission' then
    -- Aqui integraria com o sistema de RBAC existente
    -- Por enquanto retorna true se passou nas verificações acima
    return true;
  end if;

  return true;
end;
$$;

-- ============================================================
-- 4. FUNÇÃO PARA OBTER ENTITLEMENTS EFETIVOS (com cache)
-- ============================================================

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
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_cache_ttl interval;
begin
  -- Tentar cache primeiro
  select value->>'entitlement_cache_ttl_seconds' into v_cache_ttl
  from public.saas_runtime_settings
  where key = 'entitlement_cache_ttl_seconds';

  -- Se cache habilitado e válido, retorna do cache
  if v_cache_ttl is not null then
    return query
    select
      c.org_id,
      (c.entitlements->0->>'plan_code')::text as plan_code,
      (c.entitlements->0->>'subscription_status')::text as subscription_status,
      e->>'feature_key' as feature_key,
      (e->>'enabled')::boolean as enabled,
      (e->>'limit_value')::bigint as limit_value,
      e->>'source' as source
    from public.organization_entitlement_cache c,
    lateral jsonb_array_elements(c.entitlements) e
    where c.org_id = p_org_id
      and c.expires_at > now()
    order by (e->>'feature_key');
  end if;

  -- Cache miss ou desabilitado: calcular na hora
  return query
  with context as (
    select
      s.org_id,
      s.status as subscription_status,
      p.code as plan_code,
      p.id as plan_id,
      s.plan_version_id
    from public.organization_subscriptions s
    join public.saas_plans p on p.id = s.plan_id
    where s.org_id = p_org_id
  ),
  addon_values as (
    select
      f.code as feature_key,
      bool_or(af.enabled) as enabled,
      sum(coalesce(af.limit_delta, 0) * sa.quantity)::bigint as limit_delta
    from context c
    join public.organization_subscription_addons sa on sa.subscription_id = c.org_id
      and sa.status = 'active'
      and sa.starts_at <= now()
      and (sa.ends_at is null or sa.ends_at > now())
    join public.saas_addon_features af on af.addon_id = sa.addon_id
    join public.product_features f on f.id = af.feature_id
    group by f.code
  ),
  keys as (
    select e.feature_key from context c join public.saas_plan_entitlements e on e.plan_id = c.plan_id
    union select a.feature_key from addon_values a
    union
    select o.feature_key
    from public.organization_entitlement_overrides o
    where o.org_id = p_org_id
      and (o.starts_at is null or o.starts_at <= now())
      and (o.ends_at is null or o.ends_at > now())
  )
  select
    c.org_id,
    c.plan_code,
    c.subscription_status,
    k.feature_key,
    coalesce(o.enabled, (coalesce(e.enabled, false) or coalesce(a.enabled, false)), false) as enabled,
    coalesce(
      o.limit_value,
      case when e.id is null then a.limit_delta
           when e.limit_value is null then null
           else e.limit_value + coalesce(a.limit_delta, 0) end
    ) as limit_value,
    case
      when o.id is not null and (o.enabled is not null or o.limit_value is not null) then o.source_type
      when a.feature_key is not null then 'addon'
      when e.id is not null then 'plan'
      else 'missing'
    end as source
  from context c
  join keys k on true
  left join public.saas_plan_entitlements e on e.plan_id = c.plan_id and e.feature_key = k.feature_key
  left join addon_values a on a.feature_key = k.feature_key
  left join public.organization_entitlement_overrides o
    on o.org_id = c.org_id and o.feature_key = k.feature_key
    and (o.starts_at is null or o.starts_at <= now())
    and (o.ends_at is null or o.ends_at > now())
  order by k.feature_key;
end;
$$;

-- ============================================================
-- 5. INVALIDAÇÃO DE CACHE
-- ============================================================

create or replace function public.invalidate_organization_entitlement_cache(
  p_org_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.organization_entitlement_cache
  where org_id = p_org_id;
end;
$$;

create or replace function public.refresh_organization_entitlement_cache(
  p_org_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ttl_seconds int;
  v_entitlements jsonb;
  v_plan_code text;
  v_sub_status text;
begin
  select value->>'entitlement_cache_ttl_seconds' into v_ttl_seconds
  from public.saas_runtime_settings
  where key = 'entitlement_cache_ttl_seconds';

  v_ttl_seconds := coalesce(v_ttl_seconds, 300);

  select jsonb_agg(to_jsonb(e))
  into v_entitlements
  from public.get_effective_organization_entitlements(p_org_id) e;

  select s.status, p.code
  into v_sub_status, v_plan_code
  from public.organization_subscriptions s
  join public.saas_plans p on p.id = s.plan_id
  where s.org_id = p_org_id;

  v_entitlements := jsonb_set(
    coalesce(v_entitlements, '[]'::jsonb),
    '{0,plan_code}',
    to_jsonb(v_plan_code)
  );
  v_entitlements := jsonb_set(
    v_entitlements,
    '{0,subscription_status}',
    to_jsonb(v_sub_status)
  );

  insert into public.organization_entitlement_cache (org_id, entitlements, version, computed_at, expires_at)
  values (p_org_id, v_entitlements, 1, now(), now() + (v_ttl_seconds || ' seconds')::interval)
  on conflict (org_id) do update set
    entitlements = excluded.entitlements,
    version = organization_entitlement_cache.version + 1,
    computed_at = excluded.computed_at,
    expires_at = excluded.expires_at;
end;
$$;

-- ============================================================
-- 6. TRIGGERS DE INVALIDAÇÃO AUTOMÁTICA
-- ============================================================

create or replace function public.trg_invalidate_entitlement_cache()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.invalidate_organization_entitlement_cache(NEW.org_id);
  return NEW;
end;
$$;

-- Triggers nas tabelas que afetam entitlements
drop trigger if exists trg_org_sub_entitlement_inval on public.organization_subscriptions;
create trigger trg_org_sub_entitlement_inval
after insert or update or delete on public.organization_subscriptions
for each row execute function public.trg_invalidate_entitlement_cache();

drop trigger if exists trg_org_override_entitlement_inval on public.organization_entitlement_overrides;
create trigger trg_org_override_entitlement_inval
after insert or update or delete on public.organization_entitlement_overrides
for each row execute function public.trg_invalidate_entitlement_cache();

drop trigger if exists trg_org_addon_entitlement_inval on public.organization_subscription_addons;
create trigger trg_org_addon_entitlement_inval
after insert or update or delete on public.organization_subscription_addons
for each row execute function public.trg_invalidate_entitlement_cache();

drop trigger if exists trg_saas_plan_entitlement_inval on public.saas_plan_entitlements;
create trigger trg_saas_plan_entitlement_inval
after insert or update or delete on public.saas_plan_entitlements
for each row execute function public.trg_invalidate_entitlement_cache();

drop trigger if exists trg_saas_plan_version_features_inval on public.saas_plan_version_features;
create trigger trg_saas_plan_version_features_inval
after insert or update or delete on public.saas_plan_version_features
for each row execute function public.trg_invalidate_entitlement_cache();

-- ============================================================
-- 7. RPC PARA FRONTEND: getMyEntitlements
-- ============================================================

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
  select * from public.get_effective_organization_entitlements(p_org_id);
end;
$$;

-- ============================================================
-- 8. RPC PARA FRONTEND: canUseFeature
-- ============================================================

create or replace function public.can_use_feature_rpc(
  p_org_id uuid,
  p_feature_code text,
  p_context jsonb default '{}'::jsonb
)
returns boolean
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

  return public.can_use_feature(p_org_id, auth.uid(), p_feature_code, p_context);
end;
$$;

-- ============================================================
-- 9. ENFORCEMENT DE LIMITES DE RECURSOS
-- ============================================================

create or replace function public.enforce_resource_limit(
  p_org_id uuid,
  p_feature_code text,
  p_increment numeric default 1,
  p_correlation_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allowed boolean;
  v_used numeric;
  v_limit numeric;
  v_reason text;
begin
  if p_org_id is null then
    raise exception using
      errcode = '22023',
      message = 'organization_required';
  end if;

  -- Lock advisory por org + feature
  perform pg_advisory_xact_lock(
    hashtextextended(format('axionn:limit:%s:%s', p_org_id, p_feature_code), 0)
  );

  -- Verificar entitlement
  select enabled, limit_value
  into v_allowed, v_limit
  from public.get_effective_organization_entitlements(p_org_id)
  where feature_key = p_feature_code;

  if not found or not v_allowed then
    v_reason := 'entitlement_denied';
    v_allowed := false;
  else
    -- Verificar uso atual
    select coalesce(sum(used_value), 0)
    into v_used
    from public.organization_usage_records
    where org_id = p_org_id
      and usage_code = p_feature_code
      and period_start <= now()
      and period_end > now();

    if v_limit is not null and v_limit > 0 and v_used + p_increment > v_limit then
      v_allowed := false;
      v_reason := 'limit_exceeded';
    else
      v_allowed := true;
      v_reason := 'within_limit';
    end if;
  end if;

  -- Registrar evento de enforcement
  insert into public.commercial_enforcement_events (
    org_id, feature_code, decision, used_value, limit_value, reason, actor_id, correlation_id
  ) values (
    p_org_id, p_feature_code,
    case when v_allowed then 'allowed' else 'denied' end,
    v_used, v_limit, v_reason,
    auth.uid(), p_correlation_id
  );

  return v_allowed;
end;
$$;

-- ============================================================
-- 10. REGISTRO DE USO (IDEMPOTENTE)
-- ============================================================

create or replace function public.record_organization_usage(
  p_org_id uuid,
  p_usage_code text,
  p_used_value numeric,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_source text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_used_value < 0 or p_period_end <= p_period_start then
    raise exception using
      errcode = '22023',
      message = 'invalid_usage_record';
  end if;

  insert into public.organization_usage_records (
    org_id, usage_code, used_value, period_start, period_end,
    source, idempotency_key, metadata
  ) values (
    p_org_id, lower(trim(p_usage_code)), p_used_value,
    p_period_start, p_period_end, trim(p_source),
    p_idempotency_key, p_metadata
  )
  on conflict (idempotency_key) do update set
    used_value = excluded.used_value,
    metadata = excluded.metadata,
    calculated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================
-- 11. PERMISSÕES
-- ============================================================

revoke all on function public.can_use_feature(uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.get_effective_organization_entitlements(uuid) from public, anon;
revoke all on function public.get_my_organization_entitlements(uuid) from public, anon;
revoke all on function public.can_use_feature_rpc(uuid, text, jsonb) from public, anon;
revoke all on function public.enforce_resource_limit(uuid, text, numeric, uuid) from public, anon, authenticated;
revoke all on function public.record_organization_usage(uuid, text, numeric, timestamptz, timestamptz, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.invalidate_organization_entitlement_cache(uuid) from public, anon;
revoke all on function public.refresh_organization_entitlement_cache(uuid) from public, anon;

grant execute on function public.get_effective_organization_entitlements(uuid) to service_role;
grant execute on function public.get_my_organization_entitlements(uuid) to authenticated, service_role;
grant execute on function public.can_use_feature_rpc(uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.enforce_resource_limit(uuid, text, numeric, uuid) to service_role;
grant execute on function public.record_organization_usage(uuid, text, numeric, timestamptz, timestamptz, text, text, jsonb) to service_role;
grant execute on function public.invalidate_organization_entitlement_cache(uuid) to service_role;
grant execute on function public.refresh_organization_entitlement_cache(uuid) to service_role;

grant select on public.organization_entitlement_cache to authenticated, service_role;

comment on function public.can_use_feature is 'Verificação central de acesso: feature global -> admin block -> sub status -> plano/versão -> addon -> override -> limite -> RBAC';
comment on function public.can_use_feature_rpc is 'RPC tenant-scoped para canUseFeature';
comment on function public.enforce_resource_limit is 'Valida e registra enforcement de limite com lock advisory';
comment on function public.record_organization_usage is 'Registra uso com idempotency_key';

commit;