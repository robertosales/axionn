-- ============================================================
-- MIGRATION: Módulo RDM — Reunião de Mudança / Implantação
-- Data: 2026-05-18
-- Descrição: Cria todas as tabelas, índices, triggers, RLS e
--            seeds de permissões para o módulo RDM do Axion.
--            Reutiliza: teams, sprints, user_stories, profiles,
--            user_roles, role_permissions (sem duplicar dados).
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. TABELA PRINCIPAL: rdms
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rdms (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                 text        UNIQUE,                          -- "RDM-2026-0001" gerado por trigger
  nome                   text        NOT NULL,
  objetivo               text        NOT NULL,
  sistema_modulo         text        NOT NULL,

  -- Vínculos com entidades existentes (sem duplicar dados)
  team_id                uuid        NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  sprint_id              uuid        REFERENCES sprints(id) ON DELETE SET NULL,

  tipo_mudanca           text        NOT NULL
                           CHECK (tipo_mudanca IN ('evolutiva', 'corretiva', 'emergencial')),
  risco                  text        NOT NULL
                           CHECK (risco IN ('baixo', 'medio', 'alto')),
  ambiente               text        NOT NULL,

  data_implantacao       date        NOT NULL,
  hora_inicio            time        NOT NULL,
  hora_fim_prevista      time        NOT NULL,
  downtime_previsto      boolean     NOT NULL DEFAULT false,
  rollback_previsto      boolean     NOT NULL DEFAULT false,
  tempo_rollback_minutos integer,
  observacoes            text,

  status                 text        NOT NULL DEFAULT 'rascunho'
                           CHECK (status IN (
                             'rascunho',
                             'em_aprovacao',
                             'aprovada',
                             'em_execucao',
                             'implantada',
                             'rollback_executado',
                             'cancelada'
                           )),

  criado_por             uuid        NOT NULL REFERENCES profiles(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_rdms_team_id         ON rdms (team_id);
CREATE INDEX IF NOT EXISTS idx_rdms_sprint_id        ON rdms (sprint_id);
CREATE INDEX IF NOT EXISTS idx_rdms_status           ON rdms (status);
CREATE INDEX IF NOT EXISTS idx_rdms_data_implantacao ON rdms (data_implantacao);
CREATE INDEX IF NOT EXISTS idx_rdms_criado_por       ON rdms (criado_por);

-- ──────────────────────────────────────────────────────────
-- 2. ITENS DA SPRINT VINCULADOS À RDM (N:N)
--    Referencia user_stories existente — sem duplicar HUs
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rdm_sprint_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdm_id          uuid NOT NULL REFERENCES rdms(id) ON DELETE CASCADE,
  user_story_id   uuid NOT NULL REFERENCES user_stories(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rdm_id, user_story_id)
);

CREATE INDEX IF NOT EXISTS idx_rdm_sprint_items_rdm_id          ON rdm_sprint_items (rdm_id);
CREATE INDEX IF NOT EXISTS idx_rdm_sprint_items_user_story_id   ON rdm_sprint_items (user_story_id);

-- ──────────────────────────────────────────────────────────
-- 3. PARTICIPANTES DA RDM
--    Reutiliza profiles — zero cadastro paralelo de usuário
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rdm_participantes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdm_id      uuid NOT NULL REFERENCES rdms(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  papel       text NOT NULL
                CHECK (papel IN (
                  'arquiteto',
                  'scrum_master',
                  'ad',
                  'desenvolvedor',
                  'product_owner',
                  'requisitos'
                )),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rdm_id, profile_id, papel)
);

CREATE INDEX IF NOT EXISTS idx_rdm_participantes_rdm_id     ON rdm_participantes (rdm_id);
CREATE INDEX IF NOT EXISTS idx_rdm_participantes_profile_id ON rdm_participantes (profile_id);

