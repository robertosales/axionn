-- ============================================
-- FIX: Adiciona team_id em profiles
-- Problema: coluna team_id nao existia na tabela profiles,
--           causando erro 400 (42703) na query do AdminUsuariosPage.
-- Solucao:  ADD COLUMN IF NOT EXISTS com FK para teams.
-- Impacto:  ZERO - nenhuma coluna existente e alterada.
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
