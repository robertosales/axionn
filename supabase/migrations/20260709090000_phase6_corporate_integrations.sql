-- Phase 6: Integrações Corporativas - Redmine, Oracle Database, Oracle APEX
-- Cria tabelas para integração com sistemas corporativos legados

-- ============================================================
-- REDMINE INTEGRATION
-- ============================================================

-- 1. Configuração de integração Redmine
CREATE TABLE IF NOT EXISTS public.redmine_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL, -- Ex: https://redmine.empresa.com
    api_key_encrypted TEXT NOT NULL,
    -- Mapeamento de projetos Redmine -> Axionn
    project_mappings JSONB DEFAULT '[]'::jsonb, -- Array de {redmine_project_id, axionn_project_id}
    -- Mapeamento de trackers -> tipos de entidade Axionn
    tracker_mappings JSONB DEFAULT '{
        "Bug": "impediment",
        "Feature": "user_story",
        "Support": "task",
        "Task": "task"
    }'::jsonb,
    -- Mapeamento de status
    status_mappings JSONB DEFAULT '{}'::jsonb,
    -- Mapeamento de prioridades
    priority_mappings JSONB DEFAULT '{}'::jsonb,
    -- Mapeamento de usuários
    user_mapping_strategy TEXT DEFAULT 'email' CHECK (user_mapping_strategy IN ('email', 'login', 'custom_field', 'manual')),
    -- Sincronização
    sync_direction TEXT DEFAULT 'bidirectional' CHECK (sync_direction IN ('redmine_to_axionn', 'axionn_to_redmine', 'bidirectional')),
    sync_schedule TEXT DEFAULT '0 */30 * * * *', -- A cada 30 minutos
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT CHECK (last_sync_status IN ('success', 'partial', 'failed')),
    last_sync_items INTEGER DEFAULT 0,
    last_sync_error TEXT,
    -- Filtros
    sync_filter_json JSONB DEFAULT '{}'::jsonb, -- Ex: {project_ids: [1,2], tracker_ids: [1,3]}
    -- Webhook
    webhook_url TEXT,
    webhook_secret_encrypted TEXT,
    webhook_events TEXT[] DEFAULT ARRAY['issues', 'journals', 'projects', 'users'],
    -- Status
    is_active BOOLEAN DEFAULT true,
    config_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (organization_id, base_url)
);

COMMENT ON TABLE public.redmine_integrations IS 'Configuração de integração com Redmine';

-- 2. Links entre issues Redmine e entidades Axionn
CREATE TABLE IF NOT EXISTS public.redmine_issue_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES public.redmine_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    -- Redmine side
    redmine_issue_id INTEGER NOT NULL,
    redmine_project_id INTEGER NOT NULL,
    redmine_tracker_id INTEGER,
    redmine_status_id INTEGER,
    redmine_priority_id INTEGER,
    -- Axionn side
    axionn_entity_type TEXT NOT NULL CHECK (axionn_entity_type IN ('user_story', 'impediment', 'task', 'bug', 'epic')),
    axionn_entity_id UUID NOT NULL,
    -- Metadata
    sync_direction TEXT NOT NULL CHECK (sync_direction IN ('redmine_to_axionn', 'axionn_to_redmine', 'bidirectional')),
    last_synced_at TIMESTAMPTZ,
    last_redmine_updated_on TIMESTAMPTZ,
    last_axionn_updated_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
    conflict_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (integration_id, redmine_issue_id)
);

COMMENT ON TABLE public.redmine_issue_links IS 'Vínculo bidirecional entre issues Redmine e entidades Axionn';

CREATE INDEX IF NOT EXISTS idx_redmine_issue_links_axionn ON public.redmine_issue_links (axionn_entity_type, axionn_entity_id);
CREATE INDEX IF NOT EXISTS idx_redmine_issue_links_integration ON public.redmine_issue_links (integration_id, sync_status);

