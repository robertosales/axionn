-- Migration: fix has_key orphan + RPC de reset
-- Problema: provider ficou com has_key=true mas sem secret no Vault
--   porque execucoes anteriores falharam apos marcar has_key mas antes
--   de gravar o secret (erro _crypto_aead_det_noncegen).
-- Solucao:
--   1. Reseta has_key=false para providers sem secret no Vault
--   2. Cria RPC reset_ai_provider_key para limpar estado inconsistente
--   3. Corrige set_ai_provider_key_v2 com tratamento de excecao atomico

-- 1. Corrige registros orfaos: has_key=true sem secret correspondente no Vault
UPDATE public.ai_providers p
   SET has_key = false,
       updated_at = now()
 WHERE p.has_key = true
   AND NOT EXISTS (
     SELECT 1 FROM vault.secrets s
      WHERE s.name = 'ai_provider_key_' || p.id::text
   );

-- 2. RPC para resetar estado de chave (util para manutencao futura)
CREATE OR REPLACE FUNCTION public.reset_ai_provider_key_state(p_id uuid)
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

  -- Remove secret do Vault se existir
  DELETE FROM vault.secrets
   WHERE name = 'ai_provider_key_' || p_id::text;

  -- Reseta flag
  UPDATE public.ai_providers
     SET has_key = false, updated_at = now()
   WHERE id = p_id;
END;
$$;

ALTER FUNCTION public.reset_ai_provider_key_state(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reset_ai_provider_key_state(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reset_ai_provider_key_state(uuid) TO authenticated, service_role;

-- 3. Recria set_ai_provider_key_v2 com bloco atomico BEGIN/EXCEPTION
--    para garantir rollback do has_key se o Vault falhar
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

  -- So marca has_key=true APOS gravar no Vault com sucesso
  UPDATE public.ai_providers
     SET has_key = true, updated_at = now()
   WHERE id = p_id;

EXCEPTION WHEN OTHERS THEN
  -- Garante que has_key nao fica true se o Vault falhou
  UPDATE public.ai_providers
     SET has_key = false, updated_at = now()
   WHERE id = p_id;
  RAISE;
END;
$$;

ALTER FUNCTION public.set_ai_provider_key_v2(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_ai_provider_key_v2(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_ai_provider_key_v2(uuid, text) TO authenticated, service_role;
