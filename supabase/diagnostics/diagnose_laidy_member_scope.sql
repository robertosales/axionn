-- Diagnóstico somente leitura.
-- Identifica por que uma administradora enxerga apenas o próprio usuário.

with target_user as (
  select
    account.id as user_id,
    account.email
  from auth.users account
  where lower(account.email) = lower('leidybsb@gmail.com')
),
target_organizations as (
  select
    member.org_id,
    organization.name as organization_name,
    member.role::text as organization_role
  from target_user target
  join public.organization_members member
    on member.user_id = target.user_id
  join public.organizations organization
    on organization.id = member.org_id
),
target_contracts as (
  select distinct
    target.org_id,
    contract.id as contract_id,
    contract.name as contract_name,
    contract.org_id as contract_org_id,
    company.org_id as company_org_id
  from target_organizations target
  join public.contracts contract
    on coalesce(contract.org_id, (
      select company.org_id
      from public.companies company
      where company.id = contract.company_id
    )) = target.org_id
  left join public.companies company
    on company.id = contract.company_id
),
target_teams as (
  select distinct
    target.org_id,
    team.id as team_id,
    team.name as team_name,
    team.org_id as team_org_id,
    team.contract_id as direct_contract_id
  from target_organizations target
  join public.teams team
    on team.org_id = target.org_id
    or exists (
      select 1
      from target_contracts contract
      where contract.org_id = target.org_id
        and contract.contract_id = team.contract_id
    )
    or exists (
      select 1
      from public.contract_teams link
      join target_contracts contract
        on contract.contract_id = link.contract_id
       and contract.org_id = target.org_id
      where link.team_id = team.id
    )
),
source_rows as (
  select
    target.org_id,
    'organization_members'::text as source,
    member.user_id
  from target_organizations target
  join public.organization_members member
    on member.org_id = target.org_id

  union all

  select
    contract.org_id,
    'contract_members'::text,
    member.user_id
  from target_contracts contract
  join public.contract_members member
    on member.contract_id = contract.contract_id

  union all

  select
    team.org_id,
    'team_members'::text,
    member.user_id
  from target_teams team
  join public.team_members member
    on member.team_id = team.team_id

  union all

  select
    team.org_id,
    'developers'::text,
    developer.user_id
  from target_teams team
  join public.developers developer
    on developer.team_id = team.team_id
  where developer.user_id is not null

  union all

  select
    team.org_id,
    'profiles.team_id'::text,
    profile.user_id
  from target_teams team
  join public.profiles profile
    on profile.team_id = team.team_id
)
select jsonb_pretty(
  jsonb_build_object(
    'target_user',
    (select to_jsonb(target_user) from target_user),
    'organizations',
    coalesce((
      select jsonb_agg(to_jsonb(target))
      from target_organizations target
    ), '[]'::jsonb),
    'contracts',
    coalesce((
      select jsonb_agg(to_jsonb(contract))
      from target_contracts contract
    ), '[]'::jsonb),
    'teams',
    coalesce((
      select jsonb_agg(to_jsonb(team))
      from target_teams team
    ), '[]'::jsonb),
    'member_sources',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'source', grouped.source,
          'total', grouped.total,
          'users', grouped.users
        )
        order by grouped.source
      )
      from (
        select
          source.source,
          count(distinct source.user_id) as total,
          jsonb_agg(
            distinct jsonb_build_object(
              'user_id', source.user_id,
              'name', profile.display_name,
              'email', coalesce(profile.email, account.email)
            )
          ) as users
        from source_rows source
        left join public.profiles profile
          on profile.user_id = source.user_id
        left join auth.users account
          on account.id = source.user_id
        group by source.source
      ) grouped
    ), '[]'::jsonb)
  )
) as diagnostic;
