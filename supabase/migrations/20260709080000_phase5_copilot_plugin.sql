-- Phase 5: Microsoft 365 Copilot Plugin
-- Cria tabelas para configuração do plugin Copilot e indexação via Graph Connectors

-- 1. Configuração do Plugin Copilot
CREATE TABLE IF NOT EXISTS public.copilot_plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    name TEXT NOT NULL DEFAULT 'Axionn Copilot Plugin',
    description TEXT,
    -- Azure AD App Registration para o plugin
    azure_app_id TEXT NOT NULL,
    azure_app_secret_encrypted TEXT,
    -- Manifest do plugin
    manifest JSONB NOT NULL, -- Conforme schema do Microsoft 365 Copilot Plugin
    -- Configuração de APIs expostas
    api_endpoints JSONB DEFAULT '[]'::jsonb, -- Array de {name, path, method, description, parameters}
    -- Autenticação
    auth_type TEXT DEFAULT 'oauth2' CHECK (auth_type IN ('oauth2', 'api_key', 'none')),
    auth_config JSONB DEFAULT '{}'::jsonb,
    -- Rate limiting
    rate_limit_rpm INTEGER DEFAULT 60,
    rate_limit_rph INTEGER DEFAULT 1000,
    -- Status
    is_active BOOLEAN DEFAULT true,
    validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid', 'submitted', 'approved', 'rejected')),
    validation_errors JSONB,
    last_validated_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    -- Metadata
    config_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (organization_id, azure_app_id)
);

COMMENT ON TABLE public.copilot_plugins IS 'Configuração de plugins para Microsoft 365 Copilot';

-- 2. Configuração de Graph Connectors (indexação de dados do Axionn no Microsoft Graph)
CREATE TABLE IF NOT EXISTS public.graph_connectors_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    connection_id TEXT NOT NULL, -- ID da conexão no Microsoft Graph
    name TEXT NOT NULL,
    description TEXT,
    -- Schema do connector
    schema JSONB NOT NULL, -- Schema conforme Microsoft Graph Connectors
    -- Configuração de sincronização
    sync_schedule TEXT DEFAULT '0 */6 * * *', -- Cron: a cada 6 horas
    sync_strategy TEXT DEFAULT 'incremental' CHECK (sync_strategy IN ('full', 'incremental', 'delta')),
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT CHECK (last_sync_status IN ('success', 'partial', 'failed')),
    last_sync_items INTEGER DEFAULT 0,
    last_sync_error TEXT,
    -- Filtros de dados a indexar
    filter_config JSONB DEFAULT '{}'::jsonb, -- Ex: {projects: ['proj-1'], status: ['active']}
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (organization_id, connection_id)
);

COMMENT ON TABLE public.graph_connectors_config IS 'Configuração de Microsoft Graph Connectors para indexação de dados do Axionn no Copilot';

-- 3. Mapeamento de entidades Axionn para schema do Graph Connector
CREATE TABLE IF NOT EXISTS public.graph_connector_entity_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_config_id UUID NOT NULL REFERENCES public.graph_connectors_config(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('user_story', 'sprint', 'impediment', 'project', 'team', 'release', 'dashboard_metric')),
    external_id_field TEXT NOT NULL, -- Campo único da entidade (ex: 'code' para HU)
    title_field TEXT NOT NULL, -- Campo para título no search
    content_fields TEXT[], -- Campos para conteúdo searchable
    metadata_fields TEXT[], -- Campos para metadata/filtros
    url_template TEXT, -- Template de URL para link no resultado: "https://axionn.app/hu/{code}"
    icon_url TEXT,
    -- Mapeamento de propriedades para schema do connector
    property_mapping JSONB NOT NULL, -- {axionn_field: connector_property}
    -- Filtros
    active_filter JSONB DEFAULT '{}'::jsonb, -- Filtro para incluir apenas ativos
    -- Agendamento específico da entidade
    sync_schedule TEXT,
    last_synced_at TIMESTAMPTZ,
    last_synced_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (connector_config_id, entity_type)
);

COMMENT ON TABLE public.graph_connector_entity_mappings IS 'Mapeamento de entidades do Axionn para propriedades do Graph Connector';

-- 4. Log de operações do Graph Connector
CREATE TABLE IF NOT EXISTS public.graph_connector_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_config_id UUID NOT NULL REFERENCES public.graph_connectors_config(id) ON DELETE CASCADE,
    entity_mapping_id UUID REFERENCES public.graph_connector_entity_mappings(id) ON DELETE SET NULL,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'delta', 'delete')),
    status TEXT NOT NULL CHECK (status IN ('started', 'in_progress', 'completed', 'failed', 'partial')),
    items_processed INTEGER DEFAULT 0,
    items_succeeded INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    error_details JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    correlation_id UUID,
    UNIQUE (connector_config_id, correlation_id)
);

