
ALTER TABLE public.user_stories
  ADD COLUMN IF NOT EXISTS ai_fp_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS ai_fp_confidence numeric,
  ADD COLUMN IF NOT EXISTS ai_fp_validated boolean NOT NULL DEFAULT false;

ALTER TABLE public.function_point_analyses
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS function_point_analyses_team_id_idx
  ON public.function_point_analyses(team_id);
