-- ============================================================
-- RPC: get_demandas_with_responsaveis
--
-- Problema resolvido:
--   A função enrichComResponsaveis no frontend (useDemandas.ts) fazia:
--     1. fetchDemandas(teamId) → SELECT * FROM demandas
--     2. SELECT FROM demanda_responsaveis WHERE demanda_id IN (...)
--   São 2 roundtrips HTTP por cache miss. Com 150 usuários acessando
--   a Sustentação ao mesmo tempo, isso são 300 queries paralelas
--   ao banco sem nenhum cache entre eles.
--
-- Solução:
--   1 RPC com LEFT JOIN = 1 roundtrip, resultado idempotente para cache.
--   O TanStack Query faz cache do resultado por staleTime: 30s.
--   150 usuários no mesmo time → 1 query no banco a cada 30s.
--
-- Retorno: JSONB com array de demandas já enriquecidas com
--   responsavel_dev, responsavel_requisitos, responsavel_arquiteto,
--   responsavel_teste, responsaveis_list
-- ============================================================

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
  -- Valida que o usuário atual é membro do time solicitado
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
      -- Todos os campos da demanda
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
      -- Campos de responsaveis agregados via subquery
      'responsavel_dev',
        (SELECT pr.display_name FROM demanda_responsaveis dr
          JOIN profiles pr ON pr.id = dr.user_id
          WHERE dr.demanda_id = d.id AND dr.papel = 'desenvolvedor'
          ORDER BY dr.created_at ASC LIMIT 1),
      'responsavel_requisitos',
        (SELECT pr.display_name FROM demanda_responsaveis dr
          JOIN profiles pr ON pr.id = dr.user_id
          WHERE dr.demanda_id = d.id AND dr.papel = 'analista'
          ORDER BY dr.created_at ASC LIMIT 1),
      'responsavel_arquiteto',
        (SELECT pr.display_name FROM demanda_responsaveis dr
          JOIN profiles pr ON pr.id = dr.user_id
          WHERE dr.demanda_id = d.id AND dr.papel = 'arquiteto'
          ORDER BY dr.created_at ASC LIMIT 1),
      'responsavel_teste',
        (SELECT pr.display_name FROM demanda_responsaveis dr
          JOIN profiles pr ON pr.id = dr.user_id
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
          JOIN profiles pr2 ON pr2.id = dr2.user_id
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
  WHERE d.team_id = p_team_id
  ORDER BY d.updated_at DESC;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Permissões: authenticated + service_role
REVOKE ALL ON FUNCTION get_demandas_with_responsaveis(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_demandas_with_responsaveis(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_demandas_with_responsaveis(uuid) TO service_role;

COMMENT ON FUNCTION get_demandas_with_responsaveis IS
  'Retorna demandas de um time já enriquecidas com dados de responsaveis. '
  'Substitui o padrão N+1 do frontend (fetchDemandas + enrichComResponsaveis). '
  '150 usuários no mesmo time = 1 query/30s ao invés de 300 queries paralelas.';
