-- ============================================================
-- Módulo de Análise de Ponto de Função (APF/IFPUG)
-- Evolui a tabela criada em 20260619000001 sem assumir banco vazio.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_fp_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  domain_context text NOT NULL DEFAULT '',
  technology_stack text[] NOT NULL DEFAULT '{}',
  complexity_rules jsonb NOT NULL DEFAULT '{}',
  function_type_criteria jsonb NOT NULL DEFAULT '{}',
  anchor_examples jsonb NOT NULL DEFAULT '[]',
  additional_instructions text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fp_baseline_one_active
  ON public.project_fp_baselines(project_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.function_point_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  story_id uuid REFERENCES public.user_stories(id) ON DELETE SET NULL,
  story_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.function_point_analyses
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sprint_id uuid REFERENCES public.sprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS baseline_id uuid REFERENCES public.project_fp_baselines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS baseline_version integer,
  ADD COLUMN IF NOT EXISTS story_context jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_raw_count numeric(7, 2),
  ADD COLUMN IF NOT EXISTS ai_breakdown jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_confidence numeric(4, 3),
  ADD COLUMN IF NOT EXISTS ai_reasoning text,
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS few_shot_examples_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validated_count numeric(7, 2),
  ADD COLUMN IF NOT EXISTS validation_notes text,
  ADD COLUMN IF NOT EXISTS validated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_validated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_fpa_project_validated
  ON public.function_point_analyses(project_id, is_validated)
  WHERE is_validated = true AND project_id IS NOT NULL;

ALTER TABLE public.project_fp_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.function_point_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos autenticados veem baselines" ON public.project_fp_baselines;
DROP POLICY IF EXISTS "Admin gerencia baselines" ON public.project_fp_baselines;
DROP POLICY IF EXISTS "Autenticados veem analyses" ON public.function_point_analyses;
DROP POLICY IF EXISTS "Autenticados inserem analyses" ON public.function_point_analyses;
DROP POLICY IF EXISTS "Autenticados atualizam analyses" ON public.function_point_analyses;

CREATE POLICY "Todos autenticados veem baselines"
  ON public.project_fp_baselines FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin gerencia baselines"
  ON public.project_fp_baselines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Autenticados veem analyses"
  ON public.function_point_analyses FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Autenticados inserem analyses"
  ON public.function_point_analyses FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Autenticados atualizam analyses"
  ON public.function_point_analyses FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_fp_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fp_baselines_updated_at ON public.project_fp_baselines;
CREATE TRIGGER trg_fp_baselines_updated_at
  BEFORE UPDATE ON public.project_fp_baselines
  FOR EACH ROW EXECUTE FUNCTION public.update_fp_updated_at();
