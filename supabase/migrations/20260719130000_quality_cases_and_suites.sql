-- Axionn Quality Intelligence - PR 2: operacoes de casos, suites e vinculos.
-- Aplicar exclusivamente pelo fluxo autorizado do Lovable.
begin;

create or replace function public.unlink_quality_test_case_v1(p_org_id uuid,p_link_id uuid,p_correlation_id uuid default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_case_id uuid;
begin
 if not public.can_quality_permission_v1(p_org_id,'manage_test_cases') then raise exception using errcode='42501',message='quality_unlink_denied'; end if;
 delete from public.quality_test_case_links where id=p_link_id and organization_id=p_org_id returning test_case_id into v_case_id;
 if v_case_id is null then raise exception using errcode='42501',message='quality_link_not_found'; end if;
 insert into public.audit_log_events(organization_id,actor_user_id,action,target_type,target_id,source,correlation_id)
 values(p_org_id,auth.uid(),'quality.test_case.unlinked','quality_test_case',v_case_id,'web',p_correlation_id);
end $$;

create or replace function public.create_quality_test_suite_v1(p_org_id uuid,p_name text,p_description text default null,p_parent_suite_id uuid default null) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if not public.can_quality_permission_v1(p_org_id,'manage_test_suites') then raise exception using errcode='42501',message='quality_suite_create_denied'; end if;
 if nullif(btrim(p_name),'') is null then raise exception using errcode='22023',message='quality_suite_name_required'; end if;
 if p_parent_suite_id is not null and not exists(select 1 from public.quality_test_suites where id=p_parent_suite_id and organization_id=p_org_id) then raise exception using errcode='23514',message='quality_parent_suite_tenant_mismatch'; end if;
 insert into public.quality_test_suites(organization_id,parent_suite_id,name,description,created_by)
 values(p_org_id,p_parent_suite_id,btrim(p_name),nullif(btrim(p_description),''),auth.uid()) returning id into v_id;
 return v_id;
end $$;

create or replace function public.add_quality_test_suite_item_v1(p_org_id uuid,p_suite_id uuid,p_case_id uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if not public.can_quality_permission_v1(p_org_id,'manage_test_suites') then raise exception using errcode='42501',message='quality_suite_item_denied'; end if;
 if not exists(select 1 from public.quality_test_suites where id=p_suite_id and organization_id=p_org_id)
 or not exists(select 1 from public.quality_test_cases where id=p_case_id and organization_id=p_org_id) then
  raise exception using errcode='23514',message='quality_suite_item_tenant_mismatch';
 end if;
 insert into public.quality_test_suite_items(organization_id,suite_id,test_case_id)
 values(p_org_id,p_suite_id,p_case_id) on conflict(suite_id,test_case_id) do update set sort_order=quality_test_suite_items.sort_order returning id into v_id;
 return v_id;
end $$;

create or replace function public.remove_quality_test_suite_item_v1(p_org_id uuid,p_suite_id uuid,p_case_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.can_quality_permission_v1(p_org_id,'manage_test_suites') then raise exception using errcode='42501',message='quality_suite_item_denied'; end if;
 delete from public.quality_test_suite_items where organization_id=p_org_id and suite_id=p_suite_id and test_case_id=p_case_id;
end $$;

revoke all on function public.unlink_quality_test_case_v1(uuid,uuid,uuid),public.create_quality_test_suite_v1(uuid,text,text,uuid),public.add_quality_test_suite_item_v1(uuid,uuid,uuid),public.remove_quality_test_suite_item_v1(uuid,uuid,uuid) from public,anon;
grant execute on function public.unlink_quality_test_case_v1(uuid,uuid,uuid),public.create_quality_test_suite_v1(uuid,text,text,uuid),public.add_quality_test_suite_item_v1(uuid,uuid,uuid),public.remove_quality_test_suite_item_v1(uuid,uuid,uuid) to authenticated,service_role;
commit;
