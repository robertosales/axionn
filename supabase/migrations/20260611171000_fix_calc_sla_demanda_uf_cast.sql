-- ============================================================
-- MIGRATION: Fix cast CHAR(2) → CHAR em calc_sla_demanda
-- Data: 2026-06-11
-- Ambiente: PRODUÇÃO
--
-- PROBLEMA:
--   A Fase 3 (20260603130000_phase3_dynamic_sla_engine.sql)
--   reescreveu calc_sla_demanda passando p_uf (CHAR(2)) diretamente
--   para calc_horas_uteis, que espera CHAR sem tamanho.
--   PostgreSQL não faz o cast implicitamente em contexto PL/pgSQL,
--   resultando em:
--     ERROR 42883: function public.calc_horas_uteis(
--       timestamp with time zone,
--       timestamp with time zone,
--       text,
--       character  ← espera isso
--     ) does not exist
--     (recebeu character(2))
--
-- SOLUÇÃO:
--   Adicionar cast explícito p_uf::CHAR nos dois pontos de chamada
--   dentro de calc_sla_demanda.
--   A assinatura pública da função permanece idêntica.
--
-- ZERO BREAKING CHANGE:
--   • Assinatura externa idêntica
--   • Nenhuma tabela alterada
--   • Rollback: reexecutar a migration da Fase 3
-- ============================================================

CREATE OR REPLACE FUNCTION public.calc_sla_demanda(
  p_demanda_id  UUID,
  p_regime      TEXT    DEFAULT 'padrao',
  p_uf          CHAR(2) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demanda        RECORD;
  v_transitions    RECORD;
  v_limits         RECORD;
  v_total_horas    NUMERIC := 0;
  v_ultimo_ts      TIMESTAMPTZ;
  v_ultimo_status  TEXT;
  v_prazo_horas    NUMERIC;
  v_response_horas NUMERIC;
  v_status_sla     TEXT;
  v_atraso         NUMERIC;
  v_contract_id    UUID;
  v_project_id     UUID;
  v_regime_efetivo TEXT;
  v_sla_ativos     TEXT[] := ARRAY[
    'nova','planejamento','planejamento_aprovado','execucao_dev'
  ];
BEGIN
  -- Carrega demanda resolvendo contract_id e project_id pela cadeia de FKs
  SELECT
    d.id,
    d.created_at,
    d.situacao,
    d.sla,
    d.aceite_data,
    d.team_id,
    COALESCE(d.contract_id, t.contract_id, proj.contract_id) AS resolved_contract_id,
    COALESCE(d.project_id,  t.project_id)                    AS resolved_project_id
  INTO v_demanda
  FROM  public.demandas  d
  LEFT  JOIN public.teams    t    ON t.id    = d.team_id
  LEFT  JOIN public.projects proj ON proj.id = COALESCE(d.project_id, t.project_id)
  WHERE d.id = p_demanda_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'demanda_not_found');
  END IF;

  v_contract_id := v_demanda.resolved_contract_id;
  v_project_id  := v_demanda.resolved_project_id;

  -- Resolve limites via matriz dinâmica ou fallback legado
  SELECT * INTO v_limits
  FROM public.fn_resolve_sla_limits(p_demanda_id, NULL);

  v_prazo_horas    := v_limits.resolution_minutes / 60.0;
  v_response_horas := v_limits.response_minutes   / 60.0;

  -- Regime efetivo: se contrato é 24x7, força 'continuo'
  v_regime_efetivo := CASE
    WHEN NOT v_limits.business_hours THEN 'continuo'
    ELSE p_regime
  END;

  -- Acumula horas via transitions
  v_ultimo_ts     := v_demanda.created_at;
  v_ultimo_status := 'nova';

  FOR v_transitions IN
    SELECT from_status, to_status, created_at
    FROM   public.demanda_transitions
    WHERE  demanda_id = p_demanda_id
    ORDER  BY created_at ASC
  LOOP
    IF v_ultimo_status = ANY(v_sla_ativos) THEN
      v_total_horas := v_total_horas +
        public.calc_horas_uteis(
          v_ultimo_ts,
          v_transitions.created_at,
          v_regime_efetivo,
          p_uf::CHAR  -- FIX: cast explícito CHAR(2) → CHAR
        );
    END IF;
    v_ultimo_ts     := v_transitions.created_at;
    v_ultimo_status := v_transitions.to_status;
  END LOOP;

  -- Acumula até agora se ainda em status ativo
  IF v_ultimo_status = ANY(v_sla_ativos)
     AND v_demanda.situacao != 'aceite_final' THEN
    v_total_horas := v_total_horas +
      public.calc_horas_uteis(
        v_ultimo_ts,
        NOW(),
        v_regime_efetivo,
        p_uf::CHAR  -- FIX: cast explícito CHAR(2) → CHAR
      );
  END IF;

  -- Status SLA
  IF v_demanda.situacao = 'aceite_final' THEN
    v_status_sla := 'concluido';
    v_atraso     := GREATEST(0, v_total_horas - v_prazo_horas);
  ELSIF v_total_horas > v_prazo_horas THEN
    v_status_sla := 'violado';
    v_atraso     := v_total_horas - v_prazo_horas;
  ELSIF v_total_horas > (v_prazo_horas * 0.85) THEN
    v_status_sla := 'em_risco';
    v_atraso     := 0;
  ELSE
    v_status_sla := 'dentro';
    v_atraso     := 0;
  END IF;

  -- Retorno: campos originais + campos novos da Fase 3 (aditivos)
  RETURN jsonb_build_object(
    'demandaId',       p_demanda_id,
    'horasAcumuladas', ROUND(v_total_horas::NUMERIC, 2),
    'prazoHoras',      v_prazo_horas,
    'statusSLA',       v_status_sla,
    'atrasoHoras',     ROUND(v_atraso::NUMERIC, 2),
    'regime',          p_regime,
    'calculadoEm',     NOW(),
    'slaSource',       v_limits.source,
    'contractId',      v_contract_id,
    'projectId',       v_project_id,
    'responseHoras',   v_response_horas,
    'resolutionPct',   ROUND((v_total_horas / NULLIF(v_prazo_horas, 0)) * 100, 1),
    'slaColor',        CASE
                         WHEN v_status_sla = 'violado'   THEN 'red'
                         WHEN v_status_sla = 'em_risco'  THEN 'orange'
                         WHEN v_status_sla = 'concluido' THEN 'blue'
                         ELSE 'green'
                       END
  );
END;
$$;

COMMENT ON FUNCTION public.calc_sla_demanda IS
  'Calcula horas SLA acumuladas. '
  'Usa contract_slas dinâmico quando contract_id está vinculado; '
  'fallback automático para valores legados. '
  'Fix 2026-06-11: cast explícito p_uf::CHAR para compatibilidade com calc_horas_uteis.';

REVOKE ALL  ON FUNCTION public.calc_sla_demanda(UUID, TEXT, CHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calc_sla_demanda(UUID, TEXT, CHAR) TO authenticated;

-- ============================================================
-- VALIDAÇÃO PÓS-APPLY:
--
--   SELECT
--     d.id,
--     public.calc_sla_demanda(d.id) ->> 'slaSource'  AS fonte,
--     public.calc_sla_demanda(d.id) ->> 'statusSLA'  AS status
--   FROM public.demandas d
--   WHERE d.situacao NOT IN ('cancelada','aceite_final')
--   LIMIT 5;
--
--   Esperado: fonte = 'contract_matrix' para times vinculados
-- ============================================================
