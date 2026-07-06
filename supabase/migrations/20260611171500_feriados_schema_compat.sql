-- Compatibilidade entre os dois formatos históricos de public.feriados:
-- data DATE e dia/mes/ano INTEGER.

ALTER TABLE public.feriados
  ADD COLUMN IF NOT EXISTS data date,
  ADD COLUMN IF NOT EXISTS dia integer,
  ADD COLUMN IF NOT EXISTS mes integer,
  ADD COLUMN IF NOT EXISTS ano integer;

UPDATE public.feriados
   SET data = make_date(ano, mes, dia)
 WHERE data IS NULL
   AND ano IS NOT NULL
   AND mes IS NOT NULL
   AND dia IS NOT NULL;

UPDATE public.feriados
   SET dia = extract(day from data)::integer,
       mes = extract(month from data)::integer,
       ano = extract(year from data)::integer
 WHERE data IS NOT NULL
   AND (dia IS NULL OR mes IS NULL OR ano IS NULL);

CREATE OR REPLACE FUNCTION public.sync_feriado_calendar_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.data IS NULL
     AND NEW.ano IS NOT NULL
     AND NEW.mes IS NOT NULL
     AND NEW.dia IS NOT NULL THEN
    NEW.data := make_date(NEW.ano, NEW.mes, NEW.dia);
  ELSIF NEW.data IS NOT NULL THEN
    NEW.dia := extract(day from NEW.data)::integer;
    NEW.mes := extract(month from NEW.data)::integer;
    NEW.ano := extract(year from NEW.data)::integer;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_feriado_calendar_columns ON public.feriados;
CREATE TRIGGER trg_sync_feriado_calendar_columns
BEFORE INSERT OR UPDATE OF data, dia, mes, ano
ON public.feriados
FOR EACH ROW
EXECUTE FUNCTION public.sync_feriado_calendar_columns();

CREATE INDEX IF NOT EXISTS idx_feriados_calendar_parts
  ON public.feriados (ano, mes, dia)
  WHERE ano IS NOT NULL AND mes IS NOT NULL AND dia IS NOT NULL;
