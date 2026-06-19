
CREATE OR REPLACE FUNCTION public.fn_sla_contract_panel(
  p_contract_id  uuid,
  p_limit_risco  integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
WITH base AS (
  SELECT
    d.id,
    d.rhm,
    d.titulo,
    d.projeto,
    d.situacao,
    d.created_at,
    d.aceite_data,
    -- prioridade: mapeia d.sla → priority do contract_slas
    CASE
      WHEN d.sla = '24x7'      THEN 'urgent'
      WHEN d.sla IN ('alta','high','urgent') THEN 'urgent'
      WHEN d.sla IN ('baixa','low')          THEN 'low'
      WHEN d.sla IS NULL OR d.sla = ''       THEN 'medium'
      ELSE 'medium'
    END AS priority_key,
    cs.resolution_time_minutes,
    -- minutos decorridos (até aceite_data se concluída, senão até agora)
    EXTRACT(EPOCH FROM (
      COALESCE(d.aceite_data, NOW()) - d.created_at
    )) / 60.0 AS elapsed_minutes,
    LOWER(d.situacao) IN ('aceite_final','concluido','concluida','resolvido') AS is_concluido,
    LOWER(d.situacao) = 'cancelada' AS is_cancelada
  FROM public.demandas d
  LEFT JOIN public.contract_slas cs
    ON cs.contract_id = d.contract_id
   AND cs.priority    = CASE
        WHEN d.sla = '24x7'      THEN 'urgent'
        WHEN d.sla IN ('alta','high','urgent') THEN 'urgent'
        WHEN d.sla IN ('baixa','low')          THEN 'low'
        WHEN d.sla IS NULL OR d.sla = ''       THEN 'medium'
        ELSE 'medium'
      END
  WHERE d.contract_id = p_contract_id
),
classified AS (
  SELECT
    b.*,
    CASE
      WHEN b.is_cancelada                                        THEN 'cancelada'
      WHEN b.is_concluido                                        THEN 'concluido'
      WHEN b.resolution_time_minutes IS NULL                     THEN 'no_sla'
      WHEN b.elapsed_minutes > b.resolution_time_minutes         THEN 'violado'
      WHEN b.elapsed_minutes > b.resolution_time_minutes * 0.85  THEN 'em_risco'
      ELSE 'dentro'
    END AS sla_bucket,
    CASE
      WHEN b.resolution_time_minutes IS NULL OR b.resolution_time_minutes = 0 THEN 0
      ELSE ROUND((b.elapsed_minutes / b.resolution_time_minutes * 100)::numeric, 1)
    END AS resolution_pct
  FROM base b
),
ativos AS (
  SELECT * FROM classified
  WHERE sla_bucket IN ('dentro','em_risco','violado','no_sla')
),
agg AS (
  SELECT
    COUNT(*)                                       AS total,
    COUNT(*) FILTER (WHERE sla_bucket = 'dentro')   AS dentro,
    COUNT(*) FILTER (WHERE sla_bucket = 'em_risco') AS em_risco,
    COUNT(*) FILTER (WHERE sla_bucket = 'violado')  AS violado,
    COUNT(*) FILTER (WHERE sla_bucket = 'no_sla')   AS no_sla
  FROM ativos
),
top_risco AS (
  SELECT *
  FROM classified
  WHERE sla_bucket IN ('em_risco','violado')
  ORDER BY resolution_pct DESC NULLS LAST
  LIMIT p_limit_risco
)
SELECT jsonb_build_object(
  'summary', jsonb_build_object(
    'total',     (SELECT total     FROM agg),
    'dentro',    (SELECT dentro    FROM agg),
    'em_risco',  (SELECT em_risco  FROM agg),
    'violado',   (SELECT violado   FROM agg),
    'no_sla',    (SELECT no_sla    FROM agg),
    'compliance',
      CASE
        WHEN (SELECT (dentro + em_risco + violado) FROM agg) = 0 THEN 100
        ELSE ROUND(
          ((SELECT dentro FROM agg)::numeric
            / NULLIF((SELECT (dentro + em_risco + violado) FROM agg), 0)) * 100
        )
      END
  ),
  'items', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'demanda_id',     t.id,
      'rhm',            COALESCE(t.rhm, t.id::text),
      'projeto',        COALESCE(t.projeto, ''),
      'titulo',         t.titulo,
      'priority',       t.priority_key,
      'sla_bucket',     t.sla_bucket,
      'elapsed_minutes',ROUND(t.elapsed_minutes)::int,
      'resolution_pct', t.resolution_pct
    ) ORDER BY t.resolution_pct DESC NULLS LAST)
    FROM top_risco t
  ), '[]'::jsonb)
);
$$;

GRANT EXECUTE ON FUNCTION public.fn_sla_contract_panel(uuid, integer) TO authenticated, service_role;
