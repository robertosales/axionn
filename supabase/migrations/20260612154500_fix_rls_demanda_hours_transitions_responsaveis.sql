-- =============================================================================
-- FIX: RLS para demanda_hours, demanda_transitions e demanda_responsaveis
-- =============================================================================
-- Problema: após o SEC-002 essas tabelas ficaram com RLS habilitado mas sem
-- policies de acesso, causando retorno silencioso de [] para usuários comuns
-- nas abas Atividades, Histórico e Responsáveis da tela de Demandas.
-- =============================================================================

-- ─── Helper: verifica se o usuário é membro do time da demanda ───────────────
-- (reutiliza a mesma lógica de team_members já adotada nas demais tables)

-- =============================================================================
-- 1. demanda_hours
-- =============================================================================

ALTER TABLE public.demanda_hours ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas para evitar conflito em re-runs
DROP POLICY IF EXISTS "demanda_hours_select_team_member" ON public.demanda_hours;
DROP POLICY IF EXISTS "demanda_hours_insert_own"         ON public.demanda_hours;
DROP POLICY IF EXISTS "demanda_hours_update_admin"       ON public.demanda_hours;
DROP POLICY IF EXISTS "demanda_hours_delete_admin"       ON public.demanda_hours;

-- SELECT: qualquer membro do time que tem acesso à demanda
CREATE POLICY "demanda_hours_select_team_member"
ON public.demanda_hours
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.demandas d
    JOIN public.team_members tm ON tm.team_id = d.team_id
    WHERE d.id = demanda_hours.demanda_id
      AND tm.user_id = auth.uid()
  )
);

-- INSERT: membro do time lança horas em nome próprio (user_id = auth.uid())
CREATE POLICY "demanda_hours_insert_own"
ON public.demanda_hours
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.demandas d
    JOIN public.team_members tm ON tm.team_id = d.team_id
    WHERE d.id = demanda_hours.demanda_id
      AND tm.user_id = auth.uid()
  )
);

-- UPDATE: admin pode editar qualquer lançamento do time
CREATE POLICY "demanda_hours_update_admin"
ON public.demanda_hours
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.demandas d
    JOIN public.team_members tm ON tm.team_id = d.team_id
    WHERE d.id = demanda_hours.demanda_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'admin'
  )
);

-- DELETE: admin pode excluir lançamentos
CREATE POLICY "demanda_hours_delete_admin"
ON public.demanda_hours
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.demandas d
    JOIN public.team_members tm ON tm.team_id = d.team_id
    WHERE d.id = demanda_hours.demanda_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'admin'
  )
);

-- =============================================================================
-- 2. demanda_transitions
-- =============================================================================

ALTER TABLE public.demanda_transitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demanda_transitions_select_team_member" ON public.demanda_transitions;
DROP POLICY IF EXISTS "demanda_transitions_insert_team_member" ON public.demanda_transitions;

-- SELECT: membro do time enxerga todo o histórico da demanda
CREATE POLICY "demanda_transitions_select_team_member"
ON public.demanda_transitions
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.demandas d
    JOIN public.team_members tm ON tm.team_id = d.team_id
    WHERE d.id = demanda_transitions.demanda_id
      AND tm.user_id = auth.uid()
  )
);

-- INSERT: membro do time pode registrar transições (movimentações de status)
CREATE POLICY "demanda_transitions_insert_team_member"
ON public.demanda_transitions
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.demandas d
    JOIN public.team_members tm ON tm.team_id = d.team_id
    WHERE d.id = demanda_transitions.demanda_id
      AND tm.user_id = auth.uid()
  )
);

-- =============================================================================
-- 3. demanda_responsaveis
-- =============================================================================

ALTER TABLE public.demanda_responsaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demanda_responsaveis_select_team_member" ON public.demanda_responsaveis;
DROP POLICY IF EXISTS "demanda_responsaveis_insert_admin"        ON public.demanda_responsaveis;
DROP POLICY IF EXISTS "demanda_responsaveis_delete_admin"        ON public.demanda_responsaveis;

-- SELECT: membro do time vê os responsáveis vinculados
CREATE POLICY "demanda_responsaveis_select_team_member"
ON public.demanda_responsaveis
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.demandas d
    JOIN public.team_members tm ON tm.team_id = d.team_id
    WHERE d.id = demanda_responsaveis.demanda_id
      AND tm.user_id = auth.uid()
  )
);

-- INSERT: qualquer membro do time pode vincular responsáveis
CREATE POLICY "demanda_responsaveis_insert_admin"
ON public.demanda_responsaveis
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.demandas d
    JOIN public.team_members tm ON tm.team_id = d.team_id
    WHERE d.id = demanda_responsaveis.demanda_id
      AND tm.user_id = auth.uid()
  )
);

-- DELETE: qualquer membro do time pode desvincular responsáveis
CREATE POLICY "demanda_responsaveis_delete_admin"
ON public.demanda_responsaveis
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.demandas d
    JOIN public.team_members tm ON tm.team_id = d.team_id
    WHERE d.id = demanda_responsaveis.demanda_id
      AND tm.user_id = auth.uid()
  )
);
