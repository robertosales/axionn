-- Consolidação final da RPC paginada com o schema real de demandas e perfis.

DROP FUNCTION IF EXISTS public.get_demandas_with_responsaveis_paged(
  uuid,
  timestamptz,
  integer
);

CREATE FUNCTION public.get_demandas_with_responsaveis_paged(
  p_team_id uuid,
  p_cursor timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS SETOF json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT row_to_json(result_row)
  FROM (
    SELECT
      demand.id,
      demand.team_id,
      demand.rhm,
      demand.projeto,
      demand.tipo,
      demand.situacao,
      demand.descricao,
      demand.sla,
      demand.responsavel_requisitos,
      demand.responsavel_dev,
      demand.responsavel_teste,
      demand.responsavel_arquiteto,
      demand.aceite_data,
      demand.aceite_responsavel,
      demand.created_at,
      demand.updated_at,
      COALESCE(responsible_people.responsaveis, '[]'::json) AS responsaveis
    FROM public.demandas demand
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'user_id', profile.user_id,
          'full_name', COALESCE(NULLIF(profile.display_name, ''), profile.email),
          'avatar_url', profile.avatar_url,
          'papel', relation.papel
        )
        ORDER BY relation.papel, profile.display_name
      ) AS responsaveis
      FROM public.demanda_responsaveis relation
      JOIN public.profiles profile
        ON profile.user_id = relation.user_id
      WHERE relation.demanda_id = demand.id
    ) responsible_people ON true
    WHERE demand.team_id = p_team_id
      AND (
        public.is_admin()
        OR public.is_team_member(auth.uid(), p_team_id)
      )
      AND (p_cursor IS NULL OR demand.updated_at < p_cursor)
    ORDER BY demand.updated_at DESC, demand.id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
  ) result_row;
$$;

REVOKE ALL ON FUNCTION public.get_demandas_with_responsaveis_paged(
  uuid,
  timestamptz,
  integer
) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.get_demandas_with_responsaveis_paged(
  uuid,
  timestamptz,
  integer
) TO authenticated, service_role;
