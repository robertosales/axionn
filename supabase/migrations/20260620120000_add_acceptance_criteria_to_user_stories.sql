-- Migration: add acceptance_criteria column to user_stories
-- Purpose: include acceptance criteria in APF Function Point counting payload
-- Branch: feat/apf-acceptance-criteria-campos

-- 1. Add column (nullable TEXT, safe for existing rows)
ALTER TABLE public.user_stories
  ADD COLUMN IF NOT EXISTS acceptance_criteria TEXT;

-- 2. Comment for documentation
COMMENT ON COLUMN public.user_stories.acceptance_criteria IS
  'Critérios de aceite da HU. Utilizado junto com title e description para contagem de Pontos de Função (APF) pela IA.';

-- 3. Index for full-text search (optional, helps future reporting)
CREATE INDEX IF NOT EXISTS idx_user_stories_acceptance_criteria_fts
  ON public.user_stories
  USING gin(to_tsvector('portuguese', coalesce(acceptance_criteria, '')));
