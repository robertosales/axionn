-- Axion SaaS — Fase 1
-- Fundação multi-tenant não destrutiva.
-- Mantém compatibilidade com company/contract/team enquanto organization é consolidada.

create table if not exists public.platform_user_roles (
  user_id uuid not null,
  role text not null check (role in ('platform_admin', 'support_agent', 'billing_operator')),
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (user_id, role)
);

alter table public.platform_user_roles enable row level security;
revoke all on public.platform_user_roles from public, anon, authenticated;
grant select, insert, update, delete on public.platform_user_roles to service_role;

-- Preserva o comportamento dos administradores existentes durante a transição.
insert into public.platform_user_roles (user_id, role)
select ur.user_id, 'platform_admin'
from public.user_roles ur
where ur.role = 'admin'
on conflict (user_id, role) do nothing;

alter table public.companies
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.teams
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.projects
  add column if not exists org_id uuid references public.organizations(id) on delete restrict;

create index if not exists idx_companies_org_id on public.companies(org_id);
create index if not exists idx_contracts_org_id on public.contracts(org_id);
create index if not exists idx_teams_org_id on public.teams(org_id);
create index if not exists idx_projects_org_id on public.projects(org_id);
create index if not exists idx_organization_members_user_org
  on public.organization_members(user_id, org_id);

-- Empresa: preenche somente quando todos os contratos apontam para uma única organização.
with company_candidates as (
  select c.company_id, min(c.org_id) as org_id
  from public.contracts c
  where c.company_id is not null
    and c.org_id is not null
  group by c.company_id
  having count(distinct c.org_id) = 1
)
update public.companies company
set org_id = candidate.org_id
from company_candidates candidate
where company.id = candidate.company_id
  and company.org_id is null;

-- Time: consolida todos os caminhos conhecidos e só grava quando há uma única organização.
with team_org_candidates as (
  select candidate.team_id, min(candidate.org_id) as org_id
  from (
    select t.id as team_id, c.org_id
    from public.teams t
    join public.contracts c on c.id = t.contract_id
    where c.org_id is not null

    union all

    select ct.team_id, c.org_id
    from public.contract_teams ct
    join public.contracts c on c.id = ct.contract_id
    where c.org_id is not null

    union all

    select crt.team_id, c.org_id
    from public.contract_room_teams crt
    join public.contracts c on c.id = crt.contract_id
    where crt.is_active = true
      and c.org_id is not null

    union all

    select p.team_id, c.org_id
    from public.projects p
    join public.contracts c on c.id = p.contract_id
    where p.team_id is not null
      and c.org_id is not null
  ) candidate
  group by candidate.team_id
  having count(distinct candidate.org_id) = 1
)
update public.teams team
set org_id = candidate.org_id
from team_org_candidates candidate
where team.id = candidate.team_id
  and team.org_id is null;

-- Projeto: contrato direto tem precedência; depois usa a organização já resolvida do time.
update public.projects project
set org_id = contract.org_id
from public.contracts contract
where project.contract_id = contract.id
  and project.org_id is null
  and contract.org_id is not null;

update public.projects project
set org_id = team.org_id
from public.teams team
where project.team_id = team.id
  and project.org_id is null
  and team.org_id is not null;

-- Time por empresa, apenas quando a empresa já possui organização inequívoca.
update public.teams team
set org_id = company.org_id
from public.companies company
where team.company_id = company.id
  and team.org_id is null
  and company.org_id is not null;

create or replace function public.is_platform_admin(
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.platform_user_roles role
    where role.user_id = p_user_id
      and role.role = 'platform_admin'
  );
$$;

