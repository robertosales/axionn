-- OKR V2 - validacao somente leitura do hardening das RPCs de Objective.
-- Execute no SQL Editor depois da migration
-- 20260725160000_okr_v2_objective_rpc_grants_hardening.sql.
-- Esta operacao nao altera dados, grants ou configuracoes.

with expected(signature) as (
  values
    ('public.create_okr_objective_v2(uuid,jsonb)'::text),
    ('public.update_okr_objective_v2(uuid,uuid,jsonb)'::text),
    ('public.archive_okr_objective_v2(uuid,uuid,text)'::text)
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
    case when r.function_oid is null then false
         else not has_function_privilege('public', r.function_oid, 'EXECUTE')
    end as public_cannot_execute,
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
  count(*) filter (where function_available) as objective_rpcs_available,
  bool_and(security_definer) as objective_rpcs_security_definer,
  bool_and(safe_search_path) as objective_rpcs_safe_search_path,
  bool_and(public_cannot_execute) as public_cannot_execute_objective_rpcs,
  bool_and(anon_cannot_execute) as anon_cannot_execute_objective_rpcs,
  bool_and(authenticated_can_execute) as authenticated_can_execute_objective_rpcs,
  bool_and(service_role_can_execute) as service_role_can_execute_objective_rpcs,
  bool_and(
    function_available
    and security_definer
    and safe_search_path
    and public_cannot_execute
    and anon_cannot_execute
    and authenticated_can_execute
    and service_role_can_execute
  ) as okr_v2_objective_rpc_grants_validation_ok
from checks;
