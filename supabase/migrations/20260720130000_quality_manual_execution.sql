-- Axionn Quality Intelligence - PR 4: execucao manual, evidencia URL e lifecycle auditado.
-- Aplicar exclusivamente pelo fluxo autorizado do Lovable.
begin;

create or replace function public.recalculate_quality_run_item_v1(p_org_id uuid,p_run_item_id uuid) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_status text; v_total int; v_done int; v_run_id uuid;
begin
 select test_run_id into v_run_id from public.quality_test_run_items where id=p_run_item_id and organization_id=p_org_id;
 if v_run_id is null then raise exception using errcode='42501',message='quality_run_item_not_found'; end if;
 select count(*),count(*) filter(where status<>'not_run'),case when bool_or(status='failed') then 'failed' when bool_or(status='blocked') then 'blocked' when bool_and(status='passed') then 'passed' when bool_and(status='skipped') then 'skipped' when bool_or(status<>'not_run') then 'in_progress' else 'not_run' end into v_total,v_done,v_status from public.quality_test_step_results where run_item_id=p_run_item_id;
 update public.quality_test_run_items set status=coalesce(v_status,'not_run'),started_at=case when v_done>0 then coalesce(started_at,now()) else started_at end,completed_at=case when v_total>0 and v_done=v_total then now() else null end,executed_by=case when v_done>0 then auth.uid() else executed_by end,updated_at=now() where id=p_run_item_id;
 return coalesce(v_status,'not_run');
end $$;

