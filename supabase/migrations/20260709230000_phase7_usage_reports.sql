-- Phase 7: Relatórios de Uso, Auditoria e Adoção
-- Cria views materializadas, funções de agregação e relatórios consolidados

-- 1. View Materializada para relatório executivo diário (atualizada via job)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_executive_daily_report AS
SELECT
    uue.tenant_id AS organization_id,
    o.name AS organization_name,
    DATE(uue.created_at) AS report_date,
    -- Usuários ativos
    COUNT(DISTINCT uue.user_id) AS daily_active_users,
    COUNT(DISTINCT uue.user_id) FILTER (WHERE uue.created_at >= DATE(uue.created_at) AND uue.created_at < DATE(uue.created_at) + INTERVAL '1 day') AS daily_active_users_calc,
    -- Ações por funcionalidade
    COUNT(*) FILTER (WHERE uue.event_type LIKE 'hu_%') AS hu_interactions,
    COUNT(*) FILTER (WHERE uue.event_type = 'hu_created') AS hu_created,
    COUNT(*) FILTER (WHERE uue.event_type = 'hu_updated') AS hu_updated,
    COUNT(*) FILTER (WHERE uue.event_type = 'hu_status_changed') AS hu_status_changed,
    COUNT(*) FILTER (WHERE uue.event_type LIKE 'impediment_%') AS impediment_interactions,
    COUNT(*) FILTER (WHERE uue.event_type = 'impediment_created') AS impediment_created,
    COUNT(*) FILTER (WHERE uue.event_type = 'impediment_resolved') AS impediment_resolved,
    -- IA
    COUNT(*) FILTER (WHERE uue.event_type LIKE 'ai_%') AS ai_interactions,
    COUNT(*) FILTER (WHERE uue.event_type = 'ai_hu_generation') AS ai_hu_generations,
    COUNT(*) FILTER (WHERE uue.event_type = 'ai_estimation') AS ai_estimations,
    COUNT(*) FILTER (WHERE uue.event_type = 'ai_risk_analysis') AS ai_risk_analyses,
    -- Sprints
    COUNT(*) FILTER (WHERE uue.event_type LIKE 'sprint_%') AS sprint_interactions,
    -- Relatórios
    COUNT(*) FILTER (WHERE uue.event_type = 'report_exported') AS report_exports,
    -- Por fonte
    COUNT(*) FILTER (WHERE uue.source = 'web') AS web_interactions,
    COUNT(*) FILTER (WHERE uue.source = 'teams') AS teams_interactions,
    COUNT(*) FILTER (WHERE uue.source = 'copilot') AS copilot_interactions,
    COUNT(*) FILTER (WHERE uue.source = 'api') AS api_interactions,
    -- Projetos ativos
    COUNT(DISTINCT uue.project_id) FILTER (WHERE uue.project_id IS NOT NULL) AS active_projects,
    -- Timestamps
    MIN(uue.created_at) AS first_activity_at,
    MAX(uue.created_at) AS last_activity_at,
    now() AS generated_at
FROM public.user_usage_events uue
JOIN public.organizations o ON o.id = uue.tenant_id
WHERE uue.created_at >= now() - INTERVAL '90 days'
GROUP BY uue.tenant_id, o.name, DATE(uue.created_at)
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_executive_daily_report_pk
    ON public.mv_executive_daily_report (organization_id, report_date);

COMMENT ON MATERIALIZED VIEW public.mv_executive_daily_report IS 'Relatório executivo diário de adoção e uso (materializada para performance)';

-- 2. View Materializada para saúde das integrações
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_integration_health_daily AS
SELECT
    iue.tenant_id AS organization_id,
    o.name AS organization_name,
    iue.integration_type,
    iue.external_system,
    DATE(iue.created_at) AS report_date,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE iue.status = 'success') AS success_count,
    COUNT(*) FILTER (WHERE iue.status = 'error') AS error_count,
    COUNT(*) FILTER (WHERE iue.status = 'timeout') AS timeout_count,
    COUNT(*) FILTER (WHERE iue.status = 'retry') AS retry_count,
    COUNT(*) FILTER (WHERE iue.status = 'dead_letter') AS dead_letter_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE iue.status = 'success') / NULLIF(COUNT(*), 0), 2) AS success_rate_pct,
    AVG(iue.duration_ms) FILTER (WHERE iue.status = 'success') AS avg_success_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY iue.duration_ms) FILTER (WHERE iue.status = 'success') AS p95_success_duration_ms,
    MAX(iue.created_at) AS last_event_at,
    now() AS generated_at
