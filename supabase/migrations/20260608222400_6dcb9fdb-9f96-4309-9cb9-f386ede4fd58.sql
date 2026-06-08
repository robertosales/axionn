CREATE OR REPLACE FUNCTION public.get_capacity_planner_sustentacao(
  p_team_ids   uuid[],
  p_team_id    uuid    DEFAULT NULL,
  p_default_cap integer DEFAULT 40
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result    jsonb := '[]'::jsonb;
  v_team_id   uuid;
  v_team_row  jsonb;
  v_devs      jsonb;
  v_week_start timestamptz;
  v_week_end   timestamptz;
  v_closed_statuses text[] := ARRAY[
    'aceite_final','cancelada','fila_concluida','rejeitada','concluido','concluida','done','resolvido'
  ];
BEGIN
  PERFORM public._assert_team_access(p_team_ids);

  IF p_team_ids IS NULL OR array_length(p_team_ids, 1) IS NULL THEN
    RETURN v_result;
  END IF;

  -- Semana corrente (segunda 00:00 → sábado 00:00, cobre seg-sex completos)
  v_week_start := date_trunc('week', now());                  -- segunda 00:00
  v_week_end   := date_trunc('week', now()) + interval '5 days'; -- sábado 00:00

  FOREACH v_team_id IN ARRAY p_team_ids LOOP
    IF p_team_id IS NOT NULL AND v_team_id <> p_team_id THEN
      CONTINUE;
    END IF;

    -- Somente times de Sustentação
    IF NOT EXISTS (
      SELECT 1 FROM public.teams t WHERE t.id = v_team_id AND t.module = 'sustentacao'
    ) THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'devId',            p.user_id,
        'devName',          COALESCE(p.display_name, p.email, 'Sem nome'),
        'teamId',           v_team_id,
        'capacityHours',    p_default_cap,
        'noActiveSprint',   false,
        'allocatedHours',   0::numeric,
        'unestimatedCount', 0,
        'husCount', (
          SELECT COUNT(DISTINCT dr.demanda_id)
          FROM   public.demanda_responsaveis dr
          JOIN   public.demandas d ON d.id = dr.demanda_id
          WHERE  dr.user_id = p.user_id
            AND  d.team_id  = v_team_id
            AND  LOWER(COALESCE(d.situacao,'')) <> ALL(v_closed_statuses)
        ),
        'wipCount', (
          SELECT COUNT(DISTINCT dr.demanda_id)
          FROM   public.demanda_responsaveis dr
          JOIN   public.demandas d ON d.id = dr.demanda_id
          WHERE  dr.user_id = p.user_id
            AND  d.team_id  = v_team_id
            AND  LOWER(COALESCE(d.situacao,'')) <> ALL(v_closed_statuses)
        ),
        'realizedHours', (
          SELECT ROUND(COALESCE(SUM(h.horas), 0)::numeric, 1)
          FROM   public.demanda_hours h
          JOIN   public.demandas d ON d.id = h.demanda_id
          WHERE  h.user_id = p.user_id
            AND  d.team_id = v_team_id
            AND  h.created_at >= v_week_start
            AND  h.created_at <  v_week_end
        )
      ) ORDER BY COALESCE(p.display_name, p.email)
    ), '[]'::jsonb)
    INTO v_devs
    FROM public.team_members tm
    JOIN public.profiles p ON p.user_id = tm.user_id
    WHERE tm.team_id = v_team_id
      AND COALESCE(p.is_active, true) = true;

    SELECT jsonb_build_object(
      'teamId',        v_team_id,
      'sprintAtivo',   'Semana corrente (seg-sex)',
      'sprintEndDate', NULL,
      'devs',          v_devs,
      'totalCapacity', (
        SELECT COUNT(*) * p_default_cap
        FROM   public.team_members tm
        JOIN   public.profiles p ON p.user_id = tm.user_id
        WHERE  tm.team_id = v_team_id
          AND  COALESCE(p.is_active, true) = true
      ),
      'totalAllocated', 0::numeric,
      'totalRealized', (
        SELECT ROUND(COALESCE(SUM(h.horas), 0)::numeric, 1)
        FROM   public.demanda_hours h
        JOIN   public.demandas d ON d.id = h.demanda_id
        WHERE  d.team_id = v_team_id
          AND  h.created_at >= v_week_start
          AND  h.created_at <  v_week_end
      )
    ) INTO v_team_row;

    v_result := v_result || jsonb_build_array(v_team_row);
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_capacity_planner_sustentacao(uuid[], uuid, integer) TO authenticated, service_role;