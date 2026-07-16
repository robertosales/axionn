-- Axionn Quality Intelligence - PR 3: planos, itens versionados e criacao de execucao.
-- Aplicar exclusivamente pelo fluxo autorizado do Lovable.
begin;

create or replace function public.create_quality_test_plan_v1(p_org_id uuid,p_payload jsonb,p_correlation_id uuid default null) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if not public.can_manage_quality(p_org_id) then raise exception using errcode='42501',message='quality_plan_create_denied'; end if;
 perform public.assert_quality_scope(p_org_id,(p_payload->>'contract_id')::uuid,(p_payload->>'project_id')::uuid,(p_payload->>'team_id')::uuid);
 if nullif(btrim(p_payload->>'name'),'') is null then raise exception using errcode='22023',message='quality_plan_name_required'; end if;
 if (p_payload->>'sprint_id') is not null and not exists(select 1 from public.sprints s where s.id=(p_payload->>'sprint_id')::uuid and public.resolve_team_org_id(s.team_id)=p_org_id) then raise exception using errcode='23514',message='quality_plan_sprint_tenant_mismatch'; end if;
 if (p_payload->>'release_id') is not null and not exists(select 1 from public.releases r where r.id=(p_payload->>'release_id')::uuid and public.resolve_team_org_id(r.team_id)=p_org_id) then raise exception using errcode='23514',message='quality_plan_release_tenant_mismatch'; end if;
 insert into public.quality_test_plans(organization_id,contract_id,project_id,team_id,name,description,status,release_id,sprint_id,created_by)
 values(p_org_id,(p_payload->>'contract_id')::uuid,(p_payload->>'project_id')::uuid,(p_payload->>'team_id')::uuid,btrim(p_payload->>'name'),nullif(btrim(p_payload->>'description'),''),coalesce(p_payload->>'status','draft'),(p_payload->>'release_id')::uuid,(p_payload->>'sprint_id')::uuid,auth.uid()) returning id into v_id;
 insert into public.audit_log_events(organization_id,actor_user_id,action,target_type,target_id,source,correlation_id) values(p_org_id,auth.uid(),'quality.test_plan.created','quality_test_plan',v_id,'web',p_correlation_id);
 return v_id;
end $$;

