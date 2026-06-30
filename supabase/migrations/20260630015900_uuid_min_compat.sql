-- Compatibilidade temporária para backfills que agregam UUID.

CREATE OR REPLACE FUNCTION public.uuid_min_state(current_value uuid, next_value uuid)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN current_value IS NULL THEN next_value
    WHEN next_value IS NULL THEN current_value
    WHEN current_value < next_value THEN current_value
    ELSE next_value
  END;
$$;

DROP AGGREGATE IF EXISTS public.min(uuid);
CREATE AGGREGATE public.min(uuid) (
  SFUNC = public.uuid_min_state,
  STYPE = uuid,
  COMBINEFUNC = public.uuid_min_state,
  PARALLEL = SAFE
);
