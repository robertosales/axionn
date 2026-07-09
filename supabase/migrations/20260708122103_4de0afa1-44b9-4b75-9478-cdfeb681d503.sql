
-- 1. Backfill idempotente de teams.org_id via resolve_team_org_id
update public.teams t
set org_id = public.resolve_team_org_id(t.id)
where t.org_id is null
  and public.resolve_team_org_id(t.id) is not null;

-- 2. get_organization_teams_admin_v2: considerar org_id resolvido
create or replace function public.get_organization_teams_admin_v2(p_org_id uuid)
returns table(id uuid, name text, module text, company_id uuid, contract_id uuid, created_at timestamptz, org_id uuid, is_active boolean, member_count bigint)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
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
    coalesce(team.org_id, public.resolve_team_org_id(team.id)) as org_id,
    team.is_active,
    count(distinct member.user_id)::bigint as member_count
  from public.teams team
  left join public.team_members member on member.team_id = team.id
  where coalesce(team.org_id, public.resolve_team_org_id(team.id)) = p_org_id
    and team.is_active
  group by team.id
  order by team.name;
end;
$$;

-- 3. update_organization_team_v2: aceitar times legados (org_id null) via resolução
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
set search_path to 'public', 'pg_temp'
as $$
declare
  v_before public.teams%rowtype;
  v_after public.teams%rowtype;
  v_resolved_org uuid;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  select * into v_before
  from public.teams team
  where team.id = p_team_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  v_resolved_org := coalesce(v_before.org_id, public.resolve_team_org_id(v_before.id));
  if v_resolved_org is null or v_resolved_org <> p_org_id then
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
      org_id = coalesce(team.org_id, p_org_id),
      is_active = true
  where team.id = p_team_id
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
    array['name', 'module', 'company_id', 'contract_id', 'org_id', 'is_active'],
    to_jsonb(v_before),
    to_jsonb(v_after),
    jsonb_build_object('contract_link_reconciled', true)
  );

  return p_team_id;
end;
$$;

