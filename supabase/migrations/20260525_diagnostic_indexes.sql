-- ============================================================
-- PILAR 2 — Migration: Índices de Performance + Função RPC de Diagnóstico
-- SprintFlow — Sustentação Infra
-- Data: 2026-05-25
-- ============================================================

-- ─── 1. Índices de Performance ──────────────────────────────────────────────
-- Criados com CONCURRENTLY para não bloquear produção durante apply

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_stories_team_id
  ON public.user_stories(team_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_stories_sprint_id
  ON public.user_stories(sprint_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_stories_status
  ON public.user_stories(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_stories_team_sprint
  ON public.user_stories(team_id, sprint_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_hu_id
  ON public.activities(hu_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_team_id
  ON public.activities(team_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_open
  ON public.activities(team_id, is_closed) WHERE is_closed = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sprints_team_id
  ON public.sprints(team_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sprints_status
  ON public.sprints(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_impediments_team_id
  ON public.impediments(team_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_impediments_hu_id
  ON public.impediments(hu_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_epics_team_id
  ON public.epics(team_id);


-- ─── 2. Função RPC para Diagnóstico de Banco (apenas SECURITY DEFINER para admin) ──
-- Permite ao frontend chamar diagnósticos sem expor SQL direto
-- IMPORTANTE: Restringir via RLS — apenas usuários admin devem chamar

CREATE OR REPLACE FUNCTION public.run_diagnostic_query(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Segurança: bloqueia queries destrutivas
  IF sql_query ILIKE '%DROP%'
  OR sql_query ILIKE '%DELETE%'
  OR sql_query ILIKE '%TRUNCATE%'
  OR sql_query ILIKE '%UPDATE%'
  OR sql_query ILIKE '%INSERT%'
  THEN
    RAISE EXCEPTION 'Operações destrutivas não são permitidas via diagnóstico.';
  END IF;

  EXECUTE 'SELECT jsonb_agg(row_to_json(q)) FROM (' || sql_query || ') q'
  INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

-- Concede execução apenas a usuários autenticados (RLS adicional no app)
GRANT EXECUTE ON FUNCTION public.run_diagnostic_query(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.run_diagnostic_query(text) FROM anon;

COMMENT ON FUNCTION public.run_diagnostic_query IS
  'Função de diagnóstico de banco — apenas leitura, bloqueio de DML. Uso: DEV/admin only.';


-- ─── 3. View de Saúde do Pool de Conexões ──────────────────────────────────
CREATE OR REPLACE VIEW public.v_connection_health AS
SELECT
  current_setting('max_connections')::int                        AS max_connections,
  COUNT(*)                                                       AS active_connections,
  SUM(CASE WHEN state = 'idle in transaction' THEN 1 ELSE 0 END) AS idle_in_transaction,
  SUM(CASE WHEN state = 'active'              THEN 1 ELSE 0 END) AS active_queries,
  ROUND(100.0 * COUNT(*) / current_setting('max_connections')::int, 1) AS usage_pct
FROM pg_stat_activity
WHERE datname = current_database();

GRANT SELECT ON public.v_connection_health TO authenticated;

COMMENT ON VIEW public.v_connection_health IS
  'Saúde do pool de conexões PostgreSQL — uso percentual em tempo real.';
