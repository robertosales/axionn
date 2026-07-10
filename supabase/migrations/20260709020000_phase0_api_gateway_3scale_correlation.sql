-- Phase 0: Fundações - API Gateway (3Scale) e Padrões de Correlação
-- Cria tabelas para gestão de aplicações consumidoras, contratos de API e eventos de uso

-- 1. Tabela de aplicações consumidoras de API (cadastradas no 3Scale/Axionn)
CREATE TABLE IF NOT EXISTS public.api_gateway_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    application_type TEXT NOT NULL CHECK (application_type IN (
        'internal', 'partner', 'public', 'teams_bot', 'copilot_plugin', 'apex', 'redmine', 'custom'
    )),
    -- Credenciais para autenticação no API Gateway
    client_id TEXT UNIQUE NOT NULL,
    client_secret_hash TEXT NOT NULL, -- Hash bcrypt/argon2 do secret
    -- Controle de acesso e limites
    rate_limit_rpm INTEGER DEFAULT 1000, -- Requisições por minuto
    rate_limit_rph INTEGER DEFAULT 10000, -- Requisições por hora
    quota_limit INTEGER DEFAULT 100000, -- Quota mensal
    quota_period TEXT DEFAULT 'monthly' CHECK (quota_period IN ('daily', 'weekly', 'monthly')),
    -- Configuração de scopes/permissões
    allowed_scopes TEXT[] DEFAULT ARRAY['read'],
    allowed_endpoints TEXT[], -- NULL = todos os endpoints permitidos
    -- Status e metadata
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked', 'pending_approval')),
    metadata JSONB DEFAULT '{}'::jsonb,
    -- 3Scale integration
    threescale_application_id TEXT,
    threescale_service_id TEXT,
    threescale_plan_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (organization_id, name)
);

COMMENT ON TABLE public.api_gateway_applications IS 'Aplicações consumidoras das APIs do Axionn (registradas no 3Scale ou gerenciadas internamente)';
COMMENT ON COLUMN public.api_gateway_applications.client_secret_hash IS 'Hash seguro do client_secret (bcrypt/argon2)';

-- 2. Versionamento de contratos de API
CREATE TABLE IF NOT EXISTS public.api_contract_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    api_name TEXT NOT NULL,
    version TEXT NOT NULL, -- Ex: "v1", "v2.1.0"
    spec_type TEXT DEFAULT 'openapi' CHECK (spec_type IN ('openapi', 'graphql', 'grpc')),
    spec_content JSONB NOT NULL, -- OpenAPI spec ou schema GraphQL
    spec_url TEXT, -- URL para download da spec
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'deprecated', 'retired')),
    published_at TIMESTAMPTZ,
    deprecated_at TIMESTAMPTZ,
    retired_at TIMESTAMPTZ,
    changelog TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (organization_id, api_name, version)
);

COMMENT ON TABLE public.api_contract_versions IS 'Versionamento de contratos de API publicados no gateway';

-- 3. Eventos agregados de consumo de API (para relatórios e billing)
CREATE TABLE IF NOT EXISTS public.api_gateway_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.api_gateway_applications(id) ON DELETE SET NULL,
    contract_version_id UUID REFERENCES public.api_contract_versions(id) ON DELETE SET NULL,
    -- Identificação da requisição
    endpoint_path TEXT NOT NULL,
    http_method TEXT NOT NULL,
    api_version TEXT,
    -- Métricas
    response_status INTEGER NOT NULL,
    response_time_ms INTEGER,
    request_size_bytes BIGINT,
    response_size_bytes BIGINT,
    -- Contexto
    consumer_ip INET,
    user_agent TEXT,
    correlation_id UUID,
    authenticated_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- Tempo e agregação
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    aggregation_period TEXT NOT NULL CHECK (aggregation_period IN ('minute', 'hour', 'day')),
    -- Metadata adicional
    metadata JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.api_gateway_usage_events IS 'Eventos agregados de consumo de API para relatórios, billing e observabilidade';