-- ──────────────────────────────────────────────────────────
-- 4. CHECKLIST OPERACIONAL
--    Pré-implantação | Execução | Pós-implantação
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rdm_checklist_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rdm_id          uuid        NOT NULL REFERENCES rdms(id) ON DELETE CASCADE,
  categoria       text        NOT NULL
                    CHECK (categoria IN ('pre_implantacao', 'execucao', 'pos_implantacao')),
  descricao       text        NOT NULL,
  responsavel_id  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  status          text        NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'nao_aplicavel')),
  concluido_em    timestamptz,
  comentario      text,
  evidencia_url   text,
  ordem           integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rdm_checklist_rdm_id    ON rdm_checklist_items (rdm_id);
CREATE INDEX IF NOT EXISTS idx_rdm_checklist_categoria ON rdm_checklist_items (rdm_id, categoria);

-- ──────────────────────────────────────────────────────────
-- 5. GO / NO-GO — Aprovação formal da implantação
--    Aprovadores: arquiteto | product_owner | ad
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rdm_gonogo (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rdm_id        uuid        NOT NULL REFERENCES rdms(id) ON DELETE CASCADE,
  profile_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  papel         text        NOT NULL
                  CHECK (papel IN ('arquiteto', 'product_owner', 'ad')),
  decisao       text        NOT NULL
                  CHECK (decisao IN ('go', 'no_go')),
  comentario    text,
  justificativa text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rdm_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_rdm_gonogo_rdm_id     ON rdm_gonogo (rdm_id);
CREATE INDEX IF NOT EXISTS idx_rdm_gonogo_profile_id ON rdm_gonogo (profile_id);

-- ──────────────────────────────────────────────────────────
-- 6. AUDITORIA — histórico completo de alterações
--    Toda mudança em rdms é registrada via trigger
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rdm_audit_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rdm_id         uuid        NOT NULL REFERENCES rdms(id) ON DELETE CASCADE,
  profile_id     uuid        NOT NULL REFERENCES profiles(id),
  campo          text        NOT NULL,
  valor_anterior text,
  valor_novo     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rdm_audit_rdm_id  ON rdm_audit_log (rdm_id);
CREATE INDEX IF NOT EXISTS idx_rdm_audit_created ON rdm_audit_log (created_at DESC);

-- ──────────────────────────────────────────────────────────
-- 7. TRIGGERS
-- ──────────────────────────────────────────────────────────

-- 7a. updated_at automático em rdms
CREATE OR REPLACE FUNCTION fn_rdm_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rdms_updated_at ON rdms;
CREATE TRIGGER trg_rdms_updated_at
  BEFORE UPDATE ON rdms
  FOR EACH ROW EXECUTE FUNCTION fn_rdm_set_updated_at();

-- updated_at em checklist items
DROP TRIGGER IF EXISTS trg_checklist_updated_at ON rdm_checklist_items;
CREATE TRIGGER trg_checklist_updated_at
  BEFORE UPDATE ON rdm_checklist_items
  FOR EACH ROW EXECUTE FUNCTION fn_rdm_set_updated_at();

-- 7b. Geração automática do código RDM: "RDM-YYYY-NNNN"
CREATE OR REPLACE FUNCTION fn_rdm_generate_codigo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  seq_num  integer;
  ano_atual text;
BEGIN
  ano_atual := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1
    INTO seq_num
    FROM rdms
   WHERE to_char(created_at, 'YYYY') = ano_atual;
  NEW.codigo := 'RDM-' || ano_atual || '-' || lpad(seq_num::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rdms_codigo ON rdms;
CREATE TRIGGER trg_rdms_codigo
  BEFORE INSERT ON rdms
  FOR EACH ROW
  WHEN (NEW.codigo IS NULL)
  EXECUTE FUNCTION fn_rdm_generate_codigo();

-- 7c. Auditoria automática de mudanças no status da RDM
--     Registra toda alteração de status no rdm_audit_log
CREATE OR REPLACE FUNCTION fn_rdm_audit_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO rdm_audit_log (rdm_id, profile_id, campo, valor_anterior, valor_novo)
    VALUES (
      NEW.id,
      NEW.criado_por,   -- responsável pela sessão; frontend pode sobrescrever via RPC se necessário
      'status',
      OLD.status,
      NEW.status
    );
  END IF;

  IF OLD.risco IS DISTINCT FROM NEW.risco THEN
    INSERT INTO rdm_audit_log (rdm_id, profile_id, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, NEW.criado_por, 'risco', OLD.risco, NEW.risco);
  END IF;

  IF OLD.data_implantacao IS DISTINCT FROM NEW.data_implantacao THEN
    INSERT INTO rdm_audit_log (rdm_id, profile_id, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, NEW.criado_por, 'data_implantacao',
            OLD.data_implantacao::text, NEW.data_implantacao::text);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rdms_audit ON rdms;
CREATE TRIGGER trg_rdms_audit
  AFTER UPDATE ON rdms
  FOR EACH ROW EXECUTE FUNCTION fn_rdm_audit_status();

-- ──────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY (RLS)
--    Padrão exato das migrations existentes:
--    usa is_admin() já definida no banco
-- ──────────────────────────────────────────────────────────
ALTER TABLE rdms                ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdm_sprint_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdm_participantes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdm_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdm_gonogo          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdm_audit_log       ENABLE ROW LEVEL SECURITY;

-- ── rdms ──
DROP POLICY IF EXISTS "rdms_admin_all"     ON rdms;
DROP POLICY IF EXISTS "rdms_team_select"   ON rdms;
DROP POLICY IF EXISTS "rdms_team_insert"   ON rdms;
DROP POLICY IF EXISTS "rdms_team_update"   ON rdms;

CREATE POLICY "rdms_admin_all" ON rdms
  FOR ALL USING (is_admin());

-- Qualquer membro do time vê as RDMs do seu time
CREATE POLICY "rdms_team_select" ON rdms
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE user_id = auth.uid() AND team_id IS NOT NULL
    )
  );

