-- Axion SaaS - Fase 2A / Lote 6
-- Cutover manual: desliga somente o fallback legado de permissoes organizacionais.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:06_disable_legacy_permission_fallback')
);

do $$
declare
  v_missing text;
  v_tenancy_enforced_before boolean;
  v_blockers bigint;
begin
  select public.is_tenancy_enforced() into v_tenancy_enforced_before;
  perform set_config(
    'axionn.lote6.tenancy_enforced_before',
    v_tenancy_enforced_before::text,
    false
  );

  select string_agg(object_name, ', ' order by object_name)
  into v_missing
  from (
    values
      ('public.saas_runtime_settings', to_regclass('public.saas_runtime_settings') is not null),
      ('public.organization_members', to_regclass('public.organization_members') is not null),
      ('public.organization_member_modules', to_regclass('public.organization_member_modules') is not null),
      ('public.platform_user_roles', to_regclass('public.platform_user_roles') is not null),
      ('public.is_tenancy_enforced()', to_regprocedure('public.is_tenancy_enforced()') is not null),
      ('public.is_organization_legacy_permission_fallback_enabled()', to_regprocedure('public.is_organization_legacy_permission_fallback_enabled()') is not null),
      ('public.set_organization_legacy_permission_fallback(boolean)', to_regprocedure('public.set_organization_legacy_permission_fallback(boolean)') is not null),
      ('public.get_my_organization_module_roles(uuid)', to_regprocedure('public.get_my_organization_module_roles(uuid)') is not null),
      ('public.get_accessible_teams_v2(uuid)', to_regprocedure('public.get_accessible_teams_v2(uuid)') is not null)
  ) dependency(object_name, present)
  where not present;

  if v_missing is not null then
    raise exception 'Dependencias ausentes para cutover Lote 6: %', v_missing;
  end if;

  with active_memberships as (
    select org_id, user_id
    from public.organization_members
    where is_active
  ),
  platform_admins as (
    select user_id
    from public.platform_user_roles
    where role = 'platform_admin'
  ),
  blockers as (
    select 'active_membership_without_modules' as blocker, member.user_id
    from active_memberships member
    where not exists (
      select 1
      from public.organization_member_modules module_access
      where module_access.org_id = member.org_id
        and module_access.user_id = member.user_id
    )
      and not exists (
        select 1 from platform_admins platform_admin where platform_admin.user_id = member.user_id
      )
    union all
    select 'orphan_module', module_access.user_id
    from public.organization_member_modules module_access
    left join public.organization_members member
      on member.org_id = module_access.org_id
     and member.user_id = module_access.user_id
    where member.user_id is null
    union all
    select 'inactive_membership_module', module_access.user_id
    from public.organization_member_modules module_access
    join public.organization_members member
      on member.org_id = module_access.org_id
     and member.user_id = module_access.user_id
    where not member.is_active
    union all
    select 'invalid_module', module_access.user_id
    from public.organization_member_modules module_access
    where module_access.module_key not in ('sala_agil', 'sustentacao', 'rdm')
    union all
    select 'legacy_admin_missing_platform_admin', role.user_id
    from public.user_roles role
    where role.role = 'admin'
      and not exists (
        select 1
        from public.platform_user_roles platform_role
        where platform_role.user_id = role.user_id
          and platform_role.role = 'platform_admin'
      )
  )
  select count(*) into v_blockers from blockers;

  if v_blockers <> 0 then
    raise exception 'Cutover Lote 6 bloqueado: % bloqueadores criticos encontrados.', v_blockers;
  end if;

  if has_function_privilege('anon', 'public.set_organization_legacy_permission_fallback(boolean)', 'EXECUTE') then
    raise exception 'Cutover Lote 6 bloqueado: anon pode alterar fallback legado.';
  end if;
end;
$$;

select public.set_organization_legacy_permission_fallback(false);

do $$
begin
  if public.is_organization_legacy_permission_fallback_enabled() then
    raise exception 'Post-validation failed: fallback legado ainda esta ligado.';
  end if;

  if public.is_tenancy_enforced()::text is distinct from
     current_setting('axionn.lote6.tenancy_enforced_before', true) then
    raise exception 'Post-validation failed: tenancy_enforcement foi alterado.';
  end if;
end;
$$;

commit;

select
  public.is_organization_legacy_permission_fallback_enabled() = false as fallback_disabled,
  public.is_tenancy_enforced()::text =
    current_setting('axionn.lote6.tenancy_enforced_before', true) as tenancy_enforcement_unchanged,
  (
    public.is_organization_legacy_permission_fallback_enabled() = false
    and public.is_tenancy_enforced()::text =
      current_setting('axionn.lote6.tenancy_enforced_before', true)
  ) as legacy_permission_cutover_ok;
