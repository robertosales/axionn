
ALTER TABLE public.demandas
  ADD COLUMN IF NOT EXISTS situacao_changed_at timestamptz NOT NULL DEFAULT now();

-- Backfill: usa a última transição registrada
UPDATE public.demandas d
SET situacao_changed_at = COALESCE(t.last_ts, d.created_at, now())
FROM (
  SELECT demanda_id, MAX(created_at) AS last_ts
  FROM public.demanda_transitions
  GROUP BY demanda_id
) t
WHERE t.demanda_id = d.id;

CREATE OR REPLACE FUNCTION public.fn_demanda_situacao_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.situacao IS DISTINCT FROM OLD.situacao THEN
    NEW.situacao_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_demanda_situacao_changed ON public.demandas;
CREATE TRIGGER trg_demanda_situacao_changed
BEFORE UPDATE ON public.demandas
FOR EACH ROW
EXECUTE FUNCTION public.fn_demanda_situacao_changed();