CREATE INDEX IF NOT EXISTS idx_api_gateway_usage_org_time ON public.api_gateway_usage_events (organization_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_gateway_usage_app_time ON public.api_gateway_usage_events (application_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_gateway_usage_correlation ON public.api_gateway_usage_events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_api_gateway_usage_endpoint ON public.api_gateway_usage_events (endpoint_path, http_method, event_timestamp DESC);

-- 4. Tabela de correlação para rastreabilidade ponta a ponta
CREATE TABLE IF NOT EXISTS public.correlation_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
    root_correlation_id UUID, -- ID raiz da cadeia de chamadas
    parent_correlation_id UUID, -- ID do pai imediato
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    source_system TEXT NOT NULL, -- 'web', 'teams', 'copilot', 'gitlab', 'redmine', 'apex', 'api_gateway', 'scheduler'
    source_component TEXT, -- 'dashboard', 'api', 'webhook', 'bot', 'plugin', 'etl_job'
    initiated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    initiated_by_application_id UUID REFERENCES public.api_gateway_applications(id) ON DELETE SET NULL,
    trace_metadata JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'timeout')),
    error_message TEXT
);

COMMENT ON TABLE public.correlation_contexts IS 'Contexto de correlação para rastreamento distribuído (correlation ID chain)';

CREATE INDEX IF NOT EXISTS idx_correlation_contexts_corr_id ON public.correlation_contexts (correlation_id);
CREATE INDEX IF NOT EXISTS idx_correlation_contexts_root_corr ON public.correlation_contexts (root_correlation_id);
CREATE INDEX IF NOT EXISTS idx_correlation_contexts_org_time ON public.correlation_contexts (organization_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_correlation_contexts_user_time ON public.correlation_contexts (initiated_by_user_id, started_at DESC);

-- 5. RPC para criar novo contexto de correlação
CREATE OR REPLACE FUNCTION public.create_correlation_context(
    p_organization_id UUID DEFAULT NULL,
    p_source_system TEXT,
    p_source_component TEXT DEFAULT NULL,
    p_initiated_by_user_id UUID DEFAULT NULL,
    p_initiated_by_application_id UUID DEFAULT NULL,
    p_parent_correlation_id UUID DEFAULT NULL,
    p_trace_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_correlation_id UUID := gen_random_uuid();
    v_root_correlation_id UUID := COALESCE(p_parent_correlation_id, gen_random_uuid());
BEGIN
    -- Se tem parent, busca o root
    IF p_parent_correlation_id IS NOT NULL THEN
        SELECT root_correlation_id INTO v_root_correlation_id
        FROM public.correlation_contexts
        WHERE correlation_id = p_parent_correlation_id
        LIMIT 1;

        IF v_root_correlation_id IS NULL THEN
            v_root_correlation_id := p_parent_correlation_id;
        END IF;
    END IF;

    INSERT INTO public.correlation_contexts (
        correlation_id, root_correlation_id, parent_correlation_id,
        organization_id, source_system, source_component,
        initiated_by_user_id, initiated_by_application_id, trace_metadata
    ) VALUES (
        v_correlation_id, v_root_correlation_id, p_parent_correlation_id,
        p_organization_id, p_source_system, p_source_component,
        p_initiated_by_user_id, p_initiated_by_application_id, p_trace_metadata
    );

    RETURN v_correlation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_correlation_context(UUID, TEXT, TEXT, UUID, UUID, UUID, JSONB) TO authenticated;

-- 6. RPC para finalizar contexto de correlação
CREATE OR REPLACE FUNCTION public.complete_correlation_context(
    p_correlation_id UUID,
    p_status TEXT DEFAULT 'completed',
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.correlation_contexts
    SET completed_at = now(),
        status = p_status,
        error_message = p_error_message
    WHERE correlation_id = p_correlation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_correlation_context(UUID, TEXT, TEXT) TO authenticated;

-- 7. RPC para registrar evento de uso de API (chamado pelo gateway ou middleware)
CREATE OR REPLACE FUNCTION public.log_api_gateway_usage(
    p_organization_id UUID,
    p_application_id UUID,
    p_contract_version_id UUID DEFAULT NULL,
    p_endpoint_path TEXT,
    p_http_method TEXT,
    p_api_version TEXT DEFAULT NULL,
    p_response_status INTEGER,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_request_size_bytes BIGINT DEFAULT NULL,
    p_response_size_bytes BIGINT DEFAULT NULL,
    p_consumer_ip INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_correlation_id UUID DEFAULT NULL,
    p_authenticated_user_id UUID DEFAULT NULL,
    p_aggregation_period TEXT DEFAULT 'minute',
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO public.api_gateway_usage_events (
        organization_id, application_id, contract_version_id,
        endpoint_path, http_method, api_version,
        response_status, response_time_ms, request_size_bytes, response_size_bytes,
        consumer_ip, user_agent, correlation_id, authenticated_user_id,
        aggregation_period, metadata
    ) VALUES (
        p_organization_id, p_application_id, p_contract_version_id,
        p_endpoint_path, p_http_method, p_api_version,
        p_response_status, p_response_time_ms, p_request_size_bytes, p_response_size_bytes,
        p_consumer_ip, p_user_agent, p_correlation_id, p_authenticated_user_id,
        p_aggregation_period, p_metadata
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_api_gateway_usage(
    UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, BIGINT, BIGINT,
    INET, TEXT, UUID, UUID, TEXT, JSONB
) TO authenticated;

-- 8. RLS Policies
ALTER TABLE public.api_gateway_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_gateway_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correlation_contexts ENABLE ROW LEVEL SECURITY;

-- API Gateway Applications: org admins manage, members can read
CREATE POLICY "api_gateway_apps_select_org_member" ON public.api_gateway_applications
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "api_gateway_apps_manage_org_admin" ON public.api_gateway_applications
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

-- API Contract Versions: similar
CREATE POLICY "api_contract_versions_select_org_member" ON public.api_contract_versions
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "api_contract_versions_manage_org_admin" ON public.api_contract_versions
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

-- API Gateway Usage Events: only org admins and platform admins can read
CREATE POLICY "api_gateway_usage_select_org_admin" ON public.api_gateway_usage_events
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

-- Insert allowed for services
CREATE POLICY "api_gateway_usage_insert_service" ON public.api_gateway_usage_events
    FOR INSERT WITH CHECK (true);

-- Correlation Contexts: users can see their own, org admins see all
CREATE POLICY "correlation_contexts_select_own" ON public.correlation_contexts
    FOR SELECT USING (
        initiated_by_user_id = auth.uid() OR
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "correlation_contexts_insert_service" ON public.correlation_contexts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "correlation_contexts_update_service" ON public.correlation_contexts
    FOR UPDATE USING (true);

-- 9. Triggers para updated_at
DROP TRIGGER IF EXISTS update_api_gateway_applications_updated_at ON public.api_gateway_applications;
CREATE TRIGGER update_api_gateway_applications_updated_at
    BEFORE UPDATE ON public.api_gateway_applications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_contract_versions_updated_at ON public.api_contract_versions;
CREATE TRIGGER update_api_contract_versions_updated_at
    BEFORE UPDATE ON public.api_contract_versions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. View para métricas agregadas de uso de API por aplicação
CREATE OR REPLACE VIEW public.v_api_gateway_usage_daily AS
SELECT
    organization_id,
    application_id,
    DATE(event_timestamp) AS usage_date,
    COUNT(*) AS total_requests,
    COUNT(*) FILTER (WHERE response_status >= 200 AND response_status < 300) AS success_requests,
    COUNT(*) FILTER (WHERE response_status >= 400) AS error_requests,
    AVG(response_time_ms) AS avg_response_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) AS p95_response_time_ms,
    SUM(request_size_bytes) AS total_request_bytes,
    SUM(response_size_bytes) AS total_response_bytes,
    COUNT(DISTINCT correlation_id) AS unique_traces,
    COUNT(DISTINCT authenticated_user_id) AS unique_users
FROM public.api_gateway_usage_events
WHERE aggregation_period IN ('minute', 'hour')
GROUP BY organization_id, application_id, DATE(event_timestamp);

COMMENT ON VIEW public.v_api_gateway_usage_daily IS 'Métricas diárias agregadas de consumo de API por aplicação';