create or replace function public.is_organization_member(
  p_org_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin(p_user_id)
    or exists (
      select 1
      from public.organization_members member
      where member.org_id = p_org_id
        and member.user_id = p_user_id
    );
$$;

create or replace function public.is_organization_admin(
  p_org_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin(p_user_id)
    or exists (
      select 1
      from public.organization_members member
      where member.org_id = p_org_id
        and member.user_id = p_user_id
        and member.role in ('owner', 'admin')
    );
$$;

create or replace function public.resolve_contract_org_id(p_contract_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select contract.org_id
  from public.contracts contract
  where contract.id = p_contract_id;
$$;

create or replace function public.resolve_team_org_id(p_team_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    team.org_id,
    company.org_id,
    direct_contract.org_id,
    linked_contract.org_id,
    room_contract.org_id,
    project_contract.org_id
  )
  from public.teams team
  left join public.companies company on company.id = team.company_id
  left join public.contracts direct_contract on direct_contract.id = team.contract_id
  left join lateral (
    select contract.org_id
    from public.contract_teams link
    join public.contracts contract on contract.id = link.contract_id
    where link.team_id = team.id
      and contract.org_id is not null
    order by link.created_at desc
    limit 1
  ) linked_contract on true
  left join lateral (
    select contract.org_id
    from public.contract_room_teams link
    join public.contracts contract on contract.id = link.contract_id
    where link.team_id = team.id
      and link.is_active = true
      and contract.org_id is not null
    order by link.created_at desc
    limit 1
  ) room_contract on true
  left join lateral (
    select contract.org_id
    from public.projects project
    join public.contracts contract on contract.id = project.contract_id
    where project.team_id = team.id
      and contract.org_id is not null
    order by project.created_at desc
    limit 1
  ) project_contract on true
  where team.id = p_team_id;
$$;

create or replace function public.resolve_project_org_id(p_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    project.org_id,
    contract.org_id,
    public.resolve_team_org_id(project.team_id)
  )
  from public.projects project
  left join public.contracts contract on contract.id = project.contract_id
  where project.id = p_project_id;
$$;

create or replace function public.get_my_organizations_v2()
returns table (
  id uuid,
  name text,
  slug text,
  status public.org_status,
  plan public.org_plan,
  membership_role text,
  is_platform_admin boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with access as (
    select
      organization.id,
      organization.name,
      organization.slug,
      organization.status,
      organization.plan,
      member.role::text as membership_role,
      false as platform_access
    from public.organization_members member
    join public.organizations organization on organization.id = member.org_id
    where member.user_id = auth.uid()

    union all

    select
      organization.id,
      organization.name,
      organization.slug,
      organization.status,
      organization.plan,
      'platform_admin'::text,
      true
    from public.organizations organization
    where public.is_platform_admin(auth.uid())
  )
  select distinct on (access.id)
    access.id,
    access.name,
    access.slug,
    access.status,
    access.plan,
    access.membership_role,
    public.is_platform_admin(auth.uid())
  from access
  order by access.id, access.platform_access desc, access.name;
$$;

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

revoke all on function public.is_platform_admin(uuid) from public, anon;
revoke all on function public.is_organization_member(uuid, uuid) from public, anon;
revoke all on function public.is_organization_admin(uuid, uuid) from public, anon;
revoke all on function public.resolve_contract_org_id(uuid) from public, anon, authenticated;
revoke all on function public.resolve_team_org_id(uuid) from public, anon, authenticated;
revoke all on function public.resolve_project_org_id(uuid) from public, anon, authenticated;
revoke all on function public.get_my_organizations_v2() from public, anon;
revoke all on function public.get_accessible_teams_v2(uuid) from public, anon;

grant execute on function public.is_platform_admin(uuid) to authenticated, service_role;
grant execute on function public.is_organization_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_organization_admin(uuid, uuid) to authenticated, service_role;
grant execute on function public.resolve_contract_org_id(uuid) to service_role;
grant execute on function public.resolve_team_org_id(uuid) to service_role;
grant execute on function public.resolve_project_org_id(uuid) to service_role;
grant execute on function public.get_my_organizations_v2() to authenticated, service_role;
grant execute on function public.get_accessible_teams_v2(uuid) to authenticated, service_role;

comment on table public.platform_user_roles is
  'Papéis internos da plataforma Axion, separados dos papéis das organizações clientes.';
comment on function public.get_my_organizations_v2() is
  'Lista organizações acessíveis ao usuário autenticado, incluindo acesso global de platform_admin.';
comment on function public.get_accessible_teams_v2(uuid) is
  'Lista times acessíveis dentro de uma organização, respeitando administração e membership.';