-- Criar RDM exige permission rdm.create
CREATE POLICY "rdms_team_insert" ON rdms
  FOR INSERT WITH CHECK (
    is_admin() OR EXISTS (
      SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON rp.role_name = ur.role
       WHERE ur.user_id = auth.uid()
         AND rp.permission_key = 'rdm.create'
    )
  );

-- Editar RDM exige permission rdm.edit e pertencer ao time
CREATE POLICY "rdms_team_update" ON rdms
  FOR UPDATE USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE user_id = auth.uid() AND team_id IS NOT NULL
    )
    AND (
      is_admin() OR EXISTS (
        SELECT 1
          FROM user_roles ur
          JOIN role_permissions rp ON rp.role_name = ur.role
         WHERE ur.user_id = auth.uid()
           AND rp.permission_key = 'rdm.edit'
      )
    )
  );

-- ── rdm_sprint_items ──
DROP POLICY IF EXISTS "rdm_sprint_items_admin"  ON rdm_sprint_items;
DROP POLICY IF EXISTS "rdm_sprint_items_select" ON rdm_sprint_items;
DROP POLICY IF EXISTS "rdm_sprint_items_write"  ON rdm_sprint_items;

CREATE POLICY "rdm_sprint_items_admin"  ON rdm_sprint_items FOR ALL    USING (is_admin());
CREATE POLICY "rdm_sprint_items_select" ON rdm_sprint_items FOR SELECT USING (
  rdm_id IN (SELECT id FROM rdms WHERE team_id IN (
    SELECT team_id FROM profiles WHERE user_id = auth.uid() AND team_id IS NOT NULL
  ))
);
CREATE POLICY "rdm_sprint_items_write" ON rdm_sprint_items FOR INSERT WITH CHECK (
  rdm_id IN (SELECT id FROM rdms WHERE team_id IN (
    SELECT team_id FROM profiles WHERE user_id = auth.uid() AND team_id IS NOT NULL
  ))
);

-- ── rdm_participantes ──
DROP POLICY IF EXISTS "rdm_participantes_admin"  ON rdm_participantes;
DROP POLICY IF EXISTS "rdm_participantes_select" ON rdm_participantes;
DROP POLICY IF EXISTS "rdm_participantes_write"  ON rdm_participantes;

