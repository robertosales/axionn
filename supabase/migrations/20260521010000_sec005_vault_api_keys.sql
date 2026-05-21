-- ============================================================
-- SEC-005 — SUPABASE VAULT: API Keys dos providers de IA
--
-- Objetivo: remover API keys do body/frontend e armazenar
-- de forma criptografada no Vault (pgsodium).
--
-- Providers suportados:
--   lovable | openai | gemini | anthropic | perplexity
--
-- Fluxo:
--   1. Admin insere a key via função set_ai_provider_key()
--   2. Edge Function busca via get_ai_provider_key()
--   3. Frontend nunca vê nem envia a key
--
-- SEGURANÇA:
--   - vault.secrets é schema privado — usuário comum não acessa
--   - Funções SECURITY DEFINER + search_path fixo
--   - get_ai_provider_key: apenas service_role executa
--   - set_ai_provider_key: apenas admin autenticado executa
-- ============================================================

BEGIN;

-- Habilita a extensão Vault (já disponível no Supabase, apenas garante)
CREATE EXTENSION IF NOT EXISTS vault WITH SCHEMA vault;

-- ─────────────────────────────────────────────────────────────
-- 1. FUNÇÃO: set_ai_provider_key
--    Salva (ou atualiza) a key de um provider no Vault.
--    Apenas admin autenticado pode chamar.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_ai_provider_key(
  p_provider TEXT,  -- 'lovable' | 'openai' | 'gemini' | 'anthropic' | 'perplexity'
  p_key      TEXT   -- a API key em plain text (será criptografada pelo Vault)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_name TEXT := 'ai_provider_key_' || p_provider;
  v_existing_id UUID;
BEGIN
  -- Só admin pode chamar esta função
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem configurar API keys';
  END IF;

  -- Valida provider
  IF p_provider NOT IN ('lovable', 'openai', 'gemini', 'anthropic', 'perplexity') THEN
    RAISE EXCEPTION 'Provider inválido: %. Use: lovable, openai, gemini, anthropic, perplexity', p_provider;
  END IF;

  IF p_key IS NULL OR length(trim(p_key)) < 10 THEN
    RAISE EXCEPTION 'API key inválida ou muito curta';
  END IF;

  -- Verifica se já existe uma key para este provider
  SELECT id INTO v_existing_id
  FROM vault.secrets
  WHERE name = v_secret_name
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Atualiza a key existente
    PERFORM vault.update_secret(v_existing_id, p_key);
  ELSE
    -- Cria nova entrada no Vault
    PERFORM vault.create_secret(
      p_key,
      v_secret_name,
      'API key do provider ' || p_provider || ' para o apf-generate'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_ai_provider_key FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_ai_provider_key TO authenticated;
-- (a verificação is_admin() interna já bloqueia não-admins)

-- ─────────────────────────────────────────────────────────────
-- 2. FUNÇÃO: get_ai_provider_key
--    Recupera a key descriptografada de um provider.
--    Apenas service_role pode executar (chamada pela Edge Function).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_ai_provider_key(
  p_provider TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'ai_provider_key_' || p_provider
  LIMIT 1;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'API key não configurada para o provider: %', p_provider;
  END IF;

  RETURN v_key;
END;
$$;

-- Apenas service_role pode ler keys descriptografadas
REVOKE ALL ON FUNCTION public.get_ai_provider_key FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_provider_key TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 3. VIEW: ai_provider_keys_status
--    Permite ao admin ver quais providers estão configurados
--    SEM expor as keys (apenas nome + data de atualização)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.ai_provider_keys_status
WITH (security_invoker = true)
AS
SELECT
  replace(name, 'ai_provider_key_', '') AS provider,
  created_at,
  updated_at,
  -- Nunca exibe o secret, apenas confirma que existe
  TRUE AS configured
FROM vault.secrets
WHERE name LIKE 'ai_provider_key_%';

-- Apenas admins vêem o status (via RLS implícito de is_admin na app)
REVOKE ALL ON public.ai_provider_keys_status FROM PUBLIC;
GRANT SELECT ON public.ai_provider_keys_status TO authenticated;

COMMIT;

-- ============================================================
-- COMO CADASTRAR AS KEYS (rodar como admin autenticado)
-- ============================================================
-- SELECT public.set_ai_provider_key('lovable',    'sk-...');
-- SELECT public.set_ai_provider_key('openai',     'sk-...');
-- SELECT public.set_ai_provider_key('gemini',     'AIza...');
-- SELECT public.set_ai_provider_key('anthropic',  'sk-ant-...');
-- SELECT public.set_ai_provider_key('perplexity', 'pplx-...');
--
-- VERIFICAR STATUS:
-- SELECT * FROM public.ai_provider_keys_status;
-- ============================================================
