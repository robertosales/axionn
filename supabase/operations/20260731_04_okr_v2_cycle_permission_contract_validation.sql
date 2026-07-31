-- OKR V2 - validação somente leitura da permissão de aprovação/fechamento.
-- Executar após 20260731143000_okr_v2_cycle_permission_contract_fix.sql.

with required_functions(signature) as (
  values
    ('public.start_okr_cycle_closing_v1(uuid)'),
    ('public.close_okr_cycle_v1(uuid)'),
    ('public.approve_okr_objective_review_v1(uuid,uuid,boolean,text)'),
    ('public.upsert_okr_cycle_review_v1(uuid,jsonb)'),
    ('public.approve_okr_cycle_review_v1(uuid,boolean)')
), function_contract as (
  select
    count(*) = 5 as required_function_count_is_five,
    count(proc.oid) = 5 as all_required_functions_exist,
    coalesce(bool_and(proc.prosecdef), false)
      as all_required_functions_are_security_definer,
    coalesce(bool_and(
      proc.proconfig @> array['search_path=public, pg_temp']::text[]
    ), false) as all_required_functions_have_hardened_search_path,
    coalesce(bool_and(
      case when proc.oid is null then false
      else pg_get_functiondef(proc.oid) !~* '''okr\.close_cycle'''
      end
    ), false) as no_function_uses_legacy_close_permission,
    coalesce(bool_and(
      case when proc.oid is null then false
      else pg_get_functiondef(proc.oid)
        ~* '_okr_v2_guard\s*\([^;]*''okr\.cycle_management''\s*,\s*''okr\.cycle_management'''
      end
    ), false) as all_functions_use_canonical_cycle_permission
  from required_functions required
  left join pg_proc proc
    on proc.oid = to_regprocedure(required.signature)
), catalog_contract as (
  select
    exists (
      select 1 from public.app_permissions
      where key = 'okr.cycle_management'
    ) as canonical_cycle_permission_exists,
    not exists (
      select 1 from public.app_permissions
      where key = 'okr.close_cycle'
    ) as legacy_close_permission_does_not_exist,
    exists (
      select 1 from public.role_permissions
      where role_name = 'admin'
        and permission_key = 'okr.cycle_management'
    ) as admin_has_canonical_cycle_permission
)
select
  functions.required_function_count_is_five,
  functions.all_required_functions_exist,
  functions.all_required_functions_are_security_definer,
  functions.all_required_functions_have_hardened_search_path,
  functions.no_function_uses_legacy_close_permission,
  functions.all_functions_use_canonical_cycle_permission,
  catalog.canonical_cycle_permission_exists,
  catalog.legacy_close_permission_does_not_exist,
  catalog.admin_has_canonical_cycle_permission,
  functions.required_function_count_is_five
    and functions.all_required_functions_exist
    and functions.all_required_functions_are_security_definer
    and functions.all_required_functions_have_hardened_search_path
    and functions.no_function_uses_legacy_close_permission
    and functions.all_functions_use_canonical_cycle_permission
    and catalog.canonical_cycle_permission_exists
    and catalog.legacy_close_permission_does_not_exist
    and catalog.admin_has_canonical_cycle_permission
    as okr_v2_cycle_permission_contract_validation_ok
from function_contract functions
cross join catalog_contract catalog;
