-- ============================================================
-- RPC: get_admin_kpis
-- Agrega KPIs administrativos por time diretamente no banco,
-- eliminando o fetch de milhares de linhas para o cliente.
--
-- Retorna um JSON por time com:
--   sprint ativa, HUs, velocity, impedimentos, backlog,
--   demandas e SLA em risco.
--
-- Parâmetros:
--   p_team_ids  UUID[]  — lista de times a agregar
--   p_sla_dias  INT     — dias para considerar SLA em risco (default 5)
-- ============================================================

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
  v_limite_risco := NOW() - (p_sla_dias || ' days')::INTERVAL;

  FOREACH v_team_id IN ARRAY p_team_ids LOOP

    -- Sprint ativa do time
    SELECT s.id, s.name, s.end_date, s.is_active, s.closed_at, s.delay_days
    INTO   v_sprint
    FROM   sprints s
    WHERE  s.team_id  = v_team_id
      AND  s.is_active = TRUE
    LIMIT  1;

    -- Status semântico da sprint
    IF v_sprint.id IS NOT NULL THEN
      IF v_sprint.end_date IS NULL THEN
        v_sprint_status := 'ativa';
        v_delay_days    := 0;
      ELSIF v_sprint.end_date::DATE < CURRENT_DATE THEN
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
      'teamId',   v_team_id,

      -- Sprint ativa
      'sprintAtivo',      v_sprint.name,
      'sprintEndDate',    v_sprint.end_date,
      'sprintStatus',     v_sprint_status,
      'sprintDelayDays',  v_delay_days,

      -- HUs no sprint ativo
      'totalHUs', (
        SELECT COUNT(*)
        FROM   user_stories h
        WHERE  h.team_id   = v_team_id
          AND  h.sprint_id = v_sprint.id   -- NULL-safe: só conta se sprint ativa existe
      ),
      'husConcluidasNoSprint', (
        SELECT COUNT(*)
        FROM   user_stories h
        WHERE  h.team_id   = v_team_id
          AND  h.sprint_id = v_sprint.id
          AND  LOWER(h.status) IN (
                 'concluido','concluida','done','aceite',
                 'aceite_final','ag_aceite_final','resolvido'
               )
      ),
      'velocityPontos', (
        SELECT COALESCE(SUM(h.story_points), 0)
        FROM   user_stories h
        WHERE  h.team_id   = v_team_id
          AND  h.sprint_id = v_sprint.id
          AND  LOWER(h.status) IN (
                 'concluido','concluida','done','aceite',
                 'aceite_final','ag_aceite_final','resolvido'
               )
      ),

      -- Backlog (HUs sem sprint)
      'backlogTotal', (
        SELECT COUNT(*)
        FROM   user_stories h
        WHERE  h.team_id   = v_team_id
          AND  h.sprint_id IS NULL
      ),

      -- Impedimentos abertos
      'impedimentosAbertos', (
        SELECT COUNT(*)
        FROM   impediments i
        WHERE  i.team_id     = v_team_id
          AND  i.resolved_at IS NULL
      ),

      -- Demandas
      'demandasAbertas', (
        SELECT COUNT(*)
        FROM   demandas d
        WHERE  d.team_id = v_team_id
          AND  LOWER(COALESCE(d.situacao,'')) NOT IN (
                 'concluido','concluida','done','aceite',
                 'aceite_final','ag_aceite_final','resolvido'
               )
      ),
      'demandasConcluidas', (
        SELECT COUNT(*)
        FROM   demandas d
        WHERE  d.team_id = v_team_id
          AND  LOWER(COALESCE(d.situacao,'')) IN (
                 'concluido','concluida','done','aceite',
                 'aceite_final','ag_aceite_final','resolvido'
               )
      ),
      'demandasBloqueadas', (
        SELECT COUNT(*)
        FROM   demandas d
        WHERE  d.team_id = v_team_id
          AND  LOWER(COALESCE(d.situacao,'')) IN ('bloqueada','bloqueado')
      ),
      'slaEmRisco', (
        SELECT COUNT(*)
        FROM   demandas d
        WHERE  d.team_id    = v_team_id
          AND  d.created_at <= v_limite_risco
          AND  LOWER(COALESCE(d.situacao,'')) NOT IN (
                 'concluido','concluida','done','aceite',
                 'aceite_final','ag_aceite_final','resolvido'
               )
      )
    ) INTO v_team_kpi;

    v_result := v_result || jsonb_build_array(v_team_kpi);

  END LOOP;

  RETURN v_result;
END;
$$;

-- Garante que apenas usuários autenticados podem chamar
REVOKE ALL ON FUNCTION get_admin_kpis(UUID[], INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_admin_kpis(UUID[], INT) TO authenticated;

COMMENT ON FUNCTION get_admin_kpis IS
  'Agrega KPIs administrativos por time. Substitui fetch massivo no cliente.';