-- 3. Eventos de sincronização Redmine
CREATE TABLE IF NOT EXISTS public.redmine_sync_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES public.redmine_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'webhook', 'manual')),
    trigger_source TEXT CHECK (trigger_source IN ('schedule', 'webhook', 'manual', 'api')),
    status TEXT NOT NULL CHECK (status IN ('started', 'in_progress', 'completed', 'failed', 'partial')),
    issues_processed INTEGER DEFAULT 0,
    issues_created INTEGER DEFAULT 0,
    issues_updated INTEGER DEFAULT 0,
    issues_skipped INTEGER DEFAULT 0,
    issues_failed INTEGER DEFAULT 0,
    error_details JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    correlation_id UUID,
    UNIQUE (integration_id, correlation_id)
);

COMMENT ON TABLE public.redmine_sync_events IS 'Log de eventos de sincronização com Redmine';

CREATE INDEX IF NOT EXISTS idx_redmine_sync_events_integration_time ON public.redmine_sync_events (integration_id, started_at DESC);

-- ============================================================
-- ORACLE DATABASE INTEGRATION
-- ============================================================

-- 4. Configuração de integração Oracle Database
CREATE TABLE IF NOT EXISTS public.oracle_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    -- Conexão
    connection_type TEXT NOT NULL DEFAULT 'direct' CHECK (connection_type IN ('direct', 'wallet', 'tns', 'proxy', 'api')),
    host TEXT,
    port INTEGER DEFAULT 1521,
    service_name TEXT,
    sid TEXT,
    wallet_path TEXT,
    tns_alias TEXT,
    proxy_url TEXT,
    -- Credenciais (criptografadas)
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    -- TLS/SSL
    use_tls BOOLEAN DEFAULT true,
    tls_config JSONB DEFAULT '{}'::jsonb,
    -- Pool de conexões
    pool_min INTEGER DEFAULT 1,
    pool_max INTEGER DEFAULT 10,
    pool_increment INTEGER DEFAULT 1,
    -- Jobs de sincronização
    jobs JSONB DEFAULT '[]'::jsonb, -- Array de jobs de ETL
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_connection_test TIMESTAMPTZ,
    connection_test_status TEXT CHECK (connection_test_status IN ('success', 'failed')),
    connection_test_error TEXT,
    config_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (organization_id, name)
);

COMMENT ON TABLE public.oracle_integrations IS 'Configuração de conexão com Oracle Database corporativo';

-- 5. Jobs de sincronização Oracle (ETL/ELT)
CREATE TABLE IF NOT EXISTS public.oracle_sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES public.oracle_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    -- Tipo de job
    job_type TEXT NOT NULL CHECK (job_type IN ('extract', 'load', 'transform', 'full_etl')),
    -- Estratégia de extração
    extraction_strategy TEXT NOT NULL CHECK (extraction_strategy IN (
        'incremental_timestamp', 'incremental_id', 'full', 'cdc', 'view', 'staging_table'
    )),
    -- Query SQL ou configuração
    source_query TEXT, -- Query para extrair dados
    source_table TEXT, -- Tabela origem
    source_schema TEXT,
    incremental_column TEXT, -- Coluna para incremental (timestamp ou ID)
    incremental_watermark TEXT, -- Último valor processado
    -- Destino no Axionn
    target_table TEXT, -- Tabela destino (ou staging)
    target_schema TEXT DEFAULT 'public',
    column_mapping JSONB DEFAULT '{}'::jsonb, -- {source_col: target_col}
    transform_sql TEXT, -- SQL de transformação opcional
    -- Agendamento
    schedule TEXT, -- Cron expression
    timezone TEXT DEFAULT 'UTC',
    -- Configuração de execução
    batch_size INTEGER DEFAULT 10000,
    max_retries INTEGER DEFAULT 3,
    retry_delay_seconds INTEGER DEFAULT 60,
    timeout_seconds INTEGER DEFAULT 3600,
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    last_run_status TEXT CHECK (last_run_status IN ('success', 'partial', 'failed')),
    last_run_rows INTEGER DEFAULT 0,
    last_run_duration_ms INTEGER,
    last_run_error TEXT,
    next_run_at TIMESTAMPTZ,
    config_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (integration_id, name)
);

