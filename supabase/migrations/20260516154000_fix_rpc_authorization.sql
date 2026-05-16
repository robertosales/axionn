-- ============================================================
-- HOTFIX #2: validação de autorização nas RPCs SECURITY DEFINER
--
-- Problema: RPCs com SECURITY DEFINER bypassam RLS.
-- Um usuário autenticado poderia passar p_team_ids arbitrários
-- e acessar dados de times aos quais não pertence.
--
-- Solução: no início de cada RPC, validar que todos os
-- p_team_ids passados pertencem ao usuário autenticado
-- (auth.uid()) via tabela team_members.
--
-- Assume que existe tabela team_members(user_id UUID, team_id UUID).
-- Ajuste o nome da tabela/coluna se diferente no seu schema.
-- ============================================================

-- ── Helper: valida se uid tem acesso a todos os team_ids ────────────────────
CREATE OR REPLACE FUNCTION _assert_team_access(p_team_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_allowed_ids  UUID[];
  v_unauthorized UUID[];
BEGIN
  -- Usuário não autenticado
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Times que o usuário realmente pode acessar
  SELECT ARRAY_AGG(tm.team_id)
  INTO   v_allowed_ids
  FROM   team_members tm
  WHERE  tm.user_id = v_uid
    AND  tm.team_id = ANY(p_team_ids);

  -- Times solicitados que não estão na lista permitida
  SELECT ARRAY_AGG(t)
  INTO   v_unauthorized
  FROM   UNNEST(p_team_ids) AS t
  WHERE  t <> ALL(COALESCE(v_allowed_ids, ARRAY[]::UUID[]));

  IF v_unauthorized IS NOT NULL AND array_length(v_unauthorized, 1) > 0 THEN
    RAISE EXCEPTION 'Acesso negado aos times: %', v_unauthorized
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION _assert_team_access(UUID[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION _assert_team_access(UUID[]) TO authenticated;

-- ── get_admin_kpis: adiciona validação no início ────────────────────────────
CREATE OR REPLACE FUNCTION get_admin_kpis(
  p_team_ids  UUID[],
  p_sla_dias  INT DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result        JSONB := '[]'::JSONB;
  v_team_id       UUID;
  v_limite_risco  TIMESTAMPTZ;
  v_sprint        RECORD;
  v_team_kpi      JSONB;
  v_delay_days    INT;
  v_sprint_status TEXT;
BEGIN
  -- ✔ Validação de autorização
  PERFORM _assert_team_access(p_team_ids);

  v_limite_risco := NOW() - (p_sla_dias || ' days')::INTERVAL;

  FOREACH v_team_id IN ARRAY p_team_ids LOOP

    SELECT s.id, s.name, s.end_date, s.is_active, s.closed_at, s.delay_days
    INTO   v_sprint
    FROM   sprints s
    WHERE  s.team_id  = v_team_id
      AND  s.is_active = TRUE
    LIMIT  1;

    IF v_sprint.id IS NOT NULL THEN
      IF v_sprint.closed_at IS NOT NULL AND v_sprint.delay_days IS NOT NULL THEN
        v_sprint_status := 'encerrada';
        v_delay_days    := v_sprint.delay_days;
      ELSIF v_sprint.closed_at IS NOT NULL THEN
        v_sprint_status := 'encerrada_sem_registro';
        v_delay_days    := 0;
      ELSIF v_sprint.end_date IS NOT NULL AND v_sprint.end_date::DATE < CURRENT_DATE THEN
        v_sprint_status := 'ativa_atrasada';
        v_delay_days    := CURRENT_DATE - v_sprint.end_date::DATE;
      ELSE
        v_sprint_status := 'ativa';
        v_delay_days    := 0;
      END IF;
    ELSE
      v_sprint_status := NULL;
      v_delay_days    := 0;
    END IF;

    SELECT jsonb_build_object(
      'teamId',              v_team_id,
      'sprintAtivo',         v_sprint.name,
      'sprintEndDate',       v_sprint.end_date,
      'sprintStatus',        v_sprint_status,
      'sprintDelayDays',     v_delay_days,
      'totalHUs', (
        SELECT COUNT(*) FROM user_stories h
        WHERE  h.team_id = v_team_id AND h.sprint_id = v_sprint.id
      ),
      'husConcluidasNoSprint', (
        SELECT COUNT(*) FROM user_stories h
        WHERE  h.team_id = v_team_id AND h.sprint_id = v_sprint.id
          AND  LOWER(h.status) IN ('concluido','concluida','done','aceite','aceite_final','ag_aceite_final','resolvido')
      ),
      'velocityPontos', (
        SELECT COALESCE(SUM(h.story_points), 0) FROM user_stories h
        WHERE  h.team_id = v_team_id AND h.sprint_id = v_sprint.id
          AND  LOWER(h.status) IN ('concluido','concluida','done','aceite','aceite_final','ag_aceite_final','resolvido')
      ),
      'backlogTotal', (
        SELECT COUNT(*) FROM user_stories h
        WHERE  h.team_id = v_team_id AND h.sprint_id IS NULL
      ),
      'impedimentosAbertos', (
        SELECT COUNT(*) FROM impediments i
        WHERE  i.team_id = v_team_id AND i.resolved_at IS NULL
      ),
      'demandasAbertas', (
        SELECT COUNT(*) FROM demandas d
        WHERE  d.team_id = v_team_id
          AND  LOWER(COALESCE(d.situacao,'')) NOT IN ('concluido','concluida','done','aceite','aceite_final','ag_aceite_final','resolvido')
      ),
      'demandasConcluidas', (
        SELECT COUNT(*) FROM demandas d
        WHERE  d.team_id = v_team_id
          AND  LOWER(COALESCE(d.situacao,'')) IN ('concluido','concluida','done','aceite','aceite_final','ag_aceite_final','resolvido')
      ),
      'demandasBloqueadas', (
        SELECT COUNT(*) FROM demandas d
        WHERE  d.team_id = v_team_id
          AND  LOWER(COALESCE(d.situacao,'')) IN ('bloqueada','bloqueado')
      ),
      'slaEmRisco', (
        SELECT COUNT(*) FROM demandas d
        WHERE  d.team_id = v_team_id
          AND  d.created_at <= v_limite_risco
          AND  LOWER(COALESCE(d.situacao,'')) NOT IN ('concluido','concluida','done','aceite','aceite_final','ag_aceite_final','resolvido')
      )
    ) INTO v_team_kpi;

    v_result := v_result || jsonb_build_array(v_team_kpi);
  END LOOP;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION get_admin_kpis(UUID[], INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_admin_kpis(UUID[], INT) TO authenticated;

-- ── get_sprint_history: adiciona validação no início ────────────────────────
CREATE OR REPLACE FUNCTION get_sprint_history(
  p_team_ids  UUID[],
  p_team_id   UUID   DEFAULT NULL,
  p_cutoff    DATE   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics     JSONB := '[]'::JSONB;
  v_comparativo JSONB := '[]'::JSONB;
  v_sprint      RECORD;
  v_row         JSONB;
BEGIN
  -- ✔ Validação de autorização
  PERFORM _assert_team_access(p_team_ids);

  FOR v_sprint IN
    SELECT s.id, s.name, s.goal, s.start_date, s.end_date, s.team_id
    FROM   sprints s
    WHERE  s.is_active = FALSE
      AND  s.team_id   = ANY(p_team_ids)
      AND  (p_team_id IS NULL OR s.team_id = p_team_id)
      AND  (p_cutoff  IS NULL OR s.end_date::DATE >= p_cutoff)
    ORDER  BY s.end_date DESC
  LOOP
    SELECT jsonb_build_object(
      'sprintId',    v_sprint.id,
      'sprintName',  v_sprint.name,
      'teamId',      v_sprint.team_id,
      'startDate',   v_sprint.start_date,
      'endDate',     v_sprint.end_date,
      'goal',        v_sprint.goal,
      'durationDays', (
        EXTRACT(DAY FROM (v_sprint.end_date::TIMESTAMPTZ - v_sprint.start_date::TIMESTAMPTZ))::INT
      ),
      'totalHUs', (
        SELECT COUNT(*) FROM user_stories h WHERE h.sprint_id = v_sprint.id
      ),
      'husConcluidadas', (
        SELECT COUNT(*) FROM user_stories h
        WHERE  h.sprint_id = v_sprint.id
          AND  LOWER(h.status) IN ('concluido','concluida','done','aceite','aceite_final','ag_aceite_final','resolvido')
      ),
      'taxaConclusao', (
        SELECT CASE WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND(100.0 * COUNT(*) FILTER (
            WHERE LOWER(h.status) IN ('concluido','concluida','done','aceite','aceite_final','ag_aceite_final','resolvido')
          ) / COUNT(*))
        END
        FROM user_stories h WHERE h.sprint_id = v_sprint.id
      ),
      'velocityPontos', (
        SELECT COALESCE(SUM(h.story_points), 0) FROM user_stories h
        WHERE  h.sprint_id = v_sprint.id
          AND  LOWER(h.status) IN ('concluido','concluida','done','aceite','aceite_final','ag_aceite_final','resolvido')
      ),
      'horasPlanejadas', (
        SELECT ROUND(COALESCE(SUM(h.estimated_hours), 0)::NUMERIC, 1)
        FROM   user_stories h WHERE h.sprint_id = v_sprint.id
      ),
      'horasRealizadas', (
        SELECT ROUND(COALESCE(SUM(a.hours), 0)::NUMERIC, 1)
        FROM   activities a
        WHERE  a.hu_id IN (SELECT id FROM user_stories WHERE sprint_id = v_sprint.id)
      ),
      'desvioHoras', (
        SELECT ROUND(
          COALESCE(SUM(a.hours), 0)::NUMERIC -
          COALESCE((SELECT SUM(h2.estimated_hours) FROM user_stories h2 WHERE h2.sprint_id = v_sprint.id), 0)::NUMERIC
        , 1)
        FROM activities a
        WHERE a.hu_id IN (SELECT id FROM user_stories WHERE sprint_id = v_sprint.id)
      ),
      'impedimentos', (
        SELECT COUNT(*) FROM impediments i
        WHERE  i.sprint_id = v_sprint.id
          OR   i.hu_id IN (SELECT id FROM user_stories WHERE sprint_id = v_sprint.id)
      ),
      'devStats', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'developerId',    COALESCE(h.assignee_id::TEXT, '__unassigned__'),
            'developerName',  COALESCE(dev.name, 'Não atribuído'),
            'husCount',       COUNT(h.id),
            'estimatedHours', ROUND(COALESCE(SUM(h.estimated_hours), 0)::NUMERIC, 1),
            'realizedHours',  ROUND(COALESCE(SUM(lh.total_hours), 0)::NUMERIC, 1)
          ) ORDER BY COUNT(h.id) DESC
        ), '[]'::JSONB)
        FROM user_stories h
        LEFT JOIN developers dev
          ON dev.id = h.assignee_id AND dev.team_id = v_sprint.team_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(a.hours), 0) AS total_hours
          FROM   activities a WHERE a.hu_id = h.id
        ) lh ON TRUE
        WHERE h.sprint_id = v_sprint.id
        GROUP BY h.assignee_id, dev.name
      )
    ) INTO v_row;

    v_metrics := v_metrics || jsonb_build_array(v_row);
  END LOOP;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'teamId',            t_agg.team_id,
      'totalSprints',      t_agg.total_sprints,
      'avgVelocity',       ROUND(t_agg.avg_velocity::NUMERIC, 1),
      'avgTaxaConclusao',  ROUND(t_agg.avg_taxa::NUMERIC,     1),
      'avgDesvioHoras',    ROUND(t_agg.avg_desvio::NUMERIC,   1),
      'totalImpedimentos', t_agg.total_impedimentos,
      'semDados',          (t_agg.total_sprints = 0)
    )
  ), '[]'::JSONB)
  INTO v_comparativo
  FROM (
    SELECT
      s.team_id,
      COUNT(s.id) AS total_sprints,
      AVG(COALESCE((SELECT SUM(h.story_points) FROM user_stories h
        WHERE h.sprint_id = s.id
          AND LOWER(h.status) IN ('concluido','concluida','done','aceite','aceite_final','ag_aceite_final','resolvido')
      ), 0)) AS avg_velocity,
      AVG(CASE WHEN (SELECT COUNT(*) FROM user_stories h WHERE h.sprint_id = s.id) = 0 THEN 0
        ELSE 100.0 * (SELECT COUNT(*) FROM user_stories h WHERE h.sprint_id = s.id
          AND LOWER(h.status) IN ('concluido','concluida','done','aceite','aceite_final','ag_aceite_final','resolvido')
        ) / (SELECT COUNT(*) FROM user_stories h WHERE h.sprint_id = s.id)
      END) AS avg_taxa,
      AVG(
        COALESCE((SELECT SUM(a.hours) FROM activities a
          WHERE a.hu_id IN (SELECT id FROM user_stories WHERE sprint_id = s.id)), 0) -
        COALESCE((SELECT SUM(h.estimated_hours) FROM user_stories h WHERE h.sprint_id = s.id), 0)
      ) AS avg_desvio,
      SUM((SELECT COUNT(*) FROM impediments i
        WHERE i.sprint_id = s.id
          OR  i.hu_id IN (SELECT id FROM user_stories WHERE sprint_id = s.id)
      )) AS total_impedimentos
    FROM sprints s
    WHERE s.is_active = FALSE
      AND s.team_id   = ANY(p_team_ids)
      AND (p_team_id IS NULL OR s.team_id = p_team_id)
      AND (p_cutoff  IS NULL OR s.end_date::DATE >= p_cutoff)
    GROUP BY s.team_id
  ) t_agg;

  RETURN jsonb_build_object('metrics', v_metrics, 'comparativo', v_comparativo);