create or replace function public.update_quality_test_plan_v1(p_org_id uuid,p_plan_id uuid,p_payload jsonb,p_correlation_id uuid default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.can_manage_quality(p_org_id) then raise exception using errcode='42501',message='quality_plan_update_denied'; end if;
 perform public.assert_quality_scope(p_org_id,(p_payload->>'contract_id')::uuid,(p_payload->>'project_id')::uuid,(p_payload->>'team_id')::uuid);
 if nullif(btrim(p_payload->>'name'),'') is null then raise exception using errcode='22023',message='quality_plan_name_required'; end if;
 update public.quality_test_plans set contract_id=(p_payload->>'contract_id')::uuid,project_id=(p_payload->>'project_id')::uuid,team_id=(p_payload->>'team_id')::uuid,name=btrim(p_payload->>'name'),description=nullif(btrim(p_payload->>'description'),''),status=coalesce(p_payload->>'status',status),release_id=(p_payload->>'release_id')::uuid,sprint_id=(p_payload->>'sprint_id')::uuid,updated_at=now() where id=p_plan_id and organization_id=p_org_id;
 if not found then raise exception using errcode='42501',message='quality_plan_not_found'; end if;
 insert into public.audit_log_events(organization_id,actor_user_id,action,target_type,target_id,source,correlation_id) values(p_org_id,auth.uid(),'quality.test_plan.updated','quality_test_plan',p_plan_id,'web',p_correlation_id);
end $$;

create or replace function public.add_quality_test_plan_item_v1(p_org_id uuid,p_plan_id uuid,p_case_id uuid,p_case_version integer default null,p_is_required boolean default true) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_version integer;
begin
 if not public.can_manage_quality(p_org_id) then raise exception using errcode='42501',message='quality_plan_item_denied'; end if;
 if not exists(select 1 from public.quality_test_plans where id=p_plan_id and organization_id=p_org_id) then raise exception using errcode='23514',message='quality_plan_tenant_mismatch'; end if;
 select coalesce(p_case_version,c.current_version) into v_version from public.quality_test_cases c where c.id=p_case_id and c.organization_id=p_org_id and c.status<>'archived';
 if v_version is null or not exists(select 1 from public.quality_test_case_versions v where v.test_case_id=p_case_id and v.organization_id=p_org_id and v.version=v_version) then raise exception using errcode='23514',message='quality_case_version_invalid'; end if;
 insert into public.quality_test_plan_items(organization_id,test_plan_id,test_case_id,test_case_version,sort_order,is_required)
 values(p_org_id,p_plan_id,p_case_id,v_version,coalesce((select max(sort_order)+1 from public.quality_test_plan_items where test_plan_id=p_plan_id),0),p_is_required)
 on conflict(test_plan_id,test_case_id) do update set test_case_version=excluded.test_case_version,is_required=excluded.is_required returning id into v_id;
 return v_id;
end $$;

create or replace function public.remove_quality_test_plan_item_v1(p_org_id uuid,p_plan_id uuid,p_case_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if not public.can_manage_quality(p_org_id) then raise exception using errcode='42501',message='quality_plan_item_denied'; end if;
 delete from public.quality_test_plan_items where organization_id=p_org_id and test_plan_id=p_plan_id and test_case_id=p_case_id;
end $$;

create or replace function public.reorder_quality_test_plan_items_v1(p_org_id uuid,p_plan_id uuid,p_case_ids uuid[]) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_count integer;
begin
 if not public.can_manage_quality(p_org_id) then raise exception using errcode='42501',message='quality_plan_item_denied'; end if;
 select count(*) into v_count from public.quality_test_plan_items where organization_id=p_org_id and test_plan_id=p_plan_id;
 if cardinality(p_case_ids)<>v_count or (select count(distinct x) from unnest(p_case_ids) x)<>v_count then raise exception using errcode='22023',message='quality_plan_order_invalid'; end if;
 if exists(select 1 from unnest(p_case_ids) x where not exists(select 1 from public.quality_test_plan_items i where i.organization_id=p_org_id and i.test_plan_id=p_plan_id and i.test_case_id=x)) then raise exception using errcode='23514',message='quality_plan_order_tenant_mismatch'; end if;
 update public.quality_test_plan_items i set sort_order=o.ordinality-1 from unnest(p_case_ids) with ordinality o(case_id,ordinality) where i.organization_id=p_org_id and i.test_plan_id=p_plan_id and i.test_case_id=o.case_id;
end $$;

create or replace function public.create_quality_test_run_from_plan_v1(p_org_id uuid,p_plan_id uuid,p_name text,p_environment_name text default null,p_build_reference text default null,p_commit_sha text default null,p_correlation_id uuid default null) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_plan public.quality_test_plans%rowtype; v_run_id uuid; v_item record; v_run_item_id uuid; v_step jsonb; v_count integer:=0;
begin
 if not public.can_manage_quality(p_org_id) then raise exception using errcode='42501',message='quality_run_create_denied'; end if;
 select * into v_plan from public.quality_test_plans where id=p_plan_id and organization_id=p_org_id;
 if v_plan.id is null then raise exception using errcode='42501',message='quality_plan_not_found'; end if;
 if nullif(btrim(p_name),'') is null then raise exception using errcode='22023',message='quality_run_name_required'; end if;
 select count(*) into v_count from public.quality_test_plan_items where test_plan_id=p_plan_id and organization_id=p_org_id;
 if v_count=0 then raise exception using errcode='22023',message='quality_plan_empty'; end if;
 insert into public.quality_test_runs(organization_id,contract_id,project_id,team_id,test_plan_id,name,status,environment_name,build_reference,commit_sha,release_id,created_by)
 values(p_org_id,v_plan.contract_id,v_plan.project_id,v_plan.team_id,v_plan.id,btrim(p_name),'planned',p_environment_name,p_build_reference,p_commit_sha,v_plan.release_id,auth.uid()) returning id into v_run_id;
 for v_item in select pi.*,v.snapshot from public.quality_test_plan_items pi join public.quality_test_case_versions v on v.test_case_id=pi.test_case_id and v.version=pi.test_case_version and v.organization_id=p_org_id where pi.test_plan_id=p_plan_id and pi.organization_id=p_org_id order by pi.sort_order,pi.created_at loop
  insert into public.quality_test_run_items(organization_id,test_run_id,test_case_id,test_case_version,test_case_snapshot,sort_order) values(p_org_id,v_run_id,v_item.test_case_id,v_item.test_case_version,v_item.snapshot,v_item.sort_order) returning id into v_run_item_id;
  for v_step in select * from jsonb_array_elements(coalesce(v_item.snapshot->'steps','[]'::jsonb)) loop insert into public.quality_test_step_results(organization_id,run_item_id,step_id,step_order,step_snapshot) values(p_org_id,v_run_item_id,(v_step->>'id')::uuid,(v_step->>'step_order')::integer,v_step); end loop;
 end loop;
 if (select count(*) from public.quality_test_run_items where test_run_id=v_run_id)<>v_count then raise exception using errcode='23514',message='quality_plan_version_snapshot_missing'; end if;
 insert into public.audit_log_events(organization_id,actor_user_id,action,target_type,target_id,source,correlation_id,metadata_json) values(p_org_id,auth.uid(),'quality.test_run.created','quality_test_run',v_run_id,'web',p_correlation_id,jsonb_build_object('plan_id',p_plan_id,'item_count',v_count));
 return v_run_id;
end $$;

revoke all on function public.create_quality_test_plan_v1(uuid,jsonb,uuid),public.update_quality_test_plan_v1(uuid,uuid,jsonb,uuid),public.add_quality_test_plan_item_v1(uuid,uuid,uuid,integer,boolean),public.remove_quality_test_plan_item_v1(uuid,uuid,uuid),public.reorder_quality_test_plan_items_v1(uuid,uuid,uuid[]) from public,anon;
grant execute on function public.create_quality_test_plan_v1(uuid,jsonb,uuid),public.update_quality_test_plan_v1(uuid,uuid,jsonb,uuid),public.add_quality_test_plan_item_v1(uuid,uuid,uuid,integer,boolean),public.remove_quality_test_plan_item_v1(uuid,uuid,uuid),public.reorder_quality_test_plan_items_v1(uuid,uuid,uuid[]) to authenticated,service_role;
commit;
