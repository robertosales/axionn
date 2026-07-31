-- Validação somente leitura da persistência de perfis por módulo.
-- Executar após 20260731170000_organization_member_module_role_persistence.sql.

with function_contract as (
  select
    reader.oid is not null as module_role_reader_exists,
    manager.oid is not null as module_role_manager_exists,
    coalesce(reader.prosecdef, false) as reader_is_security_definer,
    coalesce(manager.prosecdef, false) as manager_is_security_definer,
    coalesce(
      reader.proconfig @> array['search_path=public, pg_temp']::text[],
      false
    ) as reader_has_hardened_search_path,
    coalesce(
      manager.proconfig @> array['search_path=public, pg_temp']::text[],
      false
    ) as manager_has_hardened_search_path,
    coalesce(
      pg_get_functiondef(manager.oid)
        ~* 'insert into public\.organization_member_modules'
      and pg_get_functiondef(manager.oid) ~* '\mrole_name\M',
      false
    ) as manager_persists_module_role_name,
    coalesce(
      pg_get_functiondef(manager.oid)
        ~* 'organization_member_module_role_invalid',
      false
    ) as manager_validates_module_role_pairs,
    coalesce(
      pg_get_functiondef(reader.oid)
        ~* 'where[[:space:]]+module_access\.org_id[[:space:]]*=[[:space:]]*p_org_id',
      false
    ) as reader_is_tenant_scoped
  from (
    select to_regprocedure(
      'public.get_organization_member_module_roles_v1(uuid)'
    ) as oid
  ) reader_ref
  left join pg_proc reader on reader.oid = reader_ref.oid
  cross join (
    select to_regprocedure(
      'public.manage_organization_member_profile_v2(uuid,uuid,text,text,boolean,jsonb)'
    ) as oid
  ) manager_ref
  left join pg_proc manager on manager.oid = manager_ref.oid
), privilege_contract as (
  select
    has_function_privilege(
      'authenticated',
      'public.get_organization_member_module_roles_v1(uuid)',
      'execute'
    ) as authenticated_can_read_module_roles,
    has_function_privilege(
      'authenticated',
      'public.manage_organization_member_profile_v2(uuid,uuid,text,text,boolean,jsonb)',
      'execute'
    ) as authenticated_can_manage_module_roles,
    not has_function_privilege(
      'anon',
      'public.get_organization_member_module_roles_v1(uuid)',
      'execute'
    ) as anon_cannot_read_module_roles,
    not has_function_privilege(
      'anon',
      'public.manage_organization_member_profile_v2(uuid,uuid,text,text,boolean,jsonb)',
      'execute'
    ) as anon_cannot_manage_module_roles
), table_contract as (
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_member_modules'
      and column_name = 'role_name'
  ) as organization_module_role_column_exists
)
select
  functions.module_role_reader_exists,
  functions.module_role_manager_exists,
  functions.reader_is_security_definer,
  functions.manager_is_security_definer,
  functions.reader_has_hardened_search_path,
  functions.manager_has_hardened_search_path,
  functions.manager_persists_module_role_name,
  functions.manager_validates_module_role_pairs,
  functions.reader_is_tenant_scoped,
  privileges.authenticated_can_read_module_roles,
  privileges.authenticated_can_manage_module_roles,
  privileges.anon_cannot_read_module_roles,
  privileges.anon_cannot_manage_module_roles,
  tables.organization_module_role_column_exists,
  functions.module_role_reader_exists
    and functions.module_role_manager_exists
    and functions.reader_is_security_definer
    and functions.manager_is_security_definer
    and functions.reader_has_hardened_search_path
    and functions.manager_has_hardened_search_path
    and functions.manager_persists_module_role_name
    and functions.manager_validates_module_role_pairs
    and functions.reader_is_tenant_scoped
    and privileges.authenticated_can_read_module_roles
    and privileges.authenticated_can_manage_module_roles
    and privileges.anon_cannot_read_module_roles
    and privileges.anon_cannot_manage_module_roles
    and tables.organization_module_role_column_exists
    as organization_member_module_role_persistence_validation_ok
from function_contract functions
cross join privilege_contract privileges
cross join table_contract tables;
