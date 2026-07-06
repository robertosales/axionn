-- Read-only validation after 20260704080200_organization_team_contract_links.sql

select
  to_regprocedure(
    'public.update_organization_team_v2(uuid,uuid,text,text,uuid,uuid)'
  ) is not null as team_update_rpc_ready,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teams'
      and column_name = 'is_active'
      and data_type = 'boolean'
  ) as team_soft_delete_ready,
  not exists (
    select 1
    from public.contract_teams relation
    join public.contracts contract on contract.id = relation.contract_id
    join public.teams team on team.id = relation.team_id
    where contract.org_id is distinct from team.org_id
  ) as no_cross_tenant_team_contract_links,
  (
    to_regprocedure(
      'public.update_organization_team_v2(uuid,uuid,text,text,uuid,uuid)'
    ) is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'teams'
        and column_name = 'is_active'
        and data_type = 'boolean'
    )
    and not exists (
      select 1
      from public.contract_teams relation
      join public.contracts contract on contract.id = relation.contract_id
      join public.teams team on team.id = relation.team_id
      where contract.org_id is distinct from team.org_id
    )
  ) as team_contract_links_hardening_ok;
