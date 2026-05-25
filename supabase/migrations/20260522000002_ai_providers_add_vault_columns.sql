-- =============================================================
-- Migration: FIX-001b — ai_providers: adiciona colunas faltantes
-- Criado em: 2026-05-22
-- Motivo: A tabela ai_providers já existia no banco (criada via
--         Dashboard) sem as colunas vault_secret_id e is_recommended
--         que a Edge Function e a migration anterior esperam.
-- =============================================================

ALTER TABLE public.ai_providers
  ADD COLUMN IF NOT EXISTS vault_secret_id uuid,
  ADD COLUMN IF NOT EXISTS is_recommended  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ai_providers.vault_secret_id IS
  'UUID do secret em vault.secrets que contém a API key deste provider.';

COMMENT ON COLUMN public.ai_providers.is_recommended IS
  'Indica o provider padrão/recomendado quando mais de um do mesmo tipo está ativo.';
