-- Axion SaaS — Fase 1.3
-- Isolamento progressivo de contratos, projetos, times e empresas por organização.
-- O enforcement no banco nasce desligado para permitir backfill e validação em staging.

create table if not exists public.saas_runtime_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.saas_runtime_settings enable row level security;
revoke all on public.saas_runtime_settings from public, anon, authenticated;
grant select, insert, update, delete on public.saas_runtime_settings to service_role;

insert into public.saas_runtime_settings (key, value)
values ('tenancy_enforcement', jsonb_build_object('enabled', false))
on conflict (key) do nothing;

create or replace function public.is_tenancy_enforced()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select lower(setting.value ->> 'enabled') = 'true'
      from public.saas_runtime_settings setting
      where setting.key = 'tenancy_enforcement'
    ),
    false
  );
$$;

create or replace function public.set_tenancy_enforcement(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.saas_runtime_settings (key, value, updated_at, updated_by)
  values (
    'tenancy_enforcement',
    jsonb_build_object('enabled', p_enabled),
    now(),
    auth.uid()
  )
  on conflict (key) do update
    set value = excluded.value,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
end;
$$;

create or replace function public.can_read_organization(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_org_id is not null
    and public.is_organization_member(p_org_id);
$$;

create or replace function public.can_operate_organization(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_org_id is not null
    and (
      public.is_platform_admin()
      or (
        public.is_organization_member(p_org_id)
        and exists (
          select 1
          from public.organizations organization
          where organization.id = p_org_id
            and organization.status in ('active', 'trial')
        )
      )
    );
$$;

create or replace function public.get_accessible_companies_v2(p_org_id uuid)
returns table (
  id uuid,
  name text,
  cnpj text,
  email text,
  phone text,
  logo_url text,
  status text,
  created_at timestamptz,
  org_id uuid,
  team_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    company.id,
    company.name,
    company.cnpj,
    company.email,
    company.phone,
    company.logo_url,
    company.status::text,
    company.created_at,
    company.org_id,
    count(distinct team.id) as team_count
  from public.companies company
  left join public.teams team
    on team.company_id = company.id
   and team.org_id = p_org_id
  where company.org_id = p_org_id
    and public.can_read_organization(p_org_id)
  group by company.id
  order by company.name;
$$;

create or replace function public.get_accessible_contracts_v2(p_org_id uuid)
returns table (
  id uuid,
  name text,
  status text,
  starts_at date,
  ends_at date,
  company_id uuid,
  number text,
  object text,
  value_per_pfus numeric,
  currency text,
  room_mode text,
  description text,
  org_id uuid,
  project_count bigint,
  sla_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    contract.id,
    contract.name,
    contract.status::text,
    contract.starts_at,
    contract.ends_at,
    contract.company_id,
    contract.number,
    contract.object,
    contract.value_per_pfus,
    contract.currency,
    contract.room_mode::text,
    contract.description,
    contract.org_id,
    count(distinct project.id) as project_count,
    count(distinct sla.id) as sla_count
  from public.contracts contract
  left join public.projects project on project.contract_id = contract.id
  left join public.contract_slas sla on sla.contract_id = contract.id
  where contract.org_id = p_org_id
    and public.can_read_organization(p_org_id)
  group by contract.id
  order by contract.name;
$$;

create or replace function public.get_accessible_projects_v2(
  p_org_id uuid,
  p_contract_id uuid
)
returns table (
  id uuid,
  name text,
  description text,
  code text,
  status text,
  module_type text,
  contract_id uuid,
  team_id uuid,
  redmine_id bigint,
  legacy_projetos_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  sla_id uuid,
  org_id uuid,
  contract_name text,
  team_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    project.id,
    project.name,
    project.description,
    project.code,
    project.status::text,
    project.module_type::text,
    project.contract_id,
    project.team_id,
    project.redmine_id,
    project.legacy_projetos_id,
    project.created_at,
    project.updated_at,
    project.sla_id,
    project.org_id,
    contract.name as contract_name,
    team.name as team_name
  from public.projects project
  left join public.contracts contract on contract.id = project.contract_id
  left join public.teams team on team.id = project.team_id
  where project.org_id = p_org_id
    and project.status <> 'archived'
    and (p_contract_id is null or project.contract_id = p_contract_id)
    and public.can_read_organization(p_org_id)
  order by project.name;
$$;

create or replace function public.enforce_company_org_boundary()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_tenancy_enforced()
     and coalesce(auth.role(), '') <> 'service_role' then
    if new.org_id is null then
      raise exception 'organization_required';
    end if;
    if not public.can_operate_organization(new.org_id) then
      raise exception 'organization_not_operational';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_contract_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  linked_org_id uuid;
begin
  if new.company_id is not null then
    select company.org_id
      into linked_org_id
      from public.companies company
     where company.id = new.company_id;
  end if;

  if new.org_id is null then
    new.org_id := linked_org_id;
  elsif linked_org_id is not null and new.org_id <> linked_org_id then
    raise exception 'contract_company_organization_mismatch';
  end if;

  if public.is_tenancy_enforced()
     and coalesce(auth.role(), '') <> 'service_role' then
    if new.org_id is null then
      raise exception 'organization_required';
    end if;
    if not public.can_operate_organization(new.org_id) then
      raise exception 'organization_not_operational';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_team_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  company_org_id uuid;
  contract_org_id uuid;
  linked_org_id uuid;
begin
  if new.company_id is not null then
    select company.org_id
      into company_org_id
      from public.companies company
     where company.id = new.company_id;
  end if;

  if new.contract_id is not null then
    select contract.org_id
      into contract_org_id
      from public.contracts contract
     where contract.id = new.contract_id;
  end if;

  if company_org_id is not null
     and contract_org_id is not null
     and company_org_id <> contract_org_id then
    raise exception 'team_relationship_organization_mismatch';
  end if;

  linked_org_id := coalesce(contract_org_id, company_org_id);

  if new.org_id is null then
    new.org_id := linked_org_id;
  elsif linked_org_id is not null and new.org_id <> linked_org_id then
    raise exception 'team_organization_mismatch';
  end if;

  if public.is_tenancy_enforced()
     and coalesce(auth.role(), '') <> 'service_role' then
    if new.org_id is null then
      raise exception 'organization_required';
    end if;
    if not public.can_operate_organization(new.org_id) then
      raise exception 'organization_not_operational';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_project_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  contract_org_id uuid;
  team_org_id uuid;
  linked_org_id uuid;
begin
  if new.contract_id is not null then
    select contract.org_id
      into contract_org_id
      from public.contracts contract
     where contract.id = new.contract_id;
  end if;

  if new.team_id is not null then
    select coalesce(team.org_id, public.resolve_team_org_id(team.id))
      into team_org_id
      from public.teams team
     where team.id = new.team_id;
  end if;

  if contract_org_id is not null
     and team_org_id is not null
     and contract_org_id <> team_org_id then
    raise exception 'project_relationship_organization_mismatch';
  end if;

  linked_org_id := coalesce(contract_org_id, team_org_id);

  if new.org_id is null then
    new.org_id := linked_org_id;
  elsif linked_org_id is not null and new.org_id <> linked_org_id then
    raise exception 'project_organization_mismatch';
  end if;

  if public.is_tenancy_enforced()
     and coalesce(auth.role(), '') <> 'service_role' then
    if new.org_id is null then
      raise exception 'organization_required';
    end if;
    if not public.can_operate_organization(new.org_id) then
      raise exception 'organization_not_operational';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_company_org_boundary on public.companies;
create trigger trg_company_org_boundary
before insert or update on public.companies
for each row execute function public.enforce_company_org_boundary();

drop trigger if exists trg_contract_org_consistency on public.contracts;
create trigger trg_contract_org_consistency
before insert or update on public.contracts
for each row execute function public.enforce_contract_org_consistency();

drop trigger if exists trg_team_org_consistency on public.teams;
create trigger trg_team_org_consistency
before insert or update on public.teams
for each row execute function public.enforce_team_org_consistency();

drop trigger if exists trg_project_org_consistency on public.projects;
create trigger trg_project_org_consistency
before insert or update on public.projects
for each row execute function public.enforce_project_org_consistency();

alter table public.companies enable row level security;
alter table public.contracts enable row level security;
alter table public.teams enable row level security;
alter table public.projects enable row level security;
alter table public.contract_teams enable row level security;
alter table public.contract_room_teams enable row level security;
alter table public.contract_slas enable row level security;

drop policy if exists companies_tenant_boundary on public.companies;
create policy companies_tenant_boundary
on public.companies as restrictive
for all to authenticated
using (
  not public.is_tenancy_enforced()
  or (org_id is not null and public.can_read_organization(org_id))
)
with check (
  not public.is_tenancy_enforced()
  or (org_id is not null and public.can_operate_organization(org_id))
);

drop policy if exists contracts_tenant_boundary on public.contracts;
create policy contracts_tenant_boundary
on public.contracts as restrictive
for all to authenticated
using (
  not public.is_tenancy_enforced()
  or (org_id is not null and public.can_read_organization(org_id))
)
with check (
  not public.is_tenancy_enforced()
  or (org_id is not null and public.can_operate_organization(org_id))
);

drop policy if exists teams_tenant_boundary on public.teams;
create policy teams_tenant_boundary
on public.teams as restrictive
for all to authenticated
using (
  not public.is_tenancy_enforced()
  or (org_id is not null and public.can_read_organization(org_id))
)
with check (
  not public.is_tenancy_enforced()
  or (org_id is not null and public.can_operate_organization(org_id))
);

drop policy if exists projects_tenant_boundary on public.projects;
create policy projects_tenant_boundary
on public.projects as restrictive
for all to authenticated
using (
  not public.is_tenancy_enforced()
  or (org_id is not null and public.can_read_organization(org_id))
)
with check (
  not public.is_tenancy_enforced()
  or (org_id is not null and public.can_operate_organization(org_id))
);

drop policy if exists contract_teams_tenant_boundary on public.contract_teams;
create policy contract_teams_tenant_boundary
on public.contract_teams as restrictive
for all to authenticated
using (
  not public.is_tenancy_enforced()
  or exists (
    select 1
    from public.contracts contract
    where contract.id = contract_teams.contract_id
      and public.can_read_organization(contract.org_id)
  )
)
with check (
  not public.is_tenancy_enforced()
  or exists (
    select 1
    from public.contracts contract
    where contract.id = contract_teams.contract_id
      and public.can_operate_organization(contract.org_id)
  )
);

drop policy if exists contract_room_teams_tenant_boundary on public.contract_room_teams;
create policy contract_room_teams_tenant_boundary
on public.contract_room_teams as restrictive
for all to authenticated
using (
  not public.is_tenancy_enforced()
  or exists (
    select 1
    from public.contracts contract
    where contract.id = contract_room_teams.contract_id
      and public.can_read_organization(contract.org_id)
  )
)
with check (
  not public.is_tenancy_enforced()
  or exists (
    select 1
    from public.contracts contract
    where contract.id = contract_room_teams.contract_id
      and public.can_operate_organization(contract.org_id)
  )
);

drop policy if exists contract_slas_tenant_boundary on public.contract_slas;
create policy contract_slas_tenant_boundary
on public.contract_slas as restrictive
for all to authenticated
using (
  not public.is_tenancy_enforced()
  or exists (
    select 1
    from public.contracts contract
    where contract.id = contract_slas.contract_id
      and public.can_read_organization(contract.org_id)
  )
)
with check (
  not public.is_tenancy_enforced()
  or exists (
    select 1
    from public.contracts contract
    where contract.id = contract_slas.contract_id
      and public.can_operate_organization(contract.org_id)
  )
);

revoke all on function public.is_tenancy_enforced() from public, anon, authenticated;
revoke all on function public.set_tenancy_enforcement(boolean) from public, anon, authenticated;
revoke all on function public.can_read_organization(uuid) from public, anon;
revoke all on function public.can_operate_organization(uuid) from public, anon;
revoke all on function public.get_accessible_companies_v2(uuid) from public, anon;
revoke all on function public.get_accessible_contracts_v2(uuid) from public, anon;
revoke all on function public.get_accessible_projects_v2(uuid, uuid) from public, anon;

grant execute on function public.is_tenancy_enforced() to service_role;
grant execute on function public.set_tenancy_enforcement(boolean) to service_role;
grant execute on function public.can_read_organization(uuid) to authenticated, service_role;
grant execute on function public.can_operate_organization(uuid) to authenticated, service_role;
grant execute on function public.get_accessible_companies_v2(uuid) to authenticated, service_role;
grant execute on function public.get_accessible_contracts_v2(uuid) to authenticated, service_role;
grant execute on function public.get_accessible_projects_v2(uuid, uuid) to authenticated, service_role;

comment on table public.saas_runtime_settings is
  'Configurações operacionais de rollout controladas exclusivamente pelo backend da plataforma.';
comment on function public.set_tenancy_enforcement(boolean) is
  'Ativa ou desativa o isolamento multi-tenant restritivo no banco. Executável somente com service_role.';
comment on function public.get_accessible_contracts_v2(uuid) is
  'Lista contratos da organização acessível ao usuário autenticado.';
comment on function public.get_accessible_projects_v2(uuid, uuid) is
  'Lista projetos da organização, com filtro opcional de contrato informado explicitamente.';
