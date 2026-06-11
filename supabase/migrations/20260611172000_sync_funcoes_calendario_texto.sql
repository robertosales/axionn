-- ============================================================
-- MIGRATION: Sincroniza funções de calendário com estado real do banco
-- Data: 2026-06-11
-- Ambiente: PRODUÇÃO
--
-- CONTEXTO:
--   A migration original (20260520031000) foi criada assumindo a
--   tabela feriados com colunas DATE + CHAR(2), mas o banco real
--   possui estrutura diferente: dia INT, mes INT, ano INT, team_id.
--   Além disso, todas as funções usavam CHAR(2) no parâmetro p_uf,
--   causando erro 42883 no PostgreSQL ao tentar resolver overloads.
--
-- O QUE ESTA MIGRATION FAZ:
--   1. Remove overloads antigos com CHAR/CHAR(2)
--   2. Recria is_feriado com estrutura real (dia/mes/ano)
--   3. Recria is_dia_util com TEXT
--   4. Recria calc_horas_uteis com TEXT
--   5. Recria calc_sla_demanda unificada (TEXT, sem overload)
--
-- IDEMPOTENTE: pode rodar múltiplas vezes sem efeito colateral
-- ZERO BREAKING CHANGE: assinaturas externas mantidas
-- ============================================================

-- ============================================================
-- 1. REMOVE OVERLOADS ANTIGOS (CHAR/CHAR(2))
-- ============================================================
DROP FUNCTION IF EXISTS public.is_feriado(DATE, CHAR);
DROP FUNCTION IF EXISTS public.is_dia_util(DATE, CHAR);
DROP FUNCTION IF EXISTS public.calc_horas_uteis(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, CHAR);
DROP FUNCTION IF EXISTS public.calc_sla_demanda(UUID, TEXT, CHAR);

