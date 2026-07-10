-- Phase 4: Integração Microsoft Teams
-- Cria tabelas para configuração de integração Teams, bot, comandos e notificações

-- 1. Configuração de integração Teams por organização/projeto
CREATE TABLE IF NOT EXISTS public.teams_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    name TEXT NOT NULL DEFAULT 'Axionn Teams Integration',
    -- Azure AD App Registration
    azure_tenant_id TEXT NOT NULL,
    azure_client_id TEXT NOT NULL,
    azure_client_secret_encrypted TEXT,
    -- Bot Framework
    bot_id TEXT,
    bot_password_encrypted TEXT,
    bot_endpoint TEXT, -- URL do endpoint do bot (ex: https://api.axionn.com/api/teams/bot)
    -- Configuração de notificações
    notification_channels JSONB DEFAULT '[]'::jsonb, -- Array de {channel_id, team_id, event_types[]}
    default_notification_events TEXT[] DEFAULT ARRAY[
        'hu_risk_high', 'hu_risk_critical', 'impediment_created', 'impediment_critical',
        'mr_awaiting_review', 'mr_merged', 'sprint_at_risk', 'deployment_failed',
        'deployment_production', 'ai_generation_complete'
    ],
    -- Configuração de comandos
    enabled_commands TEXT[] DEFAULT ARRAY[
        'status', 'hu', 'sprint', 'impediment', 'risk', 'dora', 'help'
    ],
    -- Configuração de Adaptive Cards
    card_theme TEXT DEFAULT 'default' CHECK (card_theme IN ('default', 'compact', 'detailed')),
    include_actions BOOLEAN DEFAULT true,
    -- Status
    is_active BOOLEAN DEFAULT true,
    installed_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    -- Metadata
    config_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (organization_id, project_id, azure_tenant_id)
);

COMMENT ON TABLE public.teams_integrations IS 'Configuração da integração com Microsoft Teams por organização/projeto';

-- 2. Mapeamento de canais Teams para projetos/eventos
CREATE TABLE IF NOT EXISTS public.teams_channel_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES public.teams_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    team_id TEXT NOT NULL, -- Teams Team ID
    team_name TEXT,
    channel_id TEXT NOT NULL, -- Teams Channel ID
    channel_name TEXT,
    -- Tipos de eventos para notificar neste canal
    event_types TEXT[] DEFAULT ARRAY['all'],
    -- Filtros adicionais
    filter_json JSONB DEFAULT '{}'::jsonb, -- Ex: {severity: ['high', 'critical'], assignee: 'user_id'}
    -- Configuração de menções
    mention_users TEXT[], -- User IDs para @mencionar em alertas críticos
    mention_on_critical BOOLEAN DEFAULT true,
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_notification_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (integration_id, team_id, channel_id)
);

COMMENT ON TABLE public.teams_channel_mappings IS 'Mapeamento de canais Teams para recebimento de notificações filtradas';

-- 3. Eventos de interação via Teams (comandos, bot messages, etc.)
CREATE TABLE IF NOT EXISTS public.teams_interaction_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES public.teams_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    -- Usuário Teams
    teams_user_id TEXT NOT NULL, -- Azure AD Object ID
    teams_user_name TEXT,
    teams_user_email TEXT,
    teams_user_aad_object_id TEXT,
    -- Mapeamento para usuário Axionn
    axionn_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- Contexto da interação
    team_id TEXT,
    team_name TEXT,
    channel_id TEXT,
    channel_name TEXT,
    conversation_id TEXT,
    -- Tipo de interação
    interaction_type TEXT NOT NULL CHECK (interaction_type IN (
        'command', 'message', 'card_action', 'task_module', 'meeting_extension', 'tab'
    )),
    command_name TEXT, -- Ex: 'status', 'hu', 'impediment'
    command_args JSONB, -- Argumentos do comando
    -- Resposta
    response_type TEXT CHECK (response_type IN ('success', 'error', 'permission_denied', 'not_found', 'help')),
    response_message TEXT,
    response_card JSONB, -- Adaptive Card enviado
    -- Metadata
    processing_time_ms INTEGER,
    correlation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.teams_interaction_events IS 'Log de interações dos usuários com o Bot Teams (comandos, cards, etc.)';