COMMENT ON TABLE public.oracle_sync_jobs IS 'Jobs de extração/carga de dados do Oracle Database para Axionn';

-- 6. Eventos de execução dos jobs Oracle
CREATE TABLE IF NOT EXISTS public.oracle_sync_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.oracle_sync_jobs(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.oracle_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    -- Execução
    run_id UUID NOT NULL DEFAULT gen_random_uuid(),
    trigger_type TEXT CHECK (trigger_type IN ('schedule', 'manual', 'webhook', 'dependency')),
    status TEXT NOT NULL CHECK (status IN ('started', 'extracting', 'transforming', 'loading', 'completed', 'failed', 'partial')),
    -- Métricas
    rows_extracted INTEGER DEFAULT 0,
    rows_transformed INTEGER DEFAULT 0,
    rows_loaded INTEGER DEFAULT 0,
    rows_failed INTEGER DEFAULT 0,
    bytes_processed BIGINT DEFAULT 0,
    -- Timing
    extract_duration_ms INTEGER,
    transform_duration_ms INTEGER,
    load_duration_ms INTEGER,
    total_duration_ms INTEGER,
    -- Checkpoints para resume
    extract_checkpoint JSONB,
    transform_checkpoint JSONB,
    -- Erros
    error_details JSONB,
    error_sample JSONB, -- Amostra de erros
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    correlation_id UUID
);

COMMENT ON TABLE public.oracle_sync_events IS 'Log de execução dos jobs de sincronização Oracle';

CREATE INDEX IF NOT EXISTS idx_oracle_sync_events_job_time ON public.oracle_sync_events (job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_oracle_sync_events_status ON public.oracle_sync_events (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_oracle_sync_events_run ON public.oracle_sync_events (run_id);

-- ============================================================
-- ORACLE APEX INTEGRATION
-- ============================================================

-- 7. Configuração de integração Oracle APEX
CREATE TABLE IF NOT EXISTS public.apex_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    -- APEX Workspace
    workspace_name TEXT NOT NULL,
    workspace_id INTEGER,
    -- URL base do APEX (ORDS)
    base_url TEXT NOT NULL, -- Ex: https://apex.empresa.com/ords
    -- Autenticação
    auth_type TEXT NOT NULL DEFAULT 'oauth2' CHECK (auth_type IN ('oauth2', 'basic_token', 'custom')),
    client_id TEXT,
    client_secret_encrypted TEXT,
    oauth2_token_url TEXT,
    oauth2_scope TEXT,
    -- Aplicações APEX integradas
    applications JSONB DEFAULT '[]'::jsonb, -- Array de {app_id, app_name, features[]}
    -- Configuração de REST Data Sources
    rest_data_sources JSONB DEFAULT '[]'::jsonb, -- Configuração de REST Data Sources no APEX
    -- Webhooks APEX -> Axionn
    webhook_url TEXT,
    webhook_secret_encrypted TEXT,
    webhook_events TEXT[] DEFAULT ARRAY['page_submit', 'process', 'report_query'],
    -- Mapeamento de usuários
    user_mapping JSONB DEFAULT '{}'::jsonb,
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_connection_test TIMESTAMPTZ,
    connection_test_status TEXT CHECK (connection_test_status IN ('success', 'failed')),
    config_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (organization_id, workspace_name)
);

COMMENT ON TABLE public.apex_integrations IS 'Configuração de integração com aplicações Oracle APEX';

-- 8. Aplicações APEX mapeadas
CREATE TABLE IF NOT EXISTS public.apex_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES public.apex_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    apex_app_id INTEGER NOT NULL,
    apex_app_name TEXT,
    -- Funcionalidades expostas
    features JSONB DEFAULT '[]'::jsonb, -- Ex: [{name: "dashboard_hu", type: "report", params: {}}]
    -- Páginas/Regiões mapeadas
    page_mappings JSONB DEFAULT '[]'::jsonb,
    -- REST Data Sources desta app
    rest_data_sources JSONB DEFAULT '[]'::jsonb,
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    config_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (integration_id, apex_app_id)
);

