-- Keep teams.contract_id and contract_teams consistent inside the active tenant.

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

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception using errcode = '23514', message = 'team_name_required';
  end if;

  if p_module not in ('sala_agil', 'sustentacao', 'rdm') then
    raise exception using errcode = '23514', message = 'team_module_invalid';
  end if;

  if p_company_id is not null and not exists (
    select 1 from public.companies company
    where company.id = p_company_id
      and company.org_id = p_org_id
      and company.status::text <> 'inactive'
  ) then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  if p_contract_id is not null and not exists (
    select 1 from public.contracts contract
    where contract.id = p_contract_id
      and contract.org_id = p_org_id
      and contract.status::text <> 'archived'
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

  delete from public.contract_teams relation
  where relation.team_id = p_team_id
    and exists (
      select 1
      from public.contracts contract
      where contract.id = relation.contract_id
        and contract.org_id = p_org_id
    );

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
    to_jsonb(v_after),
    jsonb_build_object('contract_link_reconciled', true)
  );

  return p_team_id;
end;
$$;

revoke all on function public.update_organization_team_v2(uuid, uuid, text, text, uuid, uuid)
  from public, anon;
grant execute on function public.update_organization_team_v2(uuid, uuid, text, text, uuid, uuid)
  to authenticated, service_role;