FROM public.integration_usage_events iue
JOIN public.organizations o ON o.id = iue.tenant_id
WHERE iue.created_at >= now() - INTERVAL '30 days'
GROUP BY iue.tenant_id, o.name, iue.integration_type, iue.external_system, DATE(iue.created_at)
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_integration_health_daily_pk
    ON public.mv_integration_health_daily (organization_id, integration_type, external_system, report_date);

COMMENT ON MATERIALIZED VIEW public.mv_integration_health_daily IS 'Saúde diária das integrações (materializada para performance)';

-- 3. View Materializada para uso de IA
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_ai_usage_daily AS
SELECT
    uue.tenant_id AS organization_id,
    o.name AS organization_name,
    uue.project_id,
    p.name AS project_name,
    DATE(uue.created_at) AS report_date,
    uue.metadata_json->>'feature' AS ai_feature,
    uue.metadata_json->>'model' AS ai_model,
    COUNT(*) AS total_calls,
    COUNT(DISTINCT uue.user_id) AS unique_users,
    SUM(COALESCE((uue.metadata_json->>'tokens_used')::INTEGER, 0)) AS total_tokens,
    SUM(COALESCE((uue.metadata_json->>'estimated_cost_usd')::NUMERIC, 0)) AS total_estimated_cost_usd,
    AVG(COALESCE((uue.metadata_json->>'tokens_used')::INTEGER, 0))::NUMERIC(10,2) AS avg_tokens_per_call,
    COUNT(*) FILTER (WHERE uue.metadata_json->>'accepted' = 'true') AS accepted_suggestions,
    COUNT(*) FILTER (WHERE uue.metadata_json->>'accepted' = 'false') AS rejected_suggestions,
    ROUND(100.0 * COUNT(*) FILTER (WHERE uue.metadata_json->>'accepted' = 'true') / NULLIF(COUNT(*) FILTER (WHERE uue.metadata_json->>'accepted' IS NOT NULL), 0), 2) AS acceptance_rate_pct,
    now() AS generated_at
FROM public.user_usage_events uue
JOIN public.organizations o ON o.id = uue.tenant_id
LEFT JOIN public.projects p ON p.id = uue.project_id
WHERE uue.event_type LIKE 'ai_%'
  AND uue.created_at >= now() - INTERVAL '60 days'
GROUP BY uue.tenant_id, o.name, uue.project_id, p.name, DATE(uue.created_at), uue.metadata_json->>'feature', uue.metadata_json->>'model'
WITH NO DATA;

