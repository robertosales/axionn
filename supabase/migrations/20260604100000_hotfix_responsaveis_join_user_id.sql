-- ============================================================
-- HOTFIX: fix JOIN profiles — pr.user_id = dr.user_id
--
-- Bug introduzido em: 20260601020000_get_demandas_with_responsaveis.sql
-- Propagado em:       20260603150000_fix_get_demandas_expose_project_contract.sql
--
-- Root cause:
--   A tabela `profiles` usa `user_id` como FK para auth.users (não `id`).
--   As subqueries de responsaveis usavam:
--     JOIN profiles pr ON pr.id = dr.user_id   ← ERRADO
--   O JOIN nunca casava → todos os campos responsavel_* retornavam NULL.
--   Sem erro 500, sem log — apenas "Sem responsável" em todos os cards do Kanban.
--
-- Fix:
--   JOIN profiles pr ON pr.user_id = dr.user_id  ← CORRETO
--   Aplicado nos 5 pontos de cada RPC (dev, requisitos, arquiteto, teste, list).
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. get_demandas_with_responsaveis (versão com project_id/contract_id)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_demandas_with_responsaveis(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado ao time %', p_team_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',                            d.id,
      'team_id',                       d.team_id,
      'rhm',                           d.rhm,
      'projeto',                       d.projeto,
      'situacao',                      d.situacao,
      'tipo',                          d.tipo,
      'descricao',                     d.descricao,
      'sla',                           d.sla,
      'tipo_defeito',                  d.tipo_defeito,
      'originada_diagnostico',         d.originada_diagnostico,
      'data_previsao_encerramento',    d.data_previsao_encerramento,
      'prazo_inicio_atendimento',      d.prazo_inicio_atendimento,
      'prazo_solucao',                 d.prazo_solucao,
      'total_horas',                   d.total_horas,
      'created_at',                    d.created_at,
      'updated_at',                    d.updated_at,
      'project_id',                    d.project_id,
      'contract_id',                   COALESCE(d.contract_id, t.contract_id),
      -- HOTFIX: era pr.id = dr.user_id → corrigido para pr.user_id = dr.user_id
      'responsavel_dev',
        (SELECT pr.display_name FROM demanda_responsaveis dr
          JOIN profiles pr ON pr.user_id = dr.user_id
          WHERE dr.demanda_id = d.id AND dr.papel = 'desenvolvedor'
          ORDER BY dr.created_at ASC LIMIT 1),
      'responsavel_requisitos',
        (SELECT pr.display_name FROM demanda_responsaveis dr
          JOIN profiles pr ON pr.user_id = dr.user_id
          WHERE dr.demanda_id = d.id AND dr.papel = 'analista'
          ORDER BY dr.created_at ASC LIMIT 1),
      'responsavel_arquiteto',
        (SELECT pr.display_name FROM demanda_responsaveis dr
          JOIN profiles pr ON pr.user_id = dr.user_id
          WHERE dr.demanda_id = d.id AND dr.papel = 'arquiteto'
          ORDER BY dr.created_at ASC LIMIT 1),
      'responsavel_teste',
        (SELECT pr.display_name FROM demanda_responsaveis dr
          JOIN profiles pr ON pr.user_id = dr.user_id
          WHERE dr.demanda_id = d.id AND dr.papel = 'testador'
          ORDER BY dr.created_at ASC LIMIT 1),
      'responsaveis_list',
        COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'papel',      dr2.papel,
              'nome',       pr2.display_name,
              'created_at', dr2.created_at
            ) ORDER BY dr2.created_at ASC
          )
          FROM demanda_responsaveis dr2
          JOIN profiles pr2 ON pr2.user_id = dr2.user_id
          WHERE dr2.demanda_id = d.id
            AND pr2.display_name IS NOT NULL
            AND pr2.display_name <> ''
          ),
          '[]'::jsonb
        )
    )
  )
  INTO v_result
  FROM demandas d
  LEFT JOIN teams t ON t.id = d.team_id
  WHERE d.team_id = p_team_id
  ORDER BY d.updated_at DESC;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION get_demandas_with_responsaveis(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_demandas_with_responsaveis(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_demandas_with_responsaveis(uuid) TO service_role;

COMMENT ON FUNCTION get_demandas_with_responsaveis IS
  'Retorna demandas de um time enriquecidas com responsaveis + project_id + contract_id. '
  'HOTFIX 2026-06-04: corrigido JOIN profiles pr ON pr.user_id (era pr.id — bug silencioso).';


-- ──────────────────────────────────────────────────────────────
-- 2. get_demandas_with_responsaveis_paged (paginação cursor-based)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_demandas_with_responsaveis_paged(
  p_team_id uuid,
  p_cursor  timestamptz,
  p_limit   int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado ao time %', p_team_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',                            d.id,
      'team_id',                       d.team_id,
      'rhm',                           d.rhm,
      'projeto',                       d.projeto,
      'situacao',                      d.situacao,
      'tipo',                          d.tipo,
      'descricao',                     d.descricao,
      'sla',                           d.sla,
      'tipo_defeito',                  d.tipo_defeito,
      'originada_diagnostico',         d.originada_diagnostico,
      'data_previsao_encerramento',    d.data_previsao_encerramento,
      'prazo_inicio_atendimento',      d.prazo_inicio_atendimento,
      'prazo_solucao',                 d.prazo_solucao,
      'total_horas',                   d.total_horas,
      'created_at',                    d.created_at,
      'updated_at',                    d.updated_at,
      'project_id',                    d.project_id,
      'contract_id',                   COALESCE(d.contract_id, t.contract_id),
      -- HOTFIX: era pr.id = dr.user_id → corrigido para pr.user_id = dr.user_id
      'responsavel_dev',
        (SELECT pr.display_name FROM demanda_responsaveis dr
          JOIN profiles pr ON pr.user_id = dr.user_id
          WHERE dr.demanda_id = d.id AND dr.papel = 'desenvolvedor'
          ORDER BY dr.created_at ASC LIMIT 1),
      'responsavel_requisitos',
        (SELECT pr.display_name FROM demanda_responsaveis dr
          JOIN profiles pr ON pr.user_id = dr.user_id
          WHERE dr.demanda_id = d.id AND dr.papel = 'analista'
          ORDER BY dr.created_at ASC LIMIT 1),
      'responsavel_arquiteto',
        (SELECT pr.display_name FROM demanda_responsaveis dr
          JOIN profiles pr ON pr.user_id = dr.user_id
          WHERE dr.demanda_id = d.id AND dr.papel = 'arquiteto'
          ORDER BY dr.created_at ASC LIMIT 1),
      'responsavel_teste',
        (SELECT pr.display_name FROM demanda_responsaveis dr
          JOIN profiles pr ON pr.user_id = dr.user_id
          WHERE dr.demanda_id = d.id AND dr.papel = 'testador'
          ORDER BY dr.created_at ASC LIMIT 1),
      'responsaveis_list',
        COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'papel',      dr2.papel,
              'nome',       pr2.display_name,
              'created_at', dr2.created_at
            ) ORDER BY dr2.created_at ASC
          )
          FROM demanda_responsaveis dr2
          JOIN profiles pr2 ON pr2.user_id = dr2.user_id
          WHERE dr2.demanda_id = d.id
            AND pr2.display_name IS NOT NULL
            AND pr2.display_name <> ''
          ),
          '[]'::jsonb
        )
    )
  )
  INTO v_result
  FROM demandas d
  LEFT JOIN teams t ON t.id = d.team_id
  WHERE d.team_id = p_team_id
    AND (p_cursor IS NULL OR d.updated_at < p_cursor)
  ORDER BY d.updated_at DESC
  LIMIT p_limit;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION get_demandas_with_responsaveis_paged(uuid, timestamptz, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_demandas_with_responsaveis_paged(uuid, timestamptz, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_demandas_with_responsaveis_paged(uuid, timestamptz, int) TO service_role;

COMMENT ON FUNCTION get_demandas_with_responsaveis_paged IS
  'Versão paginada (cursor-based) de get_demandas_with_responsaveis. '
  'HOTFIX 2026-06-04: corrigido JOIN profiles pr ON pr.user_id (era pr.id — bug silencioso).';
