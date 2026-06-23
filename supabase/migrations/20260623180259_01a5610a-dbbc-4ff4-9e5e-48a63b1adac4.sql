ALTER TABLE public.apf_knowledge_patterns
  ADD COLUMN IF NOT EXISTS occurrence_count integer GENERATED ALWAYS AS (COALESCE(evidence_count, 0)) STORED;

ALTER TABLE public.apf_learning_metrics
  ADD COLUMN IF NOT EXISTS total_validations integer GENERATED ALWAYS AS (COALESCE(total_items, 0)) STORED;

ALTER TABLE public.apf_learning_metrics
  ADD COLUMN IF NOT EXISTS corrected_count integer GENERATED ALWAYS AS (COALESCE(corrected_items, 0)) STORED;

ALTER TABLE public.apf_learning_metrics
  ADD COLUMN IF NOT EXISTS accuracy_rate numeric GENERATED ALWAYS AS (ROUND(((1 - COALESCE(correction_rate, 0)) * 100)::numeric, 2)) STORED;

ALTER TABLE public.apf_learning_metrics
  ADD COLUMN IF NOT EXISTS avg_confidence_score numeric;