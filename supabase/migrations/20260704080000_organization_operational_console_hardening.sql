-- Axion SaaS - Fase 2B hardening do console operacional.
-- Fecha mutations diretas de contratos, projetos e times no modo tenant-scoped.

alter table public.teams
  add column if not exists is_active boolean not null default true;

create index if not exists idx_teams_org_active_name
  on public.teams(org_id, is_active, name);

create or replace function public.get_accessible_teams_v2(p_org_id uuid)
returns table (
  id uuid,
  name text,
  module text,
  org_id uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    team.id,
    team.name,
    team.module,
    coalesce(team.org_id, public.resolve_team_org_id(team.id)) as org_id
  from public.teams team
  where coalesce(team.org_id, public.resolve_team_org_id(team.id)) = p_org_id
    and coalesce(team.is_active, true)
    and (
      public.is_platform_admin(auth.uid())
      or public.is_organization_admin(p_org_id, auth.uid())
      or exists (
        select 1
        from public.team_members member
        where member.team_id = team.id
          and member.user_id = auth.uid()
      )
    )
  order by team.name;
$$;

create or replace function public.get_organization_teams_admin_v2(p_org_id uuid)
returns table (
  id uuid,
  name text,
  module text,
  company_id uuid,
  contract_id uuid,
  created_at timestamptz,
  org_id uuid,
  is_active boolean,
  member_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_organization_operational_admin(p_org_id);

  return query
  select
    team.id,
    team.name,
    team.module,
    team.company_id,
    team.contract_id,
    team.created_at,
    team.org_id,
    team.is_active,
    count(distinct member.user_id)::bigint
  from public.teams team
  left join public.team_members member on member.team_id = team.id
  where team.org_id = p_org_id
    and team.is_active
  group by team.id
  order by team.name;
end;
$$;

create or replace function public.get_organization_contract_v2(
  p_org_id uuid,
  p_contract_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  select jsonb_build_object(
    'id', contract.id,
    'name', contract.name,
    'status', contract.status::text,
    'starts_at', contract.starts_at,
    'ends_at', contract.ends_at,
    'company_id', contract.company_id,
    'number', contract.number,
    'object', contract.object,
    'value_per_pfus', contract.value_per_pfus,
    'currency', contract.currency,
    'team_ids', coalesce((
      select jsonb_agg(link.team_id order by link.team_id)
      from public.contract_teams link
      join public.teams team on team.id = link.team_id
      where link.contract_id = contract.id
        and team.org_id = p_org_id
        and coalesce(team.is_active, true)
    ), '[]'::jsonb),
    'project_ids', coalesce((
      select jsonb_agg(project.id order by project.id)
      from public.projects project
      where project.contract_id = contract.id
        and project.org_id = p_org_id
        and project.status::text <> 'archived'
    ), '[]'::jsonb),
    'sla_ids', coalesce((
      select jsonb_agg(sla.id order by sla.id)
      from public.contract_slas sla
      where sla.contract_id = contract.id
    ), '[]'::jsonb)
  )
  into v_result
  from public.contracts contract
  where contract.id = p_contract_id
    and contract.org_id = p_org_id;

  if v_result is null then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  return v_result;
end;
$$;

create or replace function public.get_organization_contract_form_options_v2(
  p_org_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_organization_operational_admin(p_org_id);

  return jsonb_build_object(
    'companies', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', company.id, 'name', company.name)
        order by company.name
      )
      from public.companies company
      where company.org_id = p_org_id
        and company.status::text <> 'inactive'
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', team.id, 'name', team.name, 'module', team.module)
        order by team.name
      )
      from public.teams team
      where team.org_id = p_org_id
        and coalesce(team.is_active, true)
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', project.id, 'name', project.name)
        order by project.name
      )
      from public.projects project
      where project.org_id = p_org_id
        and project.status::text <> 'archived'
    ), '[]'::jsonb)
  );
