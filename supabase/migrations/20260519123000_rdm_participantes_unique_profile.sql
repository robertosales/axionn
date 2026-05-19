-- ============================================================
-- Migration: 20260519123000_rdm_participantes_unique_profile
-- Objetivo : Adiciona UNIQUE(rdm_id, profile_id) em
--            rdm_participantes para suportar upsert sem
--            duplicar o mesmo usuário com papéis diferentes.
-- ============================================================

-- 1. Remove duplicatas mantendo apenas o registro mais recente
--    por (rdm_id, profile_id) antes de criar a constraint.
DELETE FROM public.rdm_participantes
WHERE id NOT IN (
  SELECT DISTINCT ON (rdm_id, profile_id) id
  FROM public.rdm_participantes
  ORDER BY rdm_id, profile_id, created_at DESC
);

-- 2. Cria a unique constraint necessária para o upsert
ALTER TABLE public.rdm_participantes
  ADD CONSTRAINT rdm_participantes_rdm_id_profile_id_key
  UNIQUE (rdm_id, profile_id);
