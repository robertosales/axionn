-- refactor: ai_providers — adiciona roteamento dinâmico por URL e formato
-- Remove a necessidade de hard-code de providers no código

-- 1. Adiciona colunas de roteamento dinâmico
ALTER TABLE public.ai_providers
  ADD COLUMN IF NOT EXISTS api_base_url  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS request_format TEXT DEFAULT 'openai_compatible'
    CHECK (request_format IN ('openai_compatible', 'gemini', 'anthropic', 'nemotron'));

COMMENT ON COLUMN public.ai_providers.api_base_url IS
  'URL base da API do provider. Ex: https://api.groq.com/openai/v1/chat/completions';
COMMENT ON COLUMN public.ai_providers.request_format IS
  'Formato de requisição: openai_compatible | gemini | anthropic';

-- 2. Popula valores padrão para providers já cadastrados
UPDATE public.ai_providers SET
  api_base_url   = 'https://ai.gateway.lovable.dev/v1/chat/completions',
  request_format = 'openai_compatible'
WHERE provider_type = 'lovable' AND api_base_url IS NULL;

UPDATE public.ai_providers SET
  api_base_url   = 'https://api.openai.com/v1/chat/completions',
  request_format = 'openai_compatible'
WHERE provider_type = 'openai' AND api_base_url IS NULL;

UPDATE public.ai_providers SET
  api_base_url   = 'https://generativelanguage.googleapis.com/v1beta',
  request_format = 'gemini'
WHERE provider_type = 'gemini' AND api_base_url IS NULL;

UPDATE public.ai_providers SET
  api_base_url   = 'https://api.anthropic.com/v1/messages',
  request_format = 'anthropic'
WHERE provider_type = 'anthropic' AND api_base_url IS NULL;

UPDATE public.ai_providers SET
  api_base_url   = 'https://api.perplexity.ai/chat/completions',
  request_format = 'openai_compatible'
WHERE provider_type = 'perplexity' AND api_base_url IS NULL;

UPDATE public.ai_providers SET
  api_base_url   = 'https://api.sakana.ai/v1/chat/completions',
  request_format = 'openai_compatible'
WHERE provider_type = 'sakana' AND api_base_url IS NULL;

UPDATE public.ai_providers SET
  api_base_url   = 'https://api.nemotron.ai/v1/chat/completions',
  request_format = 'openai_compatible'
WHERE provider_type = 'nemotron' AND api_base_url IS NULL;

UPDATE public.ai_providers SET
  api_base_url   = 'https://api.groq.com/openai/v1/chat/completions',
  request_format = 'openai_compatible'
WHERE provider_type = 'groq' AND api_base_url IS NULL;

UPDATE public.ai_providers SET
  api_base_url   = 'https://api.manus.ai/v1/chat/completions',
  request_format = 'openai_compatible'
WHERE provider_type = 'manus' AND api_base_url IS NULL;

-- 3. Corrige RPC set_ai_provider_key_v2 para sempre atualizar vault_secret_id
CREATE OR REPLACE FUNCTION public.set_ai_provider_key_v2(p_id uuid, p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_name TEXT := 'ai_provider_key_' || p_id::text;
  v_existing_id UUID;
  v_new_id      UUID;
BEGIN
  -- Verifica se já existe secret vinculado
  SELECT vault_secret_id INTO v_existing_id
  FROM public.ai_providers
  WHERE id = p_id;

  IF v_existing_id IS NOT NULL THEN
    -- Atualiza o secret existente no vault
    UPDATE vault.secrets
    SET secret = p_key, updated_at = now()
    WHERE id = v_existing_id;
  ELSE
    -- Cria novo secret no vault
    INSERT INTO vault.secrets (name, secret)
    VALUES (v_secret_name, p_key)
    RETURNING id INTO v_new_id;

    -- Atualiza o vault_secret_id na tabela
    UPDATE public.ai_providers
    SET vault_secret_id = v_new_id,
        has_key = true,
        updated_at = now()
    WHERE id = p_id;

    RETURN;
  END IF;

  -- Garante has_key = true e vault_secret_id preenchido
  UPDATE public.ai_providers
  SET has_key = true,
      vault_secret_id = COALESCE(vault_secret_id, v_existing_id),
      updated_at = now()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_ai_provider_key_v2(uuid, text) TO authenticated;