CREATE INDEX IF NOT EXISTS idx_teams_interactions_integration_time ON public.teams_interaction_events (integration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teams_interactions_user_time ON public.teams_interaction_events (teams_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teams_interactions_command ON public.teams_interaction_events (command_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teams_interactions_correlation ON public.teams_interaction_events (correlation_id);

-- 4. Notificações enviadas via Teams (para auditoria e deduplicação)
CREATE TABLE IF NOT EXISTS public.teams_notifications_sent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES public.teams_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    channel_mapping_id UUID REFERENCES public.teams_channel_mappings(id) ON DELETE SET NULL,
    -- Destino
    team_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    -- Evento origem
    event_type TEXT NOT NULL,
    event_source TEXT, -- 'git', 'dora', 'risk', 'ai', 'impediment', 'deployment', 'manual'
    event_payload JSONB,
    -- Conteúdo enviado
    card_type TEXT, -- 'adaptive_card', 'text', 'hero_card', 'thumbnail_card'
    card_content JSONB,
    message_text TEXT,
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'retry')),
    sent_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    -- Deduplicação
    deduplication_key TEXT, -- Chave para evitar notificações duplicadas
    correlation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (integration_id, deduplication_key)
);

COMMENT ON TABLE public.teams_notifications_sent IS 'Registro de notificações enviadas via Teams para auditoria e deduplicação';

