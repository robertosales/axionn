with checks as (
  select
    to_regprocedure('public.list_rbac_profiles_v1(uuid)') is not null
      as profile_list_rpc_exists,
    to_regprocedure('public.list_rbac_permissions_v1(uuid)') is not null
      as permission_list_rpc_exists,
    to_regprocedure('public.save_rbac_profile_v1(uuid,text,text,text,text,text,text,text[],text[])') is not null
      as profile_save_rpc_exists,
    to_regprocedure('public.archive_rbac_profile_v1(uuid,text)') is not null
      as profile_archive_rpc_exists,
    to_regprocedure('public.is_rbac_profile_available_v1(uuid,text,text)') is not null
      as profile_scope_guard_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'app_roles'
        and column_name = 'organization_id'
    ) as profiles_are_tenant_scoped,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'app_roles'
        and column_name = 'module_keys'
    ) as profiles_have_module_scope,
    (
      select count(*) = 5
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname in (
          'list_rbac_profiles_v1', 'list_rbac_permissions_v1',
          'save_rbac_profile_v1', 'archive_rbac_profile_v1',
          'is_rbac_profile_available_v1'
        )
        and procedure.prosecdef
        and position('public' in coalesce(array_to_string(procedure.proconfig, ','), '')) > 0
    ) as rbac_functions_are_hardened,
    not has_function_privilege('anon', 'public.list_rbac_profiles_v1(uuid)', 'EXECUTE')
      as anon_cannot_list_profiles,
    has_function_privilege('authenticated', 'public.list_rbac_profiles_v1(uuid)', 'EXECUTE')
      as authenticated_can_list_profiles,
    has_function_privilege('authenticated', 'public.save_rbac_profile_v1(uuid,text,text,text,text,text,text,text[],text[])', 'EXECUTE')
      as authenticated_can_request_profile_save,
    position(
      'is_rbac_profile_available_v1' in pg_get_functiondef(
        'public.manage_organization_member_profile_v2(uuid,uuid,text,text,boolean,jsonb)'::regprocedure
      )
    ) > 0 as member_assignment_uses_profile_scope_guard
)
select
  *,
  profile_list_rpc_exists
    and permission_list_rpc_exists
    and profile_save_rpc_exists
    and profile_archive_rpc_exists
    and profile_scope_guard_exists
    and profiles_are_tenant_scoped
    and profiles_have_module_scope
    and rbac_functions_are_hardened
    and anon_cannot_list_profiles
    and authenticated_can_list_profiles
    and authenticated_can_request_profile_save
    and member_assignment_uses_profile_scope_guard
    as rbac_profile_management_validation_ok
from checks;
