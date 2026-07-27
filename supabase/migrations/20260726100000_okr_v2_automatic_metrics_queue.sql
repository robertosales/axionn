-- OKR V2 PR 7 - metricas automaticas e fila resiliente.
-- Migration aditiva: preserva a fila e os dados legados.

begin;

create table if not exists public.okr_metric_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  unit text not null,
  direction text not null check (direction in ('increase', 'decrease', 'range', 'boolean')),
  source_module text not null,
  scope_types text[] not null default array['team']::text[],
  status text not null default 'active' check (status in ('draft', 'active', 'deprecated', 'archived')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create unique index if not exists uq_okr_metric_definitions_scope_code
  on public.okr_metric_definitions (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

create table if not exists public.okr_metric_versions (
  id uuid primary key default gen_random_uuid(),
  metric_definition_id uuid not null references public.okr_metric_definitions(id) on delete restrict,
  version text not null,
  formula_type text not null check (formula_type in ('count', 'sum', 'ratio', 'boolean', 'external')),
  formula_definition jsonb not null default '{}'::jsonb,
  input_contract jsonb not null default '{}'::jsonb,
  output_contract jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null default now(),
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (metric_definition_id, version)
);

create table if not exists public.okr_metric_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key_result_id uuid not null unique references public.okr_key_results(id) on delete restrict,
  metric_version_id uuid not null references public.okr_metric_versions(id) on delete restrict,
  scope_type text not null check (scope_type in ('organization', 'contract', 'project', 'team', 'sprint')),
  scope_id uuid,
  frequency text not null default 'daily' check (frequency in ('hourly', 'daily', 'weekly', 'monthly', 'event')),
  timezone text not null default 'UTC',
  configuration jsonb not null default '{}'::jsonb,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  status text not null default 'active' check (status in ('active', 'paused', 'error', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.okr_recalculation_queue
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists key_result_id uuid references public.okr_key_results(id) on delete cascade,
  add column if not exists metric_binding_id uuid references public.okr_metric_bindings(id) on delete cascade,
  add column if not exists worker_id text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists max_attempts integer not null default 5,
  add column if not exists completed_at timestamptz,
  add column if not exists dead_lettered_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists correlation_id uuid not null default gen_random_uuid(),
  add column if not exists result jsonb;

create index if not exists idx_okr_metric_bindings_due
  on public.okr_metric_bindings (status, frequency, last_success_at)
  where status = 'active';

create index if not exists idx_okr_queue_claim_v2
  on public.okr_recalculation_queue (status, available_at, lease_expires_at)
  where status in ('pending', 'retry', 'processing');

alter table public.okr_metric_definitions enable row level security;
alter table public.okr_metric_versions enable row level security;
alter table public.okr_metric_bindings enable row level security;

create or replace function public.can_view_okr_metric_catalog_v2(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      p_org_id is null
      or public.is_organization_member(p_org_id, auth.uid())
      or public.is_platform_admin(auth.uid())
    );
$$;

-- Catalogo global e catalogo do tenant sao visiveis apenas para membros da org.
drop policy if exists okr_metric_definitions_select_v2 on public.okr_metric_definitions;
create policy okr_metric_definitions_select_v2
  on public.okr_metric_definitions for select to authenticated
  using (public.can_view_okr_metric_catalog_v2(organization_id));

drop policy if exists okr_metric_versions_select_v2 on public.okr_metric_versions;
create policy okr_metric_versions_select_v2
  on public.okr_metric_versions for select to authenticated
  using (
    exists (
      select 1
      from public.okr_metric_definitions definition
      where definition.id = metric_definition_id
        and public.can_view_okr_metric_catalog_v2(definition.organization_id)
    )
  );

drop policy if exists okr_metric_bindings_select_v2 on public.okr_metric_bindings;
create policy okr_metric_bindings_select_v2
  on public.okr_metric_bindings for select to authenticated
  using (public.can_view_okr_metric_catalog_v2(organization_id));

revoke all on public.okr_metric_definitions, public.okr_metric_versions,
  public.okr_metric_bindings, public.okr_recalculation_queue
  from public, anon, authenticated;
grant select on public.okr_metric_definitions, public.okr_metric_versions,
  public.okr_metric_bindings to authenticated;
grant all on public.okr_metric_definitions, public.okr_metric_versions,
  public.okr_metric_bindings, public.okr_recalculation_queue to service_role;
revoke all on function public.can_view_okr_metric_catalog_v2(uuid)
  from public, anon, authenticated;
grant execute on function public.can_view_okr_metric_catalog_v2(uuid)
  to authenticated, service_role;

insert into public.okr_metric_definitions (
  organization_id, code, name, description, unit, direction, source_module, scope_types, status
) values
  (null, 'velocity', 'Velocity concluída', 'Soma dos story points concluídos no período.', 'pts', 'increase', 'sala_agil', array['team'], 'active'),
  (null, 'sprint_commitment', 'Compromisso da sprint', 'Percentual de HUs planejadas concluídas.', '%', 'increase', 'sala_agil', array['team'], 'active'),
  (null, 'throughput', 'Throughput', 'Quantidade de HUs concluídas no período.', 'HUs', 'increase', 'sala_agil', array['team'], 'active'),
  (null, 'impediments_open', 'Impedimentos abertos', 'Quantidade de impedimentos ainda não resolvidos.', 'impedimentos', 'decrease', 'sala_agil', array['team'], 'active')
on conflict do nothing;

insert into public.okr_metric_versions (
  metric_definition_id, version, formula_type, formula_definition,
  input_contract, output_contract, effective_from
)
select
  definition.id,
  '1.0',
  case definition.code
    when 'velocity' then 'sum'
    when 'sprint_commitment' then 'ratio'
    else 'count'
  end,
  jsonb_build_object('collector', definition.code),
  jsonb_build_object('scope_type', 'team', 'period_required', true),
  jsonb_build_object('type', 'number', 'unit', definition.unit),
  now()
from public.okr_metric_definitions definition
where definition.organization_id is null
  and definition.code in ('velocity', 'sprint_commitment', 'throughput', 'impediments_open')
on conflict (metric_definition_id, version) do nothing;

-- Compatibilidade: converte KRs automaticos legados em bindings versionados.
insert into public.okr_metric_bindings (
  organization_id, key_result_id, metric_version_id, scope_type, scope_id,
  frequency, timezone, configuration, status
)
select
  objective.organization_id,
  kr.id,
  version.id,
  'team',
  objective.team_id,
  case when kr.frequency in ('daily', 'weekly', 'monthly') then kr.frequency else 'event' end,
  'UTC',
  jsonb_build_object('migrated_from_metric_code', kr.metric_code),
  'active'
from public.okr_key_results kr
join public.okr_objectives objective on objective.id = kr.objective_id
join public.okr_metric_definitions definition
  on definition.organization_id is null and definition.code = kr.metric_code
join public.okr_metric_versions version
  on version.metric_definition_id = definition.id and version.version = '1.0'
where kr.update_type in ('automatic', 'hybrid')
  and kr.lifecycle_status = 'active'
on conflict (key_result_id) do nothing;

create or replace function public.enqueue_okr_recalculation_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_binding record;
begin
  v_team_id := new.team_id;
  if v_team_id is null then
    return new;
  end if;

  for v_binding in
    select binding.id, binding.organization_id, binding.key_result_id,
           kr.objective_id
    from public.okr_metric_bindings binding
    join public.okr_key_results kr on kr.id = binding.key_result_id
    join public.okr_objectives objective on objective.id = kr.objective_id
    where binding.status = 'active'
      and binding.scope_type = 'team'
      and binding.scope_id = v_team_id
      and kr.lifecycle_status = 'active'
      and objective.lifecycle_status = 'active'
  loop
    insert into public.okr_recalculation_queue (
      objective_id, organization_id, key_result_id, metric_binding_id,
      reason, status, available_at, idempotency_key
    ) values (
      v_binding.objective_id, v_binding.organization_id,
      v_binding.key_result_id, v_binding.id,
      tg_table_name || ':' || tg_op, 'pending', clock_timestamp(),
      'metric:' || v_binding.id::text || ':' || tg_table_name || ':'
        || date_trunc('hour', clock_timestamp())::text
    )
    on conflict (idempotency_key) do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_okr_user_story_event on public.user_stories;
create trigger trg_okr_user_story_event
after insert or update of status, story_points on public.user_stories
for each row execute function public.enqueue_okr_recalculation_v2();

drop trigger if exists trg_okr_impediment_event on public.impediments;
create trigger trg_okr_impediment_event
after insert or update of resolved_at on public.impediments
for each row execute function public.enqueue_okr_recalculation_v2();

create or replace function public.claim_okr_recalculation_jobs_v1(
  p_worker_id text,
  p_limit integer default 25,
  p_lease_seconds integer default 120
) returns setof public.okr_recalculation_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'OKR_V2_QUEUE_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'OKR_V2_WORKER_ID_REQUIRED' using errcode = '22023';
  end if;

  return query
  with claimable as (
    select queue.id
    from public.okr_recalculation_queue queue
    where (
      queue.status in ('pending', 'retry')
      and queue.available_at <= clock_timestamp()
    ) or (
      queue.status = 'processing'
      and queue.lease_expires_at <= clock_timestamp()
    )
    order by queue.available_at, queue.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update public.okr_recalculation_queue queue
     set status = 'processing',
         attempts = queue.attempts + 1,
         worker_id = trim(p_worker_id),
         locked_at = clock_timestamp(),
         lease_expires_at = clock_timestamp()
           + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 120), 900))),
         last_error = null
    from claimable
   where queue.id = claimable.id
  returning queue.*;
end;
$$;

create or replace function public.enqueue_due_okr_metric_bindings_v1()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'OKR_V2_QUEUE_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  insert into public.okr_recalculation_queue (
    objective_id, organization_id, key_result_id, metric_binding_id,
    reason, status, available_at, idempotency_key
  )
  select
    kr.objective_id,
    binding.organization_id,
    binding.key_result_id,
    binding.id,
    'schedule:' || binding.frequency,
    'pending',
    clock_timestamp(),
    'schedule:' || binding.id::text || ':' || case binding.frequency
      when 'hourly' then date_trunc('hour', clock_timestamp())::text
      when 'daily' then date_trunc('day', clock_timestamp() at time zone binding.timezone)::text
      when 'weekly' then date_trunc('week', clock_timestamp() at time zone binding.timezone)::text
      when 'monthly' then date_trunc('month', clock_timestamp() at time zone binding.timezone)::text
      else date_trunc('hour', clock_timestamp())::text
    end
  from public.okr_metric_bindings binding
  join public.okr_key_results kr on kr.id = binding.key_result_id
  join public.okr_objectives objective on objective.id = kr.objective_id
  where binding.status = 'active'
    and binding.frequency <> 'event'
    and kr.lifecycle_status = 'active'
    and objective.lifecycle_status = 'active'
    and (
      binding.last_success_at is null
      or (binding.frequency = 'hourly' and binding.last_success_at <= clock_timestamp() - interval '1 hour')
      or (binding.frequency = 'daily' and binding.last_success_at <= clock_timestamp() - interval '1 day')
      or (binding.frequency = 'weekly' and binding.last_success_at <= clock_timestamp() - interval '7 days')
      or (binding.frequency = 'monthly' and binding.last_success_at <= clock_timestamp() - interval '1 month')
    )
  on conflict (idempotency_key) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function public.request_okr_measurement_v2(
  p_key_result_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_binding public.okr_metric_bindings%rowtype;
  v_objective_id uuid;
  v_job_id uuid;
begin
  select binding.*
    into v_binding
  from public.okr_metric_bindings binding
  where binding.key_result_id = p_key_result_id
    and binding.status = 'active';

  if v_binding.id is null then
    raise exception 'OKR_V2_METRIC_BINDING_NOT_FOUND' using errcode = '22023';
  end if;

  perform public._okr_v2_guard(v_binding.organization_id, 'okr.automatic_metrics');

  select objective_id into v_objective_id
  from public.okr_key_results
  where id = p_key_result_id;

  insert into public.okr_recalculation_queue (
    objective_id, organization_id, key_result_id, metric_binding_id,
    reason, status, available_at, idempotency_key
  ) values (
    v_objective_id, v_binding.organization_id, p_key_result_id, v_binding.id,
    'on_demand', 'pending', clock_timestamp(),
    'on_demand:' || v_binding.id::text || ':' || auth.uid()::text || ':'
      || date_trunc('minute', clock_timestamp())::text
  )
  on conflict (idempotency_key) do update
    set available_at = least(public.okr_recalculation_queue.available_at, excluded.available_at)
  returning id into v_job_id;

  return v_job_id;
end;
$$;

create or replace function public.finish_okr_recalculation_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_succeeded boolean,
  p_result jsonb default '{}'::jsonb,
  p_error text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.okr_recalculation_queue%rowtype;
  v_delay interval;
  v_status text;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'OKR_V2_QUEUE_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  select * into v_job
  from public.okr_recalculation_queue
  where id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'OKR_V2_QUEUE_JOB_NOT_FOUND' using errcode = '22023';
  end if;
  if v_job.status <> 'processing' or v_job.worker_id is distinct from trim(p_worker_id) then
    raise exception 'OKR_V2_QUEUE_LEASE_NOT_OWNED' using errcode = '40001';
  end if;

  if p_succeeded then
    v_status := 'completed';
    update public.okr_recalculation_queue
       set status = v_status,
           processed_at = clock_timestamp(),
           completed_at = clock_timestamp(),
           lease_expires_at = null,
           result = coalesce(p_result, '{}'::jsonb),
           last_error = null
     where id = p_job_id;
  elsif v_job.attempts >= v_job.max_attempts then
    v_status := 'dead_letter';
    update public.okr_recalculation_queue
       set status = v_status,
           dead_lettered_at = clock_timestamp(),
           lease_expires_at = null,
           last_error = left(coalesce(p_error, 'Erro desconhecido'), 4000),
           result = coalesce(p_result, '{}'::jsonb)
     where id = p_job_id;
  else
    v_status := 'retry';
    v_delay := case v_job.attempts
      when 1 then interval '1 minute'
      when 2 then interval '5 minutes'
      when 3 then interval '15 minutes'
      else interval '1 hour'
    end;
    update public.okr_recalculation_queue
       set status = v_status,
           available_at = clock_timestamp() + v_delay,
           lease_expires_at = null,
           last_error = left(coalesce(p_error, 'Erro desconhecido'), 4000),
           result = coalesce(p_result, '{}'::jsonb)
     where id = p_job_id;
  end if;

  return v_status;
end;
$$;

create or replace function public.apply_okr_measurement_v2(
  p_org_id uuid,
  p_key_result_id uuid,
  p_metric_version_id uuid,
  p_value numeric,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot_id uuid;
  v_objective_id uuid;
  v_org_id uuid;
  v_lifecycle text;
  v_update_type text;
  v_direction text;
  v_baseline numeric;
  v_target numeric;
  v_target_min numeric;
  v_target_max numeric;
  v_allow_overachievement boolean;
  v_formula_version text;
  v_binding_id uuid;
  v_calc record;
  v_measured_at timestamptz := clock_timestamp();
  v_health text;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'OKR_V2_MEASUREMENT_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_value is null or nullif(trim(p_idempotency_key), '') is null then
    raise exception 'OKR_V2_MEASUREMENT_VALUE_AND_KEY_REQUIRED' using errcode = '22023';
  end if;
  if not public.has_organization_entitlement(p_org_id, 'okr.automatic_metrics') then
    raise exception 'OKR_V2_AUTOMATIC_METRICS_ENTITLEMENT_REQUIRED' using errcode = '42501';
  end if;

  select kr.objective_id, objective.organization_id, kr.lifecycle_status,
         kr.update_type, kr.direction, kr.baseline_value, kr.target_value,
         kr.target_min, kr.target_max, kr.allow_overachievement,
         version.version, binding.id
    into v_objective_id, v_org_id, v_lifecycle,
         v_update_type, v_direction, v_baseline, v_target,
         v_target_min, v_target_max, v_allow_overachievement,
         v_formula_version, v_binding_id
  from public.okr_key_results kr
  join public.okr_objectives objective on objective.id = kr.objective_id
  join public.okr_metric_bindings binding on binding.key_result_id = kr.id
  join public.okr_metric_versions version on version.id = binding.metric_version_id
  where kr.id = p_key_result_id
    and binding.organization_id = p_org_id
    and binding.metric_version_id = p_metric_version_id
    and binding.status = 'active'
  for update of kr, binding;

  if v_org_id is null or v_org_id <> p_org_id then
    raise exception 'OKR_V2_METRIC_BINDING_NOT_FOUND' using errcode = '22023';
  end if;
  if v_lifecycle <> 'active' or v_update_type not in ('automatic', 'hybrid') then
    raise exception 'OKR_V2_KR_NOT_AUTOMATIC' using errcode = '42501';
  end if;

  select * into v_calc
  from public.calculate_okr_kr_progress_v2(
    v_direction, v_baseline, p_value, v_target, v_target_min,
    v_target_max, v_allow_overachievement
  );

  v_health := case
    when v_calc.calculated_progress is null then 'no_data'
    when v_calc.calculated_progress >= 100 then 'completed'
    when v_calc.calculated_progress >= 70 then 'on_track'
    else 'at_risk'
  end;

  insert into public.okr_key_result_snapshots (
    key_result_id, measured_value, raw_progress, calculated_progress,
    health, measurement_quality, source, formula_version, measured_at,
    period_start, period_end, scope_type, scope_id, calculation_metadata,
    triggered_by_type, idempotency_key
  ) values (
    p_key_result_id, p_value, v_calc.raw_progress, v_calc.calculated_progress,
    v_health, 'reliable', 'automatic_metric', v_formula_version, v_measured_at,
    p_period_start::date, p_period_end::date,
    coalesce(p_metadata->>'scope_type', 'team'),
    nullif(p_metadata->>'scope_id', '')::uuid,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'metric_version_id', p_metric_version_id,
      'binding_id', v_binding_id
    ),
    'automatic_metric', trim(p_idempotency_key)
  )
  on conflict (idempotency_key) do nothing
  returning id into v_snapshot_id;

  if v_snapshot_id is null then
    select id into v_snapshot_id
    from public.okr_key_result_snapshots
    where idempotency_key = trim(p_idempotency_key);
    return v_snapshot_id;
  end if;

  update public.okr_key_results
     set current = p_value,
         current_value = p_value,
         raw_progress = v_calc.raw_progress,
         calculated_progress = v_calc.calculated_progress,
         calculated_health = v_health,
         measurement_quality = 'reliable',
         formula_version = v_formula_version,
         last_measured_at = v_measured_at,
         lock_version = lock_version + 1,
         updated_at = v_measured_at
   where id = p_key_result_id;

  update public.okr_metric_bindings
     set last_success_at = v_measured_at,
         last_error_at = null,
         last_error = null,
         status = 'active',
         updated_at = v_measured_at
   where id = v_binding_id;

  perform public.recalculate_okr_objective_v2(v_objective_id);

  insert into public.okr_audit_log (
    objective_id, key_result_id, action, actor_id, metadata, created_at
  ) values (
    v_objective_id, p_key_result_id, 'kr.automatic_measurement_applied',
    null, jsonb_build_object(
      'snapshot_id', v_snapshot_id,
      'metric_version_id', p_metric_version_id,
      'value', p_value,
      'idempotency_key', trim(p_idempotency_key)
    ), v_measured_at
  );

  return v_snapshot_id;
end;
$$;

revoke all on function public.claim_okr_recalculation_jobs_v1(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.enqueue_okr_recalculation_v2()
  from public, anon, authenticated;
revoke all on function public.enqueue_due_okr_metric_bindings_v1()
  from public, anon, authenticated;
revoke all on function public.request_okr_measurement_v2(uuid)
  from public, anon, authenticated;
revoke all on function public.finish_okr_recalculation_job_v1(uuid, text, boolean, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.apply_okr_measurement_v2(
  uuid, uuid, uuid, numeric, timestamptz, timestamptz, text, jsonb
) from public, anon, authenticated;

grant execute on function public.claim_okr_recalculation_jobs_v1(text, integer, integer)
  to service_role;
grant execute on function public.enqueue_okr_recalculation_v2()
  to service_role;
grant execute on function public.enqueue_due_okr_metric_bindings_v1()
  to service_role;
grant execute on function public.request_okr_measurement_v2(uuid)
  to authenticated, service_role;
grant execute on function public.finish_okr_recalculation_job_v1(uuid, text, boolean, jsonb, text)
  to service_role;
grant execute on function public.apply_okr_measurement_v2(
  uuid, uuid, uuid, numeric, timestamptz, timestamptz, text, jsonb
) to service_role;

comment on function public.claim_okr_recalculation_jobs_v1(text, integer, integer) is
  'Claim atomico de jobs OKR com SKIP LOCKED, lease e incremento de tentativa.';
comment on function public.finish_okr_recalculation_job_v1(uuid, text, boolean, jsonb, text) is
  'Finaliza job OKR ou agenda retry exponencial, movendo a quinta falha para dead letter.';
comment on function public.apply_okr_measurement_v2(
  uuid, uuid, uuid, numeric, timestamptz, timestamptz, text, jsonb
) is 'Aplica medicao automatica idempotente usando o motor canonico de progresso.';

commit;