CREATE INDEX IF NOT EXISTS idx_mv_ai_usage_daily_org_date ON public.mv_ai_usage_daily (organization_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_mv_ai_usage_daily_feature ON public.mv_ai_usage_daily (ai_feature, report_date DESC);

COMMENT ON MATERIALIZED VIEW public.mv_ai_usage_daily IS 'Uso diário de funcionalidades de IA por organização/projeto (materializada)';

-- 4. View Materializada para adoção por time
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_team_adoption_weekly AS
SELECT
    uue.tenant_id AS organization_id,
    o.name AS organization_name,
    tm.team_id,
    t.name AS team_name,
    DATE_TRUNC('week', uue.created_at)::DATE AS week_start,
    COUNT(DISTINCT uue.user_id) AS weekly_active_users,
    COUNT(*) AS total_interactions,
    COUNT(*) FILTER (WHERE uue.event_type LIKE 'hu_%') AS hu_interactions,
    COUNT(*) FILTER (WHERE uue.event_type LIKE 'ai_%') AS ai_interactions,
    COUNT(*) FILTER (WHERE uue.event_type = 'report_exported') AS report_exports,
    COUNT(DISTINCT uue.project_id) FILTER (WHERE uue.project_id IS NOT NULL) AS active_projects,
    -- Feature adoption
    COUNT(DISTINCT uue.user_id) FILTER (WHERE uue.event_type = 'ai_hu_generation') AS users_using_ai_hu,
    COUNT(DISTINCT uue.user_id) FILTER (WHERE uue.event_type = 'planning_poker_vote') AS users_using_planning_poker,
    COUNT(DISTINCT uue.user_id) FILTER (WHERE uue.source = 'teams') AS users_using_teams,
    COUNT(DISTINCT uue.user_id) FILTER (WHERE uue.source = 'copilot') AS users_using_copilot,
    now() AS generated_at
FROM public.user_usage_events uue
JOIN public.organizations o ON o.id = uue.tenant_id
JOIN public.team_members tm ON tm.user_id = uue.user_id AND tm.organization_id = uue.tenant_id
JOIN public.teams t ON t.id = tm.team_id
WHERE uue.created_at >= now() - INTERVAL '12 weeks'
GROUP BY uue.tenant_id, o.name, tm.team_id, t.name, DATE_TRUNC('week', uue.created_at)::DATE
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_team_adoption_weekly_pk
    ON public.mv_team_adoption_weekly (organization_id, team_id, week_start);

COMMENT ON MATERIALIZED VIEW public.mv_team_adoption_weekly IS 'Adoção semanal por time (materializada para performance)';

-- 5. Função para refresh das views materializadas
CREATE OR REPLACE FUNCTION public.refresh_usage_report_views()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Refresh em ordem de dependência
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_executive_daily_report;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_integration_health_daily;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_ai_usage_daily;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_team_adoption_weekly;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_usage_report_views() TO authenticated;

-- 6. Job de agendamento para refresh (usar pg_cron se disponível)
-- SELECT cron.schedule('refresh-usage-reports', '0 3 * * *', 'SELECT public.refresh_usage_report_views();');

-- 7. View para relatório executivo consolidado (últimos 30 dias)
CREATE OR REPLACE VIEW public.v_executive_report_30d AS
SELECT
    medr.organization_id,
    medr.organization_name,
    -- Período
    MIN(medr.report_date) AS period_start,
    MAX(medr.report_date) AS period_end,
    COUNT(DISTINCT medr.report_date) AS active_days,
    -- Usuários
    ROUND(AVG(medr.daily_active_users)::NUMERIC, 1) AS avg_dau,
    MAX(medr.daily_active_users) AS peak_dau,
    COUNT(DISTINCT CASE WHEN medr.daily_active_users > 0 THEN medr.report_date END) AS days_with_activity,
    -- HUs
    SUM(medr.hu_created) AS total_hu_created,
    SUM(medr.hu_updated) AS total_hu_updated,
    SUM(medr.hu_status_changed) AS total_hu_status_changes,
    -- Impedimentos
    SUM(medr.impediment_created) AS total_impediments_created,
    SUM(medr.impediment_resolved) AS total_impediments_resolved,
    -- IA
    SUM(medr.ai_interactions) AS total_ai_interactions,
    SUM(medr.ai_hu_generations) AS total_ai_hu_generations,
    SUM(medr.ai_estimations) AS total_ai_estimations,
    SUM(medr.ai_risk_analyses) AS total_ai_risk_analyses,
    -- Sprints
    SUM(medr.sprint_interactions) AS total_sprint_interactions,
    -- Relatórios
    SUM(medr.report_exports) AS total_report_exports,
    -- Fontes
    SUM(medr.web_interactions) AS total_web,
    SUM(medr.teams_interactions) AS total_teams,
    SUM(medr.copilot_interactions) AS total_copilot,
    SUM(medr.api_interactions) AS total_api,
    -- Projetos
    ROUND(AVG(medr.active_projects)::NUMERIC, 1) AS avg_active_projects,
    -- Taxa de adoção (dias ativos / 30)
    ROUND(100.0 * COUNT(DISTINCT CASE WHEN medr.daily_active_users > 0 THEN medr.report_date END) / 30, 1) AS adoption_rate_pct
FROM public.mv_executive_daily_report medr
WHERE medr.report_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY medr.organization_id, medr.organization_name
ORDER BY total_ai_interactions DESC;

COMMENT ON VIEW public.v_executive_report_30d IS 'Relatório executivo consolidado dos últimos 30 dias';

-- 8. View para relatório de segurança e auditoria
CREATE OR REPLACE VIEW public.v_security_audit_report AS
SELECT
    ale.organization_id,
    o.name AS organization_name,
    DATE(ale.created_at) AS audit_date,
    ale.action,
    ale.target_type,
    COUNT(*) AS event_count,
    COUNT(DISTINCT ale.actor_user_id) AS unique_actors,
    COUNT(*) FILTER (WHERE ale.source = 'api') AS api_events,
    COUNT(*) FILTER (WHERE ale.source = 'web') AS web_events,
    COUNT(*) FILTER (WHERE ale.source = 'teams') AS teams_events,
    COUNT(*) FILTER (WHERE ale.source = 'copilot') AS copilot_events,
    MIN(ale.created_at) AS first_event_at,
    MAX(ale.created_at) AS last_event_at
FROM public.audit_log_events ale
JOIN public.organizations o ON o.id = ale.organization_id
WHERE ale.created_at >= now() - INTERVAL '30 days'
  AND ale.organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  )
