-- Quality Intelligence: ciclo seguro e auditável de achados.
begin;

create or replace function public.create_quality_finding_v1(
  p_org_id uuid,
  p_payload jsonb,
  p_correlation_id uuid default null
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_id uuid;
  v_code text;
  v_run_id uuid;
  v_run_item_id uuid := nullif(p_payload->>'run_item_id','')::uuid;
  v_step_result_id uuid := nullif(p_payload->>'step_result_id','')::uuid;
begin
  if not public.can_quality_permission_v1(p_org_id,'manage_quality_findings') then
    raise exception using errcode='42501',message='quality_finding_create_denied';
  end if;
  if nullif(btrim(p_payload->>'title'),'') is null then
    raise exception using errcode='22023',message='quality_finding_title_required';
  end if;
  if coalesce(p_payload->>'severity','medium') not in ('low','medium','high','critical') then
    raise exception using errcode='22023',message='quality_finding_severity_invalid';
  end if;
  if v_run_item_id is not null then
    select ri.test_run_id into v_run_id
    from public.quality_test_run_items ri
    where ri.id=v_run_item_id and ri.organization_id=p_org_id;
    if v_run_id is null then raise exception using errcode='23514',message='quality_finding_run_item_mismatch'; end if;
  end if;
  if v_step_result_id is not null and not exists(
    select 1 from public.quality_test_step_results sr
    where sr.id=v_step_result_id and sr.organization_id=p_org_id
      and (v_run_item_id is null or sr.run_item_id=v_run_item_id)
  ) then raise exception using errcode='23514',message='quality_finding_step_mismatch'; end if;

  v_code := public.next_quality_code_v1(p_org_id,'finding');
  insert into public.quality_findings(
    organization_id,code,title,description,expected_result,actual_result,severity,status,
    test_run_id,run_item_id,step_result_id,user_story_id,reported_by
  ) values (
    p_org_id,v_code,btrim(p_payload->>'title'),nullif(btrim(p_payload->>'description'),''),
    nullif(btrim(p_payload->>'expected_result'),''),nullif(btrim(p_payload->>'actual_result'),''),
    coalesce(p_payload->>'severity','medium'),'open',v_run_id,v_run_item_id,v_step_result_id,
    nullif(p_payload->>'user_story_id','')::uuid,auth.uid()
  ) returning id into v_id;
  insert into public.audit_log_events(organization_id,actor_user_id,action,target_type,target_id,source,correlation_id,metadata_json)
  values(p_org_id,auth.uid(),'quality.finding.created','quality_finding',v_id,'web',p_correlation_id,jsonb_build_object('code',v_code,'run_id',v_run_id));
  return v_id;
end $$;

create or replace function public.update_quality_finding_status_v1(
  p_org_id uuid,
  p_finding_id uuid,
  p_status text,
  p_correlation_id uuid default null
) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_previous text;
begin
  if not public.can_quality_permission_v1(p_org_id,'manage_quality_findings') then
    raise exception using errcode='42501',message='quality_finding_update_denied';
  end if;
  if p_status not in ('open','triaged','in_progress','resolved','closed','rejected') then
    raise exception using errcode='22023',message='quality_finding_status_invalid';
  end if;
  select status into v_previous from public.quality_findings where id=p_finding_id and organization_id=p_org_id for update;
  if v_previous is null then raise exception using errcode='P0002',message='quality_finding_not_found'; end if;
  update public.quality_findings set status=p_status,resolved_at=case when p_status in ('resolved','closed') then coalesce(resolved_at,now()) else null end,updated_at=now()
  where id=p_finding_id and organization_id=p_org_id;
  insert into public.audit_log_events(organization_id,actor_user_id,action,target_type,target_id,source,correlation_id,metadata_json)
  values(p_org_id,auth.uid(),'quality.finding.status_changed','quality_finding',p_finding_id,'web',p_correlation_id,jsonb_build_object('from',v_previous,'to',p_status));
end $$;

revoke all on function public.create_quality_finding_v1(uuid,jsonb,uuid),public.update_quality_finding_status_v1(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.create_quality_finding_v1(uuid,jsonb,uuid),public.update_quality_finding_status_v1(uuid,uuid,text,uuid) to authenticated,service_role;
commit;
