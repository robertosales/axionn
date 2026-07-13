
-- =========================================================
-- 1) ai_briefing_retention_config: enable RLS + org policies
-- =========================================================
ALTER TABLE public.ai_briefing_retention_config ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_briefing_retention_config TO authenticated;
GRANT ALL ON public.ai_briefing_retention_config TO service_role;

DROP POLICY IF EXISTS "ai_briefing_retention_config_select" ON public.ai_briefing_retention_config;
DROP POLICY IF EXISTS "ai_briefing_retention_config_manage" ON public.ai_briefing_retention_config;
DROP POLICY IF EXISTS "ai_briefing_retention_config_service" ON public.ai_briefing_retention_config;

CREATE POLICY "ai_briefing_retention_config_select"
  ON public.ai_briefing_retention_config
  FOR SELECT TO authenticated
  USING (public.is_organization_member(auth.uid(), org_id));

CREATE POLICY "ai_briefing_retention_config_manage"
  ON public.ai_briefing_retention_config
  FOR ALL TO authenticated
  USING (public.is_organization_admin(auth.uid(), org_id))
  WITH CHECK (public.is_organization_admin(auth.uid(), org_id));

CREATE POLICY "ai_briefing_retention_config_service"
  ON public.ai_briefing_retention_config
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =========================================================
-- 2) APF tables: drop overly permissive auth_select / service_role_all
-- =========================================================
DROP POLICY IF EXISTS "auth_select" ON public.apf_knowledge_patterns;
DROP POLICY IF EXISTS "service_role_all" ON public.apf_knowledge_patterns;

DROP POLICY IF EXISTS "auth_select" ON public.apf_learning_metrics;
DROP POLICY IF EXISTS "service_role_all" ON public.apf_learning_metrics;

DROP POLICY IF EXISTS "auth_select" ON public.apf_similar_cases;
DROP POLICY IF EXISTS "service_role_all" ON public.apf_similar_cases;

DROP POLICY IF EXISTS "auth_select" ON public.apf_validation_events;
DROP POLICY IF EXISTS "service_role_all" ON public.apf_validation_events;

-- apf_similar_cases had no team-scoped select; add one
CREATE POLICY "apf_sc_select_team_or_admin"
  ON public.apf_similar_cases
  FOR SELECT TO authenticated
  USING (
    team_id IS NULL
    OR public.is_team_member(auth.uid(), team_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "apf_sc_service_role"
  ON public.apf_similar_cases
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Re-add scoped service_role policies to the other APF tables
CREATE POLICY "apf_kp_service_role_all"
  ON public.apf_knowledge_patterns
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "apf_lm_service_role_all"
  ON public.apf_learning_metrics
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "apf_ve_service_role_all"
  ON public.apf_validation_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =========================================================
-- 3) function_point_analyses: drop open policies, scope by project team
-- =========================================================
DROP POLICY IF EXISTS "Autenticados atualizam analyses" ON public.function_point_analyses;
DROP POLICY IF EXISTS "Autenticados inserem analyses" ON public.function_point_analyses;
DROP POLICY IF EXISTS "Autenticados veem analyses" ON public.function_point_analyses;
DROP POLICY IF EXISTS "fpa_insert" ON public.function_point_analyses;
DROP POLICY IF EXISTS "fpa_select" ON public.function_point_analyses;
DROP POLICY IF EXISTS "fpa_update" ON public.function_point_analyses;

CREATE POLICY "fpa_select_team_or_admin"
  ON public.function_point_analyses
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = function_point_analyses.project_id
        AND public.is_team_member(auth.uid(), p.team_id)
    )
  );

CREATE POLICY "fpa_insert_team_or_admin"
  ON public.function_point_analyses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = function_point_analyses.project_id
        AND public.is_team_member(auth.uid(), p.team_id)
    )
  );

CREATE POLICY "fpa_update_team_or_admin"
  ON public.function_point_analyses
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = function_point_analyses.project_id
        AND public.is_team_member(auth.uid(), p.team_id)
    )
  );

CREATE POLICY "fpa_service_role"
  ON public.function_point_analyses
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =========================================================
-- 4) okr_check_ins: scope select by team membership via key result -> objective
-- =========================================================
DROP POLICY IF EXISTS "okr_check_ins_select" ON public.okr_check_ins;

CREATE POLICY "okr_check_ins_select"
  ON public.okr_check_ins
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.okr_key_results kr
      JOIN public.okr_objectives o ON o.id = kr.objective_id
      JOIN public.team_members tm ON tm.team_id = o.team_id
      WHERE kr.id = okr_check_ins.key_result_id
        AND tm.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- =========================================================
-- 5) okr_key_results: drop open policies (team-scoped ones remain)
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can delete key results" ON public.okr_key_results;
DROP POLICY IF EXISTS "Authenticated users can insert key results" ON public.okr_key_results;
DROP POLICY IF EXISTS "Authenticated users can select key results" ON public.okr_key_results;
DROP POLICY IF EXISTS "Authenticated users can update key results" ON public.okr_key_results;