end;
$$;

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
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  v_expected := coalesce(cardinality(p_project_ids), 0);
  select count(*)::integer into v_actual
  from public.projects project
  where project.id = any(coalesce(p_project_ids, '{}'::uuid[]))
    and project.org_id = p_org_id
    and project.status::text <> 'archived';
  if v_actual <> v_expected then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  if p_contract_id is null then
    insert into public.contracts (
      org_id,
      name,
      company_id,
      status,
      starts_at,
      ends_at,
      number,
      object,
      value_per_pfus,
      currency,
      created_by
    )
    values (
      p_org_id,
      btrim(p_name),
      p_company_id,
      coalesce(nullif(btrim(p_status), ''), 'active'),
      p_starts_at,
      p_ends_at,
      nullif(btrim(coalesce(p_number, '')), ''),
      nullif(btrim(coalesce(p_object, '')), ''),
      p_value_per_pfus,
      coalesce(nullif(btrim(p_currency), ''), 'BRL'),
      auth.uid()
    )
    returning id into v_contract_id;
  else
    select to_jsonb(contract)
    into v_before
    from public.contracts contract
    where contract.id = p_contract_id
      and contract.org_id = p_org_id
    for update;

    if v_before is null then
      raise exception using errcode = '42501', message = 'resource_cross_tenant';
    end if;

    update public.contracts contract
    set name = btrim(p_name),
        company_id = p_company_id,
        status = coalesce(nullif(btrim(p_status), ''), contract.status::text),
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        number = nullif(btrim(coalesce(p_number, '')), ''),
        object = nullif(btrim(coalesce(p_object, '')), ''),
        value_per_pfus = p_value_per_pfus,
        currency = coalesce(nullif(btrim(p_currency), ''), 'BRL')
    where contract.id = p_contract_id
      and contract.org_id = p_org_id;

    v_contract_id := p_contract_id;
  end if;

  delete from public.contract_teams link
  where link.contract_id = v_contract_id;

  insert into public.contract_teams (contract_id, team_id)
  select v_contract_id, team_id
  from unnest(coalesce(p_team_ids, '{}'::uuid[])) team_id
  on conflict do nothing;

  update public.projects project
  set contract_id = null
  where project.org_id = p_org_id
    and project.contract_id = v_contract_id
    and not (project.id = any(coalesce(p_project_ids, '{}'::uuid[])));

  update public.projects project
  set contract_id = v_contract_id
  where project.org_id = p_org_id
    and project.id = any(coalesce(p_project_ids, '{}'::uuid[]));

  select to_jsonb(contract)
  into v_after
  from public.contracts contract
  where contract.id = v_contract_id;

  perform public.log_organization_operational_event(
    p_org_id,
    case when p_contract_id is null then 'contract_created' else 'contract_updated' end,
    'contract',
    v_contract_id,
    array['name', 'company_id', 'status', 'starts_at', 'ends_at', 'number', 'object', 'value_per_pfus', 'currency', 'team_ids', 'project_ids'],
    v_before,
    v_after,
    jsonb_build_object(
      'team_ids', coalesce(to_jsonb(p_team_ids), '[]'::jsonb),
      'project_ids', coalesce(to_jsonb(p_project_ids), '[]'::jsonb)
    )
  );

  return v_contract_id;
end;
$$;

create or replace function public.create_organization_project_v2(
  p_org_id uuid,
  p_contract_id uuid,
  p_team_id uuid,
  p_name text,
  p_description text default null,
  p_code text default null,
  p_module_type text default 'sustenance',
  p_redmine_id bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception using errcode = '23514', message = 'project_name_required';
  end if;

  if not exists (
    select 1 from public.contracts contract
    where contract.id = p_contract_id and contract.org_id = p_org_id
  ) then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  if p_team_id is not null and not exists (
    select 1 from public.teams team
    where team.id = p_team_id
      and team.org_id = p_org_id
      and coalesce(team.is_active, true)
  ) then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  if p_module_type not in ('sustenance', 'agile', 'mixed') then
    raise exception using errcode = '23514', message = 'project_module_type_invalid';
  end if;

  insert into public.projects (
    org_id,
    contract_id,
    team_id,
    name,
    description,
    code,
    module_type,
    status,
    redmine_id
  )
  values (
    p_org_id,
    p_contract_id,
    p_team_id,
    btrim(p_name),
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_code, '')), ''),
    p_module_type,
    'active',
    p_redmine_id
  )
  returning * into v_project;

  perform public.log_organization_operational_event(
    p_org_id,
    'project_created',
    'project',
    v_project.id,
    array['contract_id', 'team_id', 'name', 'description', 'code', 'module_type', 'status', 'redmine_id'],
    '{}'::jsonb,
    to_jsonb(v_project)
  );

  return v_project.id;
