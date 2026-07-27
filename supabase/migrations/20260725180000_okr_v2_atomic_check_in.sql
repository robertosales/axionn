-- OKR V2 - implementa o check-in manual como uma unica transacao.

begin;

create or replace function public.record_okr_check_in_v2(
  p_org_id uuid,
  p_key_result_id uuid,
  p_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check_in_id uuid;
  v_objective_id uuid;
  v_org_id uuid;
  v_lifecycle text;
  v_update_type text;
  v_previous numeric;
  v_value numeric;
  v_direction text;
  v_baseline numeric;
  v_target numeric;
  v_target_min numeric;
  v_target_max numeric;
  v_allow_overachievement boolean;
  v_calc record;
  v_measured_at timestamptz := clock_timestamp();
begin
  perform public._okr_v2_guard(p_org_id, 'okr.check_in');

  v_value := nullif(p_payload->>'value', '')::numeric;
  if v_value is null then
    raise exception 'OKR_V2_CHECK_IN_VALUE_REQUIRED' using errcode = '22023';
  end if;

  select
    kr.objective_id,
    o.organization_id,
    kr.lifecycle_status,
    kr.update_type,
    kr.current_value,
    kr.direction,
    kr.baseline_value,
    kr.target_value,
    kr.target_min,
    kr.target_max,
    kr.allow_overachievement
  into
    v_objective_id,
    v_org_id,
    v_lifecycle,
    v_update_type,
    v_previous,
    v_direction,
    v_baseline,
    v_target,
    v_target_min,
    v_target_max,
    v_allow_overachievement
  from public.okr_key_results kr
  join public.okr_objectives o on o.id = kr.objective_id
  where kr.id = p_key_result_id
  for update of kr;

  if v_org_id is null or v_org_id <> p_org_id then
    raise exception 'OKR_V2_KR_NOT_FOUND' using errcode = '22023';
  end if;
  if v_lifecycle <> 'active' then
    raise exception 'OKR_V2_KR_LOCKED: %', v_lifecycle using errcode = '42501';
  end if;
  if v_update_type = 'automatic' then
    raise exception 'OKR_V2_AUTOMATIC_KR_REJECTS_MANUAL_CHECK_IN'
      using errcode = '42501';
  end if;

  select *
    into v_calc
    from public.calculate_okr_kr_progress_v2(
      v_direction,
      v_baseline,
      v_value,
      v_target,
      v_target_min,
      v_target_max,
      v_allow_overachievement
    );

  insert into public.okr_check_ins (
    key_result_id,
    objective_id,
    value,
    previous_value,
    note,
    summary,
    confidence,
    risks,
    next_steps,
    evidence,
    author_id,
    created_at,
    updated_at
  ) values (
    p_key_result_id,
    v_objective_id,
    v_value,
    v_previous,
    nullif(trim(p_payload->>'summary'), ''),
    nullif(trim(p_payload->>'summary'), ''),
    nullif(p_payload->>'confidence', '')::integer,
    nullif(trim(p_payload->>'risks'), ''),
    nullif(trim(p_payload->>'next_steps'), ''),
    case
      when nullif(trim(p_payload->>'evidence_url'), '') is null then '{}'::jsonb
      else jsonb_build_object('url', trim(p_payload->>'evidence_url'))
    end,
    auth.uid(),
    v_measured_at,
    v_measured_at
  )
  returning id into v_check_in_id;

  update public.okr_key_results
     set current = v_value,
         current_value = v_value,
         raw_progress = v_calc.raw_progress,
         calculated_progress = v_calc.calculated_progress,
         calculated_health = case
           when v_calc.calculated_progress is null then 'no_data'
           when v_calc.calculated_progress >= 100 then 'completed'
           when v_calc.calculated_progress >= 70 then 'on_track'
           else 'at_risk'
         end,
         measurement_quality = 'reliable',
         formula_version = '2.0',
         last_measured_at = v_measured_at,
         lock_version = lock_version + 1,
         updated_by = auth.uid(),
         updated_at = v_measured_at
   where id = p_key_result_id;

  insert into public.okr_key_result_snapshots (
    key_result_id,
    measured_value,
    raw_progress,
    calculated_progress,
    health,
    measurement_quality,
    source,
    formula_version,
    measured_at,
    scope_type,
    calculation_metadata,
    triggered_by_type,
    triggered_by_id,
    idempotency_key
  ) values (
    p_key_result_id,
    v_value,
    v_calc.raw_progress,
    v_calc.calculated_progress,
    case
      when v_calc.calculated_progress is null then 'no_data'
      when v_calc.calculated_progress >= 100 then 'completed'
      when v_calc.calculated_progress >= 70 then 'on_track'
      else 'at_risk'
    end,
    'reliable',
    'manual_check_in',
    '2.0',
    v_measured_at,
    'team',
    jsonb_build_object(
      'check_in_id', v_check_in_id,
      'summary', p_payload->>'summary',
      'confidence', p_payload->>'confidence',
      'risks', p_payload->>'risks',
      'next_steps', p_payload->>'next_steps',
      'evidence_url', p_payload->>'evidence_url'
    ),
    'manual',
    auth.uid(),
    'manual:' || v_check_in_id::text
  );

  perform public.recalculate_okr_objective_v2(v_objective_id);

  insert into public.okr_audit_log (
    objective_id,
    key_result_id,
    action,
    actor_id,
    metadata,
    created_at
  ) values (
    v_objective_id,
    p_key_result_id,
    'kr.check_in_recorded',
    auth.uid(),
    jsonb_build_object(
      'check_in_id', v_check_in_id,
      'previous_value', v_previous,
      'value', v_value
    ),
    v_measured_at
  );

  return v_check_in_id;
end;
$$;

revoke all on function public.record_okr_check_in_v2(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_okr_check_in_v2(uuid, uuid, jsonb)
  to authenticated, service_role;

comment on function public.record_okr_check_in_v2(uuid, uuid, jsonb) is
  'Registra check-in, atualiza KR, cria snapshot, recalcula Objective e audita atomicamente.';

commit;