COMMENT ON TABLE public.graph_connector_sync_logs IS 'Log de sincronização dos Graph Connectors';

CREATE INDEX IF NOT EXISTS idx_graph_connector_logs_config_time ON public.graph_connector_sync_logs (connector_config_id, started_at DESC);

-- 5. Interações do Copilot com o plugin
CREATE TABLE IF NOT EXISTS public.copilot_plugin_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id UUID NOT NULL REFERENCES public.copilot_plugins(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    -- Usuário Microsoft
    ms_user_id TEXT NOT NULL, -- Azure AD Object ID
    ms_user_email TEXT,
    ms_user_name TEXT,
    -- Sessão
    conversation_id TEXT,
    message_id TEXT,
    -- Requisição
    query_text TEXT NOT NULL,
    intent TEXT, -- Intenção detectada pelo plugin
    parameters JSONB, -- Parâmetros extraídos
    -- Resposta
    response_type TEXT CHECK (response_type IN ('success', 'error', 'clarification', 'no_results')),
    response_summary TEXT,
    response_data JSONB,
    processing_time_ms INTEGER,
    -- Tokens/custo estimado
    estimated_tokens INTEGER,
    estimated_cost_usd NUMERIC(10,6),
    -- Feedback
    user_feedback TEXT CHECK (user_feedback IN ('helpful', 'not_helpful', 'partially_helpful')),
    feedback_at TIMESTAMPTZ,
    -- Correlation
    correlation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.copilot_plugin_interactions IS 'Log de interações dos usuários com o plugin Copilot';

CREATE INDEX IF NOT EXISTS idx_copilot_interactions_plugin_time ON public.copilot_plugin_interactions (plugin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_copilot_interactions_user_time ON public.copilot_plugin_interactions (ms_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_copilot_interactions_correlation ON public.copilot_plugin_interactions (correlation_id);

-- 6. Trigger para updated_at
DROP TRIGGER IF EXISTS update_copilot_plugins_updated_at ON public.copilot_plugins;
CREATE TRIGGER update_copilot_plugins_updated_at
    BEFORE UPDATE ON public.copilot_plugins
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_graph_connectors_config_updated_at ON public.graph_connectors_config;
CREATE TRIGGER update_graph_connectors_config_updated_at
    BEFORE UPDATE ON public.graph_connectors_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_graph_connector_entity_mappings_updated_at ON public.graph_connector_entity_mappings;
CREATE TRIGGER update_graph_connector_entity_mappings_updated_at
    BEFORE UPDATE ON public.graph_connector_entity_mappings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. RLS Policies
ALTER TABLE public.copilot_plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_connectors_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_connector_entity_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_connector_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_plugin_interactions ENABLE ROW LEVEL SECURITY;

-- Copilot Plugins: org admins manage
CREATE POLICY "copilot_plugins_select_org_admin" ON public.copilot_plugins
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "copilot_plugins_manage_org_admin" ON public.copilot_plugins
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

-- Graph Connectors Config: org admins
CREATE POLICY "graph_connectors_select_org_admin" ON public.graph_connectors_config
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "graph_connectors_manage_org_admin" ON public.graph_connectors_config
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

-- Entity Mappings: org admins
CREATE POLICY "graph_entity_mappings_select_org_admin" ON public.graph_connector_entity_mappings
    FOR SELECT USING (
        connector_config_id IN (
            SELECT id FROM public.graph_connectors_config
            WHERE organization_id IN (
                SELECT organization_id FROM public.organization_members
                WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
            )
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "graph_entity_mappings_manage_org_admin" ON public.graph_connector_entity_mappings
    FOR ALL USING (
        connector_config_id IN (
            SELECT id FROM public.graph_connectors_config
            WHERE organization_id IN (
                SELECT organization_id FROM public.organization_members
                WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
            )
        )
    )
    WITH CHECK (
        connector_config_id IN (
            SELECT id FROM public.graph_connectors_config
            WHERE organization_id IN (
                SELECT organization_id FROM public.organization_members
                WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
            )
        )
    );

-- Sync Logs: org admins
CREATE POLICY "graph_sync_logs_select_org_admin" ON public.graph_connector_sync_logs
    FOR SELECT USING (
        connector_config_id IN (
            SELECT id FROM public.graph_connectors_config
            WHERE organization_id IN (
                SELECT organization_id FROM public.organization_members
                WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
            )
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "graph_sync_logs_insert_service" ON public.graph_connector_sync_logs
    FOR INSERT WITH CHECK (true);

-- Copilot Interactions: org admins and platform admins
CREATE POLICY "copilot_interactions_select_org_admin" ON public.copilot_plugin_interactions
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "copilot_interactions_insert_service" ON public.copilot_plugin_interactions
    FOR INSERT WITH CHECK (true);

-- 8. RPC para registrar interação do Copilot
CREATE OR REPLACE FUNCTION public.log_copilot_interaction(
    p_plugin_id UUID,
    p_organization_id UUID,
    p_ms_user_id TEXT,
    p_ms_user_email TEXT DEFAULT NULL,
    p_ms_user_name TEXT DEFAULT NULL,
    p_conversation_id TEXT DEFAULT NULL,
    p_message_id TEXT DEFAULT NULL,
    p_query_text TEXT,
    p_intent TEXT DEFAULT NULL,
    p_parameters JSONB DEFAULT '{}'::jsonb,
    p_response_type TEXT DEFAULT NULL,
    p_response_summary TEXT DEFAULT NULL,
    p_response_data JSONB DEFAULT NULL,
    p_processing_time_ms INTEGER DEFAULT NULL,
    p_estimated_tokens INTEGER DEFAULT NULL,
    p_estimated_cost_usd NUMERIC DEFAULT NULL,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_interaction_id UUID;
BEGIN
    INSERT INTO public.copilot_plugin_interactions (
        plugin_id, organization_id,
        ms_user_id, ms_user_email, ms_user_name,
        conversation_id, message_id,
        query_text, intent, parameters,
        response_type, response_summary, response_data,
        processing_time_ms, estimated_tokens, estimated_cost_usd,
        correlation_id
    ) VALUES (
        p_plugin_id, p_organization_id,
        p_ms_user_id, p_ms_user_email, p_ms_user_name,
        p_conversation_id, p_message_id,
        p_query_text, p_intent, p_parameters,
        p_response_type, p_response_summary, p_response_data,
        p_processing_time_ms, p_estimated_tokens, p_estimated_cost_usd,
        p_correlation_id
    ) RETURNING id INTO v_interaction_id;

    RETURN v_interaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_copilot_interaction(
    UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB,
    TEXT, TEXT, JSONB, INTEGER, INTEGER, NUMERIC, UUID
) TO authenticated;

-- 9. View para relatório de uso do Copilot
CREATE OR REPLACE VIEW public.v_copilot_usage_report AS
SELECT
    cpi.organization_id,
    o.name AS organization_name,
    cp.id AS plugin_id,
    cp.name AS plugin_name,
    DATE(cpi.created_at) AS interaction_date,
    COUNT(*) AS total_interactions,
    COUNT(DISTINCT cpi.ms_user_id) AS unique_users,
    COUNT(*) FILTER (WHERE cpi.response_type = 'success') AS successful_interactions,
    COUNT(*) FILTER (WHERE cpi.response_type = 'error') AS error_interactions,
    COUNT(*) FILTER (WHERE cpi.response_type = 'no_results') AS no_results_interactions,
    ROUND(100.0 * COUNT(*) FILTER (WHERE cpi.response_type = 'success') / NULLIF(COUNT(*), 0), 2) AS success_rate_pct,
    AVG(cpi.processing_time_ms)::NUMERIC(10,2) AS avg_processing_time_ms,
    SUM(cpi.estimated_tokens) AS total_tokens,
    SUM(cpi.estimated_cost_usd) AS total_estimated_cost_usd,
    COUNT(*) FILTER (WHERE cpi.user_feedback = 'helpful') AS helpful_feedback,
    COUNT(*) FILTER (WHERE cpi.user_feedback = 'not_helpful') AS not_helpful_feedback,
    ROUND(100.0 * COUNT(*) FILTER (WHERE cpi.user_feedback = 'helpful') / NULLIF(COUNT(*) FILTER (WHERE cpi.user_feedback IS NOT NULL), 0), 2) AS helpful_rate_pct
FROM public.copilot_plugin_interactions cpi
JOIN public.copilot_plugins cp ON cp.id = cpi.plugin_id
JOIN public.organizations o ON o.id = cpi.organization_id
WHERE cpi.organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
)
GROUP BY cpi.organization_id, o.name, cp.id, cp.name, DATE(cpi.created_at)
ORDER BY interaction_date DESC;

COMMENT ON VIEW public.v_copilot_usage_report IS 'Relatório de uso do plugin Copilot por organização/plugin/data';

-- 10. View para intents mais usadas
CREATE OR REPLACE VIEW public.v_copilot_top_intents AS
SELECT
    organization_id,
    intent,
    COUNT(*) AS usage_count,
    COUNT(DISTINCT ms_user_id) AS unique_users,
    ROUND(AVG(processing_time_ms)::NUMERIC, 2) AS avg_processing_time_ms,
    ROUND(100.0 * COUNT(*) FILTER (WHERE response_type = 'success') / NULLIF(COUNT(*), 0), 2) AS success_rate_pct
FROM public.copilot_plugin_interactions
WHERE intent IS NOT NULL
  AND organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  AND created_at >= now() - INTERVAL '30 days'
GROUP BY organization_id, intent
ORDER BY usage_count DESC;

COMMENT ON VIEW public.v_copilot_top_intents IS 'Top intents usadas no plugin Copilot nos últimos 30 dias';