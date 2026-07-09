-- Hotfix operacional: restaura acesso total de rjoacina@gmail.com ao tenant/time GESPE3.
--
-- O banco de producao pode ter apenas os times A/B/C. Nesse caso, o TIME B
-- e tratado como o time principal que deve permanecer.
--
-- O script e idempotente e segue o padrao atual de remocao de times:
-- inativacao por is_active=false, preservando historico e relacionamentos.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260707:restore_rjoacina_gespe3_access')
);

do $$
declare
  v_email constant text := 'rjoacina@gmail.com';
  v_user_id uuid;
  v_team_id uuid;
  v_org_id uuid;
  v_org_member_exists boolean;
  v_removed_team_count integer;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);

  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.teams') is null
     or to_regclass('public.team_members') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.user_module_roles') is null
     or to_regclass('public.organization_members') is null
     or to_regclass('public.organization_member_modules') is null
     or to_regclass('public.organization_entitlement_overrides') is null
     or to_regprocedure('public.get_effective_organization_entitlements(uuid)') is null then
    raise exception 'Dependencias de usuarios, times ou permissoes ausentes';
  end if;

  select auth_user.id
    into v_user_id
  from auth.users auth_user
  where lower(btrim(auth_user.email)) = v_email;

  if v_user_id is null then
    raise exception 'Usuario % nao encontrado em auth.users', v_email;
  end if;

  select
    team.id,
    team.org_id
    into v_team_id, v_org_id
  from public.teams team
  where regexp_replace(upper(btrim(team.name)), '[^A-Z0-9]', '', 'g')
    in ('GESPE3TIME', 'GESP3TIME', 'GESPE3TIMEB', 'GESP3TIMEB')
  order by
    coalesce(team.is_active, true) desc,
    case regexp_replace(upper(btrim(team.name)), '[^A-Z0-9]', '', 'g')
      when 'GESPE3TIME' then 0
      when 'GESP3TIME' then 1
      when 'GESPE3TIMEB' then 2
      else 3
    end,
    team.created_at desc
  limit 1;

  if v_team_id is null then
    raise exception 'Time base [GESPE3] TIME / [GESP3] TIME B nao encontrado';
  end if;

  if v_org_id is null then
    v_org_id := public.resolve_team_org_id(v_team_id);
  end if;

  if v_org_id is null then
    raise exception 'Nao foi possivel resolver a organizacao do time base %', v_team_id;
  end if;

  if (
    select count(*)
    from public.teams team
    where regexp_replace(upper(btrim(team.name)), '[^A-Z0-9]', '', 'g')
      in ('GESPE3TIME', 'GESP3TIME', 'GESPE3TIMEB', 'GESP3TIMEB')
      and coalesce(team.org_id, public.resolve_team_org_id(team.id)) = v_org_id
  ) <> 1 then
    raise exception 'Mais de um time base GESPE3/GESP3 encontrado na organizacao %', v_org_id;
  end if;

  update public.teams team
  set is_active = true,
      updated_at = now()
  where team.id = v_team_id;

  update public.teams team
  set is_active = false,
      updated_at = now()
  where coalesce(team.org_id, public.resolve_team_org_id(team.id)) = v_org_id
    and regexp_replace(upper(btrim(team.name)), '[^A-Z0-9]', '', 'g')
      in ('GESPE3TIMEA', 'GESPE3TIMEC', 'GESP3TIMEA', 'GESP3TIMEC')
    and coalesce(team.is_active, true);

  get diagnostics v_removed_team_count = row_count;

  if v_removed_team_count = 0 then
    raise notice 'Nenhum time A/C ativo encontrado para inativar em %', v_org_id;
  end if;

  update public.profiles profile
  set is_active = true,
      module_access = 'admin',
      team_id = v_team_id,
      updated_at = now()
  where profile.user_id = v_user_id;

  if not found then
    insert into public.profiles (
      user_id,
      email,
      display_name,
      module_access,
      team_id,
      is_active
    )
    values (
      v_user_id,
      v_email,
      split_part(v_email, '@', 1),
      'admin',
      v_team_id,
      true
    );
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (v_team_id, v_user_id, 'admin')
  on conflict (team_id, user_id) do update
    set role = 'admin';

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'admin'::public.app_role)
  on conflict (user_id, role) do nothing;

  insert into public.user_module_roles (user_id, module, role_name)
  values
    (v_user_id, 'sala_agil', 'admin'),
    (v_user_id, 'sustentacao', 'admin'),
    (v_user_id, 'rdm', 'admin')
  on conflict (user_id, module) do update
    set role_name = 'admin';

  select exists (
    select 1
    from public.organization_members member
    where member.org_id = v_org_id
      and member.user_id = v_user_id
  )
  into v_org_member_exists;

  if not exists (
    select 1
    from public.organization_members member
    where member.org_id = v_org_id
      and member.user_id = v_user_id
      and member.is_active
  ) then
    with usage as (
      select count(*)::bigint + 1 as required_users_limit
      from public.organization_members member
      where member.org_id = v_org_id
        and member.is_active
    ),
    current_entitlement as (
      select entitlement.limit_value
      from public.get_effective_organization_entitlements(v_org_id) entitlement
      where entitlement.feature_key = 'users.max'
      limit 1
    )
    insert into public.organization_entitlement_overrides (
      org_id,
      feature_key,
      enabled,
      limit_value,
      reason,
      metadata,
      created_by
    )
    select
      v_org_id,
      'users.max',
      true,
      greatest(
        usage.required_users_limit,
        coalesce(current_entitlement.limit_value, usage.required_users_limit)
      ),
      'Hotfix para restaurar acesso administrativo de rjoacina@gmail.com ao time GESP3.',
      jsonb_build_object(
        'operation', '20260707_01_restore_rjoacina_gespe3_access',
        'required_users_limit', usage.required_users_limit,
        'previous_effective_limit', current_entitlement.limit_value
      ),
      v_user_id
    from usage
    left join current_entitlement on true
    on conflict (org_id, feature_key) do update
      set enabled = true,
          limit_value = case
            when public.organization_entitlement_overrides.limit_value is null then null
            else greatest(
              public.organization_entitlement_overrides.limit_value,
              excluded.limit_value
            )
          end,
          reason = excluded.reason,
          metadata = coalesce(public.organization_entitlement_overrides.metadata, '{}'::jsonb)
            || excluded.metadata,
          updated_at = now();
  end if;

  if v_org_member_exists then
    update public.organization_members member
    set role = case
          when member.role::text = 'owner' then member.role
          else 'admin'::public.org_member_role
        end,
        is_active = true,
        updated_at = now(),
        updated_by = v_user_id
    where member.org_id = v_org_id
      and member.user_id = v_user_id;
  else
    insert into public.organization_members (
      org_id,
      user_id,
      role,
      is_active,
      updated_by
    )
    values (
      v_org_id,
      v_user_id,
      'admin'::public.org_member_role,
      true,
      v_user_id
    );
  end if;

  insert into public.organization_member_modules (
    org_id,
    user_id,
    module_key,
    role_name,
    assigned_by
  )
  values
    (v_org_id, v_user_id, 'sala_agil', 'admin', v_user_id),
    (v_org_id, v_user_id, 'sustentacao', 'admin', v_user_id),
    (v_org_id, v_user_id, 'rdm', 'admin', v_user_id)
  on conflict (org_id, user_id, module_key) do update
    set role_name = 'admin',
        assigned_by = excluded.assigned_by,
        updated_at = now();

  if to_regprocedure('public.is_organization_admin(uuid,uuid)') is not null
     and not public.is_organization_admin(v_org_id, v_user_id) then
    raise exception 'Validacao falhou: usuario % nao ficou admin da organizacao %', v_email, v_org_id;
  end if;

  if not exists (
    select 1
    from public.team_members member
    where member.team_id = v_team_id
      and member.user_id = v_user_id
      and member.role = 'admin'
  ) then
    raise exception 'Validacao falhou: usuario % nao ficou admin do time %', v_email, v_team_id;
  end if;