GROUP BY ale.organization_id, o.name, DATE(ale.created_at), ale.action, ale.target_type
ORDER BY audit_date DESC, event_count DESC;

COMMENT ON VIEW public.v_security_audit_report IS 'Relatório de auditoria de segurança (últimos 30 dias)';

-- 9. View para relatório de uso por funcionalidade
CREATE OR REPLACE VIEW public.v_feature_adoption_report AS
SELECT
    uue.tenant_id AS organization_id,
    o.name AS organization_name,
    uue.event_type,
    COUNT(*) AS total_events,
    COUNT(DISTINCT uue.user_id) AS unique_users,
    COUNT(DISTINCT uue.project_id) FILTER (WHERE uue.project_id IS NOT NULL) AS projects_using,
    DATE_TRUNC('week', uue.created_at)::DATE AS week_start,
    -- Adoption rate: % of active users using this feature
    ROUND(
        100.0 * COUNT(DISTINCT uue.user_id) /
        NULLIF(
            (SELECT COUNT(DISTINCT user_id) FROM public.user_usage_events uue2
             WHERE uue2.tenant_id = uue.tenant_id
               AND uue2.created_at >= DATE_TRUNC('week', uue.created_at)
               AND uue2.created_at < DATE_TRUNC('week', uue.created_at) + INTERVAL '1 week'),
            0
        ), 1
    ) AS adoption_rate_pct
FROM public.user_usage_events uue
JOIN public.organizations o ON o.id = uue.tenant_id
WHERE uue.created_at >= now() - INTERVAL '12 weeks'
  AND uue.tenant_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
GROUP BY uue.tenant_id, o.name, uue.event_type, DATE_TRUNC('week', uue.created_at)::DATE
ORDER BY week_start DESC, total_events DESC;

COMMENT ON VIEW public.v_feature_adoption_report IS 'Adoção semanal por funcionalidade/evento';

-- 10. View para relatório de uso de IA detalhado
CREATE OR REPLACE VIEW public.v_ai_detailed_report AS
SELECT
    uue.tenant_id AS organization_id,
    o.name AS organization_name,
    uue.project_id,
    p.name AS project_name,
    uue.metadata_json->>'feature' AS ai_feature,
    uue.metadata_json->>'model' AS ai_model,
    DATE_TRUNC('week', uue.created_at)::DATE AS week_start,
    COUNT(*) AS total_calls,
    COUNT(DISTINCT uue.user_id) AS unique_users,
    SUM(COALESCE((uue.metadata_json->>'tokens_used')::INTEGER, 0)) AS total_tokens,
    SUM(COALESCE((uue.metadata_json->>'estimated_cost_usd')::NUMERIC, 0)) AS total_estimated_cost_usd,
    AVG(COALESCE((uue.metadata_json->>'tokens_used')::INTEGER, 0))::NUMERIC(10,2) AS avg_tokens_per_call,
    COUNT(*) FILTER (WHERE uue.metadata_json->>'accepted' = 'true') AS accepted_count,
    COUNT(*) FILTER (WHERE uue.metadata_json->>'accepted' = 'false') AS rejected_count,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE uue.metadata_json->>'accepted' = 'true') /
        NULLIF(COUNT(*) FILTER (WHERE uue.metadata_json->>'accepted' IS NOT NULL), 0), 1
    ) AS acceptance_rate_pct,
    -- Por tipo de usuário
    COUNT(DISTINCT uue.user_id) FILTER (WHERE uue.source = 'web') AS web_users,
    COUNT(DISTINCT uue.user_id) FILTER (WHERE uue.source = 'teams') AS teams_users,
    COUNT(DISTINCT uue.user_id) FILTER (WHERE uue.source = 'copilot') AS copilot_users
