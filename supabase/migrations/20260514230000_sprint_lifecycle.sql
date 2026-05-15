-- ============================================================
-- Sprint Lifecycle: closed_at + delay_days
-- Criado em: 2026-05-14
-- Objetivo: registrar a data real de encerramento e os dias de
-- atraso acumulados quando a sprint é encerrada manualmente.
-- NUNCA preencher automaticamente — apenas via closeSprint().
-- ============================================================

-- 1. Adiciona closed_at: timestamp real do encerramento manual
ALTER TABLE sprints
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Adiciona delay_days: dias de atraso = MAX(0, closed_at::date - end_date::date)
--    Preenchido no momento do encerramento manual.
ALTER TABLE sprints
  ADD COLUMN IF NOT EXISTS delay_days INTEGER DEFAULT NULL;

-- 3. Backfill conservador: sprints já encerradas (is_active=false) que
--    não possuem closed_at ganham NULL — o histórico de atraso não é
--    inventado retroativamente. Apenas sprints encerradas a partir
--    de agora terão os valores corretos.
--    (nenhuma ação necessária — DEFAULT NULL já cobre isso)

-- 4. Comentários descritivos nas colunas
COMMENT ON COLUMN sprints.closed_at IS
  'Data e hora do encerramento manual da sprint. NULL = sprint ainda ativa ou nunca encerrada pela funcionalidade.';

COMMENT ON COLUMN sprints.delay_days IS
  'Dias de atraso no encerramento: MAX(0, closed_at::date - end_date::date). NULL = sprint ativa ou encerrada antes da funcionalidade existir.';
