-- Migration: RPC get_demandas_with_responsaveis_paged
-- Suporta lazy load paginado do backlog via cursor-based pagination (updated_at DESC)

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
      d.title,
      d.description,
      d.status,
      d.priority,
      d.team_id,
      d.sprint_id,
      d.story_points,
      d.horas_estimadas,
      d.horas_realizadas,
      d.created_at,
      d.updated_at,
      d.created_by,
      d.tipo,
      d.external_id,
      d.acceptance_criteria,
      d.blocked,
      d.blocked_reason,
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

-- Grant de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION get_demandas_with_responsaveis_paged(UUID, TIMESTAMPTZ, INT) TO authenticated;
