-- ============================================================
-- apf_jobs — fila assíncrona para geração de documentos APF
--
-- Problema resolvido:
--   A Edge Function apf-generate chama a IA de forma síncrona.
--   Com 10 usuários gerando APF simultaneamente, são 10 conexões
--   HTTP presas por até 15s cada, esgotando o pool do Supabase.
--
-- Solução:
--   1. Frontend enfileira um job → recebe job_id imediatamente
--   2. Edge Function worker (process-apf-job) processa 1 job por vez
--      com SELECT FOR UPDATE SKIP LOCKED (sem concorrência no banco)
--   3. Frontend observa apf_jobs via Realtime → atualiza UI quando done
--
-- FSM de status:
--   pending → processing → done
--                        ↘ failed (retenta até max_attempts)
--                                ↘ dead (esgotou tentativas)
-- ============================================================

CREATE TABLE IF NOT EXISTS apf_jobs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  generation_id   uuid        REFERENCES apf_generations(id) ON DELETE SET NULL,
  type            text        NOT NULL DEFAULT 'generate_apf'
                              CHECK (type IN ('generate_apf')),
  payload         jsonb       NOT NULL DEFAULT '{}',
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','processing','done','failed','dead')),
  result          jsonb,
  error_message   text,
  attempts        int         NOT NULL DEFAULT 0,
  max_attempts    int         NOT NULL DEFAULT 3,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now()
);

-- Índice primário: worker busca pending ordenado por prioridade (FIFO)
CREATE INDEX IF NOT EXISTS idx_apf_jobs_pending
  ON apf_jobs (next_attempt_at ASC)
  WHERE status = 'pending';

-- Índice para frontend: polling por generation_id via Realtime
CREATE INDEX IF NOT EXISTS idx_apf_jobs_generation
  ON apf_jobs (generation_id)
  WHERE generation_id IS NOT NULL;

-- Índice para listagem por time
CREATE INDEX IF NOT EXISTS idx_apf_jobs_team_status
  ON apf_jobs (team_id, status, created_at DESC);

-- Índice para limpeza de jobs antigos (cron futuro)
CREATE INDEX IF NOT EXISTS idx_apf_jobs_finished
  ON apf_jobs (finished_at)
  WHERE finished_at IS NOT NULL;

-- RLS: usuário só vê jobs do próprio time
ALTER TABLE apf_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apf_jobs_team_select" ON apf_jobs
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "apf_jobs_team_insert" ON apf_jobs
  FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Worker (service role) pode ler e atualizar qualquer job
CREATE POLICY "apf_jobs_service_all" ON apf_jobs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Realtime habilitado para a tabela (frontend recebe updates)
ALTER PUBLICATION supabase_realtime ADD TABLE apf_jobs;

COMMENT ON TABLE apf_jobs IS
  'Fila assíncrona para geração de documentos APF via IA. '
  'Desacopla chamadas à IA (3-15s) do ciclo HTTP do frontend. '
  'Worker: supabase/functions/process-apf-job/index.ts';
