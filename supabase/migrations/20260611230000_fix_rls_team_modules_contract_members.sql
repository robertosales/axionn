-- =============================================================================
-- Migration: fix/rls-team-modules
-- Data: 2026-06-11
-- Problema: team_modules tinha RLS ativo (relrowsecurity = true) mas ZERO
--           policies definidas, bloqueando 100% das queries SELECT.
--           O AuthContext.tsx faz boot via:
--             supabase.from('team_modules').select('module, team:team_id(id, name)')
--           e recebia [] — times nunca carregavam no frontend.
-- Solução: policy SELECT permissiva por contrato, alinhada com o padrão
--          das Fases 2B/2D1 já aplicadas nas demais tabelas.
-- =============================================================================

-- Garante que RLS está ativo (já estava, mas idempotente)
ALTER TABLE team_modules ENABLE ROW LEVEL SECURITY;

-- Policy: usuários autenticados podem ver registros de team_modules
-- cujo team pertença a um contrato do qual são membros (via contract_members).
CREATE POLICY "contract_members_can_select_team_modules"
ON team_modules
FOR SELECT
TO authenticated
USING (
  is_contract_member(
    auth.uid(),
    (SELECT contract_id FROM teams WHERE id = team_id)
  )
);

-- ----------------------------------------------------------------------------
-- Rollback (executar manualmente se necessário):
--
-- DROP POLICY IF EXISTS "contract_members_can_select_team_modules" ON team_modules;
-- ----------------------------------------------------------------------------
