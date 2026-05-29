-- Migration: FIX-002 — Saneamento de modelos Gemini
-- Motivo: O modelo gemini-1.5-flash-latest causa 404 na API v1beta.
--         O modelo gemini-2.5-flash foi um erro tipográfico.

UPDATE public.ai_providers
SET model = 'gemini-1.5-flash'
WHERE provider_type = 'gemini'
  AND (model = 'gemini-1.5-flash-latest' OR model = 'google/gemini-1.5-flash-latest');

UPDATE public.ai_providers
SET model = 'google/gemini-1.5-flash'
WHERE provider_type = 'lovable'
  AND model = 'google/gemini-2.5-flash';

-- Garante que nenhum modelo gemini tenha o prefixo google/ na tabela (opcional, já tratado no código)
UPDATE public.ai_providers
SET model = REPLACE(model, 'google/', '')
WHERE provider_type = 'gemini' AND model LIKE 'google/%';
