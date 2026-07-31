-- Validacao somente leitura do reparo runtime das RPCs de insights RBAC.
with functions as (
  select
    to_regprocedure('public.list_rbac_audit_events_v1(uuid,integer,text)') audit_rpc,
    to_regprocedure('public.simulate_rbac_user_access_v1(uuid,uuid)') simulation_rpc
), checks as (
  select
    audit_rpc is not null as audit_rpc_exists,
    simulation_rpc is not null as simulation_rpc_exists,
    coalesce((select prosecdef from pg_proc where oid = audit_rpc), false)
      and coalesce((select prosecdef from pg_proc where oid = simulation_rpc), false)
      as functions_are_security_definer,
    coalesce((select proconfig @> array['search_path=public, pg_temp'] from pg_proc where oid = audit_rpc), false)
      and coalesce((select proconfig @> array['search_path=public, pg_temp'] from pg_proc where oid = simulation_rpc), false)
      as functions_have_hardened_search_path,
    not has_function_privilege('anon', 'public.list_rbac_audit_events_v1(uuid,integer,text)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.simulate_rbac_user_access_v1(uuid,uuid)', 'EXECUTE')
      as anon_cannot_execute_insights,
    has_function_privilege('authenticated', 'public.list_rbac_audit_events_v1(uuid,integer,text)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.simulate_rbac_user_access_v1(uuid,uuid)', 'EXECUTE')
      as authenticated_can_execute_insights,
    position('event.org_id = p_org_id' in pg_get_functiondef(audit_rpc)) > 0
      and position('is_organization_admin(p_org_id, auth.uid())' in pg_get_functiondef(audit_rpc)) > 0
      as audit_is_tenant_scoped,
    position('access.org_id = p_org_id' in pg_get_functiondef(simulation_rpc)) > 0
      and position('access.user_id = p_user_id' in pg_get_functiondef(simulation_rpc)) > 0
      as simulation_is_tenant_scoped,
    position('access.expires_at is null or access.expires_at > now()' in pg_get_functiondef(simulation_rpc)) > 0
      as simulation_ignores_expired_access
  from functions
)
select checks.*,
  audit_rpc_exists and simulation_rpc_exists
  and functions_are_security_definer and functions_have_hardened_search_path
  and anon_cannot_execute_insights and authenticated_can_execute_insights
  and audit_is_tenant_scoped and simulation_is_tenant_scoped
  and simulation_ignores_expired_access
  as rbac_insights_runtime_repair_validation_ok
from checks;