END;
$$;

REVOKE ALL ON FUNCTION get_sprint_history(UUID[], UUID, DATE) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_sprint_history(UUID[], UUID, DATE) TO authenticated;

-- ── get_capacity_planner: adiciona validação no início ──────────────────────
CREATE OR REPLACE FUNCTION get_capacity_planner(
  p_team_ids    UUID[],
  p_team_id     UUID  DEFAULT NULL,
  p_default_cap INT   DEFAULT 40
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result   JSONB := '[]'::JSONB;
  v_team_id  UUID;
  v_sprint   RECORD;
  v_team_row JSONB;
  v_devs     JSONB;
BEGIN
  -- ✔ Validação de autorização
  PERFORM _assert_team_access(p_team_ids);

  FOREACH v_team_id IN ARRAY p_team_ids LOOP

    IF p_team_id IS NOT NULL AND v_team_id <> p_team_id THEN
      CONTINUE;
    END IF;

    SELECT s.id, s.name, s.end_date
    INTO   v_sprint
    FROM   sprints s
    WHERE  s.team_id  = v_team_id AND s.is_active = TRUE
    LIMIT  1;

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'devId',            d.id,
        'devName',          d.name,
        'teamId',           v_team_id,
        'capacityHours',    COALESCE(d.capacity, p_default_cap),
        'noActiveSprint',   (v_sprint.id IS NULL),
        'allocatedHours', CASE WHEN v_sprint.id IS NULL THEN 0::NUMERIC ELSE (
          SELECT ROUND(COALESCE(SUM(h.estimated_hours), 0)::NUMERIC, 1)
          FROM   user_stories h
          WHERE  h.sprint_id = v_sprint.id AND h.assignee_id = d.id
        ) END,
        'unestimatedCount', CASE WHEN v_sprint.id IS NULL THEN 0 ELSE (
          SELECT COUNT(*) FROM user_stories h
          WHERE  h.sprint_id = v_sprint.id AND h.assignee_id = d.id
            AND  h.estimated_hours IS NULL
        ) END,
        'husCount', CASE WHEN v_sprint.id IS NULL THEN 0 ELSE (
          SELECT COUNT(*) FROM user_stories h
          WHERE  h.sprint_id = v_sprint.id AND h.assignee_id = d.id
        ) END,
        'wipCount', CASE WHEN v_sprint.id IS NULL THEN 0 ELSE (
          SELECT COUNT(*) FROM user_stories h
          WHERE  h.sprint_id = v_sprint.id AND h.assignee_id = d.id
            AND  LOWER(h.status) NOT IN (
                   'concluido','concluida','done','aceite','aceite_final',
                   'ag_aceite_final','resolvido','cancelada','backlog'
                 )
        ) END,
        'realizedHours', CASE WHEN v_sprint.id IS NULL THEN 0::NUMERIC ELSE (
          SELECT ROUND(COALESCE(SUM(a.hours), 0)::NUMERIC, 1)
          FROM   activities a
          WHERE  a.assignee_id = d.id
            AND  a.hu_id IN (
                   SELECT h.id FROM user_stories h
                   WHERE  h.sprint_id = v_sprint.id AND h.assignee_id = d.id
                 )
        ) END
      ) ORDER BY d.name
    ), '[]'::JSONB)
    INTO v_devs
    FROM developers d WHERE d.team_id = v_team_id;

    SELECT jsonb_build_object(
      'teamId',        v_team_id,
      'sprintAtivo',   v_sprint.name,
      'sprintEndDate', v_sprint.end_date,
      'devs',          v_devs,
      'totalCapacity', (
        SELECT COALESCE(SUM(COALESCE(d.capacity, p_default_cap)), 0)
        FROM developers d WHERE d.team_id = v_team_id
      ),
      'totalAllocated', CASE WHEN v_sprint.id IS NULL THEN 0::NUMERIC ELSE (
        SELECT ROUND(COALESCE(SUM(h.estimated_hours), 0)::NUMERIC, 1)
        FROM   user_stories h
        JOIN   developers d ON d.id = h.assignee_id AND d.team_id = v_team_id
        WHERE  h.sprint_id = v_sprint.id
      ) END,
      'totalRealized', CASE WHEN v_sprint.id IS NULL THEN 0::NUMERIC ELSE (
        SELECT ROUND(COALESCE(SUM(a.hours), 0)::NUMERIC, 1)
        FROM   activities a
        JOIN   developers d ON d.id = a.assignee_id AND d.team_id = v_team_id
        WHERE  a.hu_id IN (
          SELECT h.id FROM user_stories h WHERE h.sprint_id = v_sprint.id
        )
      ) END
    ) INTO v_team_row;

    v_result := v_result || jsonb_build_array(v_team_row);
  END LOOP;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION get_capacity_planner(UUID[], UUID, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_capacity_planner(UUID[], UUID, INT) TO authenticated;

COMMENT ON FUNCTION _assert_team_access IS
  'Valida que auth.uid() tem acesso a todos os p_team_ids. Lança insufficient_privilege se negado.';