CREATE POLICY "rdm_participantes_admin"  ON rdm_participantes FOR ALL    USING (is_admin());
CREATE POLICY "rdm_participantes_select" ON rdm_participantes FOR SELECT USING (
  rdm_id IN (SELECT id FROM rdms WHERE team_id IN (
    SELECT team_id FROM profiles WHERE user_id = auth.uid() AND team_id IS NOT NULL
  ))
);
CREATE POLICY "rdm_participantes_write" ON rdm_participantes FOR INSERT WITH CHECK (
  rdm_id IN (SELECT id FROM rdms WHERE team_id IN (
    SELECT team_id FROM profiles WHERE user_id = auth.uid() AND team_id IS NOT NULL
  ))
);

-- ── rdm_checklist_items ──
DROP POLICY IF EXISTS "rdm_checklist_admin"  ON rdm_checklist_items;
DROP POLICY IF EXISTS "rdm_checklist_select" ON rdm_checklist_items;
DROP POLICY IF EXISTS "rdm_checklist_write"  ON rdm_checklist_items;

CREATE POLICY "rdm_checklist_admin"  ON rdm_checklist_items FOR ALL    USING (is_admin());
CREATE POLICY "rdm_checklist_select" ON rdm_checklist_items FOR SELECT USING (
  rdm_id IN (SELECT id FROM rdms WHERE team_id IN (
    SELECT team_id FROM profiles WHERE user_id = auth.uid() AND team_id IS NOT NULL
  ))
);
CREATE POLICY "rdm_checklist_write" ON rdm_checklist_items
  FOR ALL USING (
    rdm_id IN (SELECT id FROM rdms WHERE team_id IN (
      SELECT team_id FROM profiles WHERE user_id = auth.uid() AND team_id IS NOT NULL
    ))
    AND (
      is_admin() OR EXISTS (
        SELECT 1
          FROM user_roles ur
          JOIN role_permissions rp ON rp.role_name = ur.role
         WHERE ur.user_id = auth.uid()
           AND rp.permission_key IN ('rdm.edit', 'rdm.execute')
      )
    )
  );

-- ── rdm_gonogo ──
DROP POLICY IF EXISTS "rdm_gonogo_admin"  ON rdm_gonogo;
DROP POLICY IF EXISTS "rdm_gonogo_select" ON rdm_gonogo;
DROP POLICY IF EXISTS "rdm_gonogo_insert" ON rdm_gonogo;

CREATE POLICY "rdm_gonogo_admin"  ON rdm_gonogo FOR ALL    USING (is_admin());
CREATE POLICY "rdm_gonogo_select" ON rdm_gonogo FOR SELECT USING (
  rdm_id IN (SELECT id FROM rdms WHERE team_id IN (
    SELECT team_id FROM profiles WHERE user_id = auth.uid() AND team_id IS NOT NULL
  ))
);
CREATE POLICY "rdm_gonogo_insert" ON rdm_gonogo FOR INSERT WITH CHECK (
  is_admin() OR EXISTS (
    SELECT 1
      FROM user_roles ur
      JOIN role_permissions rp ON rp.role_name = ur.role
     WHERE ur.user_id = auth.uid()
       AND rp.permission_key = 'rdm.approve'
  )
);

-- ── rdm_audit_log ──
DROP POLICY IF EXISTS "rdm_audit_admin"  ON rdm_audit_log;
DROP POLICY IF EXISTS "rdm_audit_select" ON rdm_audit_log;

