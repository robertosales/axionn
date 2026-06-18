-- MIGRATION: Restore fn_get_team_contract (HU-001 / Fix Sustentacao Dashboard)
-- Fixes the issue where the dashboard cannot find the contract automatically
-- after the function was dropped in phase1 foundation.

CREATE OR REPLACE FUNCTION public.fn_get_team_contract(
  p_team_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Busca o contrato vinculado ao time via contract_room_teams (preferencialmente sustentacao)
  SELECT jsonb_build_object(
    'contract_id',     c.id,
    'contract_name',   c.name,
    'contract_status', c.status,
    'room_type',       crt.room_type,
    'slas', (
      SELECT jsonb_agg(to_jsonb(s))
      FROM public.contract_slas s
      WHERE s.contract_id = c.id
    )
  ) INTO v_result
  FROM public.contract_room_teams crt
  JOIN public.contracts c ON c.id = crt.contract_id
  WHERE crt.team_id = p_team_id
    AND crt.room_type = 'sustentacao'
    AND crt.is_active = true
  LIMIT 1;

  -- Fallback para qualquer sala se não houver 'sustentacao' específica
  IF v_result IS NULL THEN
    SELECT jsonb_build_object(
      'contract_id',     c.id,
      'contract_name',   c.name,
      'contract_status', c.status,
      'room_type',       crt.room_type,
      'slas', (
        SELECT jsonb_agg(to_jsonb(s))
        FROM public.contract_slas s
        WHERE s.contract_id = c.id
      )
    ) INTO v_result
    FROM public.contract_room_teams crt
    JOIN public.contracts c ON c.id = crt.contract_id
    WHERE crt.team_id = p_team_id
      AND crt.is_active = true
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_result, jsonb_build_object('status', 'no_contract_linked'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_team_contract(UUID) TO authenticated;

COMMENT ON FUNCTION public.fn_get_team_contract IS
  'Retorna o contrato e a matriz de SLAs vinculado ao time via contract_room_teams. '
  'Prioriza a sala de sustentação para conformidade com o Dashboard.';

-- Também restaura fn_sla_status_summary para garantir que ela filtra por contrato corretamente
-- conforme o dashboard espera na seção de SLA.
CREATE OR REPLACE FUNCTION public.fn_sla_status_summary(
  p_contract_id UUID DEFAULT NULL,
  p_project_id  UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total',          COUNT(*),
    'concluido',      COUNT(*) FILTER (WHERE situacao = 'aceite_final'),
    'ativo',          COUNT(*) FILTER (WHERE situacao NOT IN ('aceite_final','cancelada')),
    'compliance_pct', ROUND(
                        COUNT(*) FILTER (WHERE situacao = 'aceite_final')::NUMERIC
                        / NULLIF(COUNT(*), 0) * 100, 1
                      ),
    'por_projeto', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'projectId',   sub.proj_id,
          'projectName', sub.proj_name,
          'total',       sub.total,
          'concluido',   sub.concluido,
          'ativo',       sub.ativo
        ) ORDER BY sub.total DESC
      )
      FROM (
        SELECT
          p.id   AS proj_id,
          p.name AS proj_name,
          COUNT(d.id)                                                  AS total,
          COUNT(d.id) FILTER (WHERE d.situacao = 'aceite_final')       AS concluido,
          COUNT(d.id) FILTER (WHERE d.situacao NOT IN ('aceite_final','cancelada')) AS ativo
        FROM public.demandas  d
        LEFT JOIN public.teams    t    ON t.id    = d.team_id
        LEFT JOIN public.projects p    ON p.id    = COALESCE(d.project_id, t.project_id)
        WHERE d.situacao != 'cancelada'
          AND (p_contract_id IS NULL OR p.contract_id = p_contract_id)
          AND (p_project_id  IS NULL OR p.id          = p_project_id)
        GROUP BY p.id, p.name
      ) sub
    )
  )
  INTO v_result
  FROM (
    SELECT d.situacao
    FROM public.demandas  d
    LEFT JOIN public.teams    t    ON t.id    = d.team_id
    LEFT JOIN public.projects p    ON p.id    = COALESCE(d.project_id, t.project_id)
    WHERE d.situacao != 'cancelada'
      AND (p_contract_id IS NULL OR p.contract_id = p_contract_id)
      AND (p_project_id  IS NULL OR p.id          = p_project_id)
  ) base;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_sla_status_summary(UUID, UUID) TO authenticated;
