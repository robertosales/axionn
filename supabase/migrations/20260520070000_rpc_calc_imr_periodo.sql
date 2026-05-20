-- ============================================================
-- RPC: calc_imr_periodo  (fix v3 - SQL puro, sem PL/pgSQL)
-- IAP, IQS, ICT, ISS, Glosas, E8 Alerts no banco.
-- SQL puro nao usa dollar-quoting, funciona no Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION calc_imr_periodo(
  p_team_id   UUID,
  p_inicio    TIMESTAMPTZ,
  p_fim       TIMESTAMPTZ,
  p_e8_alerta INT DEFAULT 45,
  p_e8_glosa  INT DEFAULT 60
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
RETURN (
  WITH
  base AS (
    SELECT * FROM demandas WHERE team_id = p_team_id
  ),
  periodo AS (
    SELECT * FROM base WHERE created_at BETWEEN p_inicio AND p_fim
  ),
  -- IAP
  iap_calc AS (
    SELECT
      COUNT(*) FILTER (WHERE data_previsao_encerramento IS NOT NULL)                              AS qdtot,
      COUNT(*) FILTER (
        WHERE data_previsao_encerramento IS NOT NULL
          AND LOWER(situacao) = 'ag_aceite_final'
          AND aceite_data IS NOT NULL
          AND aceite_data::TIMESTAMPTZ <= data_previsao_encerramento::TIMESTAMPTZ
      )                                                                                           AS qdap
    FROM periodo
  ),
  -- IQS
  iqs_calc AS (
    SELECT
      COUNT(*) FILTER (
        WHERE LOWER(situacao) IN ('hom_ag_homologacao','hom_homologada','fila_producao','ag_aceite_final')
      )                                                                                           AS qde,
      COUNT(*) FILTER (
        WHERE LOWER(situacao) IN ('hom_ag_homologacao','hom_homologada','fila_producao','ag_aceite_final')
          AND COALESCE(contador_rejeicoes, 0) > 0
      )                                                                                           AS qdr
    FROM periodo
  ),
  -- ICT
  ict_calc AS (
    SELECT
      COALESCE(AVG(cobertura_testes), 0) AS valor,
      COUNT(*)                            AS total
    FROM periodo
    WHERE LOWER(situacao) = 'ag_aceite_final'
      AND cobertura_testes IS NOT NULL
  ),
  -- ISS
  iss_calc AS (
    SELECT
      COALESCE(AVG(nota_satisfacao), 0)   AS valor,
      COUNT(*)                             AS total
    FROM periodo
    WHERE LOWER(situacao) = 'ag_aceite_final'
      AND nota_satisfacao IS NOT NULL
  ),
  -- Glosas totais
  glosa_totais AS (
    SELECT
      COALESCE(SUM(e.redutor) FILTER (WHERE e.incidencia = 'integral'), 0) AS integral,
      COALESCE(SUM(e.redutor) FILTER (WHERE e.incidencia <> 'integral'), 0) AS limitada
    FROM demanda_eventos e
    JOIN base b ON b.id = e.demanda_id
    WHERE e.created_at BETWEEN p_inicio AND p_fim
  ),
  -- Glosas por tipo_evento
  glosa_byevt AS (
    SELECT COALESCE(
      jsonb_object_agg(
        sub.tipo_evento,
        jsonb_build_object('count', sub.cnt, 'total', ROUND(sub.tot::NUMERIC, 4))
      ),
      jsonb_build_object()
    ) AS byevento
    FROM (
      SELECT e.tipo_evento, COUNT(*) AS cnt, SUM(e.redutor) AS tot
      FROM demanda_eventos e
      JOIN base b ON b.id = e.demanda_id
      WHERE e.created_at BETWEEN p_inicio AND p_fim
      GROUP BY e.tipo_evento
    ) sub
  ),
  -- E8 Alerts
  e8_calc AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'demandaId',  d.id,
          'rhm',        d.rhm,
          'titulo',     d.titulo,
          'projeto',    d.projeto,
          'situacao',   d.situacao,
          'prazo',      d.data_previsao_encerramento,
          'diasAtraso', EXTRACT(DAY FROM (NOW() - d.data_previsao_encerramento::TIMESTAMPTZ))::INT,
          'tipo',       CASE
                          WHEN EXTRACT(DAY FROM (NOW() - d.data_previsao_encerramento::TIMESTAMPTZ)) >= p_e8_glosa
                          THEN 'glosa' ELSE 'alerta'
                        END
        )
        ORDER BY EXTRACT(DAY FROM (NOW() - d.data_previsao_encerramento::TIMESTAMPTZ)) DESC
      ),
      jsonb_build_array()
    ) AS alerts
    FROM base d
    WHERE LOWER(d.situacao) NOT IN ('ag_aceite_final','cancelada')
      AND d.data_previsao_encerramento IS NOT NULL
      AND d.data_previsao_encerramento::TIMESTAMPTZ < NOW()
      AND EXTRACT(DAY FROM (NOW() - d.data_previsao_encerramento::TIMESTAMPTZ)) >= p_e8_alerta
  )
  SELECT jsonb_build_object(
    'iap', jsonb_build_object(
      'valor', CASE WHEN i.qdtot > 0 THEN ROUND((i.qdap::NUMERIC / i.qdtot) * 100, 2) ELSE 0 END,
      'qdap',  i.qdap,
      'qdtot', i.qdtot
    ),
    'iqs', jsonb_build_object(
      'valor', CASE WHEN q.qde > 0 THEN ROUND((1 - q.qdr::NUMERIC / q.qde) * 100, 2) ELSE 0 END,
      'qdr',   q.qdr,
      'qde',   q.qde
    ),
    'ict', jsonb_build_object(
      'valor', ROUND(c.valor::NUMERIC, 2),
      'total', c.total
    ),
    'iss', jsonb_build_object(
      'valor', ROUND(s.valor::NUMERIC, 2),
      'total', s.total
    ),
    'glosas', jsonb_build_object(
      'totalIntegral', ROUND(g.integral::NUMERIC, 4),
      'totalLimitada', ROUND(g.limitada::NUMERIC, 4),
      'byEvento',      ge.byevento
    ),
    'e8Alerts', e8.alerts
  )
  FROM iap_calc i, iqs_calc q, ict_calc c, iss_calc s,
       glosa_totais g, glosa_byevt ge, e8_calc e8
);

REVOKE ALL ON FUNCTION calc_imr_periodo(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION calc_imr_periodo(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT) TO authenticated;

COMMENT ON FUNCTION calc_imr_periodo IS
  'Agrega indices IMR (IAP, IQS, ICT, ISS, glosas, E8 alerts) no banco para um periodo. Substitui imrCalculations.ts no frontend.';