FROM public.user_usage_events uue
JOIN public.organizations o ON o.id = uue.tenant_id
LEFT JOIN public.projects p ON p.id = uue.project_id
WHERE uue.event_type LIKE 'ai_%'
  AND uue.created_at >= now() - INTERVAL '8 weeks'
  AND uue.tenant_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
GROUP BY uue.tenant_id, o.name, uue.project_id, p.name, uue.metadata_json->>'feature', uue.metadata_json->>'model', DATE_TRUNC('week', uue.created_at)::DATE
ORDER BY week_start DESC, total_calls DESC;

COMMENT ON VIEW public.v_ai_detailed_report IS 'Relatório detalhado de uso de IA por feature/modelo/semana';

-- 11. View para relatório de health check das integrações
CREATE OR REPLACE VIEW public.v_integration_health_report AS
SELECT
    mihd.organization_id,
    mihd.organization_name,
    mihd.integration_type,
    mihd.external_system,
    mihd.report_date,
    mihd.total_events,
    mihd.success_count,
    mihd.error_count,
    mihd.timeout_count,
    mihd.retry_count,
    mihd.dead_letter_count,
    mihd.success_rate_pct,
    mihd.avg_success_duration_ms,
    mihd.p95_success_duration_ms,
    mihd.last_event_at,
    -- Status de saúde
    CASE
        WHEN mihd.success_rate_pct >= 99 THEN 'healthy'
        WHEN mihd.success_rate_pct >= 95 THEN 'degraded'
        WHEN mihd.success_rate_pct >= 90 THEN 'unhealthy'
        ELSE 'critical'
    END AS health_status,
    -- Dias desde último evento
    EXTRACT(DAY FROM (now() - mihd.last_event_at))::INTEGER AS days_since_last_event
FROM public.mv_integration_health_daily mihd
WHERE mihd.report_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY mihd.organization_id, mihd.integration_type, mihd.external_system, mihd.report_date DESC;

COMMENT ON VIEW public.v_integration_health_report IS 'Health check das integrações (últimos 7 dias)';

-- 12. View para relatório de adoção por time
CREATE OR REPLACE VIEW public.v_team_adoption_report AS
SELECT
    mtad.organization_id,
    mtad.organization_name,
    mtad.team_id,
    mtad.team_name,
    mtad.week_start,
    mtad.weekly_active_users,
    mtad.total_interactions,
    mtad.hu_interactions,
    mtad.ai_interactions,
    mtad.report_exports,
    mtad.active_projects,
    mtad.users_using_ai_hu,
    mtad.users_using_planning_poker,
    mtad.users_using_teams,
    mtad.users_using_copilot,
    -- Taxa de adoção de IA no time
    CASE WHEN mtad.weekly_active_users > 0
        THEN ROUND(100.0 * mtad.users_using_ai_hu / mtad.weekly_active_users, 1)
        ELSE 0
    END AS ai_adoption_rate_pct,
    CASE WHEN mtad.weekly_active_users > 0
        THEN ROUND(100.0 * mtad.users_using_teams / mtad.weekly_active_users, 1)
        ELSE 0
    END AS teams_adoption_rate_pct
FROM public.mv_team_adoption_weekly mtad
WHERE mtad.week_start >= CURRENT_DATE - INTERVAL '12 weeks'
ORDER BY mtad.organization_id, mtad.team_id, mtad.week_start DESC;

COMMENT ON VIEW public.v_team_adoption_report IS 'Relatório de adoção semanal por time';

