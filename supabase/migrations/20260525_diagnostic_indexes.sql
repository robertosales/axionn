-- ============================================================
-- PILAR 2 — Índices de Performance + Diagnóstico restrito
-- ============================================================

-- A CLI do Supabase executa migrations em pipeline transacional; por isso,
-- CREATE INDEX CONCURRENTLY não é válido neste contexto. IF NOT EXISTS mantém
-- o replay idempotente sem alterar o conjunto final de índices.

CREATE INDEX IF NOT EXISTS idx_user_stories_team_id
  ON public.user_stories(team_id);

CREATE INDEX IF NOT EXISTS idx_user_stories_sprint_id
  ON public.user_stories(sprint_id);

CREATE INDEX IF NOT EXISTS idx_user_stories_status
  ON public.user_stories(status);

CREATE INDEX IF NOT EXISTS idx_user_stories_team_sprint
  ON public.user_stories(team_id, sprint_id);

CREATE INDEX IF NOT EXISTS idx_activities_hu_id
  ON public.activities(hu_id);

CREATE INDEX IF NOT EXISTS idx_activities_team_id
  ON public.activities(team_id);

CREATE INDEX IF NOT EXISTS idx_activities_open
  ON public.activities(team_id, is_closed)
  WHERE is_closed = false;

CREATE INDEX IF NOT EXISTS idx_sprints_team_id
  ON public.sprints(team_id);

CREATE INDEX IF NOT EXISTS idx_sprints_status
  ON public.sprints(status);

CREATE INDEX IF NOT EXISTS idx_impediments_team_id
  ON public.impediments(team_id);

CREATE INDEX IF NOT EXISTS idx_impediments_hu_id
  ON public.impediments(hu_id);

CREATE INDEX IF NOT EXISTS idx_epics_team_id
  ON public.epics(team_id);

-- Diagnóstico arbitrário não deve ser exposto ao cliente autenticado. A função
-- permanece disponível apenas ao backend da plataforma para manutenção.
CREATE OR REPLACE FUNCTION public.run_diagnostic_query(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result jsonb;
BEGIN
  IF sql_query !~* '^\s*select\s+' THEN
    RAISE EXCEPTION 'Apenas consultas SELECT são permitidas.';
  END IF;

  IF sql_query ~* '(;|\b(drop|delete|truncate|update|insert|alter|create|grant|revoke|copy|call|do)\b)' THEN
    RAISE EXCEPTION 'Comando não permitido no diagnóstico.';
  END IF;

  EXECUTE 'SELECT jsonb_agg(row_to_json(q)) FROM (' || sql_query || ') q'
  INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

REVOKE ALL ON FUNCTION public.run_diagnostic_query(text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_diagnostic_query(text) TO service_role;

COMMENT ON FUNCTION public.run_diagnostic_query(text) IS
  'Diagnóstico somente leitura restrito ao service_role; não exposto ao frontend.';

CREATE OR REPLACE VIEW public.v_connection_health
WITH (security_invoker = true)
AS
SELECT
  current_setting('max_connections')::int AS max_connections,
  COUNT(*) AS active_connections,
  SUM(CASE WHEN state = 'idle in transaction' THEN 1 ELSE 0 END) AS idle_in_transaction,
  SUM(CASE WHEN state = 'active' THEN 1 ELSE 0 END) AS active_queries,
  ROUND(
    100.0 * COUNT(*) / current_setting('max_connections')::int,
    1
  ) AS usage_pct
FROM pg_stat_activity
WHERE datname = current_database();

REVOKE ALL ON public.v_connection_health FROM public, anon, authenticated;
GRANT SELECT ON public.v_connection_health TO service_role;

COMMENT ON VIEW public.v_connection_health IS
  'Saúde do pool PostgreSQL, restrita ao backend de operação.';