-- =========================================================
-- 6) project_fp_baselines: drop open select, add scoped select
-- =========================================================
DROP POLICY IF EXISTS "Todos autenticados veem baselines" ON public.project_fp_baselines;

CREATE POLICY "project_fp_baselines_select_team_or_admin"
  ON public.project_fp_baselines
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_fp_baselines.project_id
        AND public.is_team_member(auth.uid(), p.team_id)
    )
  );

-- =========================================================
-- 7) Convert views to security_invoker (fix SUPA_security_definer_view)
-- =========================================================
ALTER VIEW public.v_hu_git_summary                 SET (security_invoker = true);
ALTER VIEW public.v_redmine_integration_health     SET (security_invoker = true);
ALTER VIEW public.v_user_story_code_duplicates     SET (security_invoker = true);
ALTER VIEW public.vw_user_contract_roles           SET (security_invoker = true);
ALTER VIEW public.v_api_gateway_usage_daily        SET (security_invoker = true);
ALTER VIEW public.vw_projetos                      SET (security_invoker = true);
ALTER VIEW public.v_apf_confidence_calibration     SET (security_invoker = true);
ALTER VIEW public.v_apf_process_learning_accuracy  SET (security_invoker = true);
ALTER VIEW public.vw_contract_coverage             SET (security_invoker = true);
ALTER VIEW public.v_teams_notification_health      SET (security_invoker = true);
ALTER VIEW public.v_apf_accuracy_trend             SET (security_invoker = true);
ALTER VIEW public.vw_sprint_pf_summary             SET (security_invoker = true);
ALTER VIEW public.v_apf_confusion_matrix           SET (security_invoker = true);
ALTER VIEW public.v_sprint_risk_dashboard          SET (security_invoker = true);
ALTER VIEW public.v_teams_adoption_report          SET (security_invoker = true);
ALTER VIEW public.v_dora_dashboard                 SET (security_invoker = true);
ALTER VIEW public.v_copilot_usage_report           SET (security_invoker = true);
ALTER VIEW public.v_copilot_top_intents            SET (security_invoker = true);
ALTER VIEW public.v_oracle_job_health              SET (security_invoker = true);
ALTER VIEW public.v_apex_usage_report              SET (security_invoker = true);
ALTER VIEW public.v_executive_adoption_report      SET (security_invoker = true);
ALTER VIEW public.v_integration_health_report      SET (security_invoker = true);

-- =========================================================
-- 8) Pin search_path on user-defined public functions
-- =========================================================
ALTER FUNCTION public.apf_create_dpf_globalweb_model(uuid)                                            SET search_path = public;
ALTER FUNCTION public.build_apf_prompt(uuid, text)                                                    SET search_path = public;
ALTER FUNCTION public.calculate_apf_item(uuid, text, text)                                            SET search_path = public;
ALTER FUNCTION public.check_license_quota(uuid)                                                       SET search_path = public;
ALTER FUNCTION public.fn_fpa_on_validate()                                                            SET search_path = public;
ALTER FUNCTION public.fn_get_fewshot_examples(integer)                                                SET search_path = public;
ALTER FUNCTION public.fn_set_updated_at_apf_kp()                                                      SET search_path = public;
ALTER FUNCTION public.fn_sync_demanda_contract_id()                                                   SET search_path = public;
ALTER FUNCTION public.get_apf_model_by_contract(uuid)                                                 SET search_path = public;
ALTER FUNCTION public.get_apf_session_summary(uuid)                                                   SET search_path = public;
ALTER FUNCTION public.increment_license_usage(uuid, integer, integer)                                 SET search_path = public;
ALTER FUNCTION public.is_apf_auxiliary_action(text)                                                   SET search_path = public;
ALTER FUNCTION public.is_team_member(uuid, uuid)                                                      SET search_path = public;
ALTER FUNCTION public.match_similar_apf_cases(vector, double precision, integer, uuid, text)          SET search_path = public;
ALTER FUNCTION public.normalize_apf_process_key(text)                                                 SET search_path = public;
ALTER FUNCTION public.normalize_apf_ref(text)                                                         SET search_path = public;
ALTER FUNCTION public.normalize_apf_text(text)                                                        SET search_path = public;
ALTER FUNCTION public.provision_apf_model_pfs_dpf(uuid, text)                                         SET search_path = public;
ALTER FUNCTION public.recalculate_objective_progress()                                                SET search_path = public;
ALTER FUNCTION public.recalculate_session_totals(uuid)                                                SET search_path = public;
ALTER FUNCTION public.save_counting_items(uuid, jsonb, text)                                          SET search_path = public;
ALTER FUNCTION public.set_companies_updated_at()                                                      SET search_path = public;
ALTER FUNCTION public.set_licenses_updated_at()                                                       SET search_path = public;
ALTER FUNCTION public.set_updated_at()                                                                SET search_path = public;
ALTER FUNCTION public.set_user_contracts_updated_at()                                                 SET search_path = public;
ALTER FUNCTION public.trg_fn_recalculate_session_totals()                                             SET search_path = public;
ALTER FUNCTION public.update_fp_updated_at()                                                          SET search_path = public;
ALTER FUNCTION public.update_updated_at_column()                                                      SET search_path = public;
