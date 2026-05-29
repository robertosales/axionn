-- Atualiza modelo Gemini descontinuado para o modelo estável atual,
-- e prioriza o GPT (com chave paga) como recomendado para evitar
-- falhas 404 no Gemini quebrado.
UPDATE public.ai_providers
SET model = 'gemini-2.0-flash', updated_at = now()
WHERE provider_type = 'gemini'
  AND (model IS NULL OR model ILIKE '%gemini-1.5%');

-- Garante que o Gemini deixe de ser o recomendado padrão (ele estava falhando)
UPDATE public.ai_providers
SET is_recommended = false, updated_at = now()
WHERE provider_type = 'gemini';

-- Promove o GPT (chave paga) a recomendado, se existir e estiver ativo
UPDATE public.ai_providers
SET is_recommended = true, updated_at = now()
WHERE provider_type = 'openai' AND is_active = true;