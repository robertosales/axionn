CREATE OR REPLACE FUNCTION public.validate_demanda_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- O fluxo de Sustentação é configurável; a interface controla os destinos disponíveis.
  -- Por isso, a validação fixa de status foi removida para permitir etapas customizadas
  -- cadastradas no fluxo, como TESTE.
  IF (TG_OP = 'UPDATE' AND OLD.situacao IS DISTINCT FROM NEW.situacao) THEN
    INSERT INTO public.demanda_transitions (demanda_id, from_status, to_status, user_id, justificativa)
    VALUES (
      NEW.id,
      OLD.situacao,
      NEW.situacao,
      auth.uid(),
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_demanda_transition() IS
  'Registra transições de status de demandas. Aceita etapas configuráveis do fluxo de Sustentação.';