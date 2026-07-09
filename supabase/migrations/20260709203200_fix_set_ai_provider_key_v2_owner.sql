-- Migration: fix set_ai_provider_key_v2 owner
-- Problema: HTTP 42501 - permission denied for function _crypto_aead_det_noncegen
-- Causa: funcoes SECURITY DEFINER executam com privilegios do OWNER.
--   O owner era 'authenticated' que nao tem acesso ao pgsodium interno do Vault.
-- Solucao: recriar a funcao e transferir ownership para 'postgres'.

CREATE OR REPLACE FUNCTION public.set_ai_provider_key_v2(
  p_id uuid,
  p_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_secret_name text := 'ai_provider_key_' || p_id::text;
  v_existing_id uuid;
BEGIN
  -- Aceita platform_admin (nova arquitetura) OU admin legado
  IF NOT (
    coalesce(public.is_platform_admin(auth.uid()), false)
    OR coalesce(public.is_admin(), false)
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem configurar API keys';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ai_providers WHERE id = p_id) THEN
    RAISE EXCEPTION 'Provedor de IA nao encontrado: %', p_id;
  END IF;

  IF p_key IS NULL OR length(trim(p_key)) < 10 THEN
    RAISE EXCEPTION 'API key invalida ou muito curta';
  END IF;

  IF to_regclass('vault.secrets') IS NULL THEN
    RAISE EXCEPTION 'vault_unavailable';
  END IF;

  SELECT secret.id INTO v_existing_id
    FROM vault.secrets secret
   WHERE secret.name = v_secret_name
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_existing_id, p_key);
  ELSE
    PERFORM vault.create_secret(
      p_key,
      v_secret_name,
      'AI provider key for row ' || p_id::text
    );
  END IF;

  UPDATE public.ai_providers
     SET has_key = true, updated_at = now()
   WHERE id = p_id;
END;
$$;

-- CRITICO: sem isso o SECURITY DEFINER nao herda acesso ao pgsodium/vault
ALTER FUNCTION public.set_ai_provider_key_v2(uuid, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.set_ai_provider_key_v2(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_ai_provider_key_v2(uuid, text) TO authenticated, service_role;
