-- ============================================================
-- MIGRATION: Módulo de Contratos & SLAs Dinâmicos (Axion)
-- Data: 2026-06-03
-- Branch: feature/contracts-sla-module
-- NOTA: O sistema usa a tabela public.teams como entidade de sala/time.
--       Não existe public.rooms no schema atual.
-- ============================================================

-- 1. Tabela master de contratos
CREATE TABLE IF NOT EXISTS public.contracts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  status      VARCHAR(50) DEFAULT 'active'
              CHECK (status IN ('active', 'paused', 'terminated')),
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.contracts IS 'Entidade raiz do ecossistema Axion. Governa teams/salas e matrizes de SLA.';

-- 2. Matriz de SLA dinâmico por contrato
CREATE TABLE IF NOT EXISTS public.contract_slas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id             UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  priority                VARCHAR(50) NOT NULL
                          CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  response_time_minutes   INT NOT NULL DEFAULT 60,
  resolution_time_minutes INT NOT NULL DEFAULT 240,
  business_hours_only     BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_contract_priority UNIQUE (contract_id, priority)
);

COMMENT ON TABLE public.contract_slas IS 'Matriz dinâmica de SLA por prioridade. Substitui regras hardcoded no frontend.';

-- 3. Adaptar tabela public.teams para vínculo com contratos (retrocompatível)
--    contract_id nullable garante que teams legados sem contrato continuam funcionando.
--    team_type diferencia times Ágeis de times de Sustentação.
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_type   VARCHAR(50) CHECK (team_type IN ('agile', 'sustenance'));

COMMENT ON COLUMN public.teams.contract_id IS 'FK nullable para compatibilidade com teams legados sem contrato.';
COMMENT ON COLUMN public.teams.team_type   IS 'Tipo do time: agile (sprints/kanban) ou sustenance (chamados/SLA).';

-- 4. Índices de performance
CREATE INDEX IF NOT EXISTS idx_contract_slas_lookup
  ON public.contract_slas (contract_id, priority);

CREATE INDEX IF NOT EXISTS idx_teams_contract
  ON public.teams (contract_id)
  WHERE contract_id IS NOT NULL;

-- 5. Trigger de updated_at automático
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contracts_updated_at ON public.contracts;
CREATE TRIGGER trg_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_contract_slas_updated_at ON public.contract_slas;
CREATE TRIGGER trg_contract_slas_updated_at
  BEFORE UPDATE ON public.contract_slas
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- 6. RPC: calcula status de SLA de um chamado em tempo real
--    Cruza created_at da demanda + prioridade + matriz do contrato vinculado ao team
CREATE OR REPLACE FUNCTION public.fn_check_sla_status(
  p_demanda_id   UUID,
  p_contract_id  UUID,
  p_priority     VARCHAR,
  p_created_at   TIMESTAMPTZ,
  p_now          TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_sla              RECORD;
  v_elapsed_min      NUMERIC;
  v_response_pct     NUMERIC;
  v_resolution_pct   NUMERIC;
BEGIN
  SELECT * INTO v_sla
  FROM public.contract_slas
  WHERE contract_id = p_contract_id
    AND priority    = p_priority
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'status',  'no_sla_configured',
      'message', 'Nenhuma matriz de SLA encontrada para este contrato/prioridade'
    );
  END IF;

  v_elapsed_min    := EXTRACT(EPOCH FROM (p_now - p_created_at)) / 60.0;
  v_response_pct   := ROUND((v_elapsed_min / v_sla.response_time_minutes)   * 100, 1);
  v_resolution_pct := ROUND((v_elapsed_min / v_sla.resolution_time_minutes) * 100, 1);

  RETURN json_build_object(
    'elapsed_minutes',            ROUND(v_elapsed_min),
    'response_limit_minutes',     v_sla.response_time_minutes,
    'resolution_limit_minutes',   v_sla.resolution_time_minutes,
    'response_pct',               v_response_pct,
    'resolution_pct',             v_resolution_pct,
    'response_breached',          v_elapsed_min > v_sla.response_time_minutes,
    'resolution_breached',        v_elapsed_min > v_sla.resolution_time_minutes,
    'business_hours_only',        v_sla.business_hours_only,
    'sla_color',                  CASE
                                    WHEN v_elapsed_min > v_sla.resolution_time_minutes THEN 'red'
                                    WHEN v_resolution_pct >= 85                        THEN 'orange'
                                    WHEN v_resolution_pct >= 60                        THEN 'yellow'
                                    ELSE 'green'
                                  END
  );
END;
$$;

COMMENT ON FUNCTION public.fn_check_sla_status IS
  'RPC chamada pelo frontend para calcular o status de SLA de um chamado,
   cruzando created_at da demanda, prioridade e a matriz do contrato vinculado ao team.';

-- 7. RPC: retorna contrato + SLAs vinculados a um team
CREATE OR REPLACE FUNCTION public.fn_get_team_contract(
  p_team_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'contract_id',     c.id,
    'contract_name',   c.name,
    'contract_status', c.status,
    'team_type',       t.team_type,
    'slas', (
      SELECT json_agg(row_to_json(s))
      FROM public.contract_slas s
      WHERE s.contract_id = c.id
    )
  ) INTO v_result
  FROM public.teams t
  JOIN public.contracts c ON c.id = t.contract_id
  WHERE t.id = p_team_id;

  RETURN COALESCE(v_result, json_build_object('status', 'no_contract_linked'));
END;
$$;

COMMENT ON FUNCTION public.fn_get_team_contract IS
  'Retorna o contrato e toda a matriz de SLAs vinculados a um team específico.';

-- 8. RLS
ALTER TABLE public.contracts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_slas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
CREATE POLICY "contracts_select"
  ON public.contracts FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
CREATE POLICY "contracts_insert"
  ON public.contracts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
CREATE POLICY "contracts_update"
  ON public.contracts FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "slas_select" ON public.contract_slas;
CREATE POLICY "slas_select"
  ON public.contract_slas FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "slas_all" ON public.contract_slas;
CREATE POLICY "slas_all"
  ON public.contract_slas FOR ALL
  USING (auth.role() = 'authenticated');

-- ============================================================
-- FIM DA MIGRATION
-- Para aplicar: supabase db push  OU  executar no SQL Editor
-- ============================================================
