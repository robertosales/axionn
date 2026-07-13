-- Migration: fix get_ai_provider_key_by_id owner
-- Problema: Edge Function platform-ai-provider-test chama get_ai_provider_key_by_id
--   via service_role, mas a funcao retorna NULL porque o OWNER nao e postgres.
--   vault.decrypted_secrets usa pgsodium internamente e so descriptografa
--   quando o OWNER da funcao SECURITY DEFINER e postgres.
-- Solucao: transferir ownership de todas as funcoes de leitura/escrita do Vault.

CREATE OR REPLACE FUNCTION public.get_ai_provider_key_by_id(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_key text;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE EXCEPTION 'vault_unavailable';
  END IF;

  SELECT ds.decrypted_secret
    INTO v_key
    FROM vault.decrypted_secrets ds
   WHERE ds.name = 'ai_provider_key_' || p_id::text
   LIMIT 1;

  RETURN v_key;
END;
$$;

-- CRITICO: owner postgres para pgsodium descriptografar corretamente
ALTER FUNCTION public.get_ai_provider_key_by_id(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_ai_provider_key_by_id(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_provider_key_by_id(uuid) TO service_role;

-- Garante tambem delete_ai_provider_key com owner correto
CREATE OR REPLACE FUNCTION public.delete_ai_provider_key(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
BEGIN
  IF NOT (
    coalesce(public.is_platform_admin(auth.uid()), false)
    OR coalesce(public.is_admin(), false)
  ) THEN
    RAISE EXCEPTION USING errcode='42501', message='platform_admin_required';
  END IF;

  IF to_regclass('vault.secrets') IS NULL THEN
    RAISE EXCEPTION 'vault_unavailable';
  END IF;

  DELETE FROM vault.secrets
   WHERE name = 'ai_provider_key_' || p_id::text;

  UPDATE public.ai_providers
     SET has_key = false, updated_at = now()
   WHERE id = p_id;
END;
$$;

ALTER FUNCTION public.delete_ai_provider_key(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.delete_ai_provider_key(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_ai_provider_key(uuid) TO authenticated, service_role;
