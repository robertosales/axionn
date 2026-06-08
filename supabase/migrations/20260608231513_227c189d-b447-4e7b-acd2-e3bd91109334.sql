CREATE OR REPLACE FUNCTION public.get_capacity_planner_sustentacao(
  p_team_ids uuid[],
  p_team_id  uuid    DEFAULT NULL,
  p_default_cap integer DEFAULT 40
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result    jsonb := '[]'::jsonb;
  v_team_id   uuid;
  v_team_row  jsonb;
  v_devs      jsonb;
  v_week_start timestamptz;
  v_week_end   timestamptz;
  v_closed_statuses text[] := ARRAY[
    'aceite_final','cancelada','fila_concluida','rejeitada','concluido','concluida','done','resolvido',
    'ag_aceite_final','hom_homologada'
  ];
  v_paused_statuses text[] := ARRAY[
    'bloqueada','aguardando_cliente','aguardando_terceiros','suspensa','suspenso','impeditivo'
  ];
BEGIN
  PERFORM public._assert_team_access(p_team_ids);

  IF p_team_ids IS NULL OR array_length(p_team_ids, 1) IS NULL THEN
    RETURN v_result;
  END IF;

  v_week_start := date_trunc('week', now());
  v_week_end   := date_trunc('week', now()) + interval '5 days';

  FOREACH v_team_id IN ARRAY p_team_ids LOOP
    IF p_team_id IS NOT NULL AND v_team_id <> p_team_id THEN
      CONTINUE;
    END IF;

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
        'allocatedHours', (
          SELECT COALESCE(SUM(d.total_horas), 0)::numeric
          FROM   public.demanda_responsaveis dr
          JOIN   public.demandas d ON d.id = dr.demanda_id
          WHERE  dr.user_id = p.user_id
            AND  d.team_id  = v_team_id
            AND  LOWER(COALESCE(d.situacao,'')) <> ALL(v_closed_statuses)
            AND  LOWER(COALESCE(d.situacao,'')) <> ALL(v_paused_statuses)
        ),
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
            AND  LOWER(COALESCE(d.situacao,'')) <> ALL(v_paused_statuses)
        ),
        'pausedCount', (
          SELECT COUNT(DISTINCT dr.demanda_id)
          FROM   public.demanda_responsaveis dr
          JOIN   public.demandas d ON d.id = dr.demanda_id
          WHERE  dr.user_id = p.user_id
            AND  d.team_id  = v_team_id
            AND  LOWER(COALESCE(d.situacao,'')) = ANY(v_paused_statuses)
        ),
        'slaCriticalCount', (
          SELECT COUNT(DISTINCT d.id)
          FROM   public.demanda_responsaveis dr
          JOIN   public.demandas d ON d.id = dr.demanda_id
          LEFT JOIN LATERAL (
            SELECT cs.resolution_time_minutes
            FROM   public.contract_slas cs
            WHERE  cs.contract_id = d.contract_id
            ORDER BY cs.resolution_time_minutes ASC
            LIMIT 1
          ) sla ON TRUE
          WHERE  dr.user_id = p.user_id
            AND  d.team_id  = v_team_id
            AND  LOWER(COALESCE(d.situacao,'')) <> ALL(v_closed_statuses)
            AND  LOWER(COALESCE(d.situacao,'')) <> ALL(v_paused_statuses)
            AND  (
              (sla.resolution_time_minutes IS NOT NULL
                AND EXTRACT(EPOCH FROM (now() - d.created_at)) / 60.0
                    >= sla.resolution_time_minutes * 0.85)
              OR
              (sla.resolution_time_minutes IS NULL
                AND d.prazo_solucao IS NOT NULL
                AND d.prazo_solucao - now() <= interval '24 hours')
            )
        ),
        'realizedHours', (
          SELECT ROUND(COALESCE(SUM(dh.horas), 0)::numeric, 1)
          FROM   public.demanda_hours dh
          JOIN   public.demandas d ON d.id = dh.demanda_id
          WHERE  dh.user_id = p.user_id
            AND  d.team_id  = v_team_id
            AND  dh.created_at >= v_week_start
            AND  dh.created_at <  v_week_end
        )
      ) ORDER BY COALESCE(p.display_name, p.email)
    ), '[]'::jsonb)
    INTO v_devs
    FROM public.team_members tm
    JOIN public.profiles p ON p.user_id = tm.user_id
    WHERE tm.team_id = v_team_id
      AND COALESCE(p.is_active, true) = true;

    v_team_row := jsonb_build_object(
      'teamId',         v_team_id,
      'sprintAtivo',    'Semana corrente',
      'sprintEndDate',  v_week_end::text,
      'totalCapacity',  (
        SELECT COALESCE(SUM((d->>'capacityHours')::numeric), 0)
        FROM jsonb_array_elements(v_devs) d
      ),
      'totalAllocated', (
        SELECT COALESCE(SUM((d->>'allocatedHours')::numeric), 0)
        FROM jsonb_array_elements(v_devs) d
      ),
      'totalRealized',  (
        SELECT COALESCE(SUM((d->>'realizedHours')::numeric), 0)
        FROM jsonb_array_elements(v_devs) d
      ),
      'devs', v_devs
    );

    v_result := v_result || jsonb_build_array(v_team_row);
  END LOOP;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_capacity_planner_sustentacao(uuid[], uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_capacity_planner_sustentacao(uuid[], uuid, integer) TO authenticated, service_role;