end;
$$;

create or replace function public.update_organization_project_v2(
  p_org_id uuid,
  p_project_id uuid,
  p_contract_id uuid,
  p_team_id uuid,
  p_name text,
  p_description text default null,
  p_code text default null,
  p_module_type text default 'sustenance',
  p_redmine_id bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.projects%rowtype;
  v_after public.projects%rowtype;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  select * into v_before
  from public.projects project
  where project.id = p_project_id
    and project.org_id = p_org_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  if not exists (
    select 1 from public.contracts contract
    where contract.id = p_contract_id and contract.org_id = p_org_id
  ) then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  if p_team_id is not null and not exists (
    select 1 from public.teams team
    where team.id = p_team_id
      and team.org_id = p_org_id
      and coalesce(team.is_active, true)
  ) then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  if p_module_type not in ('sustenance', 'agile', 'mixed') then
    raise exception using errcode = '23514', message = 'project_module_type_invalid';
  end if;

  update public.projects project
  set contract_id = p_contract_id,
      team_id = p_team_id,
      name = btrim(p_name),
      description = nullif(btrim(coalesce(p_description, '')), ''),
      code = nullif(btrim(coalesce(p_code, '')), ''),
      module_type = p_module_type,
      redmine_id = p_redmine_id,
      updated_at = now()
  where project.id = p_project_id
    and project.org_id = p_org_id
  returning * into v_after;

  perform public.log_organization_operational_event(
    p_org_id,
    'project_updated',
    'project',
    p_project_id,
    array['contract_id', 'team_id', 'name', 'description', 'code', 'module_type', 'redmine_id'],
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  return p_project_id;
end;
$$;

create or replace function public.archive_organization_project_v2(
  p_org_id uuid,
  p_project_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.projects%rowtype;
  v_after public.projects%rowtype;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  select * into v_before
  from public.projects project
  where project.id = p_project_id
    and project.org_id = p_org_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  update public.projects project
  set status = 'archived', updated_at = now()
  where project.id = p_project_id
    and project.org_id = p_org_id
  returning * into v_after;

  perform public.log_organization_operational_event(
    p_org_id,
    'project_archived',
    'project',
    p_project_id,
    array['status'],
    to_jsonb(v_before),
    to_jsonb(v_after)
  );
end;
$$;

create or replace function public.create_organization_team_v2(
  p_org_id uuid,
  p_name text,
  p_module text,
  p_company_id uuid default null,
  p_contract_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team public.teams%rowtype;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception using errcode = '23514', message = 'team_name_required';
  end if;

  if p_module not in ('sala_agil', 'sustentacao', 'rdm') then
    raise exception using errcode = '23514', message = 'team_module_invalid';
  end if;

  if p_company_id is not null and not exists (
    select 1 from public.companies company
    where company.id = p_company_id and company.org_id = p_org_id
  ) then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  if p_contract_id is not null and not exists (
    select 1 from public.contracts contract
    where contract.id = p_contract_id and contract.org_id = p_org_id
  ) then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  insert into public.teams (
    org_id,
    name,
    module,
    company_id,
    contract_id,
    is_active
  )
  values (
    p_org_id,
    btrim(p_name),
    p_module,
    p_company_id,
    p_contract_id,
    true
  )
  returning * into v_team;

  if p_contract_id is not null then
    insert into public.contract_teams (contract_id, team_id)
    values (p_contract_id, v_team.id)
    on conflict do nothing;
  end if;

  perform public.log_organization_operational_event(
    p_org_id,
    'team_created',
    'team',
    v_team.id,
    array['name', 'module', 'company_id', 'contract_id', 'is_active'],
    '{}'::jsonb,
    to_jsonb(v_team)
  );

  return v_team.id;
end;
$$;

create or replace function public.update_organization_team_v2(
  p_org_id uuid,
  p_team_id uuid,
  p_name text,
  p_module text,
  p_company_id uuid default null,
  p_contract_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.teams%rowtype;
  v_after public.teams%rowtype;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  select * into v_before
  from public.teams team
  where team.id = p_team_id
    and team.org_id = p_org_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  if p_module not in ('sala_agil', 'sustentacao', 'rdm') then
    raise exception using errcode = '23514', message = 'team_module_invalid';
  end if;

  if p_company_id is not null and not exists (
    select 1 from public.companies company
    where company.id = p_company_id and company.org_id = p_org_id
  ) then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  if p_contract_id is not null and not exists (
    select 1 from public.contracts contract
    where contract.id = p_contract_id and contract.org_id = p_org_id
  ) then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  update public.teams team
  set name = btrim(p_name),
      module = p_module,
      company_id = p_company_id,
      contract_id = p_contract_id,
      is_active = true
  where team.id = p_team_id
    and team.org_id = p_org_id
  returning * into v_after;

  if p_contract_id is not null then
    insert into public.contract_teams (contract_id, team_id)
    values (p_contract_id, p_team_id)
    on conflict do nothing;
  end if;

  perform public.log_organization_operational_event(
    p_org_id,
    'team_updated',
    'team',
    p_team_id,
    array['name', 'module', 'company_id', 'contract_id', 'is_active'],
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  return p_team_id;
end;
$$;

create or replace function public.deactivate_organization_team_v2(
  p_org_id uuid,
  p_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.teams%rowtype;
  v_after public.teams%rowtype;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  select * into v_before
  from public.teams team
  where team.id = p_team_id
    and team.org_id = p_org_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  update public.teams team
  set is_active = false
  where team.id = p_team_id
    and team.org_id = p_org_id
  returning * into v_after;

  perform public.log_organization_operational_event(
    p_org_id,
    'team_deactivated',
    'team',
    p_team_id,
    array['is_active'],
    to_jsonb(v_before),
    to_jsonb(v_after)
  );
end;
$$;

revoke all on function public.get_organization_teams_admin_v2(uuid) from public, anon;
revoke all on function public.get_organization_contract_v2(uuid, uuid) from public, anon;
revoke all on function public.get_organization_contract_form_options_v2(uuid) from public, anon;
revoke all on function public.save_organization_contract_v3(uuid, uuid, text, uuid, text, date, date, text, text, numeric, text, uuid[], uuid[]) from public, anon;
revoke all on function public.create_organization_project_v2(uuid, uuid, uuid, text, text, text, text, bigint) from public, anon;
revoke all on function public.update_organization_project_v2(uuid, uuid, uuid, uuid, text, text, text, text, bigint) from public, anon;
revoke all on function public.archive_organization_project_v2(uuid, uuid) from public, anon;
revoke all on function public.create_organization_team_v2(uuid, text, text, uuid, uuid) from public, anon;
revoke all on function public.update_organization_team_v2(uuid, uuid, text, text, uuid, uuid) from public, anon;
revoke all on function public.deactivate_organization_team_v2(uuid, uuid) from public, anon;

grant execute on function public.get_organization_teams_admin_v2(uuid) to authenticated, service_role;
grant execute on function public.get_organization_contract_v2(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_organization_contract_form_options_v2(uuid) to authenticated, service_role;
grant execute on function public.save_organization_contract_v3(uuid, uuid, text, uuid, text, date, date, text, text, numeric, text, uuid[], uuid[]) to authenticated, service_role;
grant execute on function public.create_organization_project_v2(uuid, uuid, uuid, text, text, text, text, bigint) to authenticated, service_role;
grant execute on function public.update_organization_project_v2(uuid, uuid, uuid, uuid, text, text, text, text, bigint) to authenticated, service_role;
grant execute on function public.archive_organization_project_v2(uuid, uuid) to authenticated, service_role;
grant execute on function public.create_organization_team_v2(uuid, text, text, uuid, uuid) to authenticated, service_role;
grant execute on function public.update_organization_team_v2(uuid, uuid, text, text, uuid, uuid) to authenticated, service_role;
grant execute on function public.deactivate_organization_team_v2(uuid, uuid) to authenticated, service_role;

comment on function public.save_organization_contract_v3(uuid, uuid, text, uuid, text, date, date, text, text, numeric, text, uuid[], uuid[]) is
  'Cria ou atualiza contrato e vínculos de times/projetos dentro da organização ativa.';
comment on function public.deactivate_organization_team_v2(uuid, uuid) is
  'Inativa time sem hard delete e preserva histórico e vínculos.';