-- 4. deactivate_organization_team_v2: aceitar times legados
create or replace function public.deactivate_organization_team_v2(p_org_id uuid, p_team_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_before public.teams%rowtype;
  v_after public.teams%rowtype;
  v_resolved_org uuid;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  select * into v_before
  from public.teams team
  where team.id = p_team_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  v_resolved_org := coalesce(v_before.org_id, public.resolve_team_org_id(v_before.id));
  if v_resolved_org is null or v_resolved_org <> p_org_id then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  update public.teams team
  set is_active = false,
      org_id = coalesce(team.org_id, p_org_id)
  where team.id = p_team_id
  returning * into v_after;

  perform public.log_organization_operational_event(
    p_org_id,
    'team_deactivated',
    'team',
    p_team_id,
    array['is_active'],
    to_jsonb(v_before),
    to_jsonb(v_after),
    '{}'::jsonb
  );
end;
$$;

-- 5. get_organization_team_members_v2
create or replace function public.get_organization_team_members_v2(p_org_id uuid, p_team_id uuid)
returns table(
  team_member_id uuid,
  user_id uuid,
  role text,
  joined_at timestamptz,
  display_name text,
  email text,
  is_active boolean,
  membership_role text
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_resolved_org uuid;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  select coalesce(team.org_id, public.resolve_team_org_id(team.id))
    into v_resolved_org
  from public.teams team
  where team.id = p_team_id;

  if v_resolved_org is null or v_resolved_org <> p_org_id then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  return query
  select
    tm.id                                    as team_member_id,
    tm.user_id,
    tm.role,
    tm.joined_at,
    coalesce(profile.display_name, u.email::text, 'Usuário') as display_name,
    coalesce(profile.email, u.email::text, '')::text         as email,
    coalesce(profile.is_active, true)                        as is_active,
    coalesce(om.role::text, null)                            as membership_role
  from public.team_members tm
  left join public.profiles profile on profile.user_id = tm.user_id
  left join auth.users u          on u.id = tm.user_id
  left join public.organization_members om
         on om.user_id = tm.user_id and om.org_id = p_org_id
  where tm.team_id = p_team_id
  order by coalesce(profile.display_name, u.email::text);
end;
$$;

-- 6. add_organization_team_member_v2
create or replace function public.add_organization_team_member_v2(
  p_org_id uuid,
  p_team_id uuid,
  p_user_id uuid,
  p_role text default 'developer'
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_resolved_org uuid;
  v_new_id uuid;
  v_role text := coalesce(nullif(btrim(p_role), ''), 'developer');
begin
  perform public.assert_organization_operational_admin(p_org_id);

  select coalesce(team.org_id, public.resolve_team_org_id(team.id))
    into v_resolved_org
  from public.teams team
  where team.id = p_team_id;

  if v_resolved_org is null or v_resolved_org <> p_org_id then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  if p_user_id is null then
    raise exception using errcode = '23514', message = 'team_member_user_required';
  end if;

  if not exists (
    select 1 from public.organization_members om
    where om.org_id = p_org_id
      and om.user_id = p_user_id
      and om.is_active = true
  ) then
    raise exception using errcode = '42501', message = 'organization_member_inactive';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (p_team_id, p_user_id, v_role)
  on conflict (team_id, user_id) do update
    set role = excluded.role
  returning id into v_new_id;

  perform public.log_organization_operational_event(
    p_org_id,
    'team_member_added',
    'team_member',
    v_new_id,
    array['team_id','user_id','role'],
    null::jsonb,
    jsonb_build_object('team_id', p_team_id, 'user_id', p_user_id, 'role', v_role),
    '{}'::jsonb
  );

  return v_new_id;
end;
$$;

-- 7. update_organization_team_member_role_v2
create or replace function public.update_organization_team_member_role_v2(
  p_org_id uuid,
  p_team_member_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_row public.team_members%rowtype;
  v_resolved_org uuid;
  v_role text := coalesce(nullif(btrim(p_role), ''), null);
begin
  perform public.assert_organization_operational_admin(p_org_id);

  if v_role is null then
    raise exception using errcode = '23514', message = 'team_member_role_required';
  end if;

  select * into v_row
  from public.team_members
  where id = p_team_member_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  select coalesce(team.org_id, public.resolve_team_org_id(team.id))
    into v_resolved_org
  from public.teams team
  where team.id = v_row.team_id;

  if v_resolved_org is null or v_resolved_org <> p_org_id then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  update public.team_members
  set role = v_role
  where id = p_team_member_id;

  perform public.log_organization_operational_event(
    p_org_id,
    'team_member_role_updated',
    'team_member',
    p_team_member_id,
    array['role'],
    jsonb_build_object('role', v_row.role),
    jsonb_build_object('role', v_role),
    jsonb_build_object('team_id', v_row.team_id, 'user_id', v_row.user_id)
  );
end;
$$;

-- 8. remove_organization_team_member_v2
create or replace function public.remove_organization_team_member_v2(
  p_org_id uuid,
  p_team_member_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_row public.team_members%rowtype;
  v_resolved_org uuid;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  select * into v_row
  from public.team_members
  where id = p_team_member_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  select coalesce(team.org_id, public.resolve_team_org_id(team.id))
    into v_resolved_org
  from public.teams team
  where team.id = v_row.team_id;

  if v_resolved_org is null or v_resolved_org <> p_org_id then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  delete from public.team_members where id = p_team_member_id;

  perform public.log_organization_operational_event(
    p_org_id,
    'team_member_removed',
    'team_member',
    p_team_member_id,
    array['team_id','user_id','role'],
    to_jsonb(v_row),
    null::jsonb,
    '{}'::jsonb
  );
end;
$$;

-- 9. Grants
revoke all on function public.get_organization_team_members_v2(uuid, uuid) from public, anon;
revoke all on function public.add_organization_team_member_v2(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.update_organization_team_member_role_v2(uuid, uuid, text) from public, anon;
revoke all on function public.remove_organization_team_member_v2(uuid, uuid) from public, anon;

grant execute on function public.get_organization_team_members_v2(uuid, uuid) to authenticated, service_role;
grant execute on function public.add_organization_team_member_v2(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.update_organization_team_member_role_v2(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.remove_organization_team_member_v2(uuid, uuid) to authenticated, service_role;
