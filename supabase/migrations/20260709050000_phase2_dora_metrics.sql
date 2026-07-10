-- Phase 2: Métricas DORA e Eventos de Deploy/Incidente
-- Cria tabelas para Deployment Frequency, Lead Time, Change Failure Rate, Time to Restore

-- 1. Eventos de Deploy em Produção (fonte para DORA)
CREATE TABLE IF NOT EXISTS public.deployment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    -- Identificação do deploy
    deployment_id TEXT NOT NULL, -- ID único do deploy (ex: pipeline ID, release tag, etc.)
    source TEXT NOT NULL CHECK (source IN ('gitlab', 'github', 'jenkins', 'github_actions', 'circleci', 'argo_cd', 'flux', 'manual', 'api')),
    environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'staging', 'development', 'testing')),
    -- Commit e mudança
    commit_sha TEXT NOT NULL,
    commit_message TEXT,
    commit_author_email TEXT,
    commit_author_name TEXT,
    committed_at TIMESTAMPTZ,
    -- Branches/refs
    branch_name TEXT,
    tag_name TEXT,
    -- Timestamps
    deployed_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    -- Status e métricas
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial', 'rolled_back', 'cancelled')),
    duration_seconds INTEGER,
    -- Para Lead Time: primeiro commit da mudança
    first_commit_sha TEXT,
    first_commit_at TIMESTAMPTZ,
    -- Para Change Failure Rate
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    rollback_deployment_id TEXT,
    -- Metadata
    pipeline_id TEXT,
    pipeline_url TEXT,
    changelog TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    correlation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, source, deployment_id)
);

COMMENT ON TABLE public.deployment_events IS 'Eventos de deploy em produção (e outros ambientes) para cálculo de Métricas DORA';

CREATE INDEX IF NOT EXISTS idx_deployment_events_org_env_time ON public.deployment_events (organization_id, environment, deployed_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_events_project_time ON public.deployment_events (project_id, deployed_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_events_team_time ON public.deployment_events (team_id, deployed_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_events_commit ON public.deployment_events (commit_sha);
CREATE INDEX IF NOT EXISTS idx_deployment_events_status ON public.deployment_events (status, deployed_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_events_correlation ON public.deployment_events (correlation_id);

-- 2. Eventos de Incidente em Produção (para Change Failure Rate e MTTR)
CREATE TABLE IF NOT EXISTS public.incident_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    -- Identificação do incidente
    incident_id TEXT NOT NULL, -- ID no sistema de monitoramento (Datadog, PagerDuty, etc.)
    source TEXT NOT NULL CHECK (source IN ('datadog', 'newrelic', 'sentry', 'grafana', 'pagerduty', 'opsgenie', 'jira', 'zendesk', 'manual', 'api')),
    -- Classificação
    severity TEXT NOT NULL CHECK (severity IN ('sev1', 'sev2', 'sev3', 'sev4', 'critical', 'high', 'medium', 'low')),
    title TEXT NOT NULL,
    description TEXT,
    -- Relacionamento com deploy (para Change Failure Rate)
    related_deployment_id UUID REFERENCES public.deployment_events(id) ON DELETE SET NULL,
    related_commit_sha TEXT,
    -- Timeline
    started_at TIMESTAMPTZ NOT NULL,
    detected_at TIMESTAMPTZ, -- Quando foi detectado (pode ser diferente de started_at)
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    -- Métricas DORA
    time_to_detect_seconds INTEGER GENERATED ALWAYS AS (
        CASE WHEN detected_at IS NOT NULL THEN EXTRACT(EPOCH FROM (detected_at - started_at))::INTEGER END
    ) STORED,
    time_to_acknowledge_seconds INTEGER GENERATED ALWAYS AS (
        CASE WHEN acknowledged_at IS NOT NULL THEN EXTRACT(EPOCH FROM (acknowledged_at - started_at))::INTEGER END
    ) STORED,
    time_to_resolve_seconds INTEGER GENERATED ALWAYS AS (
        CASE WHEN resolved_at IS NOT NULL THEN EXTRACT(EPOCH FROM (resolved_at - started_at))::INTEGER END
    ) STORED,
    -- Status
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'investigating', 'resolved', 'closed')),
    -- Root cause e ação
    root_cause TEXT,
    resolution TEXT,
    action_items TEXT[],
    -- Metadata
    affected_services TEXT[],
    tags TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    correlation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, source, incident_id)
);

