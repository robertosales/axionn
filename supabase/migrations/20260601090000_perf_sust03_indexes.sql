-- ============================================================
-- PERF/SUST-03 — Índices complementares (sustentação + IMR)
-- Não duplica nenhum índice já criado em:
--   20260520040000_performance_indexes.sql  (team_id, situacao, created_at, sprint_id, demanda_id)
--   20260520031000_feriados_e_calc_sla_demanda.sql (idx_feriados_data_ativo)
--   20260525_diagnostic_indexes.sql
-- ============================================================

-- --------------------------------------------------------
-- demandas: lookup por cada responsavel (filas pessoais)
-- Colunas: responsavel_dev, responsavel_requisitos,
--          responsavel_arquiteto, responsavel_teste
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_demandas_responsavel_dev
  ON demandas (responsavel_dev)
  WHERE responsavel_dev IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_demandas_responsavel_requisitos
  ON demandas (responsavel_requisitos)
  WHERE responsavel_requisitos IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_demandas_responsavel_arquiteto
  ON demandas (responsavel_arquiteto)
  WHERE responsavel_arquiteto IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_demandas_responsavel_teste
  ON demandas (responsavel_teste)
  WHERE responsavel_teste IS NOT NULL;

-- demandas: situacao isolada (contagens sem team_id na RPC kpiGeral)
CREATE INDEX IF NOT EXISTS idx_demandas_situacao
  ON demandas (situacao);

-- demandas: composto team_id + situacao + created_at para calc_imr_periodo
-- (index-only scan para contagens por janela de tempo)
CREATE INDEX IF NOT EXISTS idx_demandas_team_sit_created
  ON demandas (team_id, situacao, created_at DESC);

-- --------------------------------------------------------
-- demanda_transitions: lookup por status de destino
-- Usado em calc_imr_periodo e calc_kpis_sustentacao
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_demanda_transitions_to_status
  ON demanda_transitions (to_status);

CREATE INDEX IF NOT EXISTS idx_demanda_transitions_demanda_to_status
  ON demanda_transitions (demanda_id, to_status);

-- demanda_transitions: filtro por período (created_at isolado)
CREATE INDEX IF NOT EXISTS idx_demanda_transitions_created_at
  ON demanda_transitions (created_at DESC);

-- --------------------------------------------------------
-- demanda_hours: sem índice anterior — todos novos
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_demanda_hours_demanda_id
  ON demanda_hours (demanda_id);

CREATE INDEX IF NOT EXISTS idx_demanda_hours_user_id
  ON demanda_hours (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_demanda_hours_demanda_user
  ON demanda_hours (demanda_id, user_id);
