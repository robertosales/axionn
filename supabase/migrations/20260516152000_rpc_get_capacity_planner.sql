-- ============================================================
-- RPC: get_capacity_planner
-- Agrega capacidade dos desenvolvedores por time,
-- baseando-se na sprint ativa de cada time.
--
-- Retorna JSONB com teamCapacities[] contendo devs[] já calculados.
--
-- Parâmetros:
--   p_team_ids    UUID[]  — times a agregar
--   p_team_id     UUID    — NULL = todos os times
--   p_default_cap INT     — capacidade padrão em horas (default 40)
-- ============================================================

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
  v_result      JSONB := '[]'::JSONB;
  v_team_id     UUID;
  v_sprint      RECORD;
  v_team_row    JSONB;
  v_devs        JSONB;
BEGIN

  FOREACH v_team_id IN ARRAY p_team_ids LOOP

    -- Filtro de timeúnico
    IF p_team_id IS NOT NULL AND v_team_id <> p_team_id THEN
      CONTINUE;
    END IF;

    -- Sprint ativa do time
    SELECT s.id, s.name, s.end_date
    INTO   v_sprint
    FROM   sprints s
    WHERE  s.team_id  = v_team_id
      AND  s.is_active = TRUE
    LIMIT  1;

    -- Capacidade por desenvolvedor
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'devId',            d.id,
        'devName',          d.name,
        'teamId',           v_team_id,
        'capacityHours',    COALESCE(d.capacity, p_default_cap),
        'noActiveSprint',   (v_sprint.id IS NULL),

        -- Horas alocadas (estimated_hours das HUs no sprint ativo)
        'allocatedHours', (
          SELECT ROUND(COALESCE(SUM(h.estimated_hours), 0)::NUMERIC, 1)
          FROM   user_stories h
          WHERE  h.sprint_id   = v_sprint.id
            AND  h.assignee_id = d.id
        ),

        -- HUs sem estimativa
        'unestimatedCount', (
          SELECT COUNT(*)
          FROM   user_stories h
          WHERE  h.sprint_id        = v_sprint.id
            AND  h.assignee_id      = d.id
            AND  h.estimated_hours IS NULL
        ),

        -- Total de HUs do dev no sprint
        'husCount', (
          SELECT COUNT(*)
          FROM   user_stories h
          WHERE  h.sprint_id   = v_sprint.id
            AND  h.assignee_id = d.id
        ),

        -- WIP: HUs em progresso (status não concluído, não cancelado, não backlog)
        'wipCount', (
          SELECT COUNT(*)
          FROM   user_stories h
          WHERE  h.sprint_id   = v_sprint.id
            AND  h.assignee_id = d.id
            AND  LOWER(h.status) NOT IN (
                   'concluido','concluida','done','aceite',
                   'aceite_final','ag_aceite_final','resolvido',
                   'cancelada','backlog'
                 )
        ),

        -- Horas realizadas (atividades das HUs do dev no sprint)
        'realizedHours', (
          SELECT ROUND(COALESCE(SUM(a.hours), 0)::NUMERIC, 1)
          FROM   activities a
          WHERE  a.assignee_id = d.id
            AND  a.hu_id IN (
                   SELECT h.id FROM user_stories h
                   WHERE  h.sprint_id   = v_sprint.id
                     AND  h.assignee_id = d.id
                 )
        )
      )
      ORDER BY d.name
    ), '[]'::JSONB)
    INTO v_devs
    FROM developers d
    WHERE d.team_id = v_team_id;

    -- Totais do time
    SELECT jsonb_build_object(
      'teamId',        v_team_id,
      'sprintAtivo',   v_sprint.name,
      'sprintEndDate', v_sprint.end_date,
      'devs',          v_devs,

      -- Totais agregados do time
      'totalCapacity', (
        SELECT COALESCE(SUM(COALESCE(d.capacity, p_default_cap)), 0)
        FROM developers d WHERE d.team_id = v_team_id
      ),
      'totalAllocated', (
        SELECT ROUND(COALESCE(SUM(h.estimated_hours), 0)::NUMERIC, 1)
        FROM   user_stories h
        JOIN   developers d ON d.id = h.assignee_id AND d.team_id = v_team_id
        WHERE  h.sprint_id = v_sprint.id
      ),
      'totalRealized', (
        SELECT ROUND(COALESCE(SUM(a.hours), 0)::NUMERIC, 1)
        FROM   activities a
        JOIN   developers d ON d.id = a.assignee_id AND d.team_id = v_team_id
        WHERE  a.hu_id IN (
          SELECT h.id FROM user_stories h WHERE h.sprint_id = v_sprint.id
        )
      )
    ) INTO v_team_row;

    v_result := v_result || jsonb_build_array(v_team_row);

  END LOOP;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION get_capacity_planner(UUID[], UUID, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_capacity_planner(UUID[], UUID, INT) TO authenticated;

COMMENT ON FUNCTION get_capacity_planner IS
  'Agrega capacidade dos devs por time com base na sprint ativa. Substitui fetch de 4 tabelas no cliente.';
