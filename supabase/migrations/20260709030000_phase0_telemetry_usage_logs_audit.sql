-- Phase 0: Fundações - Telemetria, Logs de Uso e Auditoria (Pilar 6)
-- Cria tabelas para coleta de eventos de uso, logs de integração, snapshots de relatórios e auditoria

-- 1. Eventos de uso da interface web e ações do usuário
CREATE TABLE IF NOT EXISTS public.user_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- Ex: 'page_view', 'hu_created', 'hu_updated', 'hu_status_changed', 'impediment_created', 'ai_generation', 'report_exported', 'sprint_started', 'planning_poker_vote'
    entity_type TEXT, -- 'user_story', 'sprint', 'impediment', 'project', 'dashboard', 'report', 'ai_feature'
    entity_id UUID, -- ID da entidade afetada
    source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'teams', 'copilot', 'api', 'mobile', 'cli')),
    metadata_json JSONB DEFAULT '{}'::jsonb, -- Dados contextuais da ação
    ip_hash TEXT, -- Hash do IP (não IP direto para LGPD)
    user_agent TEXT,
    session_id UUID, -- ID da sessão do usuário
    correlation_id UUID, -- Para rastreabilidade ponta a ponta
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_usage_events IS 'Eventos de uso da interface web e ações do usuário para relatórios de adoção e produtividade';
COMMENT ON COLUMN public.user_usage_events.ip_hash IS 'Hash SHA-256 do IP do usuário (LGPD - minimização de dados)';
COMMENT ON COLUMN public.user_usage_events.metadata_json IS 'Dados contextuais flexíveis: ex: {"feature": "ai_hu_generation", "tokens_used": 1500, "model": "gpt-4"}';

