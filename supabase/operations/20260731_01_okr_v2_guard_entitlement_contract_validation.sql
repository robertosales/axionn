-- OKR V2 - validação somente leitura do contrato do guard de entitlement.
-- Executar após 20260731110000_okr_v2_guard_entitlement_contract_fix.sql.

with function_contract as (
  select
    guard.oid is not null as guard_exists,
    limit_guard.oid is not null as limit_guard_exists,
    coalesce(limit_guard.prorettype = 'void'::regtype, false)
      as limit_guard_returns_void,
    coalesce(guard.prosecdef, false) as guard_is_security_definer,
    coalesce(guard.provolatile = 's', false) as guard_is_stable,
    coalesce(
      guard.proconfig @> array['search_path=public, pg_temp']::text[],
      false
    ) as guard_has_hardened_search_path,
    coalesce(
      pg_get_functiondef(guard.oid)
        ~* 'perform\s+public\.check_okr_limit_v1\s*\(',
      false
    ) as guard_performs_limit_check,
    coalesce(
      pg_get_functiondef(guard.oid)
        !~* 'select\s+allowed\s+from\s+public\.check_okr_limit_v1',
      false
    ) as guard_does_not_project_void_result
  from (select to_regprocedure('public._okr_v2_guard(uuid,text,text)') as oid) guard_ref
  left join pg_proc guard on guard.oid = guard_ref.oid
  cross join (
    select to_regprocedure('public.check_okr_limit_v1(uuid,text,integer)') as oid
  ) limit_ref
  left join pg_proc limit_guard on limit_guard.oid = limit_ref.oid
), privilege_contract as (
  select
    has_function_privilege(
      'authenticated',
      'public._okr_v2_guard(uuid,text,text)',
      'execute'
    ) as authenticated_can_execute_guard,
    has_function_privilege(
      'service_role',
      'public._okr_v2_guard(uuid,text,text)',
      'execute'
    ) as service_role_can_execute_guard,
    not has_function_privilege(
      'anon',
      'public._okr_v2_guard(uuid,text,text)',
      'execute'
    ) as anon_cannot_execute_guard
)
select
  contract.guard_exists,
  contract.limit_guard_exists,
  contract.limit_guard_returns_void,
  contract.guard_is_security_definer,
  contract.guard_is_stable,
  contract.guard_has_hardened_search_path,
  contract.guard_performs_limit_check,
  contract.guard_does_not_project_void_result,
  privileges.authenticated_can_execute_guard,
  privileges.service_role_can_execute_guard,
  privileges.anon_cannot_execute_guard,
  contract.guard_exists
    and contract.limit_guard_exists
    and contract.limit_guard_returns_void
    and contract.guard_is_security_definer
    and contract.guard_is_stable
    and contract.guard_has_hardened_search_path
    and contract.guard_performs_limit_check
    and contract.guard_does_not_project_void_result
    and privileges.authenticated_can_execute_guard
    and privileges.service_role_can_execute_guard
    and privileges.anon_cannot_execute_guard
    as okr_v2_guard_entitlement_contract_validation_ok
from function_contract contract
cross join privilege_contract privileges;
