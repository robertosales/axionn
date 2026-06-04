-- ============================================================
-- MIGRATION: Fix fn_sla_dashboard_batch
-- Filtra apenas times com module = 'sustentacao'.
-- Times de sala_agil não têm SLA contratual.
--
-- Lógica do modelo:
--   CONTRATO → PROJETOS → SALAS DE SUSTENTAÇÃO (com SLA)
--                       → SALAS ÁGEIS         (sem SLA)
-- ============================================================

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
    SELECT
      d.id,
      d.titulo,
      d.situacao,
      d.sla,
      d.team_id,
      COALESCE(d.project_id,  t.project_id)                    AS project_id,
      COALESCE(d.contract_id, t.contract_id, proj.contract_id) AS contract_id
    FROM   public.demandas  d
    -- Só times de sustentação têm SLA contratual
    JOIN   public.teams     t    ON t.id    = d.team_id AND t.module = 'sustentacao'
    LEFT   JOIN public.projects proj ON proj.id = COALESCE(d.project_id, t.project_id)
    WHERE  d.situacao NOT IN ('cancelada')
      AND  (p_team_id     IS NULL OR d.team_id = p_team_id)
      AND  (p_project_id  IS NULL
              OR d.project_id = p_project_id
              OR t.project_id = p_project_id)
      AND  (p_contract_id IS NULL
              OR d.contract_id      = p_contract_id
              OR t.contract_id      = p_contract_id
              OR proj.contract_id   = p_contract_id)
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

  RETURN jsonb_build_object(
    'summary',  v_summary,
    'demandas', v_results
  );
END;
$$;

COMMENT ON FUNCTION public.fn_sla_dashboard_batch IS
  'Calcula SLA de demandas em batch — apenas times com module = sustentacao. '
  'Times de sala_agil não têm SLA contratual e são ignorados. '
  'Retorna summary de compliance + lista de demandas com status SLA individual.';

REVOKE ALL  ON FUNCTION public.fn_sla_dashboard_batch(UUID, UUID, UUID, INT, TEXT, CHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_sla_dashboard_batch(UUID, UUID, UUID, INT, TEXT, CHAR) TO authenticated;

-- Corrige fn_resolve_sla_limits para também só navegar por times de sustentação
CREATE OR REPLACE FUNCTION public.fn_resolve_sla_limits(
  p_demanda_id UUID,
  p_priority   VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  response_minutes   INT,
  resolution_minutes INT,
  business_hours     BOOLEAN,
  source             TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_id  UUID;
  v_sla_field    TEXT;
  v_priority_key TEXT;
  v_sla_row      RECORD;
BEGIN
  SELECT
    COALESCE(d.contract_id, t.contract_id, proj.contract_id),
    d.sla
  INTO v_contract_id, v_sla_field
  FROM  public.demandas  d
  -- Só times de sustentação têm SLA contratual
  JOIN  public.teams     t    ON t.id    = d.team_id AND t.module = 'sustentacao'
  LEFT  JOIN public.projects proj ON proj.id = COALESCE(d.project_id, t.project_id)
  WHERE d.id = p_demanda_id
  LIMIT 1;

  -- Se não encontrou (time não é sustentação), usa fallback legado direto
  IF NOT FOUND THEN
    SELECT d.sla INTO v_sla_field FROM public.demandas d WHERE d.id = p_demanda_id LIMIT 1;
    RETURN QUERY SELECT
      CASE v_sla_field WHEN '24x7' THEN 240  ELSE 1440 END,
      CASE v_sla_field WHEN '24x7' THEN 240  ELSE 1440 END,
      CASE v_sla_field WHEN '24x7' THEN FALSE ELSE TRUE END,
      'legacy_fallback'::TEXT;
    RETURN;
  END IF;

  v_priority_key := COALESCE(
    p_priority,
    CASE v_sla_field
      WHEN '24x7'   THEN 'urgent'
      WHEN 'padrao' THEN 'medium'
      ELSE               'medium'
    END
  );

  IF v_contract_id IS NOT NULL THEN
    SELECT * INTO v_sla_row
    FROM   public.contract_slas
    WHERE  contract_id = v_contract_id
      AND  priority    = v_priority_key
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT
        v_sla_row.response_time_minutes,
        v_sla_row.resolution_time_minutes,
        v_sla_row.business_hours_only,
        'contract_matrix'::TEXT;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT
    CASE v_sla_field WHEN '24x7' THEN 240  ELSE 1440 END,
    CASE v_sla_field WHEN '24x7' THEN 240  ELSE 1440 END,
    CASE v_sla_field WHEN '24x7' THEN FALSE ELSE TRUE END,
    'legacy_fallback'::TEXT;
END;
$$;

REVOKE ALL  ON FUNCTION public.fn_resolve_sla_limits(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_resolve_sla_limits(UUID, VARCHAR) TO authenticated;