-- ============================================================
-- 2. is_feriado — estrutura real: dia INT, mes INT, ano INT
--    Tabela não possui coluna uf, apenas feriados nacionais.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_feriado(
  p_data DATE,
  p_uf   TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.feriados f
    WHERE  f.dia   = EXTRACT(DAY   FROM p_data)::INT
      AND  f.mes   = EXTRACT(MONTH FROM p_data)::INT
      AND  f.ano   = EXTRACT(YEAR  FROM p_data)::INT
      AND  f.ativo = TRUE
      AND  f.tipo  = 'nacional'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_feriado(DATE, TEXT) TO authenticated;

COMMENT ON FUNCTION public.is_feriado IS
  'Verifica se uma data é feriado nacional. '
  'Estrutura real da tabela: dia/mes/ano (INT). '
  'Parâmetro p_uf mantido para compatibilidade de assinatura.';

-- ============================================================
-- 3. is_dia_util
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_dia_util(
  p_data DATE,
  p_uf   TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(DOW FROM p_data) NOT IN (0, 6)
    AND NOT public.is_feriado(p_data, p_uf);
$$;

GRANT EXECUTE ON FUNCTION public.is_dia_util(DATE, TEXT) TO authenticated;

-- ============================================================
-- 4. calc_horas_uteis — p_uf TEXT (sem ambiguidade de CHAR)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calc_horas_uteis(
  p_inicio TIMESTAMPTZ,
  p_fim    TIMESTAMPTZ,
  p_regime TEXT DEFAULT 'padrao',
  p_uf     TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total      NUMERIC := 0;
  v_atual      TIMESTAMPTZ;
  v_dia_fim    TIMESTAMPTZ;
  v_hora_ini   CONSTANT INT := 8;
  v_hora_fim   CONSTANT INT := 20;
  v_hora_atual NUMERIC;
  v_hora_efim  NUMERIC;
BEGIN
  IF p_inicio >= p_fim THEN RETURN 0; END IF;

  IF p_regime = 'continuo' THEN
    RETURN EXTRACT(EPOCH FROM (p_fim - p_inicio)) / 3600.0;
  END IF;

  v_atual := p_inicio;

  WHILE v_atual < p_fim LOOP
    IF NOT public.is_dia_util(v_atual::DATE, p_uf) THEN
      v_atual := DATE_TRUNC('day', v_atual) + INTERVAL '1 day'
                 + (v_hora_ini || ' hours')::INTERVAL;
      CONTINUE;
    END IF;

    v_hora_atual :=
      EXTRACT(HOUR   FROM v_atual AT TIME ZONE 'America/Sao_Paulo')
      + EXTRACT(MINUTE FROM v_atual AT TIME ZONE 'America/Sao_Paulo') / 60.0;

    IF v_hora_atual < v_hora_ini THEN
      v_atual := DATE_TRUNC('day', v_atual) + (v_hora_ini || ' hours')::INTERVAL;
      CONTINUE;
    END IF;

    IF v_hora_atual >= v_hora_fim THEN
      v_atual := DATE_TRUNC('day', v_atual) + INTERVAL '1 day'
                 + (v_hora_ini || ' hours')::INTERVAL;
      CONTINUE;
    END IF;

    v_dia_fim := DATE_TRUNC('day', v_atual) + (v_hora_fim || ' hours')::INTERVAL;

    IF p_fim <= v_dia_fim THEN
      v_hora_efim :=
        EXTRACT(HOUR   FROM p_fim AT TIME ZONE 'America/Sao_Paulo')
        + EXTRACT(MINUTE FROM p_fim AT TIME ZONE 'America/Sao_Paulo') / 60.0;
      v_total := v_total + LEAST(v_hora_efim, v_hora_fim) - v_hora_atual;
      EXIT;
    ELSE
      v_total := v_total + (v_hora_fim - v_hora_atual);
      v_atual := DATE_TRUNC('day', v_atual) + INTERVAL '1 day'
                 + (v_hora_ini || ' hours')::INTERVAL;
    END IF;
  END LOOP;

  RETURN GREATEST(0, v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calc_horas_uteis(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 5. calc_sla_demanda — unificada com TEXT, Fase 3 integrada
-- ============================================================
CREATE OR REPLACE FUNCTION public.calc_sla_demanda(
  p_demanda_id UUID,
  p_regime     TEXT DEFAULT 'padrao',
  p_uf         TEXT DEFAULT NULL
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
  SELECT
    d.id, d.created_at, d.situacao, d.sla, d.aceite_data, d.team_id,
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

  SELECT * INTO v_limits
  FROM public.fn_resolve_sla_limits(p_demanda_id, NULL);

  v_prazo_horas    := v_limits.resolution_minutes / 60.0;
  v_response_horas := v_limits.response_minutes   / 60.0;

  v_regime_efetivo := CASE
    WHEN NOT v_limits.business_hours THEN 'continuo'
    ELSE p_regime
  END;

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
          v_ultimo_ts, v_transitions.created_at, v_regime_efetivo, p_uf
        );
    END IF;
    v_ultimo_ts     := v_transitions.created_at;
    v_ultimo_status := v_transitions.to_status;
  END LOOP;

  IF v_ultimo_status = ANY(v_sla_ativos)
     AND v_demanda.situacao != 'aceite_final' THEN
    v_total_horas := v_total_horas +
      public.calc_horas_uteis(v_ultimo_ts, NOW(), v_regime_efetivo, p_uf);
  END IF;

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

REVOKE ALL  ON FUNCTION public.calc_sla_demanda(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calc_sla_demanda(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.calc_sla_demanda IS
  'Calcula horas SLA acumuladas. Usa contract_slas dinâmico (contract_matrix) '
  'quando contract_id está vinculado; fallback automático para valores legados. '
  'Sincronizado com estrutura real do banco em 2026-06-11.';

-- ============================================================
-- FIM DA MIGRATION
-- Estado do banco após esta migration:
--   is_feriado(DATE, TEXT)                              ✔
--   is_dia_util(DATE, TEXT)                             ✔
--   calc_horas_uteis(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) ✔
--   calc_sla_demanda(UUID, TEXT, TEXT)                  ✔
--   Nenhum overload com CHAR/CHAR(2) remanescente       ✔
-- ============================================================
