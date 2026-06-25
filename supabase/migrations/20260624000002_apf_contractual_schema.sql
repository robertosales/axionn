-- APF contratual baseline-first: extensões e evolução de schema.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE OR REPLACE FUNCTION public.normalize_apf_text(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(
    translate(
      lower(coalesce(p_text, '')),
      'áàãâäéèêëíìîïóòõôöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '[^a-z0-9]+',
    ' ',
    'g'
  ));
$$;

ALTER TABLE public.apf_project_baselines
  ADD COLUMN IF NOT EXISTS source_file_name TEXT,
  ADD COLUMN IF NOT EXISTS source_summary JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.apf_baseline_items
  ADD COLUMN IF NOT EXISTS factor_sigla TEXT,
  ADD COLUMN IF NOT EXISTS contribution_pct NUMERIC(6,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS pf_fs NUMERIC(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_measurable BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_row INT,
  ADD COLUMN IF NOT EXISTS source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS normalized_key TEXT;

UPDATE public.apf_baseline_items
SET normalized_key = public.normalize_apf_text(coalesce(item_ref, '') || ' ' || description)
WHERE normalized_key IS NULL;

ALTER TABLE public.apf_counting_items
  ADD COLUMN IF NOT EXISTS story_id UUID REFERENCES public.user_stories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS story_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS hu_refs TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS match_type TEXT,
  ADD COLUMN IF NOT EXISTS match_confidence NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS ai_confidence_score NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS normalized_key TEXT,
  ADD COLUMN IF NOT EXISTS source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.user_stories
  ADD COLUMN IF NOT EXISTS apf_pf_bruto NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS apf_pf_fs NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS apf_function_sigla TEXT,
  ADD COLUMN IF NOT EXISTS apf_factor_sigla TEXT,
  ADD COLUMN IF NOT EXISTS apf_counting_session_id UUID REFERENCES public.apf_counting_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_apf_baseline_items_normalized
  ON public.apf_baseline_items USING gin (normalized_key gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_apf_counting_items_story_id
  ON public.apf_counting_items(story_id);
CREATE INDEX IF NOT EXISTS idx_apf_counting_items_story_ids
  ON public.apf_counting_items USING gin(story_ids);
CREATE INDEX IF NOT EXISTS idx_apf_counting_items_normalized
  ON public.apf_counting_items(session_id, normalized_key);

DO $$ BEGIN
  CREATE TYPE public.apf_correction_reason AS ENUM (
    'ambiguous_hu', 'wrong_functional_type', 'wrong_complexity',
    'domain_convention', 'baseline_conflict', 'scope_misunderstanding',
    'split_required', 'merge_required', 'already_counted', 'not_countable',
    'wrong_impact_factor', 'wrong_baseline_match', 'wrong_pf_value',
    'missing_function', 'extra_function', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.apf_correction_reason ADD VALUE IF NOT EXISTS 'wrong_impact_factor';
ALTER TYPE public.apf_correction_reason ADD VALUE IF NOT EXISTS 'wrong_baseline_match';
ALTER TYPE public.apf_correction_reason ADD VALUE IF NOT EXISTS 'wrong_pf_value';
ALTER TYPE public.apf_correction_reason ADD VALUE IF NOT EXISTS 'missing_function';
ALTER TYPE public.apf_correction_reason ADD VALUE IF NOT EXISTS 'extra_function';
ALTER TYPE public.apf_correction_reason ADD VALUE IF NOT EXISTS 'other';

ALTER TABLE public.apf_validation_events
  ADD COLUMN IF NOT EXISTS baseline_item_id UUID REFERENCES public.apf_baseline_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_factor_sigla TEXT,
  ADD COLUMN IF NOT EXISTS validated_factor_sigla TEXT,
  ADD COLUMN IF NOT EXISTS ai_pf_bruto_exact NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS validated_pf_bruto_exact NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS ai_pf_fs NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS validated_pf_fs NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS was_corrected_contractual BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_apf_ve_corrected_contractual
  ON public.apf_validation_events(was_corrected_contractual);
