-- ============================================================
-- MIGRATION: HU-001 — Governança de Contratos Híbridos
-- Data: 2026-06-03
--
-- O QUE MUDA:
--   1. contracts.room_mode    — modalidade do contrato (agil/sustentacao/hibrido)
--   2. projects.room_type     — tipo da sala do projeto (agil/sustentacao)
--   3. contract_room_teams    — vínculo N:N times×salas (substitui teams.project_id
--                               como mecanismo de vínculo contratual)
--   4. contract_audit_log     — log de auditoria de alterações (DoD)
--
-- RETROCOMPATIBILIDADE:
--   • teams.project_id continua existindo (usado pelo sistema ágil)
--   • room_mode DEFAULT 'sustentacao' para contratos existentes
--   • room_type DEFAULT 'sustentacao' para projetos existentes
-- ============================================================

-- 1. room_mode no contrato
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS room_mode TEXT
    NOT NULL DEFAULT 'sustentacao'
    CHECK (room_mode IN ('agil','sustentacao','hibrido'));

COMMENT ON COLUMN public.contracts.room_mode IS
  'Modalidade do contrato: agil | sustentacao | hibrido. '
  'Define se a matriz de SLA é obrigatória (RN03).';

-- 2. room_type no projeto
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS room_type TEXT
    NOT NULL DEFAULT 'sustentacao'
    CHECK (room_type IN ('agil','sustentacao'));

COMMENT ON COLUMN public.projects.room_type IS
  'Tipo da sala do projeto: agil | sustentacao. '
  'Permite projetos homônimos em salas diferentes (RN05).';

-- Índice unique que permite nomes duplicados entre salas diferentes (RN05)
CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_name_room_type_contract
  ON public.projects (contract_id, name, room_type);

-- 3. Tabela de vínculo N:N contrato × time × sala (RN04)
CREATE TABLE IF NOT EXISTS public.contract_room_teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id)  ON DELETE CASCADE,
  team_id     UUID NOT NULL REFERENCES public.teams(id)      ON DELETE CASCADE,
  room_type   TEXT NOT NULL CHECK (room_type IN ('agil','sustentacao')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contract_id, team_id, room_type)
);

COMMENT ON TABLE public.contract_room_teams IS
  'Vínculo N:N entre contratos, times e tipos de sala. '
  'Permite que o mesmo time esteja na sala ágil E na sala de sustentação (RN04).';

CREATE INDEX IF NOT EXISTS idx_crt_contract ON public.contract_room_teams(contract_id);
CREATE INDEX IF NOT EXISTS idx_crt_team     ON public.contract_room_teams(team_id);

-- RLS
ALTER TABLE public.contract_room_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage contract_room_teams"
  ON public.contract_room_teams FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members view contract_room_teams"
  ON public.contract_room_teams FOR SELECT
  USING (true);

-- 4. Log de auditoria de contratos (DoD)
CREATE TABLE IF NOT EXISTS public.contract_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  admin_id    UUID NOT NULL REFERENCES auth.users(id),
  action      TEXT NOT NULL,  -- 'created' | 'updated' | 'sla_updated' | 'team_linked' | 'team_unlinked'
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contract_audit_log IS
  'Auditoria de alterações em contratos. Registra admin, ação e payload (DoD HU-001).';

CREATE INDEX IF NOT EXISTS idx_cal_contract ON public.contract_audit_log(contract_id);
CREATE INDEX IF NOT EXISTS idx_cal_admin    ON public.contract_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_cal_created  ON public.contract_audit_log(created_at DESC);

ALTER TABLE public.contract_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage audit_log"
  ON public.contract_audit_log FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Atualiza fn_sla_dashboard_batch para usar contract_room_teams
