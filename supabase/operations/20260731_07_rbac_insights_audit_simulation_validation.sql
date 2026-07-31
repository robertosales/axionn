-- Validação somente leitura para RBAC insights v1.

with functions as (
  select
    to_regprocedure('public.list_rbac_audit_events_v1(uuid,integer,text)') as audit_rpc,
    to_regprocedure('public.simulate_rbac_user_access_v1(uuid,uuid)') as simulation_rpc
), definitions as (
  select
    pg_get_functiondef(audit_rpc) as audit_definition,
    pg_get_functiondef(simulation_rpc) as simulation_definition
  from functions
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
    audit_definition ~ 'event\.org_id = p_org_id'
      and audit_definition ~ 'is_organization_admin\(p_org_id, auth\.uid\(\)\)'
      as audit_is_tenant_scoped,
    audit_definition ~ 'rbac_profile_created'
      and audit_definition ~ 'member_profile_managed'
      as audit_filters_rbac_actions,
    simulation_definition ~ 'member\.org_id = p_org_id'
      and simulation_definition ~ 'member\.user_id = p_user_id'
      as simulation_verifies_membership,
    simulation_definition ~ 'access\.org_id = p_org_id'
      and simulation_definition ~ 'access\.user_id = p_user_id'
      and simulation_definition ~ 'permission\.group_key\) = access\.module_key'
      as simulation_is_tenant_and_module_scoped
  from functions, definitions
)
select
  *,
  audit_rpc_exists
    and simulation_rpc_exists
    and functions_are_security_definer
    and functions_have_hardened_search_path
    and anon_cannot_execute_insights
    and authenticated_can_execute_insights
    and audit_is_tenant_scoped
    and audit_filters_rbac_actions
    and simulation_verifies_membership
    and simulation_is_tenant_and_module_scoped
    as rbac_insights_audit_simulation_validation_ok
from checks;
