-- =============================================================
-- Migration: FIX-001 — ai_providers + RPC get_ai_provider_key_by_id
-- Criado em: 2026-05-22
-- Motivo: A Edge Function apf-generate chamava get_ai_provider_key_by_id
--         mas essa função nunca foi commitada em migrations,
--         causando silent failure e fallback com chave inválida (401).
-- =============================================================

-- ── 1. Tabela ai_providers ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_providers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  provider_type   text        NOT NULL
    CHECK (provider_type IN (
      'lovable', 'openai', 'gemini', 'anthropic',
      'perplexity', 'nemotron', 'sakana', 'groq',
      'manus', 'deepseek', 'mistral', 'ollama', 'xai',
      'azure_openai', 'cohere', 'custom', 'openrouter'
    )),
  model           text,
  vault_secret_id uuid,        -- UUID do secret em vault.secrets
  is_active       boolean     NOT NULL DEFAULT true,
  is_recommended  boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_ai_providers_updated_at
  BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

-- Admins gerenciam tudo
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_providers'
      AND policyname = 'Admin full access ai_providers'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admin full access ai_providers"
        ON public.ai_providers FOR ALL
        USING (has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    $p$;
  END IF;
END $$;

-- Usuários autenticados lêem providers ativos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_providers'
      AND policyname = 'Authenticated read active ai_providers'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Authenticated read active ai_providers"
        ON public.ai_providers FOR SELECT
        TO authenticated
        USING (is_active = true);
    $p$;
  END IF;
END $$;

-- ── 2. RPC get_ai_provider_key_by_id ────────────────────────
-- Chamada com service_role pela Edge Function apf-generate.
-- Busca o secret descriptografado no Vault associado ao provider.
CREATE OR REPLACE FUNCTION public.get_ai_provider_key_by_id(p_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT ds.decrypted_secret::text
  FROM public.ai_providers ap
  JOIN vault.decrypted_secrets ds
    ON ds.id = ap.vault_secret_id
  WHERE ap.id          = p_id
    AND ap.is_active   = true
    AND ds.decrypted_secret IS NOT NULL
    AND LENGTH(TRIM(ds.decrypted_secret)) > 0
  LIMIT 1;
$$;

-- Revoga acesso público e concede apenas a service_role
REVOKE ALL ON FUNCTION public.get_ai_provider_key_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_provider_key_by_id(uuid) TO service_role;

-- ── 3. Comentários ──────────────────────────────────────────
COMMENT ON TABLE public.ai_providers IS
  'Provedores de IA cadastrados para uso nas Edge Functions (APF, etc.). '
  'A API key de cada provider é armazenada no Supabase Vault (vault.secrets) '
  'e vinculada via vault_secret_id.';

COMMENT ON FUNCTION public.get_ai_provider_key_by_id(uuid) IS
  'Retorna o secret descriptografado do Vault para o provider informado. '
  'Executada com SECURITY DEFINER pela Edge Function apf-generate (service_role). '
  'Retorna NULL se o provider não existir, estiver inativo ou sem secret válido.';
