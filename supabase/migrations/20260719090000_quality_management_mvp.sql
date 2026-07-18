-- Axionn Quality Intelligence - PR 1: fundacao aditiva e tenant-safe.
-- Executar exclusivamente pelo fluxo autorizado do Lovable apos preflight fisico.
begin;

create table if not exists public.quality_code_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code_type text not null check (code_type in ('test_case','finding')),
  next_value bigint not null default 1 check (next_value > 0),
  primary key (organization_id, code_type)
);

create table if not exists public.quality_test_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  code text not null,
  title text not null check (length(btrim(title)) between 1 and 300),
  objective text, preconditions text, postconditions text, test_data text,
  test_type text not null default 'functional' check (test_type in ('functional','regression','integration','api','security','accessibility','compatibility','usability','performance','uat','other')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status text not null default 'draft' check (status in ('draft','ready','approved','deprecated','archived')),
  execution_mode text not null default 'manual' check (execution_mode in ('manual','automated','hybrid')),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  tags text[] not null default '{}', source text not null default 'manual' check (source in ('manual','import','api')),
  current_version integer not null default 1 check (current_version > 0),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
  unique (organization_id, code)
);

create table if not exists public.quality_test_steps (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  test_case_id uuid not null references public.quality_test_cases(id) on delete cascade,
  step_order integer not null check (step_order > 0), action text not null check (length(btrim(action)) > 0),
  input_data text, expected_result text not null check (length(btrim(expected_result)) > 0), reference_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(test_case_id,step_order)
);

create table if not exists public.quality_test_case_links (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  test_case_id uuid not null references public.quality_test_cases(id) on delete cascade,
  entity_type text not null check (entity_type in ('user_story','acceptance_criterion','release','epic')),
  entity_id uuid not null, entity_reference text, link_metadata jsonb not null default '{}',
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), unique(organization_id,test_case_id,entity_type,entity_id,entity_reference)
);

create table if not exists public.quality_test_case_versions (
  id uuid primary key default gen_random_uuid(), test_case_id uuid not null references public.quality_test_cases(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade, version integer not null check(version>0),
  snapshot jsonb not null, change_summary text, created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), unique(test_case_id,version)
);

create table if not exists public.quality_test_suites (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null, project_id uuid references public.projects(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null, parent_suite_id uuid references public.quality_test_suites(id) on delete set null,
  name text not null check(length(btrim(name)) between 1 and 300), description text, sort_order integer not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.quality_test_suite_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  suite_id uuid not null references public.quality_test_suites(id) on delete cascade,
  test_case_id uuid not null references public.quality_test_cases(id) on delete cascade,
  sort_order integer not null default 0, created_at timestamptz not null default now(), unique(suite_id,test_case_id)
);

create table if not exists public.quality_test_plans (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null, project_id uuid references public.projects(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null, name text not null check(length(btrim(name)) between 1 and 300),
  description text, status text not null default 'draft' check(status in ('draft','ready','archived')),
  release_id uuid references public.releases(id) on delete set null, sprint_id uuid references public.sprints(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.quality_test_plan_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  test_plan_id uuid not null references public.quality_test_plans(id) on delete cascade,
  test_case_id uuid not null references public.quality_test_cases(id) on delete cascade, test_case_version integer not null check(test_case_version>0),
  sort_order integer not null default 0, is_required boolean not null default true, created_at timestamptz not null default now(),
  unique(test_plan_id,test_case_id)
);

create table if not exists public.quality_test_runs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null, project_id uuid references public.projects(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null, test_plan_id uuid references public.quality_test_plans(id) on delete set null,
  name text not null check(length(btrim(name)) between 1 and 300), description text,
  status text not null default 'draft' check(status in ('draft','planned','in_progress','completed','cancelled')),
  environment_name text, configuration jsonb not null default '{}', build_reference text, commit_sha text, pipeline_reference text,
  release_id uuid references public.releases(id) on delete set null, started_at timestamptz, completed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.quality_test_run_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  test_run_id uuid not null references public.quality_test_runs(id) on delete cascade,
  test_case_id uuid references public.quality_test_cases(id) on delete set null, test_case_version integer not null,
  test_case_snapshot jsonb not null, status text not null default 'not_run' check(status in ('not_run','in_progress','passed','failed','blocked','skipped','invalid','retest')),
  assigned_to uuid references auth.users(id) on delete set null, executed_by uuid references auth.users(id) on delete set null,
  started_at timestamptz, completed_at timestamptz, actual_result text, notes text, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.quality_test_step_results (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  run_item_id uuid not null references public.quality_test_run_items(id) on delete cascade, step_id uuid,
  step_order integer not null check(step_order>0), step_snapshot jsonb not null,
  status text not null default 'not_run' check(status in ('not_run','in_progress','passed','failed','blocked','skipped','invalid','retest')),
  actual_result text, executed_by uuid references auth.users(id) on delete set null, executed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(run_item_id,step_order)
);

create table if not exists public.quality_findings (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null, project_id uuid references public.projects(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null, code text not null, title text not null check(length(btrim(title)) between 1 and 300),
  description text, expected_result text, actual_result text, severity text not null default 'medium' check(severity in ('low','medium','high','critical')),
  status text not null default 'open' check(status in ('open','triaged','in_progress','resolved','closed','rejected')),
  test_run_id uuid references public.quality_test_runs(id) on delete set null,
  run_item_id uuid references public.quality_test_run_items(id) on delete set null,
  step_result_id uuid references public.quality_test_step_results(id) on delete set null,
  user_story_id uuid references public.user_stories(id) on delete set null,
  external_provider text, external_issue_id text, external_issue_url text,
  reported_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  assigned_to uuid references auth.users(id) on delete set null, resolved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,code)
);

create table if not exists public.quality_test_evidences (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  run_item_id uuid references public.quality_test_run_items(id) on delete cascade,
  step_result_id uuid references public.quality_test_step_results(id) on delete cascade,
  finding_id uuid references public.quality_findings(id) on delete cascade,
  evidence_type text not null check(evidence_type in ('external_url','storage')),
  title text not null check(length(btrim(title))>0), description text, storage_bucket text, storage_path text, external_url text,
  mime_type text, file_size_bytes bigint check(file_size_bytes is null or file_size_bytes>=0),
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete restrict, created_at timestamptz not null default now(),
  check(storage_path is not null or external_url is not null)
);

create index if not exists idx_quality_cases_org_status on public.quality_test_cases(organization_id,status,updated_at desc);
create index if not exists idx_quality_cases_org_project on public.quality_test_cases(organization_id,project_id);
create index if not exists idx_quality_cases_org_team on public.quality_test_cases(organization_id,team_id);
create index if not exists idx_quality_cases_tags on public.quality_test_cases using gin(tags);
create index if not exists idx_quality_links_entity on public.quality_test_case_links(organization_id,entity_type,entity_id);
create index if not exists idx_quality_plans_org_status on public.quality_test_plans(organization_id,status,updated_at desc);
create index if not exists idx_quality_runs_org_status on public.quality_test_runs(organization_id,status,updated_at desc);
create index if not exists idx_quality_findings_org_status on public.quality_findings(organization_id,status,created_at desc);

create or replace function public.can_manage_quality(p_org_id uuid, p_user_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(public.is_platform_admin(p_user_id),false)
 or coalesce(public.is_organization_admin(p_org_id,p_user_id),false)
 or exists(select 1 from public.organization_member_modules m join public.organization_members om using(org_id,user_id)
   where m.org_id=p_org_id and m.user_id=p_user_id and m.module_key='sala_agil' and m.role_name='admin' and om.is_active)
$$;

create or replace function public.assert_quality_scope(p_org_id uuid,p_contract_id uuid,p_project_id uuid,p_team_id uuid) returns void
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if p_contract_id is not null and public.resolve_contract_org_id(p_contract_id) is distinct from p_org_id then raise exception using errcode='23514',message='quality_contract_tenant_mismatch'; end if;
 if p_project_id is not null and public.resolve_project_org_id(p_project_id) is distinct from p_org_id then raise exception using errcode='23514',message='quality_project_tenant_mismatch'; end if;
 if p_team_id is not null and public.resolve_team_org_id(p_team_id) is distinct from p_org_id then raise exception using errcode='23514',message='quality_team_tenant_mismatch'; end if;
end $$;

create or replace function public.next_quality_code_v1(p_org_id uuid,p_code_type text) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_value bigint; v_prefix text;
begin
 if p_code_type not in ('test_case','finding') then raise exception using errcode='22023',message='quality_code_type_invalid'; end if;
 insert into public.quality_code_counters(organization_id,code_type,next_value) values(p_org_id,p_code_type,2)
 on conflict(organization_id,code_type) do update set next_value=quality_code_counters.next_value+1
 returning next_value-1 into v_value;
 v_prefix:=case p_code_type when 'test_case' then 'CT' else 'QA' end;
 return v_prefix||'-'||lpad(v_value::text,6,'0');
end $$;

create or replace function public.quality_case_snapshot(p_case_id uuid) returns jsonb
language sql volatile security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('schema_version',1,'captured_at',now(),'case',to_jsonb(c)-'updated_by','steps',coalesce((select jsonb_agg(to_jsonb(s) order by s.step_order) from public.quality_test_steps s where s.test_case_id=c.id),'[]'::jsonb),'links',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at) from public.quality_test_case_links l where l.test_case_id=c.id),'[]'::jsonb)) from public.quality_test_cases c where c.id=p_case_id
$$;

create or replace function public.create_quality_test_case_v1(p_org_id uuid,p_payload jsonb,p_correlation_id uuid default null) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_step jsonb; v_order int:=0; v_code text;
begin
 if not public.can_quality_permission_v1(p_org_id,'manage_test_cases') then raise exception using errcode='42501',message='quality_case_create_denied'; end if;
 perform public.assert_quality_scope(p_org_id,(p_payload->>'contract_id')::uuid,(p_payload->>'project_id')::uuid,(p_payload->>'team_id')::uuid);
 if nullif(btrim(p_payload->>'title'),'') is null or jsonb_typeof(p_payload->'steps')<>'array' or jsonb_array_length(p_payload->'steps')=0 then raise exception using errcode='22023',message='quality_case_payload_invalid'; end if;
 v_code:=public.next_quality_code_v1(p_org_id,'test_case');
 insert into public.quality_test_cases(organization_id,contract_id,project_id,team_id,code,title,objective,preconditions,postconditions,test_data,test_type,priority,severity,status,execution_mode,estimated_minutes,tags,created_by)
 values(p_org_id,(p_payload->>'contract_id')::uuid,(p_payload->>'project_id')::uuid,(p_payload->>'team_id')::uuid,v_code,btrim(p_payload->>'title'),p_payload->>'objective',p_payload->>'preconditions',p_payload->>'postconditions',p_payload->>'test_data',coalesce(p_payload->>'test_type','functional'),coalesce(p_payload->>'priority','medium'),coalesce(p_payload->>'severity','medium'),coalesce(p_payload->>'status','draft'),coalesce(p_payload->>'execution_mode','manual'),(p_payload->>'estimated_minutes')::integer,coalesce(array(select jsonb_array_elements_text(p_payload->'tags')),'{}'),auth.uid()) returning id into v_id;
 for v_step in select * from jsonb_array_elements(p_payload->'steps') loop v_order:=v_order+1;
  if nullif(btrim(v_step->>'action'),'') is null or nullif(btrim(v_step->>'expected_result'),'') is null then raise exception using errcode='22023',message='quality_step_payload_invalid'; end if;
  insert into public.quality_test_steps(organization_id,test_case_id,step_order,action,input_data,expected_result,reference_url) values(p_org_id,v_id,v_order,btrim(v_step->>'action'),v_step->>'input_data',btrim(v_step->>'expected_result'),v_step->>'reference_url');
 end loop;
 insert into public.quality_test_case_versions(test_case_id,organization_id,version,snapshot,change_summary,created_by) values(v_id,p_org_id,1,public.quality_case_snapshot(v_id),'Initial version',auth.uid());
 insert into public.audit_log_events(organization_id,actor_user_id,action,target_type,target_id,source,correlation_id,metadata_json) values(p_org_id,auth.uid(),'quality.test_case.created','quality_test_case',v_id,'web',p_correlation_id,jsonb_build_object('code',v_code));
 return v_id;
end $$;

create or replace function public.update_quality_test_case_v1(p_org_id uuid,p_case_id uuid,p_payload jsonb,p_change_summary text default null,p_correlation_id uuid default null) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_case public.quality_test_cases%rowtype; v_step jsonb; v_order int:=0; v_version int;
begin
 if not public.can_quality_permission_v1(p_org_id,'manage_test_cases') then raise exception using errcode='42501',message='quality_case_update_denied'; end if;
 select * into v_case from public.quality_test_cases where id=p_case_id and organization_id=p_org_id for update;
 if v_case.id is null then raise exception using errcode='42501',message='quality_case_not_found'; end if;
 perform public.assert_quality_scope(p_org_id,coalesce((p_payload->>'contract_id')::uuid,v_case.contract_id),coalesce((p_payload->>'project_id')::uuid,v_case.project_id),coalesce((p_payload->>'team_id')::uuid,v_case.team_id));
 if nullif(btrim(p_payload->>'title'),'') is null or jsonb_typeof(p_payload->'steps')<>'array' or jsonb_array_length(p_payload->'steps')=0 then raise exception using errcode='22023',message='quality_case_payload_invalid'; end if;
 v_version:=v_case.current_version+1;
 update public.quality_test_cases set contract_id=(p_payload->>'contract_id')::uuid,project_id=(p_payload->>'project_id')::uuid,team_id=(p_payload->>'team_id')::uuid,title=btrim(p_payload->>'title'),objective=p_payload->>'objective',preconditions=p_payload->>'preconditions',postconditions=p_payload->>'postconditions',test_data=p_payload->>'test_data',test_type=coalesce(p_payload->>'test_type',test_type),priority=coalesce(p_payload->>'priority',priority),severity=coalesce(p_payload->>'severity',severity),status=coalesce(p_payload->>'status',status),execution_mode=coalesce(p_payload->>'execution_mode',execution_mode),estimated_minutes=(p_payload->>'estimated_minutes')::integer,tags=coalesce(array(select jsonb_array_elements_text(p_payload->'tags')),'{}'),current_version=v_version,updated_by=auth.uid(),updated_at=now() where id=p_case_id;
 delete from public.quality_test_steps where test_case_id=p_case_id;
 for v_step in select * from jsonb_array_elements(p_payload->'steps') loop v_order:=v_order+1;
  if nullif(btrim(v_step->>'action'),'') is null or nullif(btrim(v_step->>'expected_result'),'') is null then raise exception using errcode='22023',message='quality_step_payload_invalid'; end if;
  insert into public.quality_test_steps(organization_id,test_case_id,step_order,action,input_data,expected_result,reference_url) values(p_org_id,p_case_id,v_order,btrim(v_step->>'action'),v_step->>'input_data',btrim(v_step->>'expected_result'),v_step->>'reference_url');
 end loop;
 insert into public.quality_test_case_versions(test_case_id,organization_id,version,snapshot,change_summary,created_by) values(p_case_id,p_org_id,v_version,public.quality_case_snapshot(p_case_id),nullif(btrim(p_change_summary),''),auth.uid());
 insert into public.audit_log_events(organization_id,actor_user_id,action,target_type,target_id,source,correlation_id,metadata_json) values(p_org_id,auth.uid(),'quality.test_case.updated','quality_test_case',p_case_id,'web',p_correlation_id,jsonb_build_object('version',v_version));
 return v_version;
end $$;

create or replace function public.archive_quality_test_case_v1(p_org_id uuid,p_case_id uuid,p_correlation_id uuid default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.can_quality_permission_v1(p_org_id,'manage_test_cases') then raise exception using errcode='42501',message='quality_case_archive_denied'; end if;
 update public.quality_test_cases set status='archived',archived_at=now(),updated_by=auth.uid(),updated_at=now() where id=p_case_id and organization_id=p_org_id and status<>'archived';
 if not found then raise exception using errcode='42501',message='quality_case_not_found'; end if;
 insert into public.audit_log_events(organization_id,actor_user_id,action,target_type,target_id,source,correlation_id) values(p_org_id,auth.uid(),'quality.test_case.archived','quality_test_case',p_case_id,'web',p_correlation_id);
end $$;

create or replace function public.link_quality_test_case_v1(p_org_id uuid,p_case_id uuid,p_entity_type text,p_entity_id uuid,p_entity_reference text default null,p_metadata jsonb default '{}',p_correlation_id uuid default null) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_team uuid;
begin
 if not public.can_quality_permission_v1(p_org_id,'manage_test_cases') then raise exception using errcode='42501',message='quality_link_denied'; end if;
 if not exists(select 1 from public.quality_test_cases where id=p_case_id and organization_id=p_org_id) then raise exception using errcode='42501',message='quality_case_not_found'; end if;
 if p_entity_type in ('user_story','acceptance_criterion') then select team_id into v_team from public.user_stories where id=p_entity_id; if v_team is null or public.resolve_team_org_id(v_team) is distinct from p_org_id then raise exception using errcode='23514',message='quality_link_tenant_mismatch'; end if;
 elsif p_entity_type='release' then select team_id into v_team from public.releases where id=p_entity_id; if v_team is null or public.resolve_team_org_id(v_team) is distinct from p_org_id then raise exception using errcode='23514',message='quality_link_tenant_mismatch'; end if;
 elsif p_entity_type='epic' then select team_id into v_team from public.epics where id=p_entity_id; if v_team is null or public.resolve_team_org_id(v_team) is distinct from p_org_id then raise exception using errcode='23514',message='quality_link_tenant_mismatch'; end if;
 else raise exception using errcode='22023',message='quality_link_type_invalid'; end if;
 insert into public.quality_test_case_links(organization_id,test_case_id,entity_type,entity_id,entity_reference,link_metadata,created_by) values(p_org_id,p_case_id,p_entity_type,p_entity_id,p_entity_reference,coalesce(p_metadata,'{}'),auth.uid()) returning id into v_id;
 return v_id;
end $$;

create or replace function public.create_quality_test_run_from_plan_v1(p_org_id uuid,p_plan_id uuid,p_name text,p_environment_name text default null,p_build_reference text default null,p_commit_sha text default null,p_correlation_id uuid default null) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_plan public.quality_test_plans%rowtype; v_run_id uuid; v_item record; v_run_item_id uuid; v_step jsonb;
begin
 if not public.can_quality_permission_v1(p_org_id,'execute_tests') then raise exception using errcode='42501',message='quality_run_create_denied'; end if;
 select * into v_plan from public.quality_test_plans where id=p_plan_id and organization_id=p_org_id;
 if v_plan.id is null then raise exception using errcode='42501',message='quality_plan_not_found'; end if;
 if nullif(btrim(p_name),'') is null then raise exception using errcode='22023',message='quality_run_name_required'; end if;
 insert into public.quality_test_runs(organization_id,contract_id,project_id,team_id,test_plan_id,name,status,environment_name,build_reference,commit_sha,release_id,created_by)
 values(p_org_id,v_plan.contract_id,v_plan.project_id,v_plan.team_id,v_plan.id,btrim(p_name),'planned',p_environment_name,p_build_reference,p_commit_sha,v_plan.release_id,auth.uid()) returning id into v_run_id;
 for v_item in
  select pi.*,v.snapshot from public.quality_test_plan_items pi join public.quality_test_case_versions v on v.test_case_id=pi.test_case_id and v.version=pi.test_case_version
  where pi.test_plan_id=p_plan_id and pi.organization_id=p_org_id order by pi.sort_order,pi.created_at
 loop
  insert into public.quality_test_run_items(organization_id,test_run_id,test_case_id,test_case_version,test_case_snapshot,sort_order)
  values(p_org_id,v_run_id,v_item.test_case_id,v_item.test_case_version,v_item.snapshot,v_item.sort_order) returning id into v_run_item_id;
  for v_step in select * from jsonb_array_elements(coalesce(v_item.snapshot->'steps','[]'::jsonb)) loop
   insert into public.quality_test_step_results(organization_id,run_item_id,step_id,step_order,step_snapshot)
   values(p_org_id,v_run_item_id,(v_step->>'id')::uuid,(v_step->>'step_order')::integer,v_step);
  end loop;
 end loop;
 insert into public.audit_log_events(organization_id,actor_user_id,action,target_type,target_id,source,correlation_id,metadata_json)
 values(p_org_id,auth.uid(),'quality.test_run.created','quality_test_run',v_run_id,'web',p_correlation_id,jsonb_build_object('plan_id',p_plan_id));
 return v_run_id;
end $$;

create or replace function public.prevent_quality_snapshot_mutation() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin raise exception using errcode='55000',message='quality_snapshot_immutable'; end $$;
drop trigger if exists trg_quality_versions_immutable on public.quality_test_case_versions;
create trigger trg_quality_versions_immutable before update or delete on public.quality_test_case_versions for each row execute function public.prevent_quality_snapshot_mutation();
create or replace function public.prevent_completed_run_snapshot_mutation() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin if old.test_case_snapshot is distinct from new.test_case_snapshot then raise exception using errcode='55000',message='quality_run_snapshot_immutable'; end if; return new; end $$;
drop trigger if exists trg_quality_run_snapshot_immutable on public.quality_test_run_items;
create trigger trg_quality_run_snapshot_immutable before update on public.quality_test_run_items for each row execute function public.prevent_completed_run_snapshot_mutation();

do $$ declare t text; begin foreach t in array array['quality_test_cases','quality_test_steps','quality_test_suites','quality_test_plans','quality_test_runs','quality_test_run_items','quality_test_step_results','quality_findings'] loop execute format('drop trigger if exists %I on public.%I','trg_'||t||'_updated_at',t); execute format('create trigger %I before update on public.%I for each row execute function public.update_updated_at_column()','trg_'||t||'_updated_at',t); end loop; end $$;

do $$ declare t text; begin foreach t in array array['quality_test_cases','quality_test_steps','quality_test_case_links','quality_test_case_versions','quality_test_suites','quality_test_suite_items','quality_test_plans','quality_test_plan_items','quality_test_runs','quality_test_run_items','quality_test_step_results','quality_test_evidences','quality_findings'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from public,anon,authenticated',t); execute format('grant all on public.%I to service_role',t); execute format('grant select on public.%I to authenticated',t); execute format('drop policy if exists %I on public.%I','quality_tenant_select_'||t,t); execute format('create policy %I on public.%I for select to authenticated using(public.is_organization_member(organization_id,auth.uid()))','quality_tenant_select_'||t,t); end loop; end $$;
alter table public.quality_code_counters enable row level security; revoke all on public.quality_code_counters from public,anon,authenticated; grant all on public.quality_code_counters to service_role;

revoke all on function public.can_manage_quality(uuid,uuid),public.assert_quality_scope(uuid,uuid,uuid,uuid),public.next_quality_code_v1(uuid,text),public.quality_case_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.can_manage_quality(uuid,uuid) to authenticated,service_role;
grant execute on function public.assert_quality_scope(uuid,uuid,uuid,uuid),public.next_quality_code_v1(uuid,text),public.quality_case_snapshot(uuid) to service_role;
revoke all on function public.create_quality_test_case_v1(uuid,jsonb,uuid),public.update_quality_test_case_v1(uuid,uuid,jsonb,text,uuid),public.archive_quality_test_case_v1(uuid,uuid,uuid),public.link_quality_test_case_v1(uuid,uuid,text,uuid,text,jsonb,uuid),public.create_quality_test_run_from_plan_v1(uuid,uuid,text,text,text,text,uuid) from public,anon;
grant execute on function public.create_quality_test_case_v1(uuid,jsonb,uuid),public.update_quality_test_case_v1(uuid,uuid,jsonb,text,uuid),public.archive_quality_test_case_v1(uuid,uuid,uuid),public.link_quality_test_case_v1(uuid,uuid,text,uuid,text,jsonb,uuid),public.create_quality_test_run_from_plan_v1(uuid,uuid,text,text,text,text,uuid) to authenticated,service_role;

comment on table public.quality_test_case_versions is 'Snapshots imutaveis das definicoes de casos de teste.';
comment on table public.quality_test_run_items is 'Snapshot executavel, independente de alteracoes futuras no caso original.';
comment on function public.can_manage_quality(uuid,uuid) is 'Autoridade inicial: platform admin, organization admin ou admin da Sala Agil.';
commit;