CREATE POLICY "rdm_audit_admin"  ON rdm_audit_log FOR ALL    USING (is_admin());
CREATE POLICY "rdm_audit_select" ON rdm_audit_log FOR SELECT USING (
  rdm_id IN (SELECT id FROM rdms WHERE team_id IN (
    SELECT team_id FROM profiles WHERE user_id = auth.uid() AND team_id IS NOT NULL
  ))
);
-- Auditoria: INSERT permitido ao próprio sistema (trigger SECURITY DEFINER) e admins
CREATE POLICY "rdm_audit_insert" ON rdm_audit_log FOR INSERT
  WITH CHECK (is_admin() OR profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- ──────────────────────────────────────────────────────────
-- 9. SEEDS DE PERMISSÕES
--    Insere permission keys para cada role existente.
--    ON CONFLICT DO NOTHING garante idempotência.
-- ──────────────────────────────────────────────────────────
INSERT INTO role_permissions (role_name, permission_key) VALUES
  -- Admin: acesso total
  ('admin',         'rdm.view'),
  ('admin',         'rdm.create'),
  ('admin',         'rdm.edit'),
  ('admin',         'rdm.approve'),
  ('admin',         'rdm.execute'),
  ('admin',         'rdm.admin'),

  -- Arquiteto: responsável técnico — cria, edita, aprova
  ('architect',     'rdm.view'),
  ('architect',     'rdm.create'),
  ('architect',     'rdm.edit'),
  ('architect',     'rdm.approve'),

  -- Scrum Master: facilitador — cria e edita
  ('scrum_master',  'rdm.view'),
  ('scrum_master',  'rdm.create'),
  ('scrum_master',  'rdm.edit'),

  -- Product Owner: aceite de negócio — visualiza e aprova
  ('product_owner', 'rdm.view'),
  ('product_owner', 'rdm.approve'),

  -- Analista de Requisitos: validação funcional — visualiza e aprova
  ('analyst',       'rdm.view'),
  ('analyst',       'rdm.approve'),

  -- Desenvolvedor: execução técnica
  ('developer',     'rdm.view'),
  ('developer',     'rdm.execute'),

  -- QA Analyst: validação — visualiza e executa checklist
  ('qa_analyst',    'rdm.view'),
  ('qa_analyst',    'rdm.execute'),

  -- Member: visualização
  ('member',        'rdm.view')

ON CONFLICT (role_name, permission_key) DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 10. CHECKLIST PADRÃO — seed dos itens padrão
--     Não vinculados a uma RDM (template_id = NULL).
--     Serão copiados para cada nova RDM via function RPC.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rdm_checklist_templates (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria   text    NOT NULL
                CHECK (categoria IN ('pre_implantacao', 'execucao', 'pos_implantacao')),
  descricao   text    NOT NULL,
  ordem       integer NOT NULL DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true
);

INSERT INTO rdm_checklist_templates (categoria, descricao, ordem) VALUES
  -- Pré-implantação
  ('pre_implantacao', 'Requisitos aprovados e homologados',              10),
  ('pre_implantacao', 'Homologação concluída e validada',                20),
  ('pre_implantacao', 'Script de banco validado em ambiente de teste',   30),
  ('pre_implantacao', 'Procedimento de rollback documentado',            40),
  ('pre_implantacao', 'Backup do ambiente de produção confirmado',       50),
  ('pre_implantacao', 'Comunicação de janela enviada aos usuários',      60),
  ('pre_implantacao', 'Dependências externas verificadas',               70),

  -- Execução
  ('execucao',        'Execução do script de banco de dados',            10),
  ('execucao',        'Deploy da aplicação realizado',                   20),
  ('execucao',        'Restart dos serviços executado',                  30),
  ('execucao',        'Smoke test técnico realizado',                    40),
  ('execucao',        'Smoke test funcional realizado',                  50),
  ('execucao',        'Validação de negócio concluída',                  60),

  -- Pós-implantação
  ('pos_implantacao', 'Logs da aplicação verificados',                   10),
  ('pos_implantacao', 'Monitoramento e alertas validados',               20),
  ('pos_implantacao', 'Aceite formal do negócio registrado',             30),
  ('pos_implantacao', 'Encerramento da janela comunicado',               40)

ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 11. RPC: fn_rdm_criar_com_checklist
--     Cria uma RDM e popula o checklist padrão atomicamente
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_rdm_criar_com_checklist(
  p_nome                   text,
  p_objetivo               text,
  p_sistema_modulo         text,
  p_team_id                uuid,
  p_sprint_id              uuid,
  p_tipo_mudanca           text,
  p_risco                  text,
  p_ambiente               text,
  p_data_implantacao       date,
  p_hora_inicio            time,
  p_hora_fim_prevista      time,
  p_downtime_previsto      boolean,
  p_rollback_previsto      boolean,
  p_tempo_rollback_minutos integer,
  p_observacoes            text,
  p_criado_por             uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rdm_id uuid;
BEGIN
  -- Insere a RDM (trigger gera o código automaticamente)
  INSERT INTO rdms (
    nome, objetivo, sistema_modulo, team_id, sprint_id,
    tipo_mudanca, risco, ambiente,
    data_implantacao, hora_inicio, hora_fim_prevista,
    downtime_previsto, rollback_previsto, tempo_rollback_minutos,
    observacoes, criado_por
  ) VALUES (
    p_nome, p_objetivo, p_sistema_modulo, p_team_id, p_sprint_id,
    p_tipo_mudanca, p_risco, p_ambiente,
    p_data_implantacao, p_hora_inicio, p_hora_fim_prevista,
    p_downtime_previsto, p_rollback_previsto, p_tempo_rollback_minutos,
    p_observacoes, p_criado_por
  )
  RETURNING id INTO v_rdm_id;

  -- Copia o checklist padrão para a nova RDM
  INSERT INTO rdm_checklist_items (rdm_id, categoria, descricao, ordem)
  SELECT v_rdm_id, categoria, descricao, ordem
    FROM rdm_checklist_templates
   WHERE ativo = true
   ORDER BY categoria, ordem;

  RETURN v_rdm_id;
END;
$$;

-- ──────────────────────────────────────────────────────────
-- 12. RPC: fn_rdm_dashboard_kpis
--     Retorna KPIs agregados para o Dashboard RDM
--     Filtra por team_id e período opcional
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_rdm_dashboard_kpis(
  p_team_id  uuid    DEFAULT NULL,
  p_inicio   date    DEFAULT (date_trunc('month', now()))::date,
  p_fim      date    DEFAULT now()::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'em_andamento',       COUNT(*) FILTER (WHERE status IN ('em_aprovacao', 'aprovada', 'em_execucao')),
    'proximas',           COUNT(*) FILTER (WHERE status IN ('rascunho', 'em_aprovacao', 'aprovada')
                                             AND data_implantacao >= now()::date),
    'atrasadas',          COUNT(*) FILTER (WHERE data_implantacao < now()::date
                                             AND status NOT IN ('implantada', 'rollback_executado', 'cancelada')),
    'rollback_executado', COUNT(*) FILTER (WHERE status = 'rollback_executado'),
    'total_periodo',      COUNT(*) FILTER (WHERE data_implantacao BETWEEN p_inicio AND p_fim),
    'implantadas_periodo',COUNT(*) FILTER (WHERE status = 'implantada'
                                             AND data_implantacao BETWEEN p_inicio AND p_fim),
    'taxa_sucesso',       ROUND(
                            CASE WHEN COUNT(*) FILTER (WHERE status IN ('implantada','rollback_executado')
                                                         AND data_implantacao BETWEEN p_inicio AND p_fim) = 0
                                 THEN 0
                                 ELSE
                                   COUNT(*) FILTER (WHERE status = 'implantada'
                                                     AND data_implantacao BETWEEN p_inicio AND p_fim)::numeric
                                   / COUNT(*) FILTER (WHERE status IN ('implantada','rollback_executado')
                                                       AND data_implantacao BETWEEN p_inicio AND p_fim)::numeric
                                   * 100
                            END, 1
                          )
  )
  INTO v_result
  FROM rdms
  WHERE (p_team_id IS NULL OR team_id = p_team_id);

  RETURN v_result;
END;
$$;

-- ──────────────────────────────────────────────────────────
-- FIM DA MIGRATION
-- Tabelas criadas:
--   rdms
--   rdm_sprint_items
--   rdm_participantes
--   rdm_checklist_items
--   rdm_checklist_templates
--   rdm_gonogo
--   rdm_audit_log
-- Functions:
--   fn_rdm_set_updated_at        (trigger updated_at)
--   fn_rdm_generate_codigo       (trigger geração código RDM)
--   fn_rdm_audit_status          (trigger auditoria status)
--   fn_rdm_criar_com_checklist   (RPC criação atômica)
--   fn_rdm_dashboard_kpis        (RPC KPIs dashboard)
-- ──────────────────────────────────────────────────────────