COMMENT ON TABLE public.apex_applications IS 'Aplicações APEX individuais integradas ao Axionn';

-- 9. Eventos de uso APEX -> Axionn
CREATE TABLE IF NOT EXISTS public.apex_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES public.apex_integrations(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.apex_applications(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    -- Origem
    apex_session_id TEXT,
    apex_user TEXT, -- Usuário APEX (APP_USER)
    apex_app_id INTEGER,
    apex_page_id INTEGER,
    -- Requisição
    request_type TEXT CHECK (request_type IN ('report_query', 'page_submit', 'process', 'ajax', 'webhook')),
    endpoint_path TEXT,
    parameters JSONB,
    -- Resposta
    response_status INTEGER,
    response_time_ms INTEGER,
    rows_returned INTEGER,
    -- Usuário Axionn (se mapeado)
    axionn_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- Correlation
    correlation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.apex_usage_events IS 'Eventos de uso de aplicações APEX consumindo APIs do Axionn';

CREATE INDEX IF NOT EXISTS idx_apex_usage_integration_time ON public.apex_usage_events (integration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apex_usage_user_time ON public.apex_usage_events (apex_user, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apex_usage_correlation ON public.apex_usage_events (correlation_id);

-- 10. Mapeamento de usuários entre sistemas externos e Axionn
CREATE TABLE IF NOT EXISTS public.external_app_user_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    integration_type TEXT NOT NULL CHECK (integration_type IN ('redmine', 'oracle_apex', 'jira', 'azure_devops', 'service_now', 'custom')),
    integration_id UUID, -- ID da integração específica (pode ser NULL para mapeamento global)
    external_user_id TEXT NOT NULL,
    external_username TEXT,
    external_email TEXT,
    external_display_name TEXT,
    external_groups TEXT[],
    axionn_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    mapping_source TEXT DEFAULT 'email' CHECK (mapping_source IN ('email', 'username', 'sso', 'manual', 'custom_field')),
    is_active BOOLEAN DEFAULT true,
    last_mapped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, integration_type, integration_id, external_user_id)
);

COMMENT ON TABLE public.external_app_user_mappings IS 'Mapeamento unificado de usuários de sistemas externos para Axionn';

CREATE INDEX IF NOT EXISTS idx_external_user_mappings_axionn ON public.external_app_user_mappings (axionn_user_id);
CREATE INDEX IF NOT EXISTS idx_external_user_mappings_email ON public.external_app_user_mappings (external_email);

-- ============================================================
-- TRIGGERS E RLS
-- ============================================================

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_redmine_integrations_updated_at ON public.redmine_integrations;
CREATE TRIGGER update_redmine_integrations_updated_at
    BEFORE UPDATE ON public.redmine_integrations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_redmine_issue_links_updated_at ON public.redmine_issue_links;
CREATE TRIGGER update_redmine_issue_links_updated_at
    BEFORE UPDATE ON public.redmine_issue_links
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_integrations_updated_at ON public.oracle_integrations;
CREATE TRIGGER update_oracle_integrations_updated_at
    BEFORE UPDATE ON public.oracle_integrations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_sync_jobs_updated_at ON public.oracle_sync_jobs;
CREATE TRIGGER update_oracle_sync_jobs_updated_at
    BEFORE UPDATE ON public.oracle_sync_jobs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_apex_integrations_updated_at ON public.apex_integrations;
CREATE TRIGGER update_apex_integrations_updated_at
    BEFORE UPDATE ON public.apex_integrations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_apex_applications_updated_at ON public.apex_applications;
CREATE TRIGGER update_apex_applications_updated_at
    BEFORE UPDATE ON public.apex_applications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_external_app_user_mappings_updated_at ON public.external_app_user_mappings;
CREATE TRIGGER update_external_app_user_mappings_updated_at
    BEFORE UPDATE ON public.external_app_user_mappings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.redmine_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redmine_issue_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redmine_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apex_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apex_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apex_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_app_user_mappings ENABLE ROW LEVEL SECURITY;

-- Redmine Integrations: org admins
CREATE POLICY "redmine_integrations_select_org_admin" ON public.redmine_integrations
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "redmine_integrations_manage_org_admin" ON public.redmine_integrations
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Redmine Issue Links: org members read, service write
CREATE POLICY "redmine_issue_links_select_org_member" ON public.redmine_issue_links
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "redmine_issue_links_manage_service" ON public.redmine_issue_links
    FOR ALL USING (true);

-- Redmine Sync Events: org admins
CREATE POLICY "redmine_sync_events_select_org_admin" ON public.redmine_sync_events
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "redmine_sync_events_insert_service" ON public.redmine_sync_events
    FOR INSERT WITH CHECK (true);

-- Oracle Integrations: org admins
CREATE POLICY "oracle_integrations_select_org_admin" ON public.oracle_integrations
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "oracle_integrations_manage_org_admin" ON public.oracle_integrations
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Oracle Sync Jobs: org admins
CREATE POLICY "oracle_sync_jobs_select_org_admin" ON public.oracle_sync_jobs
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "oracle_sync_jobs_manage_org_admin" ON public.oracle_sync_jobs
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Oracle Sync Events: org admins
CREATE POLICY "oracle_sync_events_select_org_admin" ON public.oracle_sync_events
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "oracle_sync_events_insert_service" ON public.oracle_sync_events
    FOR INSERT WITH CHECK (true);

-- APEX Integrations: org admins
CREATE POLICY "apex_integrations_select_org_admin" ON public.apex_integrations
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "apex_integrations_manage_org_admin" ON public.apex_integrations
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- APEX Applications: org admins
CREATE POLICY "apex_applications_select_org_admin" ON public.apex_applications
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "apex_applications_manage_org_admin" ON public.apex_applications
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- APEX Usage Events: org admins
CREATE POLICY "apex_usage_events_select_org_admin" ON public.apex_usage_events
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "apex_usage_events_insert_service" ON public.apex_usage_events
    FOR INSERT WITH CHECK (true);

-- External User Mappings: org admins
CREATE POLICY "external_user_mappings_select_org_admin" ON public.external_app_user_mappings
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "external_user_mappings_manage_org_admin" ON public.external_app_user_mappings
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- ============================================================
-- RPCs
-- ============================================================

-- RPC para registrar evento de sincronização Redmine
CREATE OR REPLACE FUNCTION public.log_redmine_sync_event(
    p_integration_id UUID,
    p_organization_id UUID,
    p_sync_type TEXT,
    p_trigger_source TEXT DEFAULT NULL,
    p_status TEXT,
    p_issues_processed INTEGER DEFAULT 0,
    p_issues_created INTEGER DEFAULT 0,
    p_issues_updated INTEGER DEFAULT 0,
    p_issues_skipped INTEGER DEFAULT 0,
    p_issues_failed INTEGER DEFAULT 0,
    p_error_details JSONB DEFAULT '{}'::jsonb,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO public.redmine_sync_events (
        integration_id, organization_id,
        sync_type, trigger_source, status,
        issues_processed, issues_created, issues_updated, issues_skipped, issues_failed,
        error_details, correlation_id
    ) VALUES (
        p_integration_id, p_organization_id,
        p_sync_type, p_trigger_source, p_status,
        p_issues_processed, p_issues_created, p_issues_updated, p_issues_skipped, p_issues_failed,
        p_error_details, p_correlation_id
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_redmine_sync_event(
    UUID, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, JSONB, UUID
) TO authenticated;

-- RPC para registrar evento de job Oracle
CREATE OR REPLACE FUNCTION public.log_oracle_sync_event(
    p_job_id UUID,
    p_integration_id UUID,
    p_organization_id UUID,
    p_trigger_type TEXT DEFAULT NULL,
    p_status TEXT,
    p_rows_extracted INTEGER DEFAULT 0,
    p_rows_transformed INTEGER DEFAULT 0,
    p_rows_loaded INTEGER DEFAULT 0,
    p_rows_failed INTEGER DEFAULT 0,
    p_bytes_processed BIGINT DEFAULT 0,
    p_extract_duration_ms INTEGER DEFAULT NULL,
    p_transform_duration_ms INTEGER DEFAULT NULL,
    p_load_duration_ms INTEGER DEFAULT NULL,
    p_total_duration_ms INTEGER DEFAULT NULL,
    p_extract_checkpoint JSONB DEFAULT NULL,
    p_transform_checkpoint JSONB DEFAULT NULL,
    p_error_details JSONB DEFAULT '{}'::jsonb,
    p_error_sample JSONB DEFAULT NULL,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
    v_run_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO public.oracle_sync_events (
        job_id, integration_id, organization_id, run_id,
        trigger_type, status,
        rows_extracted, rows_transformed, rows_loaded, rows_failed, bytes_processed,
        extract_duration_ms, transform_duration_ms, load_duration_ms, total_duration_ms,
        extract_checkpoint, transform_checkpoint,
        error_details, error_sample, correlation_id
    ) VALUES (
        p_job_id, p_integration_id, p_organization_id, v_run_id,
        p_trigger_type, p_status,
        p_rows_extracted, p_rows_transformed, p_rows_loaded, p_rows_failed, p_bytes_processed,
        p_extract_duration_ms, p_transform_duration_ms, p_load_duration_ms, p_total_duration_ms,
        p_extract_checkpoint, p_transform_checkpoint,
        p_error_details, p_error_sample, p_correlation_id
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_oracle_sync_event(
    UUID, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, BIGINT,
    INTEGER, INTEGER, INTEGER, INTEGER, JSONB, JSONB, JSONB, JSONB, UUID
) TO authenticated;

-- RPC para registrar evento de uso APEX
CREATE OR REPLACE FUNCTION public.log_apex_usage_event(
    p_integration_id UUID,
    p_application_id UUID DEFAULT NULL,
    p_organization_id UUID,
    p_apex_session_id TEXT DEFAULT NULL,
    p_apex_user TEXT DEFAULT NULL,
    p_apex_app_id INTEGER DEFAULT NULL,
    p_apex_page_id INTEGER DEFAULT NULL,
    p_request_type TEXT DEFAULT NULL,
    p_endpoint_path TEXT DEFAULT NULL,
    p_parameters JSONB DEFAULT '{}'::jsonb,
    p_response_status INTEGER DEFAULT NULL,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_rows_returned INTEGER DEFAULT NULL,
    p_axionn_user_id UUID DEFAULT NULL,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO public.apex_usage_events (
        integration_id, application_id, organization_id,
        apex_session_id, apex_user, apex_app_id, apex_page_id,
        request_type, endpoint_path, parameters,
        response_status, response_time_ms, rows_returned,
        axionn_user_id, correlation_id
    ) VALUES (
        p_integration_id, p_application_id, p_organization_id,
        p_apex_session_id, p_apex_user, p_apex_app_id, p_apex_page_id,
        p_request_type, p_endpoint_path, p_parameters,
        p_response_status, p_response_time_ms, p_rows_returned,
        p_axionn_user_id, p_correlation_id
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_apex_usage_event(
    UUID, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, JSONB,
    INTEGER, INTEGER, INTEGER, UUID, UUID
) TO authenticated;

-- ============================================================
-- VIEWS PARA RELATÓRIOS
-- ============================================================

-- View: Saúde da integração Redmine
CREATE OR REPLACE VIEW public.v_redmine_integration_health AS
SELECT
    ri.organization_id,
    o.name AS organization_name,
    ri.id AS integration_id,
    ri.name AS integration_name,
    ri.is_active,
    ri.last_sync_at,
    ri.last_sync_status,
    ri.last_sync_items,
    ri.last_sync_error,
    COUNT(DISTINCT ril.axionn_entity_id) AS linked_entities,
    COUNT(DISTINCT ril.redmine_issue_id) AS linked_issues,
    COUNT(DISTINCT rse.id) FILTER (WHERE rse.started_at >= now() - INTERVAL '24 hours') AS syncs_last_24h,
    COUNT(DISTINCT rse.id) FILTER (WHERE rse.started_at >= now() - INTERVAL '24 hours' AND rse.status = 'failed') AS failed_syncs_last_24h
FROM public.redmine_integrations ri
JOIN public.organizations o ON o.id = ri.organization_id
LEFT JOIN public.redmine_issue_links ril ON ril.integration_id = ri.id
LEFT JOIN public.redmine_sync_events rse ON rse.integration_id = ri.id
WHERE ri.organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
)
GROUP BY ri.organization_id, o.name, ri.id, ri.name, ri.is_active, ri.last_sync_at, ri.last_sync_status, ri.last_sync_items, ri.last_sync_error;

COMMENT ON VIEW public.v_redmine_integration_health IS 'Saúde das integrações Redmine por organização';

-- View: Saúde dos jobs Oracle
CREATE OR REPLACE VIEW public.v_oracle_job_health AS
SELECT
    oi.organization_id,
    o.name AS organization_name,
    oi.id AS integration_id,
    oi.name AS integration_name,
    osj.id AS job_id,
    osj.name AS job_name,
    osj.job_type,
    osj.extraction_strategy,
    osj.is_active,
    osj.last_run_at,
    osj.last_run_status,
    osj.last_run_rows,
    osj.last_run_duration_ms,
    osj.last_run_error,
    osj.next_run_at,
    COUNT(DISTINCT ose.id) FILTER (WHERE ose.started_at >= now() - INTERVAL '7 days') AS runs_last_7d,
    COUNT(DISTINCT ose.id) FILTER (WHERE ose.started_at >= now() - INTERVAL '7 days' AND ose.status = 'failed') AS failed_runs_last_7d,
    AVG(ose.total_duration_ms) FILTER (WHERE ose.status = 'completed' AND ose.started_at >= now() - INTERVAL '7 days') AS avg_duration_ms_7d
FROM public.oracle_integrations oi
JOIN public.organizations o ON o.id = oi.organization_id
JOIN public.oracle_sync_jobs osj ON osj.integration_id = oi.id
LEFT JOIN public.oracle_sync_events ose ON ose.job_id = osj.id
WHERE oi.organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
)
GROUP BY oi.organization_id, o.name, oi.id, oi.name, osj.id, osj.name, osj.job_type, osj.extraction_strategy,
    osj.is_active, osj.last_run_at, osj.last_run_status, osj.last_run_rows, osj.last_run_duration_ms,
    osj.last_run_error, osj.next_run_at;

COMMENT ON VIEW public.v_oracle_job_health IS 'Saúde dos jobs de sincronização Oracle por organização';

-- View: Uso de aplicações APEX
CREATE OR REPLACE VIEW public.v_apex_usage_report AS
SELECT
    ai.organization_id,
    o.name AS organization_name,
    ai.id AS integration_id,
    ai.name AS integration_name,
    aap.id AS application_id,
    aap.apex_app_name,
    DATE(aue.created_at) AS usage_date,
    COUNT(*) AS total_requests,
    COUNT(DISTINCT aue.apex_user) AS unique_users,
    COUNT(*) FILTER (WHERE aue.response_status >= 200 AND aue.response_status < 300) AS successful_requests,
    COUNT(*) FILTER (WHERE aue.response_status >= 400) AS error_requests,
    AVG(aue.response_time_ms)::NUMERIC(10,2) AS avg_response_time_ms,
    SUM(aue.rows_returned) AS total_rows_returned
FROM public.apex_integrations ai
JOIN public.organizations o ON o.id = ai.organization_id
JOIN public.apex_applications aap ON aap.integration_id = ai.id
JOIN public.apex_usage_events aue ON aue.integration_id = ai.id AND aue.application_id = aap.id
WHERE ai.organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
)
  AND aue.created_at >= now() - INTERVAL '30 days'
GROUP BY ai.organization_id, o.name, ai.id, ai.name, aap.id, aap.apex_app_name, DATE(aue.created_at)
ORDER BY usage_date DESC;

COMMENT ON VIEW public.v_apex_usage_report IS 'Relatório de uso de aplicações APEX consumindo Axionn';