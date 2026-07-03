-- Execute once in Lovable Cloud production. Idempotent.

BEGIN;

ALTER TABLE public.apf_process_learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_story_code_repair_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.apf_process_learning_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.user_story_code_repair_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.apf_process_learning_events TO authenticated;
GRANT SELECT ON public.user_story_code_repair_log TO authenticated;
GRANT ALL ON public.apf_process_learning_events TO service_role;
GRANT ALL ON public.user_story_code_repair_log TO service_role;

DROP POLICY IF EXISTS apf_process_learning_select ON public.apf_process_learning_events;
CREATE POLICY apf_process_learning_select
ON public.apf_process_learning_events FOR SELECT TO authenticated
USING (
  public.is_team_member(auth.uid(), team_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS user_story_code_repair_log_select_admin
  ON public.user_story_code_repair_log;
CREATE POLICY user_story_code_repair_log_select_admin
ON public.user_story_code_repair_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY user_stories_update ON public.user_stories TO authenticated
USING (public.can_view_team(auth.uid(), team_id))
WITH CHECK (public.can_view_team(auth.uid(), team_id));

ALTER VIEW public.v_apf_process_learning_accuracy SET (security_invoker = true);
ALTER VIEW public.v_user_story_code_duplicates SET (security_invoker = true);
REVOKE ALL ON public.v_apf_process_learning_accuracy FROM PUBLIC, anon;
REVOKE ALL ON public.v_user_story_code_duplicates FROM PUBLIC, anon;
GRANT SELECT ON public.v_apf_process_learning_accuracy TO authenticated, service_role;
GRANT SELECT ON public.v_user_story_code_duplicates TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.assign_user_story_identity()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_apf_counting_brain_factor()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_apf_conservative_process_defaults()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_apf_process_learning_decision()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.extract_user_story_external_reference(TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extract_user_story_external_reference(TEXT)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.resolve_apf_factor_decision(UUID, UUID, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_apf_process_analysis(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.materialize_apf_process_analysis(UUID, UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_apf_process_analysis_v2(UUID, UUID, JSONB, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_apf_factor_decision(UUID, UUID, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_apf_process_analysis(UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.materialize_apf_process_analysis(UUID, UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_apf_process_analysis_v2(UUID, UUID, JSONB, TEXT, TEXT, TEXT)
  TO authenticated, service_role;

COMMIT;

SELECT
  NOT has_table_privilege('anon', 'public.apf_process_learning_events', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.apf_process_learning_events', 'TRUNCATE')
  AND NOT has_table_privilege('anon', 'public.user_story_code_repair_log', 'SELECT')
  AND NOT has_function_privilege('anon', 'public.resolve_apf_factor_decision(uuid,uuid,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.resolve_apf_process_analysis_v2(uuid,uuid,jsonb,text,text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.materialize_apf_process_analysis(uuid,uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.resolve_apf_process_analysis_v2(uuid,uuid,jsonb,text,text,text)', 'EXECUTE')
  AS apf_security_hardening_ok;
