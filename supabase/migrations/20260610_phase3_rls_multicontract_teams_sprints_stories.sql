-- ============================================================
-- FASE 3: RLS multi-contrato — teams, sprints, user_stories
-- Data: 2026-06-10 (v2 — fix admin check via has_role)
-- Premissa: teams.contract_id (FK nullable) é o elo central.
--           profiles.team_id (FK) vincula usuário ao time.
--           admin check via public.has_role(auth.uid(), 'admin').
-- ============================================================

-- 1. Helper SECURITY DEFINER — retorna contract_id do usuário atual
--    Usa profiles.team_id (adicionado em 20260514165900)
CREATE OR REPLACE FUNCTION public.get_user_contract_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.contract_id
  FROM profiles p
  JOIN teams t ON t.id = p.team_id
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

-- ============================================================
-- 2. TEAMS
-- ============================================================
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams_select_multicontract" ON public.teams;
CREATE POLICY "teams_select_multicontract"
  ON public.teams FOR SELECT
  USING (
    -- admin vê tudo
    public.has_role(auth.uid(), 'admin')
    OR
    -- membro vê times do mesmo contrato
    contract_id = get_user_contract_id()
    OR
    -- times legados (sem contrato) visíveis para todos autenticados
    contract_id IS NULL
  );

-- ============================================================
-- 3. SPRINTS
-- ============================================================
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sprints_select_multicontract" ON public.sprints;
CREATE POLICY "sprints_select_multicontract"
  ON public.sprints FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR
    team_id IN (
      SELECT id FROM teams
      WHERE contract_id = get_user_contract_id()
         OR contract_id IS NULL
    )
  );

-- ============================================================
-- 4. USER_STORIES
-- ============================================================
ALTER TABLE public.user_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_stories_select_multicontract" ON public.user_stories;
CREATE POLICY "user_stories_select_multicontract"
  ON public.user_stories FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR
    sprint_id IN (
      SELECT s.id FROM sprints s
      JOIN teams t ON t.id = s.team_id
      WHERE t.contract_id = get_user_contract_id()
         OR t.contract_id IS NULL
    )
  );

-- ============================================================
-- ÍNDICES de suporte
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_teams_contract_id
  ON public.teams (contract_id)
  WHERE contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sprints_team_id
  ON public.sprints (team_id);

CREATE INDEX IF NOT EXISTS idx_user_stories_sprint_id
  ON public.user_stories (sprint_id);

-- ============================================================
-- FIM
-- Migration: 20260610_phase3_rls_multicontract_teams_sprints_stories.sql
-- ============================================================