COMMENT ON TABLE public.incident_events IS 'Eventos de incidente em produção para cálculo de Change Failure Rate e Time to Restore Service';

CREATE INDEX IF NOT EXISTS idx_incident_events_org_time ON public.incident_events (organization_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_events_project_time ON public.incident_events (project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_events_deployment ON public.incident_events (related_deployment_id);
CREATE INDEX IF NOT EXISTS idx_incident_events_status ON public.incident_events (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_events_severity ON public.incident_events (severity, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_events_correlation ON public.incident_events (correlation_id);

-- 3. Snapshots das Métricas DORA (calculados periodicamente)
CREATE TABLE IF NOT EXISTS public.dora_metrics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    -- Período do snapshot
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    granularity TEXT NOT NULL CHECK (granularity IN ('daily', 'weekly', 'monthly')),
    -- Métricas DORA
    deployment_frequency NUMERIC(10,2), -- Deploys por dia/semana/mês
    lead_time_for_changes_seconds NUMERIC(10,2), -- Tempo médio do primeiro commit ao deploy
    lead_time_for_changes_median_seconds NUMERIC(10,2),
    lead_time_for_changes_p95_seconds NUMERIC(10,2),
    change_failure_rate NUMERIC(5,2), -- Percentual (0-100)
    time_to_restore_service_seconds NUMERIC(10,2), -- MTTR médio
    time_to_restore_service_median_seconds NUMERIC(10,2),
    time_to_restore_service_p95_seconds NUMERIC(10,2),
    -- Contadores brutos
    total_deployments INTEGER DEFAULT 0,
    successful_deployments INTEGER DEFAULT 0,
    failed_deployments INTEGER DEFAULT 0,
    rolled_back_deployments INTEGER DEFAULT 0,
    total_incidents INTEGER DEFAULT 0,
    resolved_incidents INTEGER DEFAULT 0,
    -- Distribuição de severidade
    incidents_sev1 INTEGER DEFAULT 0,
    incidents_sev2 INTEGER DEFAULT 0,
    incidents_sev3 INTEGER DEFAULT 0,
    incidents_sev4 INTEGER DEFAULT 0,
    -- Benchmarks (opcional)
    deployment_frequency_benchmark NUMERIC(10,2),
    lead_time_benchmark_seconds NUMERIC(10,2),
    change_failure_rate_benchmark NUMERIC(5,2),
    mttr_benchmark_seconds NUMERIC(10,2),
    -- Classificação DORA (Low, Medium, High, Elite)
    dora_classification TEXT CHECK (dora_classification IN ('low', 'medium', 'high', 'elite')),
    -- Metadata
    calculation_metadata JSONB DEFAULT '{}'::jsonb,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, project_id, team_id, period_start, period_end, granularity)
);

COMMENT ON TABLE public.dora_metrics_snapshots IS 'Snapshots calculados das 4 Métricas DORA por organização/projeto/time/período';

CREATE INDEX IF NOT EXISTS idx_dora_snapshots_org_period ON public.dora_metrics_snapshots (organization_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_dora_snapshots_project_period ON public.dora_metrics_snapshots (project_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_dora_snapshots_team_period ON public.dora_metrics_snapshots (team_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_dora_snapshots_granularity ON public.dora_metrics_snapshots (granularity, period_start DESC);

-- 4. Configuração de métricas DORA por projeto
CREATE TABLE IF NOT EXISTS public.dora_metrics_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    -- Configuração de o que conta como deploy em produção
    production_environments TEXT[] DEFAULT ARRAY['production', 'prod'],
    production_sources TEXT[] DEFAULT ARRAY['gitlab', 'github', 'jenkins', 'github_actions', 'circleci', 'argo_cd', 'flux'],
    -- Configuração de o que conta como falha
    failure_sources TEXT[] DEFAULT ARRAY['datadog', 'newrelic', 'sentry', 'grafana', 'pagerduty', 'opsgenie', 'jira', 'zendesk'],
    failure_severities TEXT[] DEFAULT ARRAY['sev1', 'sev2', 'critical', 'high'],
    -- Janela para associar incidente a deploy (horas)
    incident_attribution_window_hours INTEGER DEFAULT 24,
    -- Configuração de cálculo
    lead_time_percentiles INTEGER[] DEFAULT ARRAY[50, 95],
    mttr_percentiles INTEGER[] DEFAULT ARRAY[50, 95],
    -- Agendamento
    calculation_schedule TEXT DEFAULT '0 2 * * *', -- Cron: todo dia às 2h
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, project_id, team_id)
);

COMMENT ON TABLE public.dora_metrics_config IS 'Configuração de como calcular Métricas DORA por projeto/time';

-- 5. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_incident_events_updated_at ON public.incident_events;
CREATE TRIGGER update_incident_events_updated_at
    BEFORE UPDATE ON public.incident_events
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_dora_metrics_config_updated_at ON public.dora_metrics_config;
CREATE TRIGGER update_dora_metrics_config_updated_at
    BEFORE UPDATE ON public.dora_metrics_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. RLS Policies
ALTER TABLE public.deployment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dora_metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dora_metrics_config ENABLE ROW LEVEL SECURITY;

-- Deployment Events: org members can read, service can write
CREATE POLICY "deployment_events_select_org_member" ON public.deployment_events
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "deployment_events_manage_service" ON public.deployment_events
    FOR ALL USING (true);

-- Incident Events: org members can read, service can write
CREATE POLICY "incident_events_select_org_member" ON public.incident_events
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "incident_events_manage_service" ON public.incident_events
    FOR ALL USING (true);

-- DORA Snapshots: org members can read, service can write
CREATE POLICY "dora_snapshots_select_org_member" ON public.dora_metrics_snapshots
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "dora_snapshots_manage_service" ON public.dora_metrics_snapshots
    FOR ALL USING (true);

-- DORA Config: org admins manage
CREATE POLICY "dora_config_select_org_member" ON public.dora_metrics_config
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "dora_config_manage_org_admin" ON public.dora_metrics_config
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

-- 7. RPC para registrar evento de deploy
CREATE OR REPLACE FUNCTION public.log_deployment_event(
    p_organization_id UUID,
    p_deployment_id TEXT,
    p_source TEXT,
    p_commit_sha TEXT,
    p_deployed_at TIMESTAMPTZ,
    p_status TEXT,
    p_project_id UUID DEFAULT NULL,
    p_team_id UUID DEFAULT NULL,
    p_environment TEXT DEFAULT 'production',
    p_commit_message TEXT DEFAULT NULL,
    p_commit_author_email TEXT DEFAULT NULL,
    p_commit_author_name TEXT DEFAULT NULL,
    p_committed_at TIMESTAMPTZ DEFAULT NULL,
    p_branch_name TEXT DEFAULT NULL,
    p_tag_name TEXT DEFAULT NULL,
    p_finished_at TIMESTAMPTZ DEFAULT NULL,
    p_duration_seconds INTEGER DEFAULT NULL,
    p_first_commit_sha TEXT DEFAULT NULL,
    p_first_commit_at TIMESTAMPTZ DEFAULT NULL,
    p_failed_at TIMESTAMPTZ DEFAULT NULL,
    p_failure_reason TEXT DEFAULT NULL,
    p_rollback_deployment_id TEXT DEFAULT NULL,
    p_pipeline_id TEXT DEFAULT NULL,
    p_pipeline_url TEXT DEFAULT NULL,
    p_changelog TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
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
    INSERT INTO public.deployment_events (
        organization_id, project_id, team_id,
        deployment_id, source, environment,
        commit_sha, commit_message, commit_author_email, commit_author_name, committed_at,
        branch_name, tag_name,
        deployed_at, finished_at,
        status, duration_seconds,
        first_commit_sha, first_commit_at,
        failed_at, failure_reason, rollback_deployment_id,
        pipeline_id, pipeline_url, changelog, metadata, correlation_id
    ) VALUES (
        p_organization_id, p_project_id, p_team_id,
        p_deployment_id, p_source, p_environment,
        p_commit_sha, p_commit_message, p_commit_author_email, p_commit_author_name, p_committed_at,
        p_branch_name, p_tag_name,
        p_deployed_at, p_finished_at,
        p_status, p_duration_seconds,
        p_first_commit_sha, p_first_commit_at,
        p_failed_at, p_failure_reason, p_rollback_deployment_id,
        p_pipeline_id, p_pipeline_url, p_changelog, p_metadata, p_correlation_id
    ) ON CONFLICT (organization_id, source, deployment_id) DO UPDATE SET
        status = EXCLUDED.status,
        finished_at = EXCLUDED.finished_at,
        duration_seconds = EXCLUDED.duration_seconds,
        failed_at = EXCLUDED.failed_at,
        failure_reason = EXCLUDED.failure_reason,
        rollback_deployment_id = EXCLUDED.rollback_deployment_id,
        metadata = EXCLUDED.metadata,
        updated_at = now()
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_deployment_event(
    UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID
) TO authenticated;

-- 8. RPC para registrar evento de incidente
CREATE OR REPLACE FUNCTION public.log_incident_event(
    p_organization_id UUID,
    p_incident_id TEXT,
    p_source TEXT,
    p_severity TEXT,
    p_title TEXT,
    p_started_at TIMESTAMPTZ,
    p_project_id UUID DEFAULT NULL,
    p_team_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_related_deployment_id UUID DEFAULT NULL,
    p_related_commit_sha TEXT DEFAULT NULL,
    p_detected_at TIMESTAMPTZ DEFAULT NULL,
    p_acknowledged_at TIMESTAMPTZ DEFAULT NULL,
    p_resolved_at TIMESTAMPTZ DEFAULT NULL,
    p_closed_at TIMESTAMPTZ DEFAULT NULL,
    p_status TEXT DEFAULT 'open',
    p_root_cause TEXT DEFAULT NULL,
    p_resolution TEXT DEFAULT NULL,
    p_action_items TEXT[] DEFAULT '{}',
    p_affected_services TEXT[] DEFAULT '{}',
    p_tags TEXT[] DEFAULT '{}',
    p_metadata JSONB DEFAULT '{}'::jsonb,
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
    INSERT INTO public.incident_events (
        organization_id, project_id, team_id,
        incident_id, source, severity, title, description,
        related_deployment_id, related_commit_sha,
        started_at, detected_at, acknowledged_at, resolved_at, closed_at,
        status, root_cause, resolution, action_items,
        affected_services, tags, metadata, correlation_id
    ) VALUES (
        p_organization_id, p_project_id, p_team_id,
        p_incident_id, p_source, p_severity, p_title, p_description,
        p_related_deployment_id, p_related_commit_sha,
        p_started_at, p_detected_at, p_acknowledged_at, p_resolved_at, p_closed_at,
        p_status, p_root_cause, p_resolution, p_action_items,
        p_affected_services, p_tags, p_metadata, p_correlation_id
    ) ON CONFLICT (organization_id, source, incident_id) DO UPDATE SET
        severity = EXCLUDED.severity,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        detected_at = EXCLUDED.detected_at,
        acknowledged_at = EXCLUDED.acknowledged_at,
        resolved_at = EXCLUDED.resolved_at,
        closed_at = EXCLUDED.closed_at,
        status = EXCLUDED.status,
        root_cause = EXCLUDED.root_cause,
        resolution = EXCLUDED.resolution,
        action_items = EXCLUDED.action_items,
        affected_services = EXCLUDED.affected_services,
        tags = EXCLUDED.tags,
        metadata = EXCLUDED.metadata,
        updated_at = now()
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_incident_event(
    UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID, UUID, TEXT, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT[], JSONB, UUID
) TO authenticated;

-- 9. Engine de cálculo das Métricas DORA
CREATE OR REPLACE FUNCTION public.calculate_dora_metrics(
    p_organization_id UUID,
    p_project_id UUID DEFAULT NULL,
    p_team_id UUID DEFAULT NULL,
    p_period_start TIMESTAMPTZ DEFAULT NULL,
    p_period_end TIMESTAMPTZ DEFAULT NULL,
    p_granularity TEXT DEFAULT 'daily'
)
RETURNS public.dora_metrics_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_config public.dora_metrics_config;
    v_snapshot public.dora_metrics_snapshots;
    v_deployments RECORD;
    v_incidents RECORD;
    v_lead_times NUMERIC[];
    v_mttr_times NUMERIC[];
    v_dora_classification TEXT;
BEGIN
    -- Buscar configuração
    SELECT * INTO v_config
    FROM public.dora_metrics_config
    WHERE organization_id = p_organization_id
      AND (project_id IS NOT DISTINCT FROM p_project_id)
      AND (team_id IS NOT DISTINCT FROM p_team_id)
      AND is_active = true
    LIMIT 1;

    IF v_config IS NULL THEN
        -- Config padrão
        v_config := ROW(
            gen_random_uuid(), p_organization_id, p_project_id, p_team_id,
            ARRAY['production', 'prod'],
            ARRAY['gitlab', 'github', 'jenkins', 'github_actions', 'circleci', 'argo_cd', 'flux'],
            ARRAY['datadog', 'newrelic', 'sentry', 'grafana', 'pagerduty', 'opsgenie', 'jira', 'zendesk'],
            ARRAY['sev1', 'sev2', 'critical', 'high'],
            24,
            ARRAY[50, 95],
            ARRAY[50, 95],
            '0 2 * * *',
            true,
            now(), now()
        )::public.dora_metrics_config;
    END IF;

    -- 1. Deployment Frequency: deploys em produção por período
    SELECT
        COUNT(*)::NUMERIC,
        COUNT(*) FILTER (WHERE status = 'success')::NUMERIC,
        COUNT(*) FILTER (WHERE status = 'failed')::NUMERIC,
        COUNT(*) FILTER (WHERE status = 'rolled_back')::NUMERIC
    INTO
        v_snapshot.total_deployments,
        v_snapshot.successful_deployments,
        v_snapshot.failed_deployments,
        v_snapshot.rolled_back_deployments
    FROM public.deployment_events
    WHERE organization_id = p_organization_id
      AND (p_project_id IS NULL OR project_id = p_project_id)
      AND (p_team_id IS NULL OR team_id = p_team_id)
      AND environment = ANY(v_config.production_environments)
      AND source = ANY(v_config.production_sources)
      AND deployed_at >= p_period_start
      AND deployed_at < p_period_end;

    -- Calcular frequência por dia
    DECLARE
        v_days NUMERIC := EXTRACT(EPOCH FROM (p_period_end - p_period_start)) / 86400;
    BEGIN
        IF v_days > 0 THEN
            v_snapshot.deployment_frequency := v_snapshot.total_deployments / v_days;
        END IF;
    END;

    -- 2. Lead Time for Changes: tempo do primeiro commit ao deploy (apenas sucessos)
    SELECT ARRAY_AGG(EXTRACT(EPOCH FROM (deployed_at - first_commit_at)))
    INTO v_lead_times
    FROM public.deployment_events
    WHERE organization_id = p_organization_id
      AND (p_project_id IS NULL OR project_id = p_project_id)
      AND (p_team_id IS NULL OR team_id = p_team_id)
      AND environment = ANY(v_config.production_environments)
      AND source = ANY(v_config.production_sources)
      AND status = 'success'
      AND first_commit_at IS NOT NULL
      AND deployed_at >= p_period_start
      AND deployed_at < p_period_end;

    IF v_lead_times IS NOT NULL AND array_length(v_lead_times, 1) > 0 THEN
        -- Média
        SELECT AVG(val)::NUMERIC(10,2) INTO v_snapshot.lead_time_for_changes_seconds
        FROM unnest(v_lead_times) AS val;

        -- Percentis
        FOR i IN 1..array_length(v_config.lead_time_percentiles, 1) LOOP
            DECLARE
                v_pct NUMERIC := v_config.lead_time_percentiles[i];
                v_percentile_val NUMERIC;
            BEGIN
                SELECT percentile_cont(v_pct / 100.0) WITHIN GROUP (ORDER BY val)::NUMERIC(10,2)
                INTO v_percentile_val
                FROM unnest(v_lead_times) AS val;

                IF v_pct = 50 THEN
                    v_snapshot.lead_time_for_changes_median_seconds := v_percentile_val;
                ELSIF v_pct = 95 THEN
                    v_snapshot.lead_time_for_changes_p95_seconds := v_percentile_val;
                END IF;
            END;
        END LOOP;
    END IF;

    -- 3. Change Failure Rate: % de deploys que resultaram em incidente
    -- Contar deploys com incidente associado na janela de atribuição
    DECLARE
        v_failed_deployments INTEGER := 0;
    BEGIN
        SELECT COUNT(DISTINCT de.id) INTO v_failed_deployments
        FROM public.deployment_events de
        LEFT JOIN public.incident_events ie
            ON ie.organization_id = de.organization_id
            AND ie.source = ANY(v_config.failure_sources)
            AND ie.severity = ANY(v_config.failure_severities)
            AND ie.started_at >= de.deployed_at
            AND ie.started_at < de.deployed_at + (v_config.incident_attribution_window_hours || ' hours')::INTERVAL
            AND (ie.related_deployment_id = de.id OR ie.related_commit_sha = de.commit_sha)
        WHERE de.organization_id = p_organization_id
          AND (p_project_id IS NULL OR de.project_id = p_project_id)
          AND (p_team_id IS NULL OR de.team_id = p_team_id)
          AND de.environment = ANY(v_config.production_environments)
          AND de.source = ANY(v_config.production_sources)
          AND de.deployed_at >= p_period_start
          AND de.deployed_at < p_period_end;

        IF v_snapshot.total_deployments > 0 THEN
            v_snapshot.change_failure_rate := ROUND((v_failed_deployments::NUMERIC / v_snapshot.total_deployments) * 100, 2);
        END IF;
    END;

    -- 4. Time to Restore Service (MTTR): tempo para resolver incidentes
    SELECT ARRAY_AGG(EXTRACT(EPOCH FROM (resolved_at - started_at)))
    INTO v_mttr_times
    FROM public.incident_events
    WHERE organization_id = p_organization_id
      AND (p_project_id IS NULL OR project_id = p_project_id)
      AND (p_team_id IS NULL OR team_id = p_team_id)
      AND source = ANY(v_config.failure_sources)
      AND severity = ANY(v_config.failure_severities)
      AND status IN ('resolved', 'closed')
      AND resolved_at IS NOT NULL
      AND started_at >= p_period_start
      AND started_at < p_period_end;

    IF v_mttr_times IS NOT NULL AND array_length(v_mttr_times, 1) > 0 THEN
        SELECT AVG(val)::NUMERIC(10,2) INTO v_snapshot.time_to_restore_service_seconds
        FROM unnest(v_mttr_times) AS val;

        FOR i IN 1..array_length(v_config.mttr_percentiles, 1) LOOP
            DECLARE
                v_pct NUMERIC := v_config.mttr_percentiles[i];
                v_percentile_val NUMERIC;
            BEGIN
                SELECT percentile_cont(v_pct / 100.0) WITHIN GROUP (ORDER BY val)::NUMERIC(10,2)
                INTO v_percentile_val
                FROM unnest(v_mttr_times) AS val;

                IF v_pct = 50 THEN
                    v_snapshot.time_to_restore_service_median_seconds := v_percentile_val;
                ELSIF v_pct = 95 THEN
                    v_snapshot.time_to_restore_service_p95_seconds := v_percentile_val;
                END IF;
            END;
        END LOOP;
    END IF;

    -- Contadores de incidentes
    SELECT
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE status IN ('resolved', 'closed'))::INTEGER,
        COUNT(*) FILTER (WHERE severity = 'sev1')::INTEGER,
        COUNT(*) FILTER (WHERE severity = 'sev2')::INTEGER,
        COUNT(*) FILTER (WHERE severity = 'sev3')::INTEGER,
        COUNT(*) FILTER (WHERE severity = 'sev4')::INTEGER
    INTO
        v_snapshot.total_incidents,
        v_snapshot.resolved_incidents,
        v_snapshot.incidents_sev1,
        v_snapshot.incidents_sev2,
        v_snapshot.incidents_sev3,
        v_snapshot.incidents_sev4
    FROM public.incident_events
    WHERE organization_id = p_organization_id
      AND (p_project_id IS NULL OR project_id = p_project_id)
      AND (p_team_id IS NULL OR team_id = p_team_id)
      AND source = ANY(v_config.failure_sources)
      AND started_at >= p_period_start
      AND started_at < p_period_end;

    -- Classificação DORA baseada nos benchmarks da pesquisa
    -- Elite: DF on-demand, LT < 1h, CFR < 15%, MTTR < 1h
    -- High: DF daily, LT < 1week, CFR 16-30%, MTTR < 1day
    -- Medium: DF weekly, LT < 1month, CFR 31-45%, MTTR < 1week
    -- Low: DF monthly, LT > 1month, CFR > 45%, MTTR > 1week
    IF v_snapshot.deployment_frequency >= 1
        AND v_snapshot.lead_time_for_changes_seconds < 3600
        AND v_snapshot.change_failure_rate < 15
        AND v_snapshot.time_to_restore_service_seconds < 3600 THEN
        v_dora_classification := 'elite';
    ELSIF v_snapshot.deployment_frequency >= 1/7.0
        AND v_snapshot.lead_time_for_changes_seconds < 604800
        AND v_snapshot.change_failure_rate < 30
        AND v_snapshot.time_to_restore_service_seconds < 86400 THEN
        v_dora_classification := 'high';
    ELSIF v_snapshot.deployment_frequency >= 1/30.0
        AND v_snapshot.lead_time_for_changes_seconds < 2592000
        AND v_snapshot.change_failure_rate < 45
        AND v_snapshot.time_to_restore_service_seconds < 604800 THEN
        v_dora_classification := 'medium';
    ELSE
        v_dora_classification := 'low';
    END IF;
    v_snapshot.dora_classification := v_dora_classification;

    -- Inserir/atualizar snapshot
    INSERT INTO public.dora_metrics_snapshots (
        organization_id, project_id, team_id,
        period_start, period_end, granularity,
        deployment_frequency, lead_time_for_changes_seconds,
        lead_time_for_changes_median_seconds, lead_time_for_changes_p95_seconds,
        change_failure_rate, time_to_restore_service_seconds,
        time_to_restore_service_median_seconds, time_to_restore_service_p95_seconds,
        total_deployments, successful_deployments, failed_deployments, rolled_back_deployments,
        total_incidents, resolved_incidents,
        incidents_sev1, incidents_sev2, incidents_sev3, incidents_sev4,
        dora_classification, calculation_metadata
    ) VALUES (
        p_organization_id, p_project_id, p_team_id,
        p_period_start, p_period_end, p_granularity,
        v_snapshot.deployment_frequency, v_snapshot.lead_time_for_changes_seconds,
        v_snapshot.lead_time_for_changes_median_seconds, v_snapshot.lead_time_for_changes_p95_seconds,
        v_snapshot.change_failure_rate, v_snapshot.time_to_restore_service_seconds,
        v_snapshot.time_to_restore_service_median_seconds, v_snapshot.time_to_restore_service_p95_seconds,
        v_snapshot.total_deployments, v_snapshot.successful_deployments, v_snapshot.failed_deployments, v_snapshot.rolled_back_deployments,
        v_snapshot.total_incidents, v_snapshot.resolved_incidents,
        v_snapshot.incidents_sev1, v_snapshot.incidents_sev2, v_snapshot.incidents_sev3, v_snapshot.incidents_sev4,
        v_dora_classification, jsonb_build_object(
            'lead_time_samples', array_length(v_lead_times, 1),
            'mttr_samples', array_length(v_mttr_times, 1),
            'config', jsonb_build_object(
                'production_environments', v_config.production_environments,
                'incident_attribution_window_hours', v_config.incident_attribution_window_hours
            )
        )
    ) ON CONFLICT (organization_id, project_id, team_id, period_start, period_end, granularity) DO UPDATE SET
        deployment_frequency = EXCLUDED.deployment_frequency,
        lead_time_for_changes_seconds = EXCLUDED.lead_time_for_changes_seconds,
        lead_time_for_changes_median_seconds = EXCLUDED.lead_time_for_changes_median_seconds,
        lead_time_for_changes_p95_seconds = EXCLUDED.lead_time_for_changes_p95_seconds,
        change_failure_rate = EXCLUDED.change_failure_rate,
        time_to_restore_service_seconds = EXCLUDED.time_to_restore_service_seconds,
        time_to_restore_service_median_seconds = EXCLUDED.time_to_restore_service_median_seconds,
        time_to_restore_service_p95_seconds = EXCLUDED.time_to_restore_service_p95_seconds,
        total_deployments = EXCLUDED.total_deployments,
        successful_deployments = EXCLUDED.successful_deployments,
        failed_deployments = EXCLUDED.failed_deployments,
        rolled_back_deployments = EXCLUDED.rolled_back_deployments,
        total_incidents = EXCLUDED.total_incidents,
        resolved_incidents = EXCLUDED.resolved_incidents,
        incidents_sev1 = EXCLUDED.incidents_sev1,
        incidents_sev2 = EXCLUDED.incidents_sev2,
        incidents_sev3 = EXCLUDED.incidents_sev3,
        incidents_sev4 = EXCLUDED.incidents_sev4,
        dora_classification = EXCLUDED.dora_classification,
        calculation_metadata = EXCLUDED.calculation_metadata,
        calculated_at = now()
    RETURNING * INTO v_snapshot;

    RETURN v_snapshot;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_dora_metrics(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;

-- 10. View para dashboard DORA
CREATE OR REPLACE VIEW public.v_dora_dashboard AS
SELECT
    dms.organization_id,
    o.name AS organization_name,
    dms.project_id,
    p.name AS project_name,
    dms.team_id,
    t.name AS team_name,
    dms.period_start,
    dms.period_end,
    dms.granularity,
    dms.deployment_frequency,
    dms.lead_time_for_changes_seconds,
    dms.lead_time_for_changes_median_seconds,
    dms.lead_time_for_changes_p95_seconds,
    dms.change_failure_rate,
    dms.time_to_restore_service_seconds,
    dms.time_to_restore_service_median_seconds,
    dms.time_to_restore_service_p95_seconds,
    dms.dora_classification,
    dms.total_deployments,
    dms.successful_deployments,
    dms.failed_deployments,
    dms.total_incidents,
    dms.resolved_incidents,
    dms.calculated_at,
    -- Formatação legível
    CASE
        WHEN dms.lead_time_for_changes_seconds < 3600 THEN ROUND(dms.lead_time_for_changes_seconds / 60, 1) || ' min'
        WHEN dms.lead_time_for_changes_seconds < 86400 THEN ROUND(dms.lead_time_for_changes_seconds / 3600, 1) || ' h'
        ELSE ROUND(dms.lead_time_for_changes_seconds / 86400, 1) || ' d'
    END AS lead_time_display,
    CASE
        WHEN dms.time_to_restore_service_seconds < 3600 THEN ROUND(dms.time_to_restore_service_seconds / 60, 1) || ' min'
        WHEN dms.time_to_restore_service_seconds < 86400 THEN ROUND(dms.time_to_restore_service_seconds / 3600, 1) || ' h'
        ELSE ROUND(dms.time_to_restore_service_seconds / 86400, 1) || ' d'
    END AS mttr_display,
    dms.deployment_frequency || ' deploys/dia' AS frequency_display,
    ROUND(dms.change_failure_rate, 1) || '%' AS cfr_display
FROM public.dora_metrics_snapshots dms
JOIN public.organizations o ON o.id = dms.organization_id
LEFT JOIN public.projects p ON p.id = dms.project_id
LEFT JOIN public.teams t ON t.id = dms.team_id
WHERE dms.organization_id IN (
    SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
)
ORDER BY dms.period_start DESC;

COMMENT ON VIEW public.v_dora_dashboard IS 'Dashboard consolidado das Métricas DORA com formatação legível';