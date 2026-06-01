-- Fix: recria RPC com as colunas reais da tabela demandas
-- Remove colunas inexistentes: status, priority, titulo, sprint_id,
-- story_points, horas_estimadas, horas_realizadas, created_by,
-- external_id, acceptance_criteria, blocked, blocked_reason

DROP FUNCTION IF EXISTS get_demandas_with_responsaveis_paged(UUID, TIMESTAMPTZ, INT);

CREATE OR REPLACE FUNCTION get_demandas_with_responsaveis_paged(
  p_team_id UUID,
  p_cursor  TIMESTAMPTZ DEFAULT NULL,
  p_limit   INT         DEFAULT 50
)
RETURNS SETOF json
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT row_to_json(t)
  FROM (
    SELECT
      d.id,
      d.team_id,
      d.rhm,
      d.projeto,
      d.tipo,
      d.situacao,
      d.descricao,
      d.sla,
      d.responsavel_requisitos,
      d.responsavel_dev,
      d.responsavel_teste,
      d.responsavel_arquiteto,
      d.aceite_data,
      d.aceite_responsavel,
      d.created_at,
      d.updated_at,
      COALESCE(r.responsaveis, '[]'::json) AS responsaveis
    FROM demandas d
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'user_id',   p.user_id,
          'full_name', p.full_name,
          'avatar_url', p.avatar_url
        )
      ) AS responsaveis
      FROM demanda_responsaveis dr
      JOIN profiles p ON p.user_id = dr.user_id
      WHERE dr.demanda_id = d.id
    ) r ON true
    WHERE d.team_id = p_team_id
      AND (p_cursor IS NULL OR d.updated_at < p_cursor)
    ORDER BY d.updated_at DESC
    LIMIT p_limit
  ) t
$$;

GRANT EXECUTE ON FUNCTION get_demandas_with_responsaveis_paged(UUID, TIMESTAMPTZ, INT) TO authenticated;
