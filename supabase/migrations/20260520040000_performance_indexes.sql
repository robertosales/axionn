-- ============================================================
-- PERFORMANCE: Índices nas tabelas core
-- Semana 1 do plano de ação — risco zero, impacto imediato.
-- Nenhuma alteração de código necessária.
--
-- Problemas corrigidos:
--   - Full table scan em demandas filtradas por team_id
--   - Full table scan em user_stories no Kanban (team_id + sprint_id)
--   - Seq scan em demanda_transitions por demanda_id
--   - RPC get_admin_kpis conta demandas por (team_id, situacao) sem índice
-- ============================================================

-- demandas: filtro principal em todos os hooks de sustentação
CREATE INDEX IF NOT EXISTS idx_demandas_team_id
  ON demandas (team_id);

-- demandas: contagens por situação usadas na RPC get_admin_kpis e nos dashboards
CREATE INDEX IF NOT EXISTS idx_demandas_team_situacao
  ON demandas (team_id, situacao);

-- demandas: ordenação por data de criação (timeline, SLA em risco)
CREATE INDEX IF NOT EXISTS idx_demandas_team_created_at
  ON demandas (team_id, created_at DESC);

-- user_stories: filtro do Kanban — .filter(team_id).limit(500)
CREATE INDEX IF NOT EXISTS idx_user_stories_team_id
  ON user_stories (team_id);

-- user_stories: filtro por sprint (get_admin_kpis, sprint board, capacity planner)
CREATE INDEX IF NOT EXISTS idx_user_stories_sprint_id
  ON user_stories (sprint_id);

-- user_stories: composto team_id + sprint_id (join mais comum no RPC)
CREATE INDEX IF NOT EXISTS idx_user_stories_team_sprint
  ON user_stories (team_id, sprint_id);

-- demanda_transitions: lookup por demanda (calc_sla_demanda + histórico)
CREATE INDEX IF NOT EXISTS idx_demanda_transitions_demanda_id
  ON demanda_transitions (demanda_id);

-- demanda_transitions: composto demanda_id + created_at (ORDER BY na RPC e no hook)
CREATE INDEX IF NOT EXISTS idx_demanda_transitions_demanda_created
  ON demanda_transitions (demanda_id, created_at ASC);
