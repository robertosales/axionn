-- Axion SaaS — Fase 1.3
-- Endurecimento do rollout: permissões de policy, consistência de vínculos e relatório de prontidão.

-- As policies restritivas executam esta função durante requisições autenticadas.
revoke all on function public.is_tenancy_enforced() from public, anon;
grant execute on function public.is_tenancy_enforced() to authenticated, service_role;

create or replace function public.enforce_contract_team_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  contract_org_id uuid;
  team_org_id uuid;
begin
  select contract.org_id
    into contract_org_id
    from public.contracts contract
   where contract.id = new.contract_id;

  select coalesce(team.org_id, public.resolve_team_org_id(team.id))
    into team_org_id
    from public.teams team
   where team.id = new.team_id;

  if contract_org_id is not null
     and team_org_id is not null
     and contract_org_id <> team_org_id then
    raise exception 'contract_team_organization_mismatch';
  end if;

  if public.is_tenancy_enforced()
     and coalesce(auth.role(), '') <> 'service_role' then
    if contract_org_id is null or team_org_id is null then
      raise exception 'organization_required';
    end if;
    if not public.can_operate_organization(contract_org_id) then
      raise exception 'organization_not_operational';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_contract_room_team_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  contract_org_id uuid;
  team_org_id uuid;
  project_org_id uuid;
begin
  select contract.org_id
    into contract_org_id
    from public.contracts contract
   where contract.id = new.contract_id;

  select coalesce(team.org_id, public.resolve_team_org_id(team.id))
    into team_org_id
    from public.teams team
   where team.id = new.team_id;

  if new.project_id is not null then
    select coalesce(project.org_id, public.resolve_project_org_id(project.id))
      into project_org_id
      from public.projects project
     where project.id = new.project_id;
  end if;

  if contract_org_id is not null
     and team_org_id is not null
     and contract_org_id <> team_org_id then
    raise exception 'contract_room_team_organization_mismatch';
  end if;

  if project_org_id is not null
     and contract_org_id is not null
     and project_org_id <> contract_org_id then
    raise exception 'contract_room_project_organization_mismatch';
  end if;

  if public.is_tenancy_enforced()
     and coalesce(auth.role(), '') <> 'service_role' then
    if contract_org_id is null or team_org_id is null then
      raise exception 'organization_required';
    end if;
    if new.project_id is not null and project_org_id is null then
      raise exception 'project_organization_required';
    end if;
    if not public.can_operate_organization(contract_org_id) then
      raise exception 'organization_not_operational';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_contract_team_org_consistency on public.contract_teams;
create trigger trg_contract_team_org_consistency
before insert or update on public.contract_teams
for each row execute function public.enforce_contract_team_org_consistency();

drop trigger if exists trg_contract_room_team_org_consistency on public.contract_room_teams;
create trigger trg_contract_room_team_org_consistency
before insert or update on public.contract_room_teams
for each row execute function public.enforce_contract_room_team_org_consistency();

create or replace function public.get_tenancy_readiness_report()
returns table (
  resource text,
  issue text,
  affected_rows bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select 'companies'::text, 'missing_org_id'::text, count(*)::bigint
  from public.companies
  where org_id is null

  union all

  select 'contracts'::text, 'missing_org_id'::text, count(*)::bigint
  from public.contracts
  where org_id is null

  union all

  select 'teams'::text, 'missing_org_id'::text, count(*)::bigint
  from public.teams
  where org_id is null

  union all

  select 'projects'::text, 'missing_org_id'::text, count(*)::bigint
  from public.projects
  where org_id is null

  union all

  select 'contracts'::text, 'company_org_mismatch'::text, count(*)::bigint
  from public.contracts contract
  join public.companies company on company.id = contract.company_id
  where contract.org_id is not null
    and company.org_id is not null
    and contract.org_id <> company.org_id

  union all

  select 'contract_teams'::text, 'contract_team_org_mismatch'::text, count(*)::bigint
  from public.contract_teams relation
  join public.contracts contract on contract.id = relation.contract_id
  join public.teams team on team.id = relation.team_id
  where contract.org_id is not null
    and team.org_id is not null
    and contract.org_id <> team.org_id

  union all

  select 'contract_room_teams'::text, 'contract_team_org_mismatch'::text, count(*)::bigint
  from public.contract_room_teams relation
  join public.contracts contract on contract.id = relation.contract_id
  join public.teams team on team.id = relation.team_id
  where contract.org_id is not null
    and team.org_id is not null
    and contract.org_id <> team.org_id

  union all

  select 'projects'::text, 'contract_org_mismatch'::text, count(*)::bigint
  from public.projects project
  join public.contracts contract on contract.id = project.contract_id
  where project.org_id is not null
    and contract.org_id is not null
    and project.org_id <> contract.org_id

  union all

  select 'projects'::text, 'team_org_mismatch'::text, count(*)::bigint
  from public.projects project
  join public.teams team on team.id = project.team_id
  where project.org_id is not null
    and team.org_id is not null
    and project.org_id <> team.org_id;
$$;

revoke all on function public.enforce_contract_team_org_consistency() from public, anon, authenticated;
revoke all on function public.enforce_contract_room_team_org_consistency() from public, anon, authenticated;
revoke all on function public.get_tenancy_readiness_report() from public, anon, authenticated;

grant execute on function public.enforce_contract_team_org_consistency() to service_role;
grant execute on function public.enforce_contract_room_team_org_consistency() to service_role;
grant execute on function public.get_tenancy_readiness_report() to service_role;

comment on function public.get_tenancy_readiness_report() is
  'Relatório somente backend para validar registros sem organização e vínculos entre organizações antes do enforcement.';
