-- Phase 3: Predição de Risco de Sprint com IA
-- Cria tabelas para eventos de risco, modelo de predição e feedback loop

-- 1. Eventos de predição de risco de Sprint/HU
CREATE TABLE IF NOT EXISTS public.sprint_risk_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    sprint_id UUID REFERENCES public.sprints(id) ON DELETE SET NULL,
    hu_id UUID REFERENCES public.user_stories(id) ON DELETE SET NULL,
    -- Nível de risco calculado
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_score NUMERIC(5,2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100), -- 0-100
    -- Probabilidades
    delay_probability NUMERIC(5,2) CHECK (delay_probability >= 0 AND delay_probability <= 100),
    incomplete_probability NUMERIC(5,2) CHECK (incomplete_probability >= 0 AND incomplete_probability <= 100),
    -- Justificativa da IA
    justification TEXT NOT NULL,
    key_factors JSONB DEFAULT '[]'::jsonb, -- Array de fatores: [{"factor": "high_complexity", "impact": 0.3}, ...]
    -- Features usadas na predição
    features JSONB DEFAULT '{}'::jsonb,
    -- Modelo usado
    model_version TEXT NOT NULL,
    model_type TEXT NOT NULL CHECK (model_type IN ('random_forest', 'gradient_boosting', 'xgboost', 'llm_classifier', 'ensemble')),
    -- Contexto temporal
    sprint_start_date DATE,
    sprint_end_date DATE,
    days_remaining INTEGER,
    -- Status da predição
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'false_positive', 'expired')),
    -- Feedback loop
    actual_outcome TEXT CHECK (actual_outcome IN ('on_time', 'delayed', 'incomplete', 'cancelled')),
    feedback_provided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    feedback_at TIMESTAMPTZ,
    feedback_notes TEXT,
    -- Timestamps
    predicted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sprint_risk_events IS 'Predições de risco de Sprint/HU geradas pelo modelo de IA com feedback loop';

CREATE INDEX IF NOT EXISTS idx_sprint_risk_org_sprint ON public.sprint_risk_events (organization_id, sprint_id, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sprint_risk_org_hu ON public.sprint_risk_events (organization_id, hu_id, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sprint_risk_level ON public.sprint_risk_events (risk_level, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sprint_risk_status ON public.sprint_risk_events (status, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sprint_risk_feedback ON public.sprint_risk_events (actual_outcome, feedback_at) WHERE actual_outcome IS NOT NULL;

-- 2. Configuração do modelo de predição de risco
CREATE TABLE IF NOT EXISTS public.risk_prediction_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    -- Configuração de features
    enabled_features JSONB DEFAULT '{
        "hu_complexity": true,
        "hu_story_points": true,
        "hu_dependencies": true,
        "team_velocity": true,
        "team_capacity": true,
        "git_activity": true,
        "pr_review_time": true,
        "impediment_count": true,
        "impediment_age": true,
        "historical_accuracy": true,
        "assignee_experience": true
    }'::jsonb,
    -- Pesos das features (somam 1.0)
    feature_weights JSONB DEFAULT '{
        "hu_complexity": 0.15,
        "hu_story_points": 0.10,
        "hu_dependencies": 0.10,
        "team_velocity": 0.15,
        "team_capacity": 0.10,
        "git_activity": 0.15,
        "pr_review_time": 0.10,
        "impediment_count": 0.05,
        "impediment_age": 0.05,
        "historical_accuracy": 0.03,
        "assignee_experience": 0.02
    }'::jsonb,
    -- Limiares de risco
    risk_thresholds JSONB DEFAULT '{
        "low_max": 25,
        "medium_max": 50,
        "high_max": 75
    }'::jsonb,
    -- Configuração do modelo
    model_type TEXT DEFAULT 'ensemble' CHECK (model_type IN ('random_forest', 'gradient_boosting', 'xgboost', 'llm_classifier', 'ensemble')),
    model_version TEXT DEFAULT '1.0.0',
    retrain_schedule TEXT DEFAULT '0 3 * * 0', -- Semanal domingo 3h
    min_training_samples INTEGER DEFAULT 50,
    -- Agendamento de predição
    prediction_schedule TEXT DEFAULT '0 */6 * * *', -- A cada 6 horas
    predict_on_events TEXT[] DEFAULT ARRAY['hu_created', 'hu_updated', 'impediment_created', 'pr_opened', 'sprint_started'],
    -- Notificações
    notify_on_high_risk BOOLEAN DEFAULT true,
    notify_on_critical_risk BOOLEAN DEFAULT true,
    notification_channels TEXT[] DEFAULT ARRAY['web', 'teams', 'email'],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, project_id)
);

