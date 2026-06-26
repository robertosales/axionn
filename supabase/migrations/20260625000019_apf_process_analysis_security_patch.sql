-- ============================================================
-- APF — restrição explícita dos RPCs da análise estruturada.
-- PostgreSQL concede EXECUTE a PUBLIC por padrão; esta migration
-- remove o acesso anônimo e preserva authenticated/service_role.
-- ============================================================

REVOKE ALL ON FUNCTION public.get_apf_project_process_candidates_unfiltered(
  UUID, TEXT, INT
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_apf_project_process_candidates(
  UUID, TEXT, INT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_apf_project_process_candidates(
  UUID, TEXT, INT
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_apf_process_analysis(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_apf_process_analysis(UUID)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.persist_apf_process_analysis(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.persist_apf_process_analysis(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.materialize_apf_process_analysis(UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.materialize_apf_process_analysis(UUID, UUID)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.resolve_apf_process_analysis(UUID, UUID, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_apf_process_analysis(UUID, UUID, JSONB)
  TO authenticated, service_role;