--    (mantém compatibilidade com teams.project_id como fallback)
CREATE OR REPLACE FUNCTION public.fn_sla_dashboard_batch(
  p_team_id      UUID    DEFAULT NULL,
  p_project_id   UUID    DEFAULT NULL,
  p_contract_id  UUID    DEFAULT NULL,
  p_limit        INT     DEFAULT 100,
  p_regime       TEXT    DEFAULT 'padrao',
  p_uf           CHAR(2) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demanda   RECORD;
  v_sla_row   JSONB;
  v_results   JSONB := '[]'::JSONB;
  v_summary   JSONB;
  v_total     INT := 0;
  v_dentro    INT := 0;
  v_em_risco  INT := 0;
  v_violado   INT := 0;
  v_concluido INT := 0;
BEGIN
  FOR v_demanda IN
    SELECT DISTINCT
      d.id,
      d.titulo,
      d.situacao,
      d.sla,
      d.team_id,
      COALESCE(d.project_id,  t.project_id)                    AS project_id,
      COALESCE(d.contract_id, t.contract_id, proj.contract_id,
               crt.contract_id)                                 AS contract_id
    FROM   public.demandas           d
    -- Só times de sustentação (module legado)
    JOIN   public.teams              t    ON t.id    = d.team_id
                                         AND t.module = 'sustentacao'
    LEFT   JOIN public.projects      proj ON proj.id = COALESCE(d.project_id, t.project_id)
    -- Novo vínculo via contract_room_teams (sustentação)
    LEFT   JOIN public.contract_room_teams crt
                                          ON crt.team_id   = d.team_id
                                         AND crt.room_type = 'sustentacao'
    WHERE  d.situacao NOT IN ('cancelada')
      AND  (p_team_id     IS NULL OR d.team_id = p_team_id)
      AND  (p_project_id  IS NULL
              OR d.project_id = p_project_id
              OR t.project_id = p_project_id)
      AND  (p_contract_id IS NULL
              OR d.contract_id      = p_contract_id
              OR t.contract_id      = p_contract_id
              OR proj.contract_id   = p_contract_id
              OR crt.contract_id    = p_contract_id)
    ORDER  BY d.created_at DESC
    LIMIT  p_limit
  LOOP
    v_sla_row := public.calc_sla_demanda(v_demanda.id, p_regime, p_uf);
    v_total := v_total + 1;
    CASE v_sla_row->>'statusSLA'
      WHEN 'dentro'    THEN v_dentro    := v_dentro    + 1;
      WHEN 'em_risco'  THEN v_em_risco  := v_em_risco  + 1;
      WHEN 'violado'   THEN v_violado   := v_violado   + 1;
      WHEN 'concluido' THEN v_concluido := v_concluido + 1;
      ELSE NULL;
    END CASE;
    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'demandaId',       v_demanda.id,
        'titulo',          v_demanda.titulo,
        'situacao',        v_demanda.situacao,
        'teamId',          v_demanda.team_id,
        'projectId',       v_demanda.project_id,
        'contractId',      v_demanda.contract_id,
        'horasAcumuladas', v_sla_row->'horasAcumuladas',
        'prazoHoras',      v_sla_row->'prazoHoras',
        'statusSLA',       v_sla_row->>'statusSLA',
        'resolutionPct',   v_sla_row->'resolutionPct',
        'slaColor',        v_sla_row->>'slaColor',
        'slaSource',       v_sla_row->>'slaSource'
      )
    );
  END LOOP;

  v_summary := jsonb_build_object(
    'total',          v_total,
    'dentro',         v_dentro,
    'em_risco',       v_em_risco,
    'violado',        v_violado,
    'concluido',      v_concluido,
    'compliance_pct', CASE WHEN v_total > 0
                        THEN ROUND(((v_dentro + v_concluido)::NUMERIC / v_total) * 100, 1)
                        ELSE 0
                      END
  );

  RETURN jsonb_build_object('summary', v_summary, 'demandas', v_results);
END;
$$;

REVOKE ALL  ON FUNCTION public.fn_sla_dashboard_batch(UUID,UUID,UUID,INT,TEXT,CHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_sla_dashboard_batch(UUID,UUID,UUID,INT,TEXT,CHAR) TO authenticated;

-- ============================================================
-- FIM DA MIGRATION HU-001 Fase A
-- Próximo: Fase B — ContractForm wizard 3 passos + services
-- ============================================================
