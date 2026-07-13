-- Migration: fix ai_providers_provider_type_check
-- Problema: INSERT com provider_type = 'openrouter' falha com erro 23514
-- porque a constraint CHECK não incluía 'openrouter' nem 'groq'.
-- Solução: recriar a constraint com todos os valores válidos atuais.
-- Status: ✅ Aplicada com sucesso em 2026-07-09T18:29 -03

ALTER TABLE public.ai_providers
  DROP CONSTRAINT IF EXISTS ai_providers_provider_type_check,
  DROP CONSTRAINT IF EXISTS ai_providers_type_check;

ALTER TABLE public.ai_providers
  ADD CONSTRAINT ai_providers_provider_type_check
  CHECK (provider_type IN (
    'lovable',
    'openai',
    'gemini',
    'anthropic',
    'perplexity',
    'sakana',
    'groq',
    'openrouter'
  ));
