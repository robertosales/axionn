-- ============================================================
-- MIGRATION: rdm_deployment_tasks
-- Tarefas de implantação vinculadas a uma RDM
-- ============================================================

CREATE TABLE IF NOT EXISTS rdm_deployment_tasks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rdm_id          uuid        NOT NULL REFERENCES rdms(id) ON DELETE CASCADE,
  categoria       text        NOT NULL
                    CHECK (categoria IN ('pre_implantacao', 'execucao', 'pos_implantacao')),
  titulo          text        NOT NULL,
  descricao       text,
  responsavel_id  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  status          text        NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'bloqueado')),
  concluido_em    timestamptz,
  ordem           integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rdm_deployment_tasks_rdm_id    ON rdm_deployment_tasks (rdm_id);
CREATE INDEX IF NOT EXISTS idx_rdm_deployment_tasks_categoria ON rdm_deployment_tasks (rdm_id, categoria);
CREATE INDEX IF NOT EXISTS idx_rdm_deployment_tasks_status    ON rdm_deployment_tasks (status);

-- Trigger updated_at
CREATE TRIGGER trg_rdm_deployment_tasks_updated_at
  BEFORE UPDATE ON rdm_deployment_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE rdm_deployment_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rdm_deployment_tasks_admin"  ON rdm_deployment_tasks;
DROP POLICY IF EXISTS "rdm_deployment_tasks_select" ON rdm_deployment_tasks;
DROP POLICY IF EXISTS "rdm_deployment_tasks_write"  ON rdm_deployment_tasks;

CREATE POLICY "rdm_deployment_tasks_admin" ON rdm_deployment_tasks
  FOR ALL USING (is_admin());

CREATE POLICY "rdm_deployment_tasks_select" ON rdm_deployment_tasks
  FOR SELECT USING (
    rdm_id IN (
      SELECT id FROM rdms
       WHERE team_id = ANY(SELECT fn_rdm_user_team_ids())
    )
  );

CREATE POLICY "rdm_deployment_tasks_write" ON rdm_deployment_tasks
  FOR ALL USING (
    rdm_id IN (
      SELECT id FROM rdms
       WHERE team_id = ANY(SELECT fn_rdm_user_team_ids())
    )
    AND (
      is_admin()
      OR fn_rdm_has_permission('rdm.edit')
      OR fn_rdm_has_permission('rdm.execute')
    )
  );
