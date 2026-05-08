
ALTER TABLE public.demanda_hours
  ADD COLUMN IF NOT EXISTS minutos integer NOT NULL DEFAULT 0;

UPDATE public.demanda_hours
   SET minutos = GREATEST(0, ROUND(COALESCE(horas, 0) * 60)::int)
 WHERE minutos = 0 AND COALESCE(horas, 0) > 0;

CREATE INDEX IF NOT EXISTS idx_demanda_hours_demanda_id
  ON public.demanda_hours (demanda_id);
