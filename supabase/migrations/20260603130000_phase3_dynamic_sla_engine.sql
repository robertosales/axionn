-- ============================================================
-- MIGRATION: Fase 3 — SLA Engine Dinâmico
-- Data: 2026-06-03
-- Branch: feature/contracts-sla-module
--
-- O QUE MUDA:
--   calc_sla_demanda() passa a buscar os limites de prazo
--   diretamente de contract_slas (via contract vinculado ao
--   projeto/time da demanda), substituindo o CASE WHEN hardcoded.
--
-- RETROCOMPATIBILIDADE TOTAL:
--   • Demandas sem contract_id → fallback para valores legados
--     ('24x7' = 240min, 'padrao' = 1440min), comportamento idêntico ao atual.
--   • Nenhuma demanda existente quebra.
--   • Assinatura da função IDÊNTICA — nenhum código frontend muda.
--
-- NOVAS RPCS:
--   • fn_sla_dashboard_batch()  — calcula SLA de N demandas em batch
--   • fn_sla_status_summary()   — resumo de compliance por projeto
-- ============================================================

-- ============================================================
-- 1. HELPER PRIVADO: fn_resolve_sla_limits
--    Dado um demanda_id, retorna os limites corretos
--    buscando na hierarquia: demanda → contract_slas → fallback legado.
--    Navega: demanda.contract_id → team.contract_id → team.project_id → project.contract_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_resolve_sla_limits(
  p_demanda_id UUID,
  p_priority   VARCHAR DEFAULT NULL   -- se NULL, infere do campo sla legado
)
RETURNS TABLE (
  response_minutes   INT,
  resolution_minutes INT,
  business_hours     BOOLEAN,
  source             TEXT    -- 'contract_matrix' | 'legacy_fallback'
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_id  UUID;
  v_sla_field    TEXT;
  v_priority_key TEXT;
  v_sla_row      RECORD;
BEGIN
  -- Resolve contract_id e sla legado navegando pela cadeia de FKs
  SELECT
    COALESCE(d.contract_id, t.contract_id, proj.contract_id),
    d.sla
  INTO v_contract_id, v_sla_field
  FROM  public.demandas  d
  LEFT  JOIN public.teams    t    ON t.id    = d.team_id
  LEFT  JOIN public.projects proj ON proj.id = COALESCE(d.project_id, t.project_id)
  WHERE d.id = p_demanda_id
  LIMIT 1;

  -- Mapeia prioridade: parâmetro explícito ou inferido do campo sla legado
  v_priority_key := COALESCE(
    p_priority,
    CASE v_sla_field
      WHEN '24x7'   THEN 'urgent'
      WHEN 'padrao' THEN 'medium'
      ELSE               'medium'
    END
  );

  -- Tenta buscar na matriz dinâmica do contrato
  IF v_contract_id IS NOT NULL THEN
    SELECT *
    INTO   v_sla_row
    FROM   public.contract_slas
    WHERE  contract_id = v_contract_id
      AND  priority    = v_priority_key
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT
        v_sla_row.response_time_minutes,
        v_sla_row.resolution_time_minutes,
        v_sla_row.business_hours_only,
        'contract_matrix'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Fallback legado — comportamento idêntico ao original
  -- 24x7   → 240 min  (4h),  regime contínuo (não só horário comercial)
  -- padrão → 1440 min (24h), regime horário útil
  RETURN QUERY SELECT
    CASE v_sla_field WHEN '24x7' THEN 240  ELSE 1440 END,
    CASE v_sla_field WHEN '24x7' THEN 240  ELSE 1440 END,
    CASE v_sla_field WHEN '24x7' THEN FALSE ELSE TRUE END,
    'legacy_fallback'::TEXT;
END;
$$;

COMMENT ON FUNCTION public.fn_resolve_sla_limits IS
  'Resolve limites de SLA buscando em contract_slas via hierarquia de FKs. '
  'Fallback automático para valores legados quando contract_id não está vinculado. '
  'source: contract_matrix | legacy_fallback.';

REVOKE ALL  ON FUNCTION public.fn_resolve_sla_limits(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_resolve_sla_limits(UUID, VARCHAR) TO authenticated;


-- ============================================================
-- 2. ATUALIZAÇÃO: calc_sla_demanda
--    Mesma assinatura — nenhum código frontend precisa mudar.
--    Internamente usa fn_resolve_sla_limits em vez do CASE WHEN.
--    Campos NOVOS no JSON de retorno (aditivos — frontend pode ignorar):
--      • slaSource    — 'contract_matrix' | 'legacy_fallback'
--      • contractId   — UUID do contrato resolvido (ou null)
--      • projectId    — UUID do projeto resolvido (ou null)
--      • priorityUsed — prioridade efetivamente usada
--      • responseHoras — limite de resposta em horas
--      • resolutionPct — % do prazo de resolução consumido
--      • slaColor     — green | orange | red | blue
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

  -- Regime efetivo: se contrato é 24x7 (business_hours=false), força 'continuo'
  v_regime_efetivo := CASE
    WHEN NOT v_limits.business_hours THEN 'continuo'
    ELSE p_regime
  END;

  -- ── Acumula horas conforme transitions (lógica original preservada) ──
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
          p_uf
        );
    END IF;
    v_ultimo_ts     := v_transitions.created_at;
    v_ultimo_status := v_transitions.to_status;
  END LOOP;

  -- Acumula até agora se ainda em status ativo
  IF v_ultimo_status = ANY(v_sla_ativos)
     AND v_demanda.situacao != 'aceite_final' THEN
    v_total_horas := v_total_horas +
      public.calc_horas_uteis(v_ultimo_ts, NOW(), v_regime_efetivo, p_uf);
  END IF;

  -- ── Status SLA ──────────────────────────────────────────────────────
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

  -- ── Retorno — campos originais + novos (aditivos) ───────────────────
  RETURN jsonb_build_object(
    -- campos originais (inalterados — zero breaking change)
    'demandaId',       p_demanda_id,
    'horasAcumuladas', ROUND(v_total_horas::NUMERIC, 2),
    'prazoHoras',      v_prazo_horas,
    'statusSLA',       v_status_sla,
    'atrasoHoras',     ROUND(v_atraso::NUMERIC, 2),
    'regime',          p_regime,
    'calculadoEm',     NOW(),
    -- campos novos (frontend pode ignorar se não usar ainda)
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
  'fallback automático para valores legados (24x7=240min, padrao=1440min). '
  'Assinatura idêntica à versão anterior — zero breaking change no frontend.';

REVOKE ALL  ON FUNCTION public.calc_sla_demanda(UUID, TEXT, CHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calc_sla_demanda(UUID, TEXT, CHAR) TO authenticated;


-- ============================================================
-- 3. NOVA RPC: fn_sla_dashboard_batch
--    Calcula SLA de múltiplas demandas em uma única call.
--    Elimina N+1 queries no frontend do dashboard.
--    Filtra por team_id, project_id ou contract_id (todos opcionais).
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_sla_dashboard_batch(
  p_team_id      UUID    DEFAULT NULL,
  p_project_id   UUID    DEFAULT NULL,
  p_contract_id  UUID    DEFAULT NULL,
  p_limit        INT     DEFAULT 100,
  p_regime       TEXT    DEFAULT 'padrao',
  p_uf           CHAR(2) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demanda   RECORD;
  v_sla_row   JSONB;
  v_results   JSONB := '[]'::JSONB;
  v_summary   JSONB;
  v_total     INT := 0;
  v_dentro    INT := 0;
  v_em_risco  INT := 0;
  v_violado   INT := 0;
  v_concluido INT := 0;
BEGIN
  FOR v_demanda IN
    SELECT
      d.id,
      d.titulo,
      d.situacao,
      d.sla,
      d.team_id,
      COALESCE(d.project_id,  t.project_id)                    AS project_id,
      COALESCE(d.contract_id, t.contract_id, proj.contract_id) AS contract_id
    FROM   public.demandas  d
    LEFT   JOIN public.teams    t    ON t.id    = d.team_id
    LEFT   JOIN public.projects proj ON proj.id = COALESCE(d.project_id, t.project_id)
    WHERE  d.situacao NOT IN ('cancelada')
      AND  (p_team_id     IS NULL OR d.team_id = p_team_id)
      AND  (p_project_id  IS NULL
              OR d.project_id = p_project_id
              OR t.project_id = p_project_id)
      AND  (p_contract_id IS NULL
              OR d.contract_id      = p_contract_id
              OR t.contract_id      = p_contract_id
              OR proj.contract_id   = p_contract_id)
    ORDER  BY d.created_at DESC
    LIMIT  p_limit
  LOOP
    v_sla_row := public.calc_sla_demanda(v_demanda.id, p_regime, p_uf);

    v_total := v_total + 1;
    CASE v_sla_row->>'statusSLA'
      WHEN 'dentro'    THEN v_dentro    := v_dentro    + 1;
      WHEN 'em_risco'  THEN v_em_risco  := v_em_risco  + 1;
      WHEN 'violado'   THEN v_violado   := v_violado   + 1;
      WHEN 'concluido' THEN v_concluido := v_concluido + 1;
      ELSE NULL;
    END CASE;

    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'demandaId',       v_demanda.id,
        'titulo',          v_demanda.titulo,
        'situacao',        v_demanda.situacao,
        'teamId',          v_demanda.team_id,
        'projectId',       v_demanda.project_id,
        'contractId',      v_demanda.contract_id,
        'horasAcumuladas', v_sla_row->'horasAcumuladas',
        'prazoHoras',      v_sla_row->'prazoHoras',
        'statusSLA',       v_sla_row->>'statusSLA',
        'resolutionPct',   v_sla_row->'resolutionPct',
        'slaColor',        v_sla_row->>'slaColor',
        'slaSource',       v_sla_row->>'slaSource'
      )
    );
  END LOOP;

  v_summary := jsonb_build_object(
    'total',          v_total,
    'dentro',         v_dentro,
    'em_risco',       v_em_risco,
    'violado',        v_violado,
    'concluido',      v_concluido,
    'compliance_pct', CASE WHEN v_total > 0
                        THEN ROUND(((v_dentro + v_concluido)::NUMERIC / v_total) * 100, 1)
                        ELSE 0
                      END
  );

  RETURN jsonb_build_object(
    'summary',  v_summary,
    'demandas', v_results
  );
END;
$$;

COMMENT ON FUNCTION public.fn_sla_dashboard_batch IS
  'Calcula SLA de múltiplas demandas em batch. '
  'Retorna array de resultados + summary com compliance_pct. '
  'Filtra por team_id, project_id ou contract_id (todos opcionais). '
  'Elimina N+1 queries no dashboard de sustentação.';

REVOKE ALL  ON FUNCTION public.fn_sla_dashboard_batch(UUID, UUID, UUID, INT, TEXT, CHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_sla_dashboard_batch(UUID, UUID, UUID, INT, TEXT, CHAR) TO authenticated;


-- ============================================================
-- 4. NOVA RPC: fn_sla_status_summary
--    Resumo leve de compliance agrupado por projeto.
--    Sem calcular hora a hora — rápido para cards do dashboard.
--    Para cálculo preciso por demanda, use fn_sla_dashboard_batch.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_sla_status_summary(
  p_contract_id UUID DEFAULT NULL,
  p_project_id  UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total',          COUNT(*),
    'concluido',      COUNT(*) FILTER (WHERE situacao = 'aceite_final'),
    'ativo',          COUNT(*) FILTER (WHERE situacao NOT IN ('aceite_final','cancelada')),
    'compliance_pct', ROUND(
                        COUNT(*) FILTER (WHERE situacao = 'aceite_final')::NUMERIC
                        / NULLIF(COUNT(*), 0) * 100, 1
                      ),
    'por_projeto', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'projectId',   sub.proj_id,
          'projectName', sub.proj_name,
          'total',       sub.total,
          'concluido',   sub.concluido,
          'ativo',       sub.ativo
        ) ORDER BY sub.total DESC
      )
      FROM (
        SELECT
          p.id   AS proj_id,
          p.name AS proj_name,
          COUNT(d.id)                                                  AS total,
          COUNT(d.id) FILTER (WHERE d.situacao = 'aceite_final')       AS concluido,
          COUNT(d.id) FILTER (WHERE d.situacao NOT IN ('aceite_final','cancelada')) AS ativo
        FROM public.demandas  d
        LEFT JOIN public.teams    t    ON t.id    = d.team_id
        LEFT JOIN public.projects p    ON p.id    = COALESCE(d.project_id, t.project_id)
        WHERE d.situacao != 'cancelada'
          AND (p_contract_id IS NULL OR p.contract_id = p_contract_id)
          AND (p_project_id  IS NULL OR p.id          = p_project_id)
        GROUP BY p.id, p.name
      ) sub
    )
  )
  INTO v_result
  FROM (
    SELECT d.situacao
    FROM public.demandas  d
    LEFT JOIN public.teams    t    ON t.id    = d.team_id
    LEFT JOIN public.projects p    ON p.id    = COALESCE(d.project_id, t.project_id)
    WHERE d.situacao != 'cancelada'
      AND (p_contract_id IS NULL OR p.contract_id = p_contract_id)
      AND (p_project_id  IS NULL OR p.id          = p_project_id)
  ) base;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

COMMENT ON FUNCTION public.fn_sla_status_summary IS
  'Resumo leve de compliance SLA por contrato/projeto para cards do dashboard. '
  'Não calcula hora a hora — use fn_sla_dashboard_batch para cálculo preciso.';

GRANT EXECUTE ON FUNCTION public.fn_sla_status_summary(UUID, UUID) TO authenticated;


-- ============================================================
-- FIM DA MIGRATION
-- Próximo passo: Fase 4 — UI Lovable
--   /contracts  → CRUD contratos + matriz SLA
--   /projects   → CRUD projetos por contrato
--   vinculação team → project
--   SlaStatusBadge dinâmico nas demandas
-- ============================================================
