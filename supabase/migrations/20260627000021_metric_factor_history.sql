CREATE TABLE IF NOT EXISTS public.apf_metric_factor_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_key TEXT NOT NULL,
  reference_code TEXT NOT NULL,
  description TEXT NOT NULL,
  function_sigla TEXT NOT NULL,
  factor_sigla TEXT NOT NULL,
  pf_bruto NUMERIC(8,2) NOT NULL DEFAULT 0,
  pf_fs NUMERIC(8,2) NOT NULL DEFAULT 0,
  is_measurable BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  source_measurement TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(system_key, reference_code, description)
);
