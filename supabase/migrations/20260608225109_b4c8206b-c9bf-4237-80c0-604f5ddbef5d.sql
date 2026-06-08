
REVOKE EXECUTE ON FUNCTION public.calc_sla_demanda(uuid, text, character) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_get_contract_tree(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_get_project_sla_matrix(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_protect_profile_privileged_fields() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_resolve_demanda_context(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_resolve_sla_limits(uuid, character varying) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_sla_dashboard_batch(uuid, uuid, uuid, integer, text, character) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_sla_status_summary(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_capacity_planner_sustentacao(uuid[], uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_demandas_with_responsaveis(uuid) FROM anon;

ALTER FUNCTION public.fn_check_sla_status(uuid, uuid, character varying, timestamptz, timestamptz) SET search_path = public;
ALTER FUNCTION public.fn_get_team_contract(uuid) SET search_path = public;
ALTER FUNCTION public.fn_set_updated_at() SET search_path = public;
ALTER FUNCTION public.validate_demanda_transition() SET search_path = public;
