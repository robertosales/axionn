-- Corrige a inicialização de RECORDs usados na deduplicação do motor de
-- processo elementar. A alteração é aplicada sobre a definição instalada
-- para manter esta migration pequena e compatível com ambientes que já
-- executaram a migration 08.
DO $$
DECLARE
  v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.save_contractual_counting_items(uuid,uuid,jsonb,text)'::regprocedure
  )
  INTO v_definition;

  v_definition := replace(
    v_definition,
    'v_existing := NULL;',
    E'SELECT NULL::uuid AS id INTO v_existing;\n    SELECT NULL::uuid AS id INTO v_absorbing;'
  );

  v_definition := replace(
    v_definition,
    'v_absorbing := NULL;',
    '-- v_absorbing já foi inicializado no início da iteração'
  );

  EXECUTE v_definition;
END;
$$;
