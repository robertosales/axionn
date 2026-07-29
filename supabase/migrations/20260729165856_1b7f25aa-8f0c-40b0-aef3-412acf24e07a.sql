create or replace function public._okr_upsert_alert_v1(
  p_org_id uuid,
  p_rule_code text,
  p_severity text,
  p_message text,
  p_objective_id uuid default null,
  p_key_result_id uuid default null,
  p_initiative_id uuid default null,
  p_cycle_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_id uuid;
begin
  v_key := p_rule_code || ':' || coalesce(p_objective_id::text, '-') || ':'
    || coalesce(p_key_result_id::text, '-') || ':' || coalesce(p_initiative_id::text, '-');

  insert into public.okr_alerts (
    organization_id, cycle_id, objective_id, key_result_id, initiative_id,
    alert_type, rule_code, severity, message, status, deduplication_key,
    detected_at, first_detected_at, last_detected_at, occurrence_count, metadata
  ) values (
    p_org_id, p_cycle_id, p_objective_id, p_key_result_id, p_initiative_id,
    p_rule_code, p_rule_code, p_severity, p_message, 'open', v_key,
    now(), now(), now(), 1, coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (deduplication_key) do update
    set last_detected_at = now(),
        occurrence_count = public.okr_alerts.occurrence_count + 1,
        severity = excluded.severity,
        message = excluded.message,
        metadata = excluded.metadata,
        organization_id = coalesce(public.okr_alerts.organization_id, excluded.organization_id),
        status = case when public.okr_alerts.status = 'resolved' then 'open' else public.okr_alerts.status end,
        resolved_at = case when public.okr_alerts.status = 'resolved' then null else public.okr_alerts.resolved_at end
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.list_okr_initiatives_v1(
  p_org_id uuid,
  p_objective_id uuid default null,
  p_include_archived boolean default false
) returns setof public.okr_initiatives
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._okr_v2_guard(p_org_id, 'okr.view');
  return query
    select i.*
      from public.okr_initiatives i
     where i.organization_id = p_org_id
       and (p_objective_id is null or i.objective_id = p_objective_id)
       and (p_include_archived or i.archived_at is null)
     order by i.created_at;
end;
$$;

create or replace function public.create_okr_initiative_v1(
  p_org_id uuid,
  p_objective_id uuid,
  p_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obj record;
  v_kr uuid := nullif(p_payload->>'key_result_id', '')::uuid;
  v_title text := nullif(trim(coalesce(p_payload->>'title', '')), '');
  v_start date := nullif(p_payload->>'start_date', '')::date;
  v_due date := nullif(p_payload->>'due_date', '')::date;
  v_id uuid;
begin
  perform public._okr_v2_guard(p_org_id, 'okr.initiatives');

  if v_title is null then
    raise exception 'OKR_V2_INITIATIVE_TITLE_REQUIRED' using errcode = '22023';
  end if;

  select o.id, o.organization_id, o.team_id, o.lifecycle_status, o.cycle_id
    into v_obj
    from public.okr_objectives o
   where o.id = p_objective_id;

  if v_obj.id is null
     or coalesce(v_obj.organization_id, public.resolve_team_org_id(v_obj.team_id)) is distinct from p_org_id then
    raise exception 'OKR_V2_OBJECTIVE_NOT_FOUND' using errcode = '22023';
  end if;

  if v_kr is not null and not exists (
    select 1 from public.okr_key_results kr
     where kr.id = v_kr and kr.objective_id = p_objective_id
  ) then
    raise exception 'OKR_V2_INITIATIVE_KR_MISMATCH' using errcode = '22023';
  end if;

  if v_start is not null and v_due is not null and v_due < v_start then
    raise exception 'OKR_V2_INITIATIVE_INVALID_DUE_DATE' using errcode = '22023';
  end if;

  insert into public.okr_initiatives (
    organization_id, objective_id, key_result_id, title, description, owner_id,
    status, priority, start_date, due_date, progress,
    linked_entity_type, linked_entity_id, linked_entity_module,
    dependency_metadata, created_by
  ) values (
    p_org_id, p_objective_id, v_kr, v_title,
    nullif(p_payload->>'description', ''),
    nullif(p_payload->>'owner_id', '')::uuid,
    coalesce(nullif(p_payload->>'status', ''), 'planned'),
    coalesce(nullif(p_payload->>'priority', ''), 'medium'),
    v_start, v_due,
    coalesce(nullif(p_payload->>'progress', '')::numeric, 0),
    nullif(p_payload->>'linked_entity_type', ''),
    nullif(p_payload->>'linked_entity_id', '')::uuid,
    nullif(p_payload->>'linked_entity_module', ''),
    coalesce(p_payload->'dependency_metadata', '{}'::jsonb),
    auth.uid()
  ) returning id into v_id;

  insert into public.okr_audit_log (objective_id, key_result_id, initiative_id, action, actor_id, after_data, metadata)
  values (p_objective_id, v_kr, v_id, 'initiative_created', auth.uid(), p_payload,
          jsonb_build_object('organization_id', p_org_id));

  return v_id;
end;
$$;

create or replace function public.update_okr_initiative_v1(
  p_org_id uuid,
  p_initiative_id uuid,
  p_payload jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.okr_initiatives%rowtype;
  v_status text;
  v_progress numeric;
  v_start date;
  v_due date;
  v_kr uuid;
begin
  perform public._okr_v2_guard(p_org_id, 'okr.initiatives');

  select * into v_before
    from public.okr_initiatives
   where id = p_initiative_id
   for update;

  if v_before.id is null or v_before.organization_id is distinct from p_org_id then
    raise exception 'OKR_V2_INITIATIVE_NOT_FOUND' using errcode = '22023';
  end if;
  if v_before.archived_at is not null then
    raise exception 'OKR_V2_INITIATIVE_ARCHIVED' using errcode = '42501';
  end if;

  v_status := coalesce(nullif(p_payload->>'status', ''), v_before.status);
  v_progress := coalesce(nullif(p_payload->>'progress', '')::numeric, v_before.progress);
  v_start := coalesce(nullif(p_payload->>'start_date', '')::date, v_before.start_date);
  v_due := coalesce(nullif(p_payload->>'due_date', '')::date, v_before.due_date);
  v_kr := coalesce(nullif(p_payload->>'key_result_id', '')::uuid, v_before.key_result_id);

  if v_kr is not null and not exists (
    select 1 from public.okr_key_results kr
     where kr.id = v_kr and kr.objective_id = v_before.objective_id
  ) then
    raise exception 'OKR_V2_INITIATIVE_KR_MISMATCH' using errcode = '22023';
  end if;
  if v_start is not null and v_due is not null and v_due < v_start then
    raise exception 'OKR_V2_INITIATIVE_INVALID_DUE_DATE' using errcode = '22023';
  end if;
  if v_progress < 0 or v_progress > 100 then
    raise exception 'OKR_V2_INITIATIVE_INVALID_PROGRESS' using errcode = '22023';
  end if;
  if v_status = 'completed' then
    v_progress := 100;
  end if;
  if v_status = 'blocked'
     and nullif(coalesce(p_payload->>'blocked_reason', v_before.blocked_reason, ''), '') is null then
    raise exception 'OKR_V2_INITIATIVE_BLOCKED_REASON_REQUIRED' using errcode = '22023';
  end if;
  if v_status = 'cancelled'
     and nullif(coalesce(p_payload->>'cancelled_reason', v_before.cancelled_reason, ''), '') is null then
    raise exception 'OKR_V2_INITIATIVE_CANCELLED_REASON_REQUIRED' using errcode = '22023';
  end if;

  update public.okr_initiatives
     set title = coalesce(nullif(trim(coalesce(p_payload->>'title', '')), ''), title),
         description = coalesce(p_payload->>'description', description),
         owner_id = coalesce(nullif(p_payload->>'owner_id', '')::uuid, owner_id),
         key_result_id = v_kr,
         status = v_status,
         priority = coalesce(nullif(p_payload->>'priority', ''), priority),
         progress = v_progress,
         start_date = v_start,
         due_date = v_due,
         blocked_reason = case when v_status = 'blocked'
                               then coalesce(nullif(p_payload->>'blocked_reason', ''), blocked_reason)
                               else null end,
         cancelled_reason = case when v_status = 'cancelled'
                                 then coalesce(nullif(p_payload->>'cancelled_reason', ''), cancelled_reason)
                                 else cancelled_reason end,
         linked_entity_type = coalesce(nullif(p_payload->>'linked_entity_type', ''), linked_entity_type),
         linked_entity_id = coalesce(nullif(p_payload->>'linked_entity_id', '')::uuid, linked_entity_id),
         linked_entity_module = coalesce(nullif(p_payload->>'linked_entity_module', ''), linked_entity_module),
         dependency_metadata = coalesce(p_payload->'dependency_metadata', dependency_metadata),
         completed_at = case when v_status = 'completed' then coalesce(completed_at, now()) else null end,
         version = version + 1,
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_initiative_id;

  if v_status = 'blocked' then
    perform public._okr_upsert_alert_v1(
      p_org_id, 'initiative.blocked', 'high',
      'Iniciativa bloqueada: ' || v_before.title,
      v_before.objective_id, v_kr, p_initiative_id, null,
      jsonb_build_object('blocked_reason', coalesce(p_payload->>'blocked_reason', v_before.blocked_reason)));
  end if;
  if v_status not in ('completed', 'cancelled')
     and v_due is not null and v_due < current_date then
    perform public._okr_upsert_alert_v1(
      p_org_id, 'initiative.overdue', 'medium',
      'Iniciativa vencida: ' || v_before.title,
      v_before.objective_id, v_kr, p_initiative_id, null,
      jsonb_build_object('due_date', v_due));
  end if;

  insert into public.okr_audit_log (objective_id, key_result_id, initiative_id, action, actor_id, before_data, after_data, metadata)
  values (v_before.objective_id, v_kr, p_initiative_id,
          case when v_status = 'completed' then 'initiative_completed' else 'initiative_updated' end,
          auth.uid(), to_jsonb(v_before), p_payload,
          jsonb_build_object('organization_id', p_org_id));
end;
$$;

create or replace function public.archive_okr_initiative_v1(
  p_org_id uuid,
  p_initiative_id uuid,
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.okr_initiatives%rowtype;
begin
  perform public._okr_v2_guard(p_org_id, 'okr.archive');

  select * into v_before from public.okr_initiatives where id = p_initiative_id for update;
  if v_before.id is null or v_before.organization_id is distinct from p_org_id then
    raise exception 'OKR_V2_INITIATIVE_NOT_FOUND' using errcode = '22023';
  end if;

  update public.okr_initiatives
     set archived_at = now(), status = 'archived', version = version + 1,
         updated_by = auth.uid(), updated_at = now()
   where id = p_initiative_id;

  update public.okr_alerts
     set status = 'resolved', resolved_at = now(), resolution_note = 'initiative_archived'
   where initiative_id = p_initiative_id and status <> 'resolved';

  insert into public.okr_audit_log (objective_id, initiative_id, action, actor_id, before_data, metadata)
  values (v_before.objective_id, p_initiative_id, 'initiative_updated', auth.uid(), to_jsonb(v_before),
          jsonb_build_object('organization_id', p_org_id, 'reason', p_reason, 'archived', true));
end;
$$;

create or replace function public.add_okr_initiative_dependency_v1(
  p_org_id uuid,
  p_initiative_id uuid,
  p_depends_on_initiative_id uuid,
  p_dependency_type text default 'blocks'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public._okr_v2_guard(p_org_id, 'okr.initiatives');

  insert into public.okr_initiative_dependencies (
    organization_id, initiative_id, depends_on_initiative_id, dependency_type, created_by
  ) values (
    p_org_id, p_initiative_id, p_depends_on_initiative_id,
    coalesce(nullif(p_dependency_type, ''), 'blocks'), auth.uid()
  )
  on conflict (initiative_id, depends_on_initiative_id) do update
    set dependency_type = excluded.dependency_type
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.remove_okr_initiative_dependency_v1(
  p_org_id uuid,
  p_dependency_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._okr_v2_guard(p_org_id, 'okr.initiatives');
  delete from public.okr_initiative_dependencies
   where id = p_dependency_id and organization_id = p_org_id;
end;
$$;

create or replace function public.list_okr_alerts_v1(
  p_org_id uuid,
  p_status text default 'open'
) returns setof public.okr_alerts
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._okr_v2_guard(p_org_id, 'okr.view');
  return query
    select a.*
      from public.okr_alerts a
     where a.organization_id = p_org_id
       and (p_status is null or p_status = 'all' or a.status = p_status)
     order by a.last_detected_at desc
     limit 500;
end;
$$;

create or replace function public.acknowledge_okr_alert_v1(
  p_org_id uuid,
  p_alert_id uuid,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._okr_v2_guard(p_org_id, 'okr.edit');
  update public.okr_alerts
     set status = 'acknowledged', acknowledged_at = now(), acknowledged_by = auth.uid(),
         resolution_note = coalesce(nullif(p_note, ''), resolution_note)
   where id = p_alert_id and organization_id = p_org_id;

  insert into public.okr_audit_log (action, actor_id, metadata)
  values ('alert_acknowledged', auth.uid(),
          jsonb_build_object('organization_id', p_org_id, 'alert_id', p_alert_id));
end;
$$;

create or replace function public.resolve_okr_alert_v1(
  p_org_id uuid,
  p_alert_id uuid,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._okr_v2_guard(p_org_id, 'okr.edit');
  update public.okr_alerts
     set status = 'resolved', resolved_at = now(),
         resolution_note = coalesce(nullif(p_note, ''), resolution_note)
   where id = p_alert_id and organization_id = p_org_id;
end;
$$;

create or replace function public.run_okr_alert_engine_v1(p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row record;
begin
  if auth.uid() is not null then
    perform public._okr_v2_guard(p_org_id, 'okr.view');
  end if;

  for v_row in
    select o.id, o.title, o.cycle_id
      from public.okr_objectives o
     where coalesce(o.organization_id, public.resolve_team_org_id(o.team_id)) = p_org_id
       and o.lifecycle_status = 'active'
       and o.owner_id is null
  loop
    perform public._okr_upsert_alert_v1(p_org_id, 'objective.no_owner', 'high',
      'Objective sem responsável: ' || v_row.title, v_row.id, null, null, v_row.cycle_id);
    v_count := v_count + 1;
  end loop;

  for v_row in
    select o.id, o.title, o.cycle_id
      from public.okr_objectives o
     where coalesce(o.organization_id, public.resolve_team_org_id(o.team_id)) = p_org_id
       and o.lifecycle_status = 'active'
       and o.objective_level is distinct from 'organization'
       and not exists (
         select 1 from public.okr_objective_alignments a
          where a.child_objective_id = o.id and a.archived_at is null
       )
  loop
    perform public._okr_upsert_alert_v1(p_org_id, 'objective.no_alignment', 'medium',
      'Objective sem alinhamento: ' || v_row.title, v_row.id, null, null, v_row.cycle_id);
    v_count := v_count + 1;
  end loop;

  for v_row in
    select kr.id, kr.title, kr.objective_id, o.cycle_id
      from public.okr_key_results kr
      join public.okr_objectives o on o.id = kr.objective_id
     where coalesce(o.organization_id, public.resolve_team_org_id(o.team_id)) = p_org_id
       and kr.lifecycle_status = 'active'
       and kr.baseline_value is null
  loop
    perform public._okr_upsert_alert_v1(p_org_id, 'kr.no_baseline', 'medium',
      'KR sem linha de base: ' || v_row.title, v_row.objective_id, v_row.id, null, v_row.cycle_id);
    v_count := v_count + 1;
  end loop;

  for v_row in
    select kr.id, kr.title, kr.objective_id, o.cycle_id, kr.last_measured_at
      from public.okr_key_results kr
      join public.okr_objectives o on o.id = kr.objective_id
     where coalesce(o.organization_id, public.resolve_team_org_id(o.team_id)) = p_org_id
       and kr.lifecycle_status = 'active'
       and (kr.last_measured_at is null or kr.last_measured_at < now() - interval '14 days')
  loop
    perform public._okr_upsert_alert_v1(p_org_id,
      case when v_row.last_measured_at is null then 'kr.no_measurement' else 'kr.stale_measurement' end,
      'medium',
      case when v_row.last_measured_at is null
           then 'KR sem medição: ' || v_row.title
           else 'KR com medição desatualizada: ' || v_row.title end,
      v_row.objective_id, v_row.id, null, v_row.cycle_id);
    v_count := v_count + 1;
  end loop;

  for v_row in
    select i.id, i.title, i.objective_id, i.key_result_id, i.status, i.due_date
      from public.okr_initiatives i
     where i.organization_id = p_org_id
       and i.archived_at is null
       and (
         i.status = 'blocked'
         or (i.status not in ('completed', 'cancelled') and i.due_date is not null and i.due_date < current_date)
       )
  loop
    perform public._okr_upsert_alert_v1(p_org_id,
      case when v_row.status = 'blocked' then 'initiative.blocked' else 'initiative.overdue' end,
      case when v_row.status = 'blocked' then 'high' else 'medium' end,
      case when v_row.status = 'blocked'
           then 'Iniciativa bloqueada: ' || v_row.title
           else 'Iniciativa vencida: ' || v_row.title end,
      v_row.objective_id, v_row.key_result_id, v_row.id, null);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public._okr_upsert_alert_v1(uuid, text, text, text, uuid, uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public._okr_upsert_alert_v1(uuid, text, text, text, uuid, uuid, uuid, uuid, jsonb) to service_role;

revoke all on function public.list_okr_initiatives_v1(uuid, uuid, boolean) from public, anon;
grant execute on function public.list_okr_initiatives_v1(uuid, uuid, boolean) to authenticated, service_role;
revoke all on function public.create_okr_initiative_v1(uuid, uuid, jsonb) from public, anon;
grant execute on function public.create_okr_initiative_v1(uuid, uuid, jsonb) to authenticated, service_role;
revoke all on function public.update_okr_initiative_v1(uuid, uuid, jsonb) from public, anon;
grant execute on function public.update_okr_initiative_v1(uuid, uuid, jsonb) to authenticated, service_role;
revoke all on function public.archive_okr_initiative_v1(uuid, uuid, text) from public, anon;
grant execute on function public.archive_okr_initiative_v1(uuid, uuid, text) to authenticated, service_role;
revoke all on function public.add_okr_initiative_dependency_v1(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.add_okr_initiative_dependency_v1(uuid, uuid, uuid, text) to authenticated, service_role;
revoke all on function public.remove_okr_initiative_dependency_v1(uuid, uuid) from public, anon;
grant execute on function public.remove_okr_initiative_dependency_v1(uuid, uuid) to authenticated, service_role;
revoke all on function public.list_okr_alerts_v1(uuid, text) from public, anon;
grant execute on function public.list_okr_alerts_v1(uuid, text) to authenticated, service_role;
revoke all on function public.acknowledge_okr_alert_v1(uuid, uuid, text) from public, anon;
grant execute on function public.acknowledge_okr_alert_v1(uuid, uuid, text) to authenticated, service_role;
revoke all on function public.resolve_okr_alert_v1(uuid, uuid, text) from public, anon;
grant execute on function public.resolve_okr_alert_v1(uuid, uuid, text) to authenticated, service_role;
revoke all on function public.run_okr_alert_engine_v1(uuid) from public, anon;
grant execute on function public.run_okr_alert_engine_v1(uuid) to authenticated, service_role;