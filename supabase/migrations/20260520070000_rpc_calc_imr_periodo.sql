-- ============================================================
-- RPC: calc_imr_periodo
-- Semana 7+ do plano de ação de performance.
--
-- Substitui no frontend:
--   calcIAP()           — Índice de Atendimento de Prazo
--   calcIQS()           — Índice de Qualidade de Serviço
--   calcICT()           — Índice de Cobertura de Testes
--   calcISS()           — Índice de Satisfação do Serviço
--   calcGlosasSummary() — Totais de glosas por incidência
--   detectE8Alerts()    — Demandas em alerta/glosa por atraso
--
-- Parâmetros:
--   p_team_id    UUID          — time
--   p_inicio     TIMESTAMPTZ   — início do período (ex: primeiro dia do mês)
--   p_fim        TIMESTAMPTZ   — fim do período (ex: NOW())
--   p_e8_alerta  INT DEFAULT 45 — dias de atraso para alerta E8
--   p_e8_glosa   INT DEFAULT 60 — dias de atraso para glosa E8
--
-- Retorna JSONB com:
--   { iap, iqs, ict, iss, glosas, e8Alerts[] }
-- ============================================================

CREATE OR REPLACE FUNCTION calc_imr_periodo(
  p_team_id   UUID,
  p_inicio    TIMESTAMPTZ,
  p_fim       TIMESTAMPTZ,
  p_e8_alerta INT         DEFAULT 45,
  p_e8_glosa  INT         DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();

  -- IAP
  v_qdtot INT     := 0;
  v_qdap  INT     := 0;
  v_iap   NUMERIC := 0;

  -- IQS
  v_qde   INT     := 0;
  v_qdr   INT     := 0;
  v_iqs   NUMERIC := 0;

  -- ICT
  v_ict_sum   NUMERIC := 0;
  v_ict_count INT     := 0;
  v_ict       NUMERIC := 0;

  -- ISS
  v_iss_sum   NUMERIC := 0;
  v_iss_count INT     := 0;
  v_iss       NUMERIC := 0;

BEGIN

  -- ============================================================
  -- IAP — Índice de Atendimento de Prazo
  -- qdtot = demandas com data_previsao_encerramento no período
  -- qdap  = das acima, encerradas (aceite_final) dentro do prazo
  -- ============================================================
  SELECT
    COUNT(*) FILTER (
      WHERE d.data_previsao_encerramento IS NOT NULL
        AND d.created_at BETWEEN p_inicio AND p_fim
    ),
    COUNT(*) FILTER (
      WHERE d.data_previsao_encerramento IS NOT NULL
        AND d.created_at BETWEEN p_inicio AND p_fim
        AND LOWER(d.situacao) = 'ag_aceite_final'
        AND d.aceite_data IS NOT NULL
        AND d.aceite_data <= COALESCE(
              d.data_previsao_encerramento::TIMESTAMPTZ,
              d.data_previsao_encerramento::TIMESTAMPTZ
            )
    )
  INTO v_qdtot, v_qdap
  FROM demandas d
  WHERE d.team_id = p_team_id;

  v_iap := CASE WHEN v_qdtot > 0 THEN ROUND((v_qdap::NUMERIC / v_qdtot) * 100, 2) ELSE 0 END;

  -- ============================================================
  -- IQS — Índice de Qualidade de Serviço
  -- qde = demandas entregues para homologação ou além
  -- qdr = das acima com ao menos 1 rejeicao (contador_rejeicoes > 0)
  -- ============================================================
  SELECT
    COUNT(*) FILTER (
      WHERE LOWER(d.situacao) IN (
        'hom_ag_homologacao','hom_homologada',
        'fila_producao','ag_aceite_final'
      )
      AND d.created_at BETWEEN p_inicio AND p_fim
    ),
    COUNT(*) FILTER (
      WHERE LOWER(d.situacao) IN (
        'hom_ag_homologacao','hom_homologada',
        'fila_producao','ag_aceite_final'
      )
      AND d.created_at BETWEEN p_inicio AND p_fim
      AND COALESCE(d.contador_rejeicoes, 0) > 0
    )
  INTO v_qde, v_qdr
  FROM demandas d
  WHERE d.team_id = p_team_id;

  v_iqs := CASE WHEN v_qde > 0
    THEN ROUND((1 - v_qdr::NUMERIC / v_qde) * 100, 2)
    ELSE 0 END;

  -- ============================================================
  -- ICT — Índice de Cobertura de Testes
  -- Média de cobertura_testes entre demandas aceite_final com valor
  -- ============================================================
  SELECT
    COALESCE(SUM(d.cobertura_testes), 0),
    COUNT(*)
  INTO v_ict_sum, v_ict_count
  FROM demandas d
  WHERE d.team_id = p_team_id
    AND LOWER(d.situacao) = 'ag_aceite_final'
    AND d.cobertura_testes IS NOT NULL
    AND d.created_at BETWEEN p_inicio AND p_fim;

  v_ict := CASE WHEN v_ict_count > 0
    THEN ROUND(v_ict_sum / v_ict_count, 2)
    ELSE 0 END;

  -- ============================================================
  -- ISS — Índice de Satisfação do Serviço
  -- Média de nota_satisfacao entre demandas aceite_final avaliadas
  -- ============================================================
  SELECT
    COALESCE(SUM(d.nota_satisfacao), 0),
    COUNT(*)
  INTO v_iss_sum, v_iss_count
  FROM demandas d
  WHERE d.team_id = p_team_id
    AND LOWER(d.situacao) = 'ag_aceite_final'
    AND d.nota_satisfacao IS NOT NULL
    AND d.created_at BETWEEN p_inicio AND p_fim;

  v_iss := CASE WHEN v_iss_count > 0
    THEN ROUND(v_iss_sum / v_iss_count, 2)
    ELSE 0 END;

  -- ============================================================
  -- Retorno final
  -- ============================================================
  RETURN jsonb_build_object(

    'iap', jsonb_build_object(
      'valor',  v_iap,
      'qdap',   v_qdap,
      'qdtot',  v_qdtot
    ),

    'iqs', jsonb_build_object(
      'valor',  v_iqs,
      'qdr',    v_qdr,
      'qde',    v_qde
    ),

    'ict', jsonb_build_object(
      'valor',  v_ict,
      'total',  v_ict_count
    ),

    'iss', jsonb_build_object(
      'valor',  v_iss,
      'total',  v_iss_count
    ),

    -- Glosas: agrega por tipo_evento e incidencia da tabela demanda_eventos
    'glosas', (
      WITH glosa_rows AS (
        SELECT
          e.tipo_evento,
          e.incidencia,
          e.redutor
        FROM demanda_eventos e
        JOIN demandas       d ON d.id = e.demanda_id
        WHERE d.team_id     = p_team_id
          AND e.created_at BETWEEN p_inicio AND p_fim
      )
      SELECT jsonb_build_object(
        'totalIntegral', ROUND(COALESCE(SUM(r.redutor) FILTER (WHERE r.incidencia = 'integral'), 0)::NUMERIC, 4),
        'totalLimitada', ROUND(COALESCE(SUM(r.redutor) FILTER (WHERE r.incidencia <> 'integral'), 0)::NUMERIC, 4),
        'byEvento', COALESCE(
          jsonb_object_agg(
            r.tipo_evento,
            jsonb_build_object(
              'count', cnt,
              'total', tot
            )
          ),
          '{}'::JSONB
        )
      )
      FROM (
        SELECT
          tipo_evento,
          incidencia,
          redutor,
          COUNT(*)        OVER (PARTITION BY tipo_evento) AS cnt,
          SUM(redutor)    OVER (PARTITION BY tipo_evento) AS tot
        FROM glosa_rows
      ) r
    ),

    -- E8 Alerts: demandas em atraso (não encerradas) acima dos limiares
    'e8Alerts', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'demandaId',   d.id,
          'rhm',         d.rhm,
          'titulo',      d.titulo,
          'projeto',     d.projeto,
          'situacao',    d.situacao,
          'prazo',       COALESCE(d.data_previsao_encerramento, NULL),
          'diasAtraso',  EXTRACT(DAY FROM (v_now - COALESCE(
                            d.data_previsao_encerramento::TIMESTAMPTZ,
                            d.created_at
                          )))::INT,
          'tipo',        CASE
                           WHEN EXTRACT(DAY FROM (v_now - COALESCE(
                                  d.data_previsao_encerramento::TIMESTAMPTZ,
                                  d.created_at
                                ))) >= p_e8_glosa  THEN 'glosa'
                           ELSE 'alerta'
                         END
        ) ORDER BY (
          EXTRACT(DAY FROM (v_now - COALESCE(
            d.data_previsao_encerramento::TIMESTAMPTZ,
            d.created_at
          )))
        ) DESC
      ), '[]'::JSONB)
      FROM demandas d
      WHERE d.team_id    = p_team_id
        AND LOWER(d.situacao) <> 'ag_aceite_final'
        AND LOWER(d.situacao) <> 'cancelada'
        AND d.data_previsao_encerramento IS NOT NULL
        AND d.data_previsao_encerramento::TIMESTAMPTZ < v_now
        AND EXTRACT(DAY FROM (
              v_now - d.data_previsao_encerramento::TIMESTAMPTZ
            )) >= p_e8_alerta
    )

  );

END;
$$;

REVOKE ALL ON FUNCTION calc_imr_periodo(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION calc_imr_periodo(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT) TO authenticated;

COMMENT ON FUNCTION calc_imr_periodo IS
  'Agrega índices IMR (IAP, IQS, ICT, ISS, glosas, E8 alerts) no banco para um período. '
  'Substitui imrCalculations.ts no frontend.';