COMMENT ON TABLE public.risk_prediction_config IS 'Configuração do modelo de predição de risco por organização/projeto';

-- 3. Dados de treinamento do modelo (features históricas + outcome real)
CREATE TABLE IF NOT EXISTS public.risk_training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    sprint_id UUID REFERENCES public.sprints(id) ON DELETE SET NULL,
    hu_id UUID REFERENCES public.user_stories(id) ON DELETE SET NULL,
    -- Features extraídas no momento da predição
    features JSONB NOT NULL,
    -- Outcome real (ground truth)
    actual_outcome TEXT NOT NULL CHECK (actual_outcome IN ('on_time', 'delayed', 'incomplete', 'cancelled')),
    actual_delay_days INTEGER DEFAULT 0,
    -- Metadata
    sprint_start_date DATE,
    sprint_end_date DATE,
    data_collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Usado para treino/validação/teste
    dataset_split TEXT DEFAULT 'training' CHECK (dataset_split IN ('training', 'validation', 'test')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.risk_training_data IS 'Dados históricos para treinamento e validação do modelo de predição de risco';

CREATE INDEX IF NOT EXISTS idx_risk_training_org_split ON public.risk_training_data (organization_id, dataset_split, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_training_sprint ON public.risk_training_data (sprint_id);

-- 4. Versões do modelo treinado
CREATE TABLE IF NOT EXISTS public.risk_model_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    version TEXT NOT NULL,
    model_type TEXT NOT NULL,
    -- Métricas de validação
    accuracy NUMERIC(5,2),
    precision_score NUMERIC(5,2),
    recall_score NUMERIC(5,2),
    f1_score NUMERIC(5,2),
    auc_roc NUMERIC(5,2),
    -- Matriz de confusão
    confusion_matrix JSONB,
    -- Feature importance
    feature_importance JSONB,
    -- Dataset usado
    training_samples INTEGER,
    validation_samples INTEGER,
    test_samples INTEGER,
    training_period_start DATE,
    training_period_end DATE,
    -- Arquivo do modelo (path no storage ou serialized)
    model_artifact_path TEXT,
    model_artifact_size_bytes BIGINT,
    -- Status
    status TEXT DEFAULT 'training' CHECK (status IN ('training', 'validating', 'deployed', 'archived', 'failed')),
    deployed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, project_id, version)
);

COMMENT ON TABLE public.risk_model_versions IS 'Versões treinadas do modelo de predição de risco com métricas';

CREATE INDEX IF NOT EXISTS idx_risk_model_org_status ON public.risk_model_versions (organization_id, status, created_at DESC);

-- 5. Trigger para updated_at
DROP TRIGGER IF EXISTS update_sprint_risk_events_updated_at ON public.sprint_risk_events;
CREATE TRIGGER update_sprint_risk_events_updated_at
    BEFORE UPDATE ON public.sprint_risk_events
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_risk_prediction_config_updated_at ON public.risk_prediction_config;
CREATE TRIGGER update_risk_prediction_config_updated_at
    BEFORE UPDATE ON public.risk_prediction_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. RLS Policies
ALTER TABLE public.sprint_risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_prediction_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_model_versions ENABLE ROW LEVEL SECURITY;

-- Sprint Risk Events: org members can read
CREATE POLICY "sprint_risk_events_select_org_member" ON public.sprint_risk_events
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "sprint_risk_events_manage_service" ON public.sprint_risk_events
    FOR ALL USING (true);

-- Risk Prediction Config: org admins manage
CREATE POLICY "risk_config_select_org_member" ON public.risk_prediction_config
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "risk_config_manage_org_admin" ON public.risk_prediction_config
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

-- Risk Training Data: org admins and service
CREATE POLICY "risk_training_select_org_admin" ON public.risk_training_data
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "risk_training_manage_service" ON public.risk_training_data
    FOR ALL USING (true);

-- Risk Model Versions: org admins
CREATE POLICY "risk_model_select_org_admin" ON public.risk_model_versions
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "risk_model_manage_service" ON public.risk_model_versions
    FOR ALL USING (true);

-- 7. RPC para registrar predição de risco
CREATE OR REPLACE FUNCTION public.log_sprint_risk_prediction(
    p_organization_id UUID,
    p_project_id UUID DEFAULT NULL,
    p_sprint_id UUID DEFAULT NULL,
    p_hu_id UUID DEFAULT NULL,
    p_risk_level TEXT,
    p_risk_score NUMERIC,
    p_delay_probability NUMERIC DEFAULT NULL,
    p_incomplete_probability NUMERIC DEFAULT NULL,
    p_justification TEXT,
    p_key_factors JSONB DEFAULT '[]'::jsonb,
    p_features JSONB DEFAULT '{}'::jsonb,
    p_model_version TEXT,
    p_model_type TEXT,
    p_sprint_start_date DATE DEFAULT NULL,
    p_sprint_end_date DATE DEFAULT NULL,
    p_days_remaining INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO public.sprint_risk_events (
        organization_id, project_id, sprint_id, hu_id,
        risk_level, risk_score, delay_probability, incomplete_probability,
        justification, key_factors, features,
        model_version, model_type,
        sprint_start_date, sprint_end_date, days_remaining
    ) VALUES (
        p_organization_id, p_project_id, p_sprint_id, p_hu_id,
        p_risk_level, p_risk_score, p_delay_probability, p_incomplete_probability,
        p_justification, p_key_factors, p_features,
        p_model_version, p_model_type,
        p_sprint_start_date, p_sprint_end_date, p_days_remaining
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_sprint_risk_prediction(
    UUID, UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC,
    TEXT, JSONB, JSONB, TEXT, TEXT, DATE, DATE, INTEGER
) TO authenticated;

-- 8. RPC para registrar feedback (feedback loop)
CREATE OR REPLACE FUNCTION public.record_risk_feedback(
    p_risk_event_id UUID,
    p_actual_outcome TEXT,
    p_feedback_by UUID DEFAULT NULL,
    p_feedback_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event public.sprint_risk_events;
BEGIN
    SELECT * INTO v_event
    FROM public.sprint_risk_events
    WHERE id = p_risk_event_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Risk event not found: %', p_risk_event_id;
    END IF;

    -- Atualizar evento com feedback
    UPDATE public.sprint_risk_events
    SET actual_outcome = p_actual_outcome,
        feedback_provided_by = COALESCE(p_feedback_by, auth.uid()),
        feedback_at = now(),
        feedback_notes = p_feedback_notes,
        status = CASE
            WHEN p_actual_outcome = 'on_time' AND v_event.risk_level IN ('high', 'critical') THEN 'false_positive'
            WHEN p_actual_outcome IN ('delayed', 'incomplete') AND v_event.risk_level IN ('low', 'medium') THEN 'resolved'
            ELSE 'acknowledged'
        END,
        updated_at = now()
    WHERE id = p_risk_event_id;

    -- Inserir em dados de treinamento para retrain futuro
    INSERT INTO public.risk_training_data (
        organization_id, project_id, sprint_id, hu_id,
        features, actual_outcome, actual_delay_days,
        sprint_start_date, sprint_end_date,
        dataset_split
    ) VALUES (
        v_event.organization_id, v_event.project_id, v_event.sprint_id, v_event.hu_id,
        v_event.features, p_actual_outcome,
        CASE WHEN p_actual_outcome = 'delayed' THEN p_days_remaining ELSE 0 END, -- Placeholder
        v_event.sprint_start_date, v_event.sprint_end_date,
        'training'
    ) ON CONFLICT DO NOTHING; -- Ignorar duplicatas
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_risk_feedback(UUID, TEXT, UUID, TEXT) TO authenticated;

-- 9. RPC para obter predições ativas de uma sprint
CREATE OR REPLACE FUNCTION public.get_sprint_risk_predictions(
    p_organization_id UUID,
    p_sprint_id UUID
)
RETURNS TABLE (
    id UUID,
    hu_id UUID,
    hu_code TEXT,
    hu_title TEXT,
    risk_level TEXT,
    risk_score NUMERIC,
    delay_probability NUMERIC,
    incomplete_probability NUMERIC,
    justification TEXT,
    key_factors JSONB,
    predicted_at TIMESTAMPTZ,
    status TEXT,
    actual_outcome TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sre.id,
        sre.hu_id,
        us.code AS hu_code,
        us.title AS hu_title,
        sre.risk_level,
        sre.risk_score,
        sre.delay_probability,
        sre.incomplete_probability,
        sre.justification,
        sre.key_factors,
        sre.predicted_at,
        sre.status,
        sre.actual_outcome
    FROM public.sprint_risk_events sre
    LEFT JOIN public.user_stories us ON us.id = sre.hu_id
    WHERE sre.organization_id = p_organization_id
      AND sre.sprint_id = p_sprint_id
      AND sre.status IN ('active', 'acknowledged')
    ORDER BY sre.risk_score DESC, sre.predicted_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sprint_risk_predictions(UUID, UUID) TO authenticated;

-- 10. View para dashboard de risco
CREATE OR REPLACE VIEW public.v_sprint_risk_dashboard AS
SELECT
    sre.organization_id,
    o.name AS organization_name,
    sre.project_id,
    p.name AS project_name,
    sre.sprint_id,
    s.name AS sprint_name,
    s.start_date AS sprint_start,
    s.end_date AS sprint_end,
    COUNT(*) FILTER (WHERE sre.risk_level = 'critical') AS critical_count,
    COUNT(*) FILTER (WHERE sre.risk_level = 'high') AS high_count,
    COUNT(*) FILTER (WHERE sre.risk_level = 'medium') AS medium_count,
    COUNT(*) FILTER (WHERE sre.risk_level = 'low') AS low_count,
    AVG(sre.risk_score)::NUMERIC(5,2) AS avg_risk_score,
    MAX(sre.risk_score) AS max_risk_score,
    COUNT(*) FILTER (WHERE sre.status = 'active') AS active_predictions,
    COUNT(*) FILTER (WHERE sre.actual_outcome IS NOT NULL) AS with_feedback,
    COUNT(*) FILTER (WHERE sre.actual_outcome = 'on_time' AND sre.risk_level IN ('high', 'critical')) AS false_positives,
    COUNT(*) FILTER (WHERE sre.actual_outcome IN ('delayed', 'incomplete') AND sre.risk_level IN ('low', 'medium')) AS missed_risks,
    MAX(sre.predicted_at) AS last_prediction_at
FROM public.sprint_risk_events sre
JOIN public.organizations o ON o.id = sre.organization_id
LEFT JOIN public.projects p ON p.id = sre.project_id
LEFT JOIN public.sprints s ON s.id = sre.sprint_id
WHERE sre.organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
)
GROUP BY sre.organization_id, o.name, sre.project_id, p.name, sre.sprint_id, s.name, s.start_date, s.end_date
ORDER BY sre.organization_id, s.end_date DESC;

COMMENT ON VIEW public.v_sprint_risk_dashboard IS 'Dashboard consolidado de predições de risco por sprint';