end;
$$;

commit;

select
  auth_user.email,
  organization.name as organization_name,
  organization_member.role::text as organization_role,
  organization_member.is_active as organization_membership_active,
  team.name as controlled_team_name,
  team_member.role as team_role,
  profile.module_access,
  profile.is_active as profile_active,
  array(
    select removed_team.name
    from public.teams removed_team
    where coalesce(removed_team.org_id, public.resolve_team_org_id(removed_team.id)) = organization.id
      and regexp_replace(upper(btrim(removed_team.name)), '[^A-Z0-9]', '', 'g')
        in ('GESPE3TIMEA', 'GESPE3TIMEC', 'GESP3TIMEA', 'GESP3TIMEC')
      and not coalesce(removed_team.is_active, true)
    order by removed_team.name
  ) as inactive_removed_teams
from auth.users auth_user
join public.profiles profile
  on profile.user_id = auth_user.id
join public.teams team
  on team.id = profile.team_id
join public.organizations organization
  on organization.id = coalesce(team.org_id, public.resolve_team_org_id(team.id))
join public.organization_members organization_member
  on organization_member.org_id = organization.id
 and organization_member.user_id = auth_user.id
left join public.team_members team_member
  on team_member.team_id = team.id
 and team_member.user_id = auth_user.id
where lower(btrim(auth_user.email)) = 'rjoacina@gmail.com';
