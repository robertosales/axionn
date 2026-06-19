-- ============================================================
-- Migration: Módulo de Análise de Ponto de Função (APF/IFPUG)
-- ============================================================

-- ============================================================
-- PARTE 1: Tabela de Baseline do Projeto
-- ============================================================

CREATE TABLE IF NOT EXISTS project_fp_baselines (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  domain_context          TEXT NOT NULL DEFAULT '',
  technology_stack        TEXT[] NOT NULL DEFAULT '{}',
  complexity_rules        JSONB NOT NULL DEFAULT '{}',
  function_type_criteria  JSONB NOT NULL DEFAULT '{}',
  anchor_examples         JSONB NOT NULL DEFAULT '[]',
  additional_instructions TEXT NOT NULL DEFAULT '',
  version                 INTEGER NOT NULL DEFAULT 1,
  status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by              UUID REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fp_baseline_one_active
  ON project_fp_baselines(project_id)
  WHERE status = 'active';

-- ============================================================
-- PARTE 2: Tabela de Análises (histórico + aprendizado)
-- ============================================================

CREATE TABLE IF NOT EXISTS function_point_analyses (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sprint_id              UUID REFERENCES sprints(id) ON DELETE SET NULL,
  story_id               UUID REFERENCES user_stories(id) ON DELETE SET NULL,
  baseline_id            UUID REFERENCES project_fp_baselines(id) ON DELETE SET NULL,
  baseline_version       INTEGER,
  story_text             TEXT NOT NULL,
  story_context          JSONB DEFAULT '{}',
  -- Resultado do agente IA
  ai_raw_count           NUMERIC(6,2),
  ai_breakdown           JSONB DEFAULT '{}',   -- EI, EO, EQ, ILF, EIF detalhado
  ai_confidence          NUMERIC(3,2) CHECK (ai_confidence BETWEEN 0 AND 1),
  ai_reasoning           TEXT,
  model_used             TEXT,
  few_shot_examples_used INTEGER DEFAULT 0,
  -- Validação humana (base do aprendizado incremental)
  validated_count        NUMERIC(6,2),
  validation_notes       TEXT,
  validated_by           UUID REFERENCES auth.users(id),
  validated_at           TIMESTAMPTZ,
  is_validated           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fpa_project_validated
  ON function_point_analyses(project_id, is_validated)
  WHERE is_validated = TRUE;

-- ============================================================
-- PARTE 3: RLS usando has_role() (padrão do projeto)
-- ============================================================

ALTER TABLE project_fp_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE function_point_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados veem baselines"
  ON project_fp_baselines FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin gerencia baselines"
  ON project_fp_baselines FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Autenticados veem analyses"
  ON function_point_analyses FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Autenticados inserem analyses"
  ON function_point_analyses FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados atualizam analyses"
  ON function_point_analyses FOR UPDATE
  TO authenticated USING (true);

-- ============================================================
-- PARTE 4: Trigger updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_fp_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fp_baselines_updated_at
  BEFORE UPDATE ON project_fp_baselines
  FOR EACH ROW EXECUTE FUNCTION update_fp_updated_at();