CREATE INDEX IF NOT EXISTS idx_teams_notifications_integration_time ON public.teams_notifications_sent (integration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teams_notifications_status ON public.teams_notifications_sent (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teams_notifications_dedup ON public.teams_notifications_sent (deduplication_key);
CREATE INDEX IF NOT EXISTS idx_teams_notifications_event_type ON public.teams_notifications_sent (event_type, created_at DESC);

-- 5. Configuração de comandos personalizados
CREATE TABLE IF NOT EXISTS public.teams_custom_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES public.teams_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    command_name TEXT NOT NULL,
    description TEXT,
    usage_hint TEXT,
    -- Handler: pode ser 'rpc' (chama RPC no Supabase), 'webhook' (chama URL externa), 'builtin'
    handler_type TEXT NOT NULL DEFAULT 'rpc' CHECK (handler_type IN ('rpc', 'webhook', 'builtin')),
    handler_config JSONB NOT NULL, -- Ex: {function: 'get_hu_status', params: {hu_code: '$1'}}
    -- Permissões
    required_roles TEXT[] DEFAULT ARRAY['member'], -- member, admin, owner
    allowed_in_channel BOOLEAN DEFAULT true,
    allowed_in_personal BOOLEAN DEFAULT true,
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (integration_id, command_name)
);

COMMENT ON TABLE public.teams_custom_commands IS 'Comandos personalizados do Bot Teams configuráveis';

-- 6. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_teams_integrations_updated_at ON public.teams_integrations;
CREATE TRIGGER update_teams_integrations_updated_at
    BEFORE UPDATE ON public.teams_integrations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_teams_channel_mappings_updated_at ON public.teams_channel_mappings;
CREATE TRIGGER update_teams_channel_mappings_updated_at
    BEFORE UPDATE ON public.teams_channel_mappings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_teams_custom_commands_updated_at ON public.teams_custom_commands;
CREATE TRIGGER update_teams_custom_commands_updated_at
    BEFORE UPDATE ON public.teams_custom_commands
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. RLS Policies
ALTER TABLE public.teams_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams_channel_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams_interaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams_notifications_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams_custom_commands ENABLE ROW LEVEL SECURITY;

-- Teams Integrations: org members read, admins manage
CREATE POLICY "teams_integrations_select_org_member" ON public.teams_integrations
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "teams_integrations_manage_org_admin" ON public.teams_integrations
    FOR ALL USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Channel Mappings: similar
CREATE POLICY "teams_channels_select_org_member" ON public.teams_channel_mappings
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "teams_channels_manage_org_admin" ON public.teams_channel_mappings
    FOR ALL USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Interaction Events: org admins and platform admins
CREATE POLICY "teams_interactions_select_org_admin" ON public.teams_interaction_events
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "teams_interactions_insert_service" ON public.teams_interaction_events
    FOR INSERT WITH CHECK (true);

-- Notifications Sent: org admins
CREATE POLICY "teams_notifications_select_org_admin" ON public.teams_notifications_sent
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "teams_notifications_insert_service" ON public.teams_notifications_sent
    FOR INSERT WITH CHECK (true);

CREATE POLICY "teams_notifications_update_service" ON public.teams_notifications_sent
    FOR UPDATE USING (true);

-- Custom Commands: org admins manage
CREATE POLICY "teams_commands_select_org_member" ON public.teams_custom_commands
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "teams_commands_manage_org_admin" ON public.teams_custom_commands
    FOR ALL USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- 8. RPC para registrar interação Teams
CREATE OR REPLACE FUNCTION public.log_teams_interaction(
    p_integration_id UUID,
    p_organization_id UUID,
    p_teams_user_id TEXT,
    p_interaction_type TEXT,
    p_teams_user_name TEXT DEFAULT NULL,
    p_teams_user_email TEXT DEFAULT NULL,
    p_teams_user_aad_object_id TEXT DEFAULT NULL,
    p_team_id TEXT DEFAULT NULL,
    p_team_name TEXT DEFAULT NULL,
    p_channel_id TEXT DEFAULT NULL,
    p_channel_name TEXT DEFAULT NULL,
    p_conversation_id TEXT DEFAULT NULL,
    p_command_name TEXT DEFAULT NULL,
    p_command_args JSONB DEFAULT '{}'::jsonb,
    p_response_type TEXT DEFAULT NULL,
    p_response_message TEXT DEFAULT NULL,
    p_response_card JSONB DEFAULT NULL,
    p_processing_time_ms INTEGER DEFAULT NULL,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
    v_axionn_user_id UUID;
BEGIN
    -- Tentar mapear usuário Teams para usuário Axionn via email
    IF p_teams_user_email IS NOT NULL THEN
        SELECT id INTO v_axionn_user_id
        FROM auth.users
        WHERE email = p_teams_user_email
        LIMIT 1;
    END IF;

    INSERT INTO public.teams_interaction_events (
        integration_id, organization_id,
        teams_user_id, teams_user_name, teams_user_email, teams_user_aad_object_id,
        axionn_user_id,
        team_id, team_name, channel_id, channel_name, conversation_id,
        interaction_type, command_name, command_args,
        response_type, response_message, response_card,
        processing_time_ms, correlation_id
    ) VALUES (
        p_integration_id, p_organization_id,
        p_teams_user_id, p_teams_user_name, p_teams_user_email, p_teams_user_aad_object_id,
        v_axionn_user_id,
        p_team_id, p_team_name, p_channel_id, p_channel_name, p_conversation_id,
        p_interaction_type, p_command_name, p_command_args,
        p_response_type, p_response_message, p_response_card,
        p_processing_time_ms, p_correlation_id
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_teams_interaction(
    UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
    TEXT, JSONB, TEXT, TEXT, JSONB, INTEGER, UUID
) TO authenticated;

-- 9. RPC para registrar notificação enviada
CREATE OR REPLACE FUNCTION public.log_teams_notification(
    p_integration_id UUID,
    p_organization_id UUID,
    p_team_id TEXT,
    p_channel_id TEXT,
    p_event_type TEXT,
    p_channel_mapping_id UUID DEFAULT NULL,
    p_event_source TEXT DEFAULT NULL,
    p_event_payload JSONB DEFAULT '{}'::jsonb,
    p_card_type TEXT DEFAULT NULL,
    p_card_content JSONB DEFAULT NULL,
    p_message_text TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'pending',
    p_sent_at TIMESTAMPTZ DEFAULT NULL,
    p_failure_reason TEXT DEFAULT NULL,
    p_deduplication_key TEXT DEFAULT NULL,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO public.teams_notifications_sent (
        integration_id, organization_id, channel_mapping_id,
        team_id, channel_id,
        event_type, event_source, event_payload,
        card_type, card_content, message_text,
        status, sent_at, failure_reason,
        deduplication_key, correlation_id
    ) VALUES (
        p_integration_id, p_organization_id, p_channel_mapping_id,
        p_team_id, p_channel_id,
        p_event_type, p_event_source, p_event_payload,
        p_card_type, p_card_content, p_message_text,
        p_status, p_sent_at, p_failure_reason,
        p_deduplication_key, p_correlation_id
    ) ON CONFLICT (integration_id, deduplication_key) DO UPDATE SET
        status = EXCLUDED.status,
        sent_at = EXCLUDED.sent_at,
        failure_reason = EXCLUDED.failure_reason,
        retry_count = teams_notifications_sent.retry_count + 1
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_teams_notification(
    UUID, UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB, TEXT, JSONB, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, UUID
) TO authenticated;

-- 10. View para relatório de adoção Teams
CREATE OR REPLACE VIEW public.v_teams_adoption_report AS
SELECT
    ti.organization_id,
    o.name AS organization_name,
    ti.id AS integration_id,
    ti.name AS integration_name,
    ti.is_active,
    ti.installed_at,
    COUNT(DISTINCT tie.teams_user_id) AS unique_users,
    COUNT(*) AS total_interactions,
    COUNT(*) FILTER (WHERE tie.interaction_type = 'command') AS command_count,
    COUNT(*) FILTER (WHERE tie.command_name = 'status') AS status_commands,
    COUNT(*) FILTER (WHERE tie.command_name = 'hu') AS hu_commands,
    COUNT(*) FILTER (WHERE tie.command_name = 'impediment') AS impediment_commands,
    COUNT(*) FILTER (WHERE tie.command_name = 'risk') AS risk_commands,
    COUNT(*) FILTER (WHERE tie.response_type = 'error') AS error_count,
    COUNT(*) FILTER (WHERE tie.response_type = 'permission_denied') AS permission_denied_count,
    MAX(tie.created_at) AS last_interaction_at,
    AVG(tie.processing_time_ms)::NUMERIC(10,2) AS avg_processing_time_ms
FROM public.teams_integrations ti
JOIN public.organizations o ON o.id = ti.organization_id
LEFT JOIN public.teams_interaction_events tie ON tie.integration_id = ti.id
WHERE ti.organization_id IN (
    SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
)
GROUP BY ti.organization_id, o.name, ti.id, ti.name, ti.is_active, ti.installed_at
ORDER BY total_interactions DESC;

COMMENT ON VIEW public.v_teams_adoption_report IS 'Relatório de adoção e uso da integração Teams por organização';

-- 11. View para saúde das notificações Teams
CREATE OR REPLACE VIEW public.v_teams_notification_health AS
SELECT
    ti.organization_id,
    o.name AS organization_name,
    ti.id AS integration_id,
    DATE(tns.created_at) AS notification_date,
    tns.event_type,
    COUNT(*) AS total_sent,
    COUNT(*) FILTER (WHERE tns.status = 'sent') AS success_count,
    COUNT(*) FILTER (WHERE tns.status = 'failed') AS failed_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE tns.status = 'sent') / NULLIF(COUNT(*), 0), 2) AS success_rate_pct,
    AVG(CASE WHEN tns.status = 'sent' THEN EXTRACT(EPOCH FROM (tns.sent_at - tns.created_at)) * 1000 END)::NUMERIC(10,2) AS avg_latency_ms
FROM public.teams_notifications_sent tns
JOIN public.teams_integrations ti ON ti.id = tns.integration_id
JOIN public.organizations o ON o.id = ti.organization_id
WHERE ti.organization_id IN (
    SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
)
  AND tns.created_at >= now() - INTERVAL '30 days'
GROUP BY ti.organization_id, o.name, ti.id, DATE(tns.created_at), tns.event_type
ORDER BY ti.organization_id, notification_date DESC, total_sent DESC;

COMMENT ON VIEW public.v_teams_notification_health IS 'Saúde das notificações Teams (taxa de sucesso, latência) por evento';