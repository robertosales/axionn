-- OKR V2 - validacao somente leitura da boundary atomica de check-in.
-- Execute depois de 20260725180000_okr_v2_atomic_check_in.sql.

with resolved as (
  select to_regprocedure(
    'public.record_okr_check_in_v2(uuid,uuid,jsonb)'
  ) as function_oid
),
definition as (
  select
    r.function_oid,
    p.prosecdef,
    p.proconfig,
    case
      when r.function_oid is null then null
      else pg_get_functiondef(r.function_oid)
    end as body
  from resolved r
  left join pg_proc p on p.oid = r.function_oid
),
checks as (
  select
    function_oid is not null as check_in_rpc_available,
    coalesce(prosecdef, false) as check_in_rpc_security_definer,
    coalesce(proconfig @> array['search_path=public'], false)
      as check_in_rpc_safe_search_path,
    coalesce(body ~* '\mfor\s+update\s+of\s+kr\M', false)
      as check_in_row_lock_present,
    coalesce(body like '%insert into public.okr_check_ins%', false)
      as check_in_write_present,
    coalesce(body like '%update public.okr_key_results%', false)
      as key_result_write_present,
    coalesce(body like '%insert into public.okr_key_result_snapshots%', false)
      as snapshot_write_present,
    coalesce(body like '%recalculate_okr_objective_v2%', false)
      as objective_recalculation_present,
    coalesce(body like '%insert into public.okr_audit_log%', false)
      as audit_write_present,
    coalesce(body not like '%OKR_V2_NOT_IMPLEMENTED%', false)
      as implementation_stub_removed,
    case when function_oid is null then false
         else not has_function_privilege('anon', function_oid, 'EXECUTE')
    end as anon_cannot_execute,
    case when function_oid is null then false
         else has_function_privilege('authenticated', function_oid, 'EXECUTE')
    end as authenticated_can_execute,
    case when function_oid is null then false
         else has_function_privilege('service_role', function_oid, 'EXECUTE')
    end as service_role_can_execute
  from definition
)
select
  *,
  (
    check_in_rpc_available
    and check_in_rpc_security_definer
    and check_in_rpc_safe_search_path
    and check_in_row_lock_present
    and check_in_write_present
    and key_result_write_present
    and snapshot_write_present
    and objective_recalculation_present
    and audit_write_present
    and implementation_stub_removed
    and anon_cannot_execute
    and authenticated_can_execute
    and service_role_can_execute
  ) as okr_v2_atomic_check_in_validation_ok
from checks;
