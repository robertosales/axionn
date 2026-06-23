-- FIX-003: Adiciona suporte ao provedor Sakana AI
-- Expande o CHECK constraint de ai_providers para aceitar 'sakana'
-- e insere o registro padrão caso ainda não exista.

ALTER TABLE public.ai_providers
  DROP CONSTRAINT IF EXISTS ai_providers_provider_type_check,
  DROP CONSTRAINT IF EXISTS ai_providers_type_check;

ALTER TABLE public.ai_providers
  ADD CONSTRAINT ai_providers_provider_type_check
  CHECK (provider_type IN ('lovable', 'openai', 'gemini', 'anthropic', 'perplexity', 'sakana'));

INSERT INTO public.ai_providers (name, provider_type, model, is_active, is_recommended)
SELECT
  'Sakana AI (Fugu)',
  'sakana',
  'fugu',
  true,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_providers WHERE provider_type = 'sakana'
);
