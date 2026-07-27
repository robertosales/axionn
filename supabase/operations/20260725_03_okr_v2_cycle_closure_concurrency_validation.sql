-- OKR V2 - validacao somente leitura do hardening de fechamento concorrente.
-- Execute depois de 20260725170000_okr_v2_cycle_closure_concurrency_hardening.sql.

with expected(signature) as (
  values
    ('public.start_okr_cycle_closing_v1(uuid)'::text),
    ('public.close_okr_cycle_v1(uuid)'::text)
),
resolved as (
  select
    e.signature,
    to_regprocedure(e.signature) as function_oid
  from expected e
),
checks as (
  select
    r.signature,
    r.function_oid is not null as function_available,
    coalesce(p.prosecdef, false) as security_definer,
    coalesce(p.proconfig @> array['search_path=public'], false) as safe_search_path,
    coalesce(pg_get_functiondef(r.function_oid) ~* '\mfor\s+update\M', false)
      as row_lock_present,
    coalesce(pg_get_functiondef(r.function_oid) ~* '\mstatus\s*=\s*''(active|closing)''', false)
      as conditional_transition_present,
    coalesce(pg_get_functiondef(r.function_oid) like '%40001%', false)
      as serialization_error_present,
    case when r.function_oid is null then false
         else not has_function_privilege('anon', r.function_oid, 'EXECUTE')
    end as anon_cannot_execute,
    case when r.function_oid is null then false
         else has_function_privilege('authenticated', r.function_oid, 'EXECUTE')
    end as authenticated_can_execute,
    case when r.function_oid is null then false
         else has_function_privilege('service_role', r.function_oid, 'EXECUTE')
    end as service_role_can_execute
  from resolved r
  left join pg_proc p on p.oid = r.function_oid
)
select
  count(*) filter (where function_available) as cycle_closure_rpcs_available,
  bool_and(security_definer) as cycle_closure_rpcs_security_definer,
  bool_and(safe_search_path) as cycle_closure_rpcs_safe_search_path,
  bool_and(row_lock_present) as cycle_closure_row_locks_present,
  bool_and(conditional_transition_present) as cycle_closure_conditional_transitions_present,
  bool_and(serialization_error_present) as cycle_closure_serialization_errors_present,
  bool_and(anon_cannot_execute) as anon_cannot_execute_cycle_closure_rpcs,
  bool_and(authenticated_can_execute) as authenticated_can_execute_cycle_closure_rpcs,
  bool_and(service_role_can_execute) as service_role_can_execute_cycle_closure_rpcs,
  bool_and(
    function_available
    and security_definer
    and safe_search_path
    and row_lock_present
    and conditional_transition_present
    and serialization_error_present
    and anon_cannot_execute
    and authenticated_can_execute
    and service_role_can_execute
  ) as okr_v2_cycle_closure_concurrency_validation_ok
from checks;