-- 13. RPC para exportar relatório em CSV
CREATE OR REPLACE FUNCTION public.export_report_csv(
    p_report_name TEXT,
    p_organization_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE,
    p_filters JSONB DEFAULT '{}'::jsonb
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_query TEXT;
    v_result TEXT;
BEGIN
    -- Verificar permissão
    IF NOT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = auth.uid()
          AND organization_id = p_organization_id
          AND role IN ('admin', 'owner')
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to export report';
    END IF;

    CASE p_report_name
        WHEN 'executive' THEN
            v_query := format(
                'COPY (
                    SELECT * FROM public.v_executive_report_30d
                    WHERE organization_id = %L
                ) TO STDOUT WITH CSV HEADER',
                p_organization_id
            );
        WHEN 'feature_adoption' THEN
            v_query := format(
                'COPY (
                    SELECT * FROM public.v_feature_adoption_report
                    WHERE organization_id = %L
                      AND week_start BETWEEN %L AND %L
                ) TO STDOUT WITH CSV HEADER',
                p_organization_id, p_start_date, p_end_date
            );
        WHEN 'ai_usage' THEN
            v_query := format(
                'COPY (
                    SELECT * FROM public.v_ai_detailed_report
                    WHERE organization_id = %L
                      AND week_start BETWEEN %L AND %L
                ) TO STDOUT WITH CSV HEADER',
                p_organization_id, p_start_date, p_end_date
            );
        WHEN 'team_adoption' THEN
            v_query := format(
                'COPY (
                    SELECT * FROM public.v_team_adoption_report
                    WHERE organization_id = %L
                      AND week_start BETWEEN %L AND %L
                ) TO STDOUT WITH CSV HEADER',
                p_organization_id, p_start_date, p_end_date
            );
        WHEN 'integration_health' THEN
            v_query := format(
                'COPY (
                    SELECT * FROM public.v_integration_health_report
                    WHERE organization_id = %L
                      AND report_date BETWEEN %L AND %L
                ) TO STDOUT WITH CSV HEADER',
                p_organization_id, p_start_date, p_end_date
            );
        WHEN 'security_audit' THEN
            v_query := format(
                'COPY (
                    SELECT * FROM public.v_security_audit_report
                    WHERE organization_id = %L
                      AND audit_date BETWEEN %L AND %L
                ) TO STDOUT WITH CSV HEADER',
                p_organization_id, p_start_date, p_end_date
            );
        ELSE
            RAISE EXCEPTION 'Unknown report name: %', p_report_name;
    END CASE;

    -- Note: COPY TO STDOUT não funciona diretamente em função SECURITY DEFINER
    -- Esta função retorna a query para o cliente executar
    RETURN v_query;
END;
$$;

GRANT EXECUTE ON FUNCTION public.export_report_csv(TEXT, UUID, DATE, DATE, JSONB) TO authenticated;

-- 14. RPC para obter resumo de relatório (para dashboards)
CREATE OR REPLACE FUNCTION public.get_report_summary(
    p_report_type TEXT,
    p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = auth.uid()
          AND organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    CASE p_report_type
        WHEN 'executive' THEN
            SELECT jsonb_build_object(
                'period_days', 30,
                'avg_dau', avg_dau,
                'peak_dau', peak_dau,
                'adoption_rate_pct', adoption_rate_pct,
                'total_hu_created', total_hu_created,
                'total_ai_interactions', total_ai_interactions,
                'total_impediments_created', total_impediments_created,
                'total_report_exports', total_report_exports
            ) INTO v_result
            FROM public.v_executive_report_30d
            WHERE organization_id = p_organization_id;

        WHEN 'integration_health' THEN
            SELECT jsonb_agg(jsonb_build_object(
                'integration_type', integration_type,
                'external_system', external_system,
                'health_status', health_status,
                'success_rate_pct', success_rate_pct,
                'days_since_last_event', days_since_last_event
            )) INTO v_result
            FROM public.v_integration_health_report
            WHERE organization_id = p_organization_id
              AND report_date = (SELECT MAX(report_date) FROM public.v_integration_health_report WHERE organization_id = p_organization_id);

        WHEN 'ai_usage' THEN
            SELECT jsonb_build_object(
                'total_calls', SUM(total_calls),
                'unique_users', SUM(unique_users),
                'total_tokens', SUM(total_tokens),
                'total_cost_usd', SUM(total_estimated_cost_usd),
                'acceptance_rate_pct', AVG(acceptance_rate_pct)
            ) INTO v_result
            FROM public.v_ai_detailed_report
            WHERE organization_id = p_organization_id
              AND week_start >= CURRENT_DATE - INTERVAL '4 weeks';

        ELSE
            v_result := '{}'::jsonb;
    END CASE;

    RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_report_summary(TEXT, UUID) TO authenticated;

-- 15. Índices adicionais para performance dos relatórios
CREATE INDEX IF NOT EXISTS idx_user_usage_events_tenant_type_date
    ON public.user_usage_events (tenant_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_usage_events_tenant_source_date
    ON public.user_usage_events (tenant_id, source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_usage_events_tenant_type_date
    ON public.integration_usage_events (tenant_id, integration_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_events_org_action_date
    ON public.audit_log_events (organization_id, action, created_at DESC);