create or replace function public.start_quality_test_run_v1(p_org_id uuid,p_run_id uuid,p_correlation_id uuid default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if not public.can_quality_permission_v1(p_org_id,'execute_tests') then raise exception using errcode='42501',message='quality_run_start_denied'; end if;
 update public.quality_test_runs set status='in_progress',started_at=coalesce(started_at,now()),completed_at=null,updated_at=now() where id=p_run_id and organization_id=p_org_id and status in ('draft','planned');
 if not found then raise exception using errcode='55000',message='quality_run_not_startable'; end if;
 insert into public.audit_log_events(organization_id,actor_user_id,action,target_type,target_id,source,correlation_id) values(p_org_id,auth.uid(),'quality.test_run.started','quality_test_run',p_run_id,'web',p_correlation_id);
end $$;

create or replace function public.update_quality_step_result_v1(p_org_id uuid,p_step_result_id uuid,p_status text,p_actual_result text default null,p_correlation_id uuid default null) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_item_id uuid; v_run_id uuid; v_item_status text;
begin
 if not public.can_quality_permission_v1(p_org_id,'execute_tests') then raise exception using errcode='42501',message='quality_result_update_denied'; end if;
 if p_status not in ('not_run','in_progress','passed','failed','blocked','skipped','invalid','retest') then raise exception using errcode='22023',message='quality_result_status_invalid'; end if;
 select sr.run_item_id,ri.test_run_id into v_item_id,v_run_id from public.quality_test_step_results sr join public.quality_test_run_items ri on ri.id=sr.run_item_id join public.quality_test_runs r on r.id=ri.test_run_id where sr.id=p_step_result_id and sr.organization_id=p_org_id and r.organization_id=p_org_id and r.status='in_progress' for update of sr;
 if v_item_id is null then raise exception using errcode='55000',message='quality_run_not_editable'; end if;
 update public.quality_test_step_results set status=p_status,actual_result=nullif(btrim(p_actual_result),''),executed_by=case when p_status='not_run' then null else auth.uid() end,executed_at=case when p_status='not_run' then null else now() end,updated_at=now() where id=p_step_result_id;
 v_item_status:=public.recalculate_quality_run_item_v1(p_org_id,v_item_id);
 insert into public.audit_log_events(organization_id,actor_user_id,action,target_type,target_id,source,correlation_id,metadata_json) values(p_org_id,auth.uid(),'quality.test_result.updated','quality_step_result',p_step_result_id,'web',p_correlation_id,jsonb_build_object('status',p_status,'run_id',v_run_id));
 return v_item_status;
end $$;

create or replace function public.add_quality_external_evidence_v1(p_org_id uuid,p_run_item_id uuid,p_step_result_id uuid,p_title text,p_external_url text,p_description text default null) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_run_id uuid;
begin
 if not public.can_quality_permission_v1(p_org_id,'execute_tests') then raise exception using errcode='42501',message='quality_evidence_create_denied'; end if;
 if nullif(btrim(p_title),'') is null or p_external_url !~* '^https?://[^[:space:]]+$' then raise exception using errcode='22023',message='quality_evidence_invalid'; end if;
 select ri.test_run_id into v_run_id from public.quality_test_run_items ri join public.quality_test_runs r on r.id=ri.test_run_id where ri.id=p_run_item_id and ri.organization_id=p_org_id and r.status='in_progress';
 if v_run_id is null or (p_step_result_id is not null and not exists(select 1 from public.quality_test_step_results where id=p_step_result_id and run_item_id=p_run_item_id and organization_id=p_org_id)) then raise exception using errcode='23514',message='quality_evidence_tenant_mismatch'; end if;
 insert into public.quality_test_evidences(organization_id,run_item_id,step_result_id,evidence_type,title,description,external_url,uploaded_by) values(p_org_id,p_run_item_id,p_step_result_id,'external_url',btrim(p_title),nullif(btrim(p_description),''),btrim(p_external_url),auth.uid()) returning id into v_id;
 return v_id;
end $$;

create or replace function public.complete_quality_test_run_v1(p_org_id uuid,p_run_id uuid,p_allow_not_run boolean default false,p_correlation_id uuid default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if not public.can_quality_permission_v1(p_org_id,'execute_tests') then raise exception using errcode='42501',message='quality_run_complete_denied'; end if;
 if not p_allow_not_run and exists(select 1 from public.quality_test_run_items where test_run_id=p_run_id and organization_id=p_org_id and status in ('not_run','in_progress','retest')) then raise exception using errcode='55000',message='quality_run_has_pending_items'; end if;
 update public.quality_test_runs set status='completed',completed_at=now(),updated_at=now() where id=p_run_id and organization_id=p_org_id and status='in_progress';
 if not found then raise exception using errcode='55000',message='quality_run_not_completable'; end if;
 insert into public.audit_log_events(organization_id,actor_user_id,action,target_type,target_id,source,correlation_id) values(p_org_id,auth.uid(),'quality.test_run.completed','quality_test_run',p_run_id,'web',p_correlation_id);
end $$;

create or replace function public.reopen_quality_test_run_v1(p_org_id uuid,p_run_id uuid,p_reason text,p_correlation_id uuid default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if not public.can_quality_permission_v1(p_org_id,'execute_tests') then raise exception using errcode='42501',message='quality_run_reopen_denied'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception using errcode='22023',message='quality_run_reopen_reason_required'; end if;
 update public.quality_test_runs set status='in_progress',completed_at=null,updated_at=now() where id=p_run_id and organization_id=p_org_id and status='completed';
 if not found then raise exception using errcode='55000',message='quality_run_not_reopenable'; end if;
 insert into public.audit_log_events(organization_id,actor_user_id,action,target_type,target_id,source,correlation_id,metadata_json) values(p_org_id,auth.uid(),'quality.test_run.reopened','quality_test_run',p_run_id,'web',p_correlation_id,jsonb_build_object('reason',btrim(p_reason)));
end $$;

revoke all on function public.recalculate_quality_run_item_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.recalculate_quality_run_item_v1(uuid,uuid) to service_role;
revoke all on function public.start_quality_test_run_v1(uuid,uuid,uuid),public.update_quality_step_result_v1(uuid,uuid,text,text,uuid),public.add_quality_external_evidence_v1(uuid,uuid,uuid,text,text,text),public.complete_quality_test_run_v1(uuid,uuid,boolean,uuid),public.reopen_quality_test_run_v1(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.start_quality_test_run_v1(uuid,uuid,uuid),public.update_quality_step_result_v1(uuid,uuid,text,text,uuid),public.add_quality_external_evidence_v1(uuid,uuid,uuid,text,text,text),public.complete_quality_test_run_v1(uuid,uuid,boolean,uuid),public.reopen_quality_test_run_v1(uuid,uuid,text,uuid) to authenticated,service_role;
commit;
