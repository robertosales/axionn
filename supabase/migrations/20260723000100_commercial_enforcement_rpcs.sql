-- Fase 2.2: Add commercial enforcement to resource-creating RPCs
-- Adds assert_feature_access() calls after existing permission checks
-- Executar exclusivamente pelo Lovable
begin;

-- ============================================================
-- 1. ENFORCEMENT ON TEAM CREATION
-- ============================================================

create or replace function public.create_organization_team_v2(
  p_org_id uuid,
  p_name text,
  p_module text default 'sala_agil',
  p_company_id uuid default null,
  p_contract_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team_id uuid;
  v_module_id uuid;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  -- Commercial enforcement: check teams.max
  perform public.assert_feature_access(p_org_id, 'teams.max', 1);

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception using errcode = '23514', message = 'team_name_required';
  end if;

  -- Validate module
  select id into v_module_id
  from public.product_modules
  where code = p_module and status = 'active';
  if v_module_id is null then
    raise exception using errcode = 'P0002', message = 'invalid_module';
  end if;

  insert into public.teams (name, module, company_id, contract_id, org_id)
  values (trim(p_name), p_module, p_company_id, p_contract_id, p_org_id)
  returning id into v_team_id;

  insert into public.platform_operational_audit_log (actor_id, action, resource_type, resource_id, after_values)
  values (auth.uid(), 'team_created', 'team', v_team_id, jsonb_build_object('name', p_name, 'module', p_module));

  return v_team_id;
end $$;

-- ============================================================
-- 2. ENFORCEMENT ON PROJECT CREATION
-- ============================================================

create or replace function public.create_organization_project_v2(
  p_org_id uuid,
  p_contract_id uuid,
  p_name text,
  p_module_type text default 'agile',
  p_team_id uuid default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_id uuid;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  -- Commercial enforcement: check projects.max
  perform public.assert_feature_access(p_org_id, 'projects.max', 1);

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception using errcode = '23514', message = 'project_name_required';
  end if;

  -- Validate contract exists and belongs to org
  if not exists (
    select 1 from public.contracts
    where id = p_contract_id and org_id = p_org_id and status <> 'inactive'
  ) then
    raise exception using errcode = '42501', message = 'invalid_contract';
  end if;

  insert into public.projects (name, description, module_type, status, contract_id, team_id, org_id)
  values (trim(p_name), p_module_type, p_description, 'active', p_contract_id, p_team_id, p_org_id)
  returning id into v_project_id;

  insert into public.platform_operational_audit_log (actor_id, action, resource_type, resource_id, after_values)
  values (auth.uid(), 'project_created', 'project', v_project_id, jsonb_build_object('name', p_name, 'module_type', p_module_type));

  return v_project_id;
end $$;

-- ============================================================
-- 3. ENFORCEMENT ON CONTRACT CREATION
-- ============================================================

create or replace function public.save_organization_contract_v3(
  p_org_id uuid,
  p_contract_id uuid,
  p_name text,
  p_company_id uuid default null,
  p_status text default 'active',
  p_starts_at date default null,
  p_ends_at date default null,
  p_number text default null,
  p_object text default null,
  p_value_per_pfus numeric default null,
  p_currency text default 'BRL',
  p_team_ids uuid[] default '{}'::uuid[],
  p_project_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract_id uuid;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb;
  v_expected integer;
  v_actual integer;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  -- Commercial enforcement: check contracts.max (only for new contracts)
  if p_contract_id is null or not exists (
    select 1 from public.contracts where id = p_contract_id
  ) then
    perform public.assert_feature_access(p_org_id, 'contracts.max', 1);
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception using errcode = '23514', message = 'contract_name_required';
  end if;

  if p_company_id is not null and not exists (
    select 1
    from public.companies company
    where company.id = p_company_id
      and company.org_id = p_org_id
      and company.status::text <> 'inactive'
  ) then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  v_expected := coalesce(cardinality(p_team_ids), 0);
  select count(*)::integer into v_actual
  from public.teams team
  where team.id = any(coalesce(p_team_ids, '{}'::uuid[]))
    and team.org_id = p_org_id
    and coalesce(team.is_active, true);
  if v_actual <> v_expected then
    raise exception using errcode = '42501', message = 'invalid_team_ids';
  end if;

  v_expected := coalesce(cardinality(p_project_ids), 0);
  select count(*)::integer into v_actual
  from public.projects project
  where project.id = any(coalesce(p_project_ids, '{}'::uuid[]))
    and project.org_id = p_org_id;
  if v_actual <> v_expected then
    raise exception using errcode = '42501', message = 'invalid_project_ids';
  end if;

  -- Capture before state for updates
  if p_contract_id is not null then
    select to_jsonb(c.*) into v_before
    from public.contracts c where c.id = p_contract_id;
  end if;

  if p_contract_id is null then
    insert into public.contracts (
      name, status, company_id, org_id, starts_at, ends_at,
      contract_number, commercial_amount, currency
    ) values (
      trim(p_name), p_status::public.contract_status, p_company_id, p_org_id,
      p_starts_at, p_ends_at, p_number, p_value_per_pfus, p_currency
    ) returning id into v_contract_id;
  else
    update public.contracts set
      name = trim(p_name),
      status = p_status::public.contract_status,
      company_id = p_company_id,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      contract_number = p_number,
      commercial_amount = p_value_per_pfus,
      currency = p_currency
    where id = p_contract_id and org_id = p_org_id
    returning id into v_contract_id;
  end if;

  -- Link teams
  delete from public.contract_teams where contract_id = v_contract_id;
  insert into public.contract_teams (contract_id, team_id)
  select v_contract_id, unnest(p_team_ids);

  -- Capture after state
  select to_jsonb(c.*) into v_after
  from public.contracts c where c.id = v_contract_id;

  insert into public.platform_operational_audit_log (actor_id, action, resource_type, resource_id, before_values, after_values)
  values (auth.uid(), case when p_contract_id is null then 'contract_created' else 'contract_updated' end, 'contract', v_contract_id, v_before, v_after);

  return v_contract_id;
end $$;

-- ============================================================
-- 4. ENFORCEMENT ON MEMBER INVITATION (via existing RPC)
-- ============================================================

-- The invite_organization_member function already exists and handles validation.
-- We add a pre-check enforcement call in a wrapper.

create or replace function public.invite_organization_member_with_enforcement(
  p_org_id uuid,
  p_email text,
  p_role text default 'member',
  p_module_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid;
begin
  -- Commercial enforcement: check users.max
  perform public.assert_feature_access(p_org_id, 'users.max', 1);

  -- Delegate to existing invitation logic
  v_member_id := public.invite_organization_member(p_org_id, p_email, p_role, p_module_ids);
  return v_member_id;
end $$;

-- ============================================================
-- DONE
-- ============================================================

commit;