CREATE INDEX IF NOT EXISTS idx_user_usage_events_tenant_time ON public.user_usage_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_usage_events_user_time ON public.user_usage_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_usage_events_project_time ON public.user_usage_events (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_usage_events_type_time ON public.user_usage_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_usage_events_correlation ON public.user_usage_events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_events_entity ON public.user_usage_events (entity_type, entity_id);

-- 2. Eventos gerados por integrações externas
CREATE TABLE IF NOT EXISTS public.integration_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    integration_type TEXT NOT NULL CHECK (integration_type IN (
        'gitlab', 'github', 'bitbucket', 'azure_devops',
        'teams', 'copilot', 'slack', 'discord',
        'redmine', 'jira', 'azure_boards',
        'keycloak', 'azure_ad', 'okta',
        'oracle_db', 'oracle_apex', 'api_gateway',
        'datadog', 'newrelic', 'sentry', 'grafana',
        'jenkins', 'gitlab_ci', 'github_actions', 'circleci',
        'custom'
    )),
    external_system TEXT NOT NULL, -- Nome identificador do sistema externo
    event_type TEXT NOT NULL, -- Ex: 'webhook_received', 'sync_completed', 'sync_failed', 'api_call', 'command_executed', 'query_executed'
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial', 'timeout', 'retry', 'dead_letter')),
    correlation_id UUID, -- Correlation ID da cadeia de chamadas
    metadata_json JSONB DEFAULT '{}'::jsonb, -- Payload relevante, erro, duração, etc.
    duration_ms INTEGER, -- Duração da operação em ms
    error_code TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.integration_usage_events IS 'Eventos gerados por integrações externas (GitLab, Teams, Redmine, Oracle, etc.) para observabilidade e relatórios';

CREATE INDEX IF NOT EXISTS idx_integration_usage_tenant_time ON public.integration_usage_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_usage_type_time ON public.integration_usage_events (integration_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_usage_system_time ON public.integration_usage_events (external_system, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_usage_status_time ON public.integration_usage_events (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_usage_correlation ON public.integration_usage_events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_integration_usage_event_type ON public.integration_usage_events (event_type, created_at DESC);

-- 3. Snapshots agregados para relatórios (pré-calculados para performance)
CREATE TABLE IF NOT EXISTS public.report_usage_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    granularity TEXT NOT NULL CHECK (granularity IN ('hourly', 'daily', 'weekly', 'monthly')),
    metric_name TEXT NOT NULL, -- Ex: 'dau', 'wau', 'mau', 'hu_created', 'ai_calls', 'api_calls', 'sync_duration_avg', 'error_rate'
    metric_value NUMERIC NOT NULL,
    dimension_json JSONB DEFAULT '{}'::jsonb, -- Dimensões: {"feature": "ai_hu_generation", "team_id": "uuid", "user_role": "po"}
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, project_id, period_start, period_end, granularity, metric_name, dimension_json)
);

COMMENT ON TABLE public.report_usage_snapshots IS 'Snapshots agregados pré-calculados para dashboards e relatórios de uso/adoção';

CREATE INDEX IF NOT EXISTS idx_report_snapshots_tenant_period ON public.report_usage_snapshots (tenant_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_metric_time ON public.report_usage_snapshots (metric_name, period_start);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_project_time ON public.report_usage_snapshots (project_id, period_start);

-- 4. Log de auditoria para ações sensíveis e administrativas
CREATE TABLE IF NOT EXISTS public.audit_log_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- Ex: 'user_invited', 'role_changed', 'integration_configured', 'api_key_rotated', 'retention_policy_changed', 'data_exported', 'permission_granted', 'permission_revoked'
    target_type TEXT NOT NULL, -- 'user', 'organization', 'project', 'integration', 'api_key', 'retention_policy', 'report', 'team'
    target_id UUID, -- ID do alvo da ação
    before_json JSONB, -- Estado anterior (para mudanças)
    after_json JSONB, -- Estado posterior
    source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'api', 'teams', 'copilot', 'cli', 'scheduler', 'webhook')),
    ip_hash TEXT,
    user_agent TEXT,
    correlation_id UUID,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garantir coluna caso tabela já exista de execução anterior sem a coluna (antes dos índices)
ALTER TABLE public.audit_log_events
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

COMMENT ON TABLE public.audit_log_events IS 'Log de auditoria imutável para ações sensíveis, administrativas e de segurança';

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_time ON public.audit_log_events (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON public.audit_log_events (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_time ON public.audit_log_events (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_correlation ON public.audit_log_events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_time ON public.audit_log_events (organization_id, created_at DESC);

-- 5. Tabela para configuração de retenção de logs por tipo
CREATE TABLE IF NOT EXISTS public.log_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    log_type TEXT NOT NULL CHECK (log_type IN (
        'user_usage_events', 'integration_usage_events', 'auth_audit_events',
        'api_gateway_usage_events', 'correlation_contexts', 'audit_log_events',
        'git_events', 'dora_metrics_snapshots', 'sprint_risk_events'
    )),
    retention_days INTEGER NOT NULL CHECK (retention_days > 0 AND retention_days <= 3650), -- Max 10 anos
    archive_after_days INTEGER CHECK (archive_after_days > 0 AND archive_after_days <= retention_days),
    archive_storage TEXT CHECK (archive_storage IN ('cold_storage', 's3', 'azure_blob', 'gcs')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (tenant_id, log_type)
);

COMMENT ON TABLE public.log_retention_policies IS 'Políticas de retenção e arquivamento de logs por tipo e tenant (LGPD compliance)';

-- 6. Trigger para updated_at
DROP TRIGGER IF EXISTS update_log_retention_policies_updated_at ON public.log_retention_policies;
CREATE TRIGGER update_log_retention_policies_updated_at
    BEFORE UPDATE ON public.log_retention_policies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_report_usage_snapshots_updated_at ON public.report_usage_snapshots;
CREATE TRIGGER update_report_usage_snapshots_updated_at
    BEFORE UPDATE ON public.report_usage_snapshots
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. RLS Policies
ALTER TABLE public.user_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_usage_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_retention_policies ENABLE ROW LEVEL SECURITY;

-- User Usage Events: users see own, org admins see all in org
CREATE POLICY "user_usage_events_select_own" ON public.user_usage_events
    FOR SELECT USING (
        user_id = auth.uid() OR
        tenant_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "user_usage_events_insert_service" ON public.user_usage_events
    FOR INSERT WITH CHECK (true);

-- Integration Usage Events: org admins only
CREATE POLICY "integration_usage_events_select_org_admin" ON public.integration_usage_events
    FOR SELECT USING (
        tenant_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "integration_usage_events_insert_service" ON public.integration_usage_events
    FOR INSERT WITH CHECK (true);

-- Report Usage Snapshots: org admins and platform admins
CREATE POLICY "report_snapshots_select_org_admin" ON public.report_usage_snapshots
    FOR SELECT USING (
        tenant_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "report_snapshots_upsert_service" ON public.report_usage_snapshots
    FOR INSERT WITH CHECK (true);

CREATE POLICY "report_snapshots_update_service" ON public.report_usage_snapshots
    FOR UPDATE USING (true);

-- Audit Log Events: only org admins and platform admins
CREATE POLICY "audit_log_events_select_org_admin" ON public.audit_log_events
    FOR SELECT USING (
        actor_user_id = auth.uid() OR
        public.is_platform_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.user_id = auth.uid()
              AND om.role IN ('admin', 'owner')
              AND om.org_id IN (
                  SELECT om2.org_id FROM public.organization_members om2
                  WHERE om2.user_id = audit_log_events.actor_user_id
              )
        )
    );

-- Para auditoria, permitimos leitura por admins da org do ator
CREATE POLICY "audit_log_events_select_org_admin_v2" ON public.audit_log_events
    FOR SELECT USING (
        public.is_platform_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.user_id = auth.uid()
              AND om.role IN ('admin', 'owner')
              AND om.org_id IN (
                  SELECT om2.org_id FROM public.organization_members om2
                  WHERE om2.user_id = audit_log_events.actor_user_id
              )
        )
    );

CREATE POLICY "audit_log_events_insert_service" ON public.audit_log_events
    FOR INSERT WITH CHECK (true);

-- Log Retention Policies: org admins manage
CREATE POLICY "log_retention_policies_select_org_admin" ON public.log_retention_policies
    FOR SELECT USING (
        tenant_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "log_retention_policies_manage_org_admin" ON public.log_retention_policies
    FOR ALL USING (
        tenant_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- 8. RPC para registrar evento de uso do usuário (chamado pelo frontend)
CREATE OR REPLACE FUNCTION public.log_user_usage_event(
    p_tenant_id UUID,
    p_event_type TEXT,
    p_project_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_source TEXT DEFAULT 'web',
    p_metadata_json JSONB DEFAULT '{}'::jsonb,
    p_ip_hash TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id UUID DEFAULT NULL,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := COALESCE(p_user_id, auth.uid());
    v_event_id UUID;
BEGIN
    INSERT INTO public.user_usage_events (
        tenant_id, project_id, user_id, event_type, entity_type, entity_id,
        source, metadata_json, ip_hash, user_agent, session_id, correlation_id
    ) VALUES (
        p_tenant_id, p_project_id, v_user_id, p_event_type, p_entity_type, p_entity_id,
        p_source, p_metadata_json, p_ip_hash, p_user_agent, p_session_id, p_correlation_id
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_user_usage_event(
    UUID, TEXT, UUID, UUID, TEXT, UUID, TEXT, JSONB, TEXT, TEXT, UUID, UUID
) TO authenticated;

-- 9. RPC para registrar evento de integração
CREATE OR REPLACE FUNCTION public.log_integration_usage_event(
    p_tenant_id UUID,
    p_integration_type TEXT,
    p_external_system TEXT,
    p_event_type TEXT,
    p_status TEXT,
    p_correlation_id UUID DEFAULT NULL,
    p_metadata_json JSONB DEFAULT '{}'::jsonb,
    p_duration_ms INTEGER DEFAULT NULL,
    p_error_code TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_retry_count INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO public.integration_usage_events (
        tenant_id, integration_type, external_system, event_type, status,
        correlation_id, metadata_json, duration_ms, error_code, error_message, retry_count
    ) VALUES (
        p_tenant_id, p_integration_type, p_external_system, p_event_type, p_status,
        p_correlation_id, p_metadata_json, p_duration_ms, p_error_code, p_error_message, p_retry_count
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_integration_usage_event(
    UUID, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, INTEGER, TEXT, TEXT, INTEGER
) TO authenticated;

-- 10. RPC para registrar evento de auditoria
CREATE OR REPLACE FUNCTION public.log_audit_event(
    p_action TEXT,
    p_target_type TEXT,
    p_organization_id UUID DEFAULT NULL,
    p_actor_user_id UUID DEFAULT NULL,
    p_target_id UUID DEFAULT NULL,
    p_before_json JSONB DEFAULT NULL,
    p_after_json JSONB DEFAULT NULL,
    p_source TEXT DEFAULT 'web',
    p_ip_hash TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_correlation_id UUID DEFAULT NULL,
    p_metadata_json JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
    v_actor UUID := COALESCE(p_actor_user_id, auth.uid());
BEGIN
    INSERT INTO public.audit_log_events (
        organization_id, actor_user_id, action, target_type, target_id,
        before_json, after_json, source, ip_hash, user_agent,
        correlation_id, metadata_json
    ) VALUES (
        p_organization_id, v_actor, p_action, p_target_type, p_target_id,
        p_before_json, p_after_json, p_source, p_ip_hash, p_user_agent,
        p_correlation_id, p_metadata_json
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(
    TEXT, TEXT, UUID, UUID, UUID, JSONB, JSONB, TEXT, TEXT, TEXT, UUID, JSONB
) TO authenticated;

-- 11. Função para hashear IP (LGPD - não armazenar IP direto)
CREATE OR REPLACE FUNCTION public.hash_ip(p_ip INET)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_salt TEXT := current_setting('app.ip_hash_salt', true); -- Configurar via vault/config
BEGIN
    IF v_salt IS NULL OR v_salt = '' THEN
        v_salt := 'axionn-default-salt-change-in-production';
    END IF;
    RETURN encode(digest(p_ip::text || v_salt, 'sha256'), 'hex');
END;
$$;

GRANT EXECUTE ON FUNCTION public.hash_ip(INET) TO authenticated;

-- 12. View para relatório executivo de adoção (últimos 30 dias)
CREATE OR REPLACE VIEW public.v_executive_adoption_report AS
WITH daily_metrics AS (
    SELECT
        tenant_id,
        DATE(created_at) AS metric_date,
        COUNT(DISTINCT user_id) AS daily_active_users,
        COUNT(*) FILTER (WHERE event_type LIKE 'hu_%') AS hu_interactions,
        COUNT(*) FILTER (WHERE event_type LIKE 'ai_%') AS ai_interactions,
        COUNT(*) FILTER (WHERE event_type = 'report_exported') AS report_exports,
        COUNT(*) FILTER (WHERE source = 'teams') AS teams_interactions,
        COUNT(*) FILTER (WHERE source = 'copilot') AS copilot_interactions
    FROM public.user_usage_events
    WHERE created_at >= now() - INTERVAL '30 days'
    GROUP BY tenant_id, DATE(created_at)
),
aggregated AS (
    SELECT
        tenant_id,
        COUNT(DISTINCT metric_date) AS active_days,
        AVG(daily_active_users)::NUMERIC(10,2) AS avg_dau,
        MAX(daily_active_users) AS peak_dau,
        SUM(hu_interactions) AS total_hu_interactions,
        SUM(ai_interactions) AS total_ai_interactions,
        SUM(report_exports) AS total_report_exports,
        SUM(teams_interactions) AS total_teams_interactions,
        SUM(copilot_interactions) AS total_copilot_interactions
    FROM daily_metrics
    GROUP BY tenant_id
)
SELECT
    a.*,
    o.name AS tenant_name
FROM aggregated a
JOIN public.organizations o ON o.id = a.tenant_id;

COMMENT ON VIEW public.v_executive_adoption_report IS 'Relatório executivo de adoção dos últimos 30 dias por tenant';

-- 13. View para relatório de saúde das integrações
CREATE OR REPLACE VIEW public.v_integration_health_report AS
SELECT
    tenant_id,
    integration_type,
    external_system,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE status = 'success') AS success_count,
    COUNT(*) FILTER (WHERE status = 'error') AS error_count,
    COUNT(*) FILTER (WHERE status = 'timeout') AS timeout_count,
    COUNT(*) FILTER (WHERE status = 'retry') AS retry_count,
    COUNT(*) FILTER (WHERE status = 'dead_letter') AS dead_letter_count,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'success') / NULLIF(COUNT(*), 0), 2
    ) AS success_rate_pct,
    AVG(duration_ms) FILTER (WHERE status = 'success') AS avg_success_duration_ms,
    MAX(created_at) AS last_event_at,
    MIN(created_at) AS first_event_at
FROM public.integration_usage_events
WHERE created_at >= now() - INTERVAL '24 hours'
GROUP BY tenant_id, integration_type, external_system
ORDER BY tenant_id, error_count DESC, total_events DESC;

COMMENT ON VIEW public.v_integration_health_report IS 'Saúde das integrações nas últimas 24h por tenant/sistema';

-- 14. Inserir políticas de retenção padrão para novos tenants
CREATE OR REPLACE FUNCTION public.create_default_retention_policies(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.log_retention_policies (tenant_id, log_type, retention_days, archive_after_days, archive_storage, is_active)
    VALUES
        (p_tenant_id, 'user_usage_events', 365, 90, 'cold_storage', true),
        (p_tenant_id, 'integration_usage_events', 365, 90, 'cold_storage', true),
        (p_tenant_id, 'auth_audit_events', 2555, 365, 'cold_storage', true), -- 7 anos para compliance
        (p_tenant_id, 'api_gateway_usage_events', 365, 90, 'cold_storage', true),
        (p_tenant_id, 'correlation_contexts', 90, 30, 'cold_storage', true),
        (p_tenant_id, 'audit_log_events', 2555, 365, 'cold_storage', true), -- 7 anos para auditoria
        (p_tenant_id, 'git_events', 730, 180, 'cold_storage', true),
        (p_tenant_id, 'dora_metrics_snapshots', 1095, 365, 'cold_storage', true), -- 3 anos
        (p_tenant_id, 'sprint_risk_events', 730, 180, 'cold_storage', true)
    ON CONFLICT (tenant_id, log_type) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_default_retention_policies(UUID) TO authenticated;

-- 15. Trigger para criar políticas padrão ao criar nova organização
CREATE OR REPLACE FUNCTION public.trigger_create_default_retention_policies()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.create_default_retention_policies(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_org_retention_policies ON public.organizations;
CREATE TRIGGER trigger_org_retention_policies
    AFTER INSERT ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.trigger_create_default_retention_policies();