-- Fix: tornar o trigger tolerante a tabelas sem NEW.org_id ------------------
create or replace function public.trg_invalidate_entitlement_cache()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_org_id uuid;
begin
  begin
    v_org_id := (case when tg_op = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end)->>'org_id';
  exception when others then
    v_org_id := null;
  end;

  if v_org_id is not null then
    perform public.invalidate_organization_entitlement_cache(v_org_id::uuid);
  else
    -- Tabela de plano/plan_version: expira todo o cache; ele é recomputado on-demand.
    delete from public.organization_entitlement_cache;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

-- ============================================================================
-- PR 1 (reaplicando)
-- ============================================================================

-- 1. Novas features no catálogo comercial (idempotente)
with okr_features(module_code, code, name, feature_type, usage_unit) as (
  values
    ('okr', 'okr.alignments',         'Alinhamento de objetivos',    'capability', null),
    ('okr', 'okr.cycle_management',   'Gestão formal de ciclos OKR', 'capability', null),
    ('okr', 'okr.executive_dashboard','Dashboard executivo de OKR',  'capability', null),
    ('okr', 'okr.advanced_alerts',    'Alertas avançados de OKR',    'capability', null)
)
insert into public.product_features (module_id, code, name, feature_type, usage_unit)
select m.id, f.code, f.name, f.feature_type, f.usage_unit
from okr_features f
join public.product_modules m on m.code = f.module_code
where m.status = 'active'
on conflict (code) do update set
  module_id = excluded.module_id,
  name = excluded.name,
  updated_at = now();

-- 2. Mapear features novas nas versões de plano (catálogo novo)
with plan_versions as (
  select pv.id as plan_version_id, p.code as plan_code
  from public.saas_plan_versions pv
  join public.saas_plans p on p.id = pv.plan_id
  where pv.version = 1 and pv.status = 'active'
),
okr_feature_map(plan_code, feature_code, access_level, enabled, limit_value, configuration) as (
  values
    ('starter', 'okr.alignments',         'basic', true,  1,    '{"depth_max": 1}'::jsonb),
    ('starter', 'okr.cycle_management',   'basic', true,  1,    '{"concurrent_cycles": 1}'::jsonb),
    ('starter', 'okr.executive_dashboard','none',  false, null, '{}'::jsonb),
    ('starter', 'okr.advanced_alerts',    'none',  false, null, '{}'::jsonb),
    ('pro', 'okr.alignments',         'full', true,  null, '{"depth_max": null}'::jsonb),
    ('pro', 'okr.cycle_management',   'full', true,  3,    '{"concurrent_cycles": 3}'::jsonb),
    ('pro', 'okr.executive_dashboard','full', true,  null, '{}'::jsonb),
    ('pro', 'okr.advanced_alerts',    'full', true,  null, '{}'::jsonb),
    ('enterprise', 'okr.alignments',         'full', true, null, '{"depth_max": null}'::jsonb),
    ('enterprise', 'okr.cycle_management',   'full', true, null, '{"concurrent_cycles": null}'::jsonb),
    ('enterprise', 'okr.executive_dashboard','full', true, null, '{}'::jsonb),
    ('enterprise', 'okr.advanced_alerts',    'full', true, null, '{}'::jsonb)
)
insert into public.saas_plan_version_features (plan_version_id, feature_id, access_level, enabled, limit_value, configuration)
select pv.plan_version_id, pf.id, fm.access_level, fm.enabled, fm.limit_value, fm.configuration
from okr_feature_map fm
join plan_versions pv on pv.plan_code = fm.plan_code
join public.product_features pf on pf.code = fm.feature_code
on conflict (plan_version_id, feature_id) do update set
  access_level = excluded.access_level,
  enabled = excluded.enabled,
  limit_value = excluded.limit_value,
  configuration = excluded.configuration,
  updated_at = now();

-- 3. Espelhar no catálogo LEGADO (saas_plan_entitlements)
with legacy_seed(plan_code, feature_key, enabled, limit_value) as (
  values
    ('starter', 'okr.view',                 true,  null::bigint),
    ('starter', 'okr.create',               true,  null),
    ('starter', 'okr.edit',                 true,  null),
    ('starter', 'okr.archive',              true,  null),
    ('starter', 'okr.check_in',             true,  null),
    ('starter', 'okr.initiatives',          true,  3),
    ('starter', 'okr.automatic_metrics',    false, null),
    ('starter', 'okr.history',              true,  90),
    ('starter', 'okr.export',               false, null),
    ('starter', 'okr.ai_recommendations',   false, null),
    ('starter', 'okr.alignments',           true,  1),
    ('starter', 'okr.cycle_management',     true,  1),
    ('starter', 'okr.executive_dashboard',  false, null),
    ('starter', 'okr.advanced_alerts',      false, null),

    ('pro', 'okr.view',                     true,  null),
    ('pro', 'okr.create',                   true,  null),
    ('pro', 'okr.edit',                     true,  null),
    ('pro', 'okr.archive',                  true,  null),
    ('pro', 'okr.check_in',                 true,  null),
    ('pro', 'okr.initiatives',              true,  null),
    ('pro', 'okr.automatic_metrics',        true,  null),
    ('pro', 'okr.history',                  true,  365),
    ('pro', 'okr.export',                   true,  10),
    ('pro', 'okr.ai_recommendations',       false, null),
    ('pro', 'okr.alignments',               true,  null),
    ('pro', 'okr.cycle_management',         true,  3),
    ('pro', 'okr.executive_dashboard',      true,  null),
    ('pro', 'okr.advanced_alerts',          true,  null),

    ('enterprise', 'okr.view',                true, null),
    ('enterprise', 'okr.create',              true, null),
    ('enterprise', 'okr.edit',                true, null),
    ('enterprise', 'okr.archive',             true, null),
    ('enterprise', 'okr.check_in',            true, null),
    ('enterprise', 'okr.initiatives',         true, null),
    ('enterprise', 'okr.automatic_metrics',   true, null),
    ('enterprise', 'okr.history',             true, null),
    ('enterprise', 'okr.export',              true, null),
    ('enterprise', 'okr.ai_recommendations',  true, null),
    ('enterprise', 'okr.alignments',          true, null),
    ('enterprise', 'okr.cycle_management',    true, null),
    ('enterprise', 'okr.executive_dashboard', true, null),
    ('enterprise', 'okr.advanced_alerts',     true, null)
)
insert into public.saas_plan_entitlements (plan_id, feature_key, enabled, limit_value)
select p.id, s.feature_key, s.enabled, s.limit_value
from legacy_seed s
join public.saas_plans p on p.code = s.plan_code
on conflict (plan_id, feature_key) do update set
  enabled = excluded.enabled,
  limit_value = excluded.limit_value,
  updated_at = now();

-- 4. Invalidar cache
delete from public.organization_entitlement_cache;

-- 5. Resolvedor canônico versionado por feature OKR.
create or replace function public.resolve_okr_entitlement_v1(
  p_org_id uuid,
  p_feature_key text
)
returns table (feature_key text, enabled boolean, limit_value bigint, source text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select e.feature_key, e.enabled, e.limit_value, e.source
  from public.get_effective_organization_entitlements(p_org_id) e
  where e.feature_key = p_feature_key
  limit 1;
$$;
revoke all on function public.resolve_okr_entitlement_v1(uuid, text) from public, anon;
grant execute on function public.resolve_okr_entitlement_v1(uuid, text) to authenticated, service_role;

-- 6. Matriz completa OKR
create or replace function public.get_okr_entitlement_matrix_v1(p_org_id uuid)
returns table (feature_key text, enabled boolean, limit_value bigint, source text)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or not public.is_organization_member(p_org_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'okr_entitlement_matrix_access_denied';
  end if;

  return query
  select e.feature_key, e.enabled, e.limit_value, e.source
  from public.get_effective_organization_entitlements(p_org_id) e
  where e.feature_key like 'okr.%'
  order by e.feature_key;
end;
$$;
revoke all on function public.get_okr_entitlement_matrix_v1(uuid) from public, anon;
grant execute on function public.get_okr_entitlement_matrix_v1(uuid) to authenticated, service_role;

-- 7. Guard de limite
create or replace function public.check_okr_limit_v1(
  p_org_id uuid,
  p_feature_key text,
  p_current_count integer
)
returns void
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_limit bigint; v_enabled boolean;
begin
  select limit_value, enabled into v_limit, v_enabled
  from public.resolve_okr_entitlement_v1(p_org_id, p_feature_key);
  if not coalesce(v_enabled, false) then
    raise exception using errcode = '42501', message = 'okr_entitlement_disabled:' || p_feature_key;
  end if;
  if v_limit is not null and p_current_count >= v_limit then
    raise exception using errcode = '42501',
      message = 'okr_entitlement_limit_reached:' || p_feature_key || ':' || v_limit::text;
  end if;
end;
$$;
revoke all on function public.check_okr_limit_v1(uuid, text, integer) from public, anon;
grant execute on function public.check_okr_limit_v1(uuid, text, integer) to authenticated, service_role;

-- ============================================================================
-- Security auto-fix
-- ============================================================================

alter table public.saas_contracts enable row level security;
revoke all on public.saas_contracts from anon, authenticated;
grant select on public.saas_contracts to authenticated;
grant all on public.saas_contracts to service_role;

drop policy if exists saas_contracts_select_platform_admin on public.saas_contracts;
create policy saas_contracts_select_platform_admin
  on public.saas_contracts for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists saas_contracts_select_org_admin on public.saas_contracts;
create policy saas_contracts_select_org_admin
  on public.saas_contracts for select to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = public.saas_contracts.org_id
        and m.user_id = auth.uid()
        and coalesce(m.is_active, true)
        and m.role in ('owner','admin')
    )
  );

drop policy if exists saas_contracts_service_role_all on public.saas_contracts;
create policy saas_contracts_service_role_all
  on public.saas_contracts for all to service_role using (true) with check (true);

drop policy if exists tm_member_insert_self on public.team_members;
create policy tm_member_insert_self
  on public.team_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and coalesce(lower(role), '') <> 'admin'
  );