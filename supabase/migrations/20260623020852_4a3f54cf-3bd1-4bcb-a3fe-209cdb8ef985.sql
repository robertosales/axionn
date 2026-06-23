-- Restaurar GRANT EXECUTE perdidos em funcoes que estavam quebrando o app.

REVOKE ALL ON FUNCTION public.set_ai_provider_key_v2(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_ai_provider_key_v2(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.set_ai_provider_key(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_ai_provider_key(text, text) TO authenticated;

-- has_role tambem perdeu o grant — sem isso quase todas as RLS retornam 401.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'has_role'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.has_role(%s) TO authenticated, anon', fn.args);
  END LOOP;
END;
$$;