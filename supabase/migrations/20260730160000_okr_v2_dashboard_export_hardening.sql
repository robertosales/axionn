-- OKR V2 - PR 10: dashboards agregados e exportacao governada.
-- Aditiva e idempotente. Nenhuma migration anterior e reescrita.

begin;

create table if not exists public.okr_export_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  export_format text not null check (export_format in ('csv', 'pdf')),
  cycle_ids uuid[] not null default '{}'::uuid[],
  row_count integer not null default 0 check (row_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_okr_export_events_org_period
  on public.okr_export_events (organization_id, created_at desc);

alter table public.okr_export_events enable row level security;
revoke all on public.okr_export_events from public, anon, authenticated;
grant all on public.okr_export_events to service_role;

drop policy if exists okr_export_events_service_all on public.okr_export_events;
create policy okr_export_events_service_all
  on public.okr_export_events
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.get_okr_dashboard_v1(
  p_org_id uuid,
  p_cycle_id uuid default null,
  p_compare_cycle_id uuid default null,
  p_mode text default 'operational'
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_mode text := lower(coalesce(p_mode, 'operational'));
  v_cycle_id uuid := p_cycle_id;
  v_compare_cycle_id uuid := p_compare_cycle_id;
  v_result jsonb;
begin
  if v_mode not in ('operational', 'executive') then
    raise exception 'OKR_V2_DASHBOARD_MODE_INVALID' using errcode = '22023';
  end if;

  if v_mode = 'executive' then
    perform public._okr_v2_guard(p_org_id, 'okr.executive_dashboard');
    perform public.check_okr_limit_v1(p_org_id, 'okr.executive_dashboard', 0);
  else
    perform public._okr_v2_guard(p_org_id, 'okr.view');
  end if;

  if v_cycle_id is not null and not exists (
    select 1 from public.okr_cycles c
    where c.id = v_cycle_id and c.organization_id = p_org_id
  ) then
    raise exception 'OKR_V2_CYCLE_NOT_FOUND' using errcode = '22023';
  end if;

  if v_compare_cycle_id is not null and not exists (
    select 1 from public.okr_cycles c
    where c.id = v_compare_cycle_id and c.organization_id = p_org_id
  ) then
    raise exception 'OKR_V2_COMPARE_CYCLE_NOT_FOUND' using errcode = '22023';
  end if;

  if v_cycle_id is null then
    select c.id into v_cycle_id
    from public.okr_cycles c
    where c.organization_id = p_org_id
      and c.status <> 'archived'
    order by
      case c.status when 'active' then 0 when 'planning' then 1 when 'closing' then 2 else 3 end,
      c.starts_at desc
    limit 1;
  end if;

  with selected_cycles as (
    select c.*
    from public.okr_cycles c
    where c.organization_id = p_org_id
      and c.id = any(array_remove(array[v_cycle_id, v_compare_cycle_id], null::uuid))
  ),
  objective_scope as (
    select o.*, c.code as cycle_code, c.name as cycle_name, t.name as team_name
    from public.okr_objectives o
    join selected_cycles c on c.id = o.cycle_id
    left join public.teams t on t.id = o.team_id
    where o.organization_id = p_org_id
      and o.lifecycle_status <> 'archived'
  ),
  kr_scope as (
    select kr.*, o.organization_id, o.cycle_id, o.team_id
    from public.okr_key_results kr
    join objective_scope o on o.id = kr.objective_id
    where kr.lifecycle_status <> 'archived'
  ),
  cycle_summary as (
    select
      c.id,
      c.code,
      c.name,
      c.status,
      c.starts_at,
      c.ends_at,
      count(distinct o.id)::integer as objectives,
      count(distinct o.id) filter (
        where o.lifecycle_status in ('active', 'completed')
      )::integer as active_objectives,
      round(avg(o.calculated_progress) filter (
        where o.calculated_progress is not null
          and o.lifecycle_status in ('active', 'completed')
      ), 2) as average_progress,
      count(distinct o.id) filter (where o.calculated_health = 'on_track')::integer as on_track,
      count(distinct o.id) filter (where o.calculated_health = 'attention')::integer as attention,
      count(distinct o.id) filter (where o.calculated_health in ('at_risk', 'off_track'))::integer as at_risk,
      count(distinct o.id) filter (
        where o.calculated_health is null or o.calculated_health = 'no_data'
      )::integer as no_data,
      count(distinct kr.id)::integer as key_results,
      count(distinct kr.id) filter (
        where kr.lifecycle_status = 'active'
          and coalesce(kr.last_measured_at, kr.created_at) < now() - interval '8 days'
      )::integer as stale_key_results
    from selected_cycles c
    left join objective_scope o on o.cycle_id = c.id
    left join kr_scope kr on kr.objective_id = o.id
    group by c.id, c.code, c.name, c.status, c.starts_at, c.ends_at
  ),
  team_summary as (
    select
      o.cycle_id,
      o.team_id,
      coalesce(o.team_name, 'Sem time') as team_name,
      count(distinct o.id)::integer as objectives,
      round(avg(o.calculated_progress) filter (
        where o.calculated_progress is not null
      ), 2) as average_progress,
      count(distinct o.id) filter (
        where o.calculated_health in ('at_risk', 'off_track')
      )::integer as at_risk,
      count(distinct kr.id) filter (
        where kr.lifecycle_status = 'active'
          and coalesce(kr.last_measured_at, kr.created_at) < now() - interval '8 days'
      )::integer as stale_key_results
    from objective_scope o
    left join kr_scope kr on kr.objective_id = o.id
    group by o.cycle_id, o.team_id, coalesce(o.team_name, 'Sem time')
  ),
  objective_focus as (
    select *
    from (
      select
        o.id,
        o.cycle_id,
        o.cycle_code,
        o.title,
        o.team_name,
        o.lifecycle_status,
        coalesce(o.calculated_health, 'no_data') as health,
        o.calculated_progress as progress,
        count(kr.id)::integer as key_results,
        count(kr.id) filter (
          where kr.lifecycle_status = 'active'
            and coalesce(kr.last_measured_at, kr.created_at) < now() - interval '8 days'
        )::integer as stale_key_results
      from objective_scope o
      left join kr_scope kr on kr.objective_id = o.id
      where o.cycle_id = v_cycle_id
      group by o.id, o.cycle_id, o.cycle_code, o.title, o.team_name,
        o.lifecycle_status, o.calculated_health, o.calculated_progress
      order by
        case coalesce(o.calculated_health, 'no_data')
          when 'at_risk' then 0
          when 'off_track' then 0
          when 'attention' then 1
          when 'no_data' then 2
          else 3
        end,
        o.calculated_progress nulls first,
        o.updated_at desc
      limit 12
    ) ranked
  ),
  operational_counts as (
    select
      (
        select count(*)::integer
        from public.okr_alerts a
        where a.organization_id = p_org_id
          and a.status = 'open'
          and (v_cycle_id is null or a.cycle_id = v_cycle_id)
      ) as open_alerts,
      (
        select count(*)::integer
        from public.okr_alerts a
        where a.organization_id = p_org_id
          and a.status = 'open'
          and a.severity in ('high', 'critical')
          and (v_cycle_id is null or a.cycle_id = v_cycle_id)
      ) as critical_alerts,
      (
        select count(*)::integer
        from public.okr_initiatives i
        join public.okr_objectives o on o.id = i.objective_id
        where i.organization_id = p_org_id
          and i.status = 'blocked'
          and i.archived_at is null
          and (v_cycle_id is null or o.cycle_id = v_cycle_id)
      ) as blocked_initiatives,
      (
        select count(*)::integer
        from public.okr_initiatives i
        join public.okr_objectives o on o.id = i.objective_id
        where i.organization_id = p_org_id
          and i.status not in ('completed', 'cancelled', 'archived')
          and i.archived_at is null
          and i.due_date < current_date
          and (v_cycle_id is null or o.cycle_id = v_cycle_id)
      ) as overdue_initiatives
  )
  select jsonb_build_object(
    'mode', v_mode,
    'generated_at', now(),
    'primary_cycle_id', v_cycle_id,
    'compare_cycle_id', v_compare_cycle_id,
    'cycles', coalesce((
      select jsonb_agg(to_jsonb(cs) order by cs.starts_at)
      from cycle_summary cs
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(to_jsonb(ts) order by ts.cycle_id, ts.average_progress desc nulls last)
      from team_summary ts
    ), '[]'::jsonb),
    'focus_objectives', coalesce((
      select jsonb_agg(to_jsonb(ofc))
      from objective_focus ofc
    ), '[]'::jsonb),
    'operations', coalesce((
      select to_jsonb(oc) from operational_counts oc
    ), '{}'::jsonb)
  ) into v_result;

  return coalesce(v_result, jsonb_build_object(
    'mode', v_mode,
    'generated_at', now(),
    'primary_cycle_id', v_cycle_id,
    'compare_cycle_id', v_compare_cycle_id,
    'cycles', '[]'::jsonb,
    'teams', '[]'::jsonb,
    'focus_objectives', '[]'::jsonb,
    'operations', '{}'::jsonb
  ));
end;
$$;

create or replace function public.request_okr_export_v1(
  p_org_id uuid,
  p_cycle_ids uuid[],
  p_format text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_format text := lower(coalesce(p_format, 'csv'));
  v_cycle_ids uuid[] := coalesce(p_cycle_ids, '{}'::uuid[]);
  v_plan_code text;
  v_limit bigint;
  v_used integer;
  v_rows jsonb;
  v_row_count integer;
begin
  perform public._okr_v2_guard(p_org_id, 'okr.export');

  if v_format not in ('csv', 'pdf') then
    raise exception 'OKR_V2_EXPORT_FORMAT_INVALID' using errcode = '22023';
  end if;

  select e.plan_code, e.limit_value
    into v_plan_code, v_limit
  from public.get_effective_organization_entitlements(p_org_id) e
  where e.feature_key = 'okr.export'
    and e.enabled
    and e.subscription_status in ('active', 'trialing')
  limit 1;

  if v_plan_code is null then
    raise exception 'okr_entitlement_disabled:okr.export' using errcode = '42501';
  end if;

  if v_format = 'pdf' and lower(v_plan_code) <> 'enterprise' then
    raise exception 'OKR_V2_EXPORT_FORMAT_NOT_INCLUDED:pdf'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(v_cycle_ids) requested_cycle_id
    left join public.okr_cycles c
      on c.id = requested_cycle_id and c.organization_id = p_org_id
    where c.id is null
  ) then
    raise exception 'OKR_V2_EXPORT_CYCLE_NOT_FOUND' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(format('okr-export:%s', p_org_id), 0)
  );

  select count(*)::integer into v_used
  from public.okr_export_events e
  where e.organization_id = p_org_id
    and e.created_at >= date_trunc('month', now())
    and e.created_at < date_trunc('month', now()) + interval '1 month';

  perform public.check_okr_limit_v1(p_org_id, 'okr.export', v_used);

  select coalesce(jsonb_agg(jsonb_build_object(
    'cycle_code', c.code,
    'cycle_name', c.name,
    'team_name', coalesce(t.name, 'Sem time'),
    'objective_title', o.title,
    'objective_level', o.objective_level,
    'objective_lifecycle', o.lifecycle_status,
    'objective_health', coalesce(o.calculated_health, 'no_data'),
    'objective_progress', o.calculated_progress,
    'key_result_title', kr.title,
    'key_result_unit', kr.unit,
    'key_result_direction', kr.direction,
    'key_result_baseline', kr.baseline_value,
    'key_result_target', kr.target_value,
    'key_result_current', kr.current_value,
    'key_result_progress', kr.calculated_progress,
    'key_result_health', coalesce(kr.calculated_health, 'no_data'),
    'measurement_quality', kr.measurement_quality,
    'last_measured_at', kr.last_measured_at
  ) order by c.starts_at, coalesce(t.name, 'Sem time'), o.title, kr.title), '[]'::jsonb)
  into v_rows
  from public.okr_objectives o
  join public.okr_cycles c on c.id = o.cycle_id and c.organization_id = p_org_id
  left join public.teams t on t.id = o.team_id
  left join public.okr_key_results kr
    on kr.objective_id = o.id and kr.lifecycle_status <> 'archived'
  where o.organization_id = p_org_id
    and o.lifecycle_status <> 'archived'
    and (
      cardinality(v_cycle_ids) = 0
      or o.cycle_id = any(v_cycle_ids)
    );

  v_row_count := jsonb_array_length(v_rows);

  insert into public.okr_export_events (
    organization_id, requested_by, export_format, cycle_ids, row_count
  ) values (
    p_org_id, auth.uid(), v_format, v_cycle_ids, v_row_count
  );

  return jsonb_build_object(
    'format', v_format,
    'plan_code', v_plan_code,
    'used', v_used + 1,
    'limit', v_limit,
    'rows', v_rows
  );
end;
$$;

revoke all on function public.get_okr_dashboard_v1(uuid, uuid, uuid, text)
  from public, anon;
grant execute on function public.get_okr_dashboard_v1(uuid, uuid, uuid, text)
  to authenticated, service_role;

revoke all on function public.request_okr_export_v1(uuid, uuid[], text)
  from public, anon;
grant execute on function public.request_okr_export_v1(uuid, uuid[], text)
  to authenticated, service_role;

comment on function public.get_okr_dashboard_v1(uuid, uuid, uuid, text) is
  'Dashboard OKR V2 agregado, tenant-scoped e protegido por RBAC/entitlement.';
comment on function public.request_okr_export_v1(uuid, uuid[], text) is
  'Exportacao OKR V2 governada por permissao, entitlement, formato e cota mensal.';

commit;
