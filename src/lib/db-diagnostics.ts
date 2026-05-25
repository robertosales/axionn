/**
 * PILAR 2 — Diagnóstico de Banco de Dados
 * Slow Queries, Deadlocks, Índices ausentes, Pool de conexões, Tabelas volumosas.
 *
 * COMO USAR:
 *   1. Cole cada query SQL no Supabase Dashboard → SQL Editor
 *   2. Em produção, chame runDiagnostics() no console do browser (DEV only)
 *   3. Os resultados são enviados automaticamente ao Sentry se severity >= warning
 *
 * PRÉ-REQUISITO: extensão pg_stat_statements habilitada no Supabase
 *   → Supabase Dashboard → Database → Extensions → pg_stat_statements → Enable
 */

import * as Sentry from '@sentry/react';
import { supabase } from '@/integrations/supabase/client';

// ─── Thresholds ────────────────────────────────────────────────────────────
const THRESHOLDS = {
  slowQueryMs:        500,   // queries acima de 500ms são lentas
  criticalQueryMs:   2000,   // queries acima de 2s são críticas
  maxConnections:      80,   // % do max_connections que dispara alerta
  tableRowsWarn:   100_000, // tabelas acima de 100k linhas sem índice
};

// ─── SQL Queries de Diagnóstico ───────────────────────────────────────────

export const SQL_DIAGNOSTICS = {
  /**
   * TOP 10 Slow Queries
   * Identifica as consultas mais lentas acumuladas desde o último reset.
   * Requer: pg_stat_statements
   */
  slowQueries: `
SELECT
  LEFT(query, 120)                          AS query_preview,
  calls,
  ROUND((mean_exec_time)::numeric, 2)       AS avg_ms,
  ROUND((max_exec_time)::numeric, 2)        AS max_ms,
  ROUND((total_exec_time)::numeric, 2)      AS total_ms,
  ROUND((stddev_exec_time)::numeric, 2)     AS stddev_ms,
  rows
FROM pg_stat_statements
WHERE query NOT ILIKE '%pg_stat%'
  AND mean_exec_time > ${THRESHOLDS.slowQueryMs}
ORDER BY mean_exec_time DESC
LIMIT 10;`,

  /**
   * Conexões ativas e idle por estado
   * Identifica pool esgotado e conexões presas (idle in transaction).
   */
  activeConnections: `
SELECT
  state,
  COUNT(*)                       AS count,
  MAX(EXTRACT(EPOCH FROM (NOW() - state_change)))::int AS max_age_sec,
  usename
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state, usename
ORDER BY count DESC;`,

  /**
   * Deadlocks detectados
   * Registros de deadlocks no pg_stat_database.
   */
  deadlocks: `
SELECT
  datname,
  deadlocks,
  conflicts,
  temp_files,
  temp_bytes / 1024 / 1024 AS temp_mb,
  blk_read_time,
  blk_write_time
FROM pg_stat_database
WHERE datname = current_database();`,

  /**
   * Tabelas sem índice adequado (Sequential Scans excessivos)
   * Alta razão seq_scan/idx_scan = candidato para índice.
   */
  missingIndexes: `
SELECT
  schemaname,
  relname                                        AS table_name,
  seq_scan,
  idx_scan,
  seq_tup_read,
  n_live_tup                                     AS row_count,
  ROUND(100.0 * seq_scan / NULLIF(seq_scan + idx_scan, 0), 1) AS seq_scan_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND seq_scan > 100
  AND n_live_tup > ${THRESHOLDS.tableRowsWarn}
ORDER BY seq_scan DESC
LIMIT 15;`,

  /**
   * Índices não utilizados (candidatos a remoção para aliviar I/O de writes)
   */
  unusedIndexes: `
SELECT
  schemaname,
  relname    AS table_name,
  indexrelname AS index_name,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexrelname NOT ILIKE '%pkey%'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 10;`,

  /**
   * Tabelas mais volumosas (tamanho total incluindo índices)
   */
  largestTables: `
SELECT
  relname                                                      AS table_name,
  n_live_tup                                                   AS row_count,
  pg_size_pretty(pg_total_relation_size(relid))                AS total_size,
  pg_size_pretty(pg_relation_size(relid))                      AS table_size,
  pg_size_pretty(pg_indexes_size(relid))                       AS indexes_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;`,

  /**
   * Locks ativos — identifica queries bloqueando outras
   */
  activeLocks: `
SELECT
  pid,
  usename,
  LEFT(query, 100)   AS query_preview,
  state,
  wait_event_type,
  wait_event,
  EXTRACT(EPOCH FROM (NOW() - query_start))::int AS age_sec
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start IS NOT NULL
  AND EXTRACT(EPOCH FROM (NOW() - query_start)) > 5
ORDER BY age_sec DESC
LIMIT 10;`,

  /**
   * Pool de conexões — uso atual vs. máximo
   */
  connectionPool: `
SELECT
  current_setting('max_connections')::int   AS max_connections,
  COUNT(*)                                  AS active_connections,
  ROUND(100.0 * COUNT(*) / current_setting('max_connections')::int, 1) AS usage_pct
FROM pg_stat_activity
WHERE datname = current_database();`,

  /**
   * Índices recomendados para o SprintFlow (tabelas críticas)
   * Execute no SQL Editor do Supabase para criar os índices necessários.
   */
  createRecommendedIndexes: `
-- Índices recomendados para o SprintFlow
-- Execute com CONCURRENTLY para não bloquear produção

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_stories_team_id
  ON user_stories(team_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_stories_sprint_id
  ON user_stories(sprint_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_stories_status
  ON user_stories(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_hu_id
  ON activities(hu_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_team_id
  ON activities(team_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_is_closed
  ON activities(is_closed) WHERE is_closed = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sprints_team_id
  ON sprints(team_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sprints_status
  ON sprints(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_impediments_team_id
  ON impediments(team_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_impediments_hu_id
  ON impediments(hu_id);
`,
};

// ─── Runner de diagnóstico (DEV + admin only) ─────────────────────────────
export interface DiagnosticReport {
  timestamp: string;
  slowQueries:        unknown[];
  activeConnections:  unknown[];
  deadlocks:          unknown[];
  missingIndexes:     unknown[];
  unusedIndexes:      unknown[];
  largestTables:      unknown[];
  activeLocks:        unknown[];
  connectionPool:     unknown[];
  alerts:             DiagnosticAlert[];
}

export interface DiagnosticAlert {
  severity: 'info' | 'warning' | 'critical';
  category: string;
  message: string;
  data?: unknown;
}

function analyzeResults(
  results: Omit<DiagnosticReport, 'timestamp' | 'alerts'>
): DiagnosticAlert[] {
  const alerts: DiagnosticAlert[] = [];

  // Slow queries
  if (results.slowQueries.length > 0) {
    alerts.push({
      severity: 'warning',
      category: 'slow-queries',
      message: `${results.slowQueries.length} queries lentas detectadas (> ${THRESHOLDS.slowQueryMs}ms)`,
      data: results.slowQueries,
    });
  }

  // Pool de conexões
  const pool = results.connectionPool[0] as Record<string, number> | undefined;
  if (pool && pool.usage_pct >= THRESHOLDS.maxConnections) {
    alerts.push({
      severity: pool.usage_pct >= 95 ? 'critical' : 'warning',
      category: 'connection-pool',
      message: `Pool de conexões em ${pool.usage_pct}% (${pool.active_connections}/${pool.max_connections})`,
      data: pool,
    });
  }

  // Deadlocks
  const db = results.deadlocks[0] as Record<string, number> | undefined;
  if (db && db.deadlocks > 0) {
    alerts.push({
      severity: 'critical',
      category: 'deadlocks',
      message: `${db.deadlocks} deadlock(s) detectados no banco`,
      data: db,
    });
  }

  // Tabelas sem índice
  if (results.missingIndexes.length > 0) {
    alerts.push({
      severity: 'warning',
      category: 'missing-indexes',
      message: `${results.missingIndexes.length} tabela(s) com sequential scans excessivos (provável falta de índice)`,
      data: results.missingIndexes,
    });
  }

  // Locks ativos
  if (results.activeLocks.length > 0) {
    alerts.push({
      severity: 'warning',
      category: 'active-locks',
      message: `${results.activeLocks.length} query(ies) bloqueadas há mais de 5 segundos`,
      data: results.activeLocks,
    });
  }

  return alerts;
}

/**
 * Executa diagnóstico completo via RPC do Supabase.
 * Requer função SQL `run_diagnostic_query` criada via migration (veja abaixo).
 * Em modo DEV, imprime relatório completo no console.
 */
export async function runDiagnostics(): Promise<DiagnosticReport | null> {
  if (!import.meta.env.DEV) {
    console.warn('[DB Diagnostics] runDiagnostics() só está disponível em modo DEV.');
    return null;
  }

  console.group('🔍 [DB Diagnostics] Executando diagnóstico de banco...');

  try {
    const runQuery = async (sql: string): Promise<unknown[]> => {
      const { data, error } = await supabase.rpc('run_diagnostic_query', { sql_query: sql });
      if (error) { console.error('Query error:', error); return []; }
      return (data as unknown[]) ?? [];
    };

    const [slowQ, conns, dlocks, missIdx, unusedIdx, tables, locks, pool] = await Promise.all([
      runQuery(SQL_DIAGNOSTICS.slowQueries),
      runQuery(SQL_DIAGNOSTICS.activeConnections),
      runQuery(SQL_DIAGNOSTICS.deadlocks),
      runQuery(SQL_DIAGNOSTICS.missingIndexes),
      runQuery(SQL_DIAGNOSTICS.unusedIndexes),
      runQuery(SQL_DIAGNOSTICS.largestTables),
      runQuery(SQL_DIAGNOSTICS.activeLocks),
      runQuery(SQL_DIAGNOSTICS.connectionPool),
    ]);

    const resultMap = {
      slowQueries: slowQ, activeConnections: conns, deadlocks: dlocks,
      missingIndexes: missIdx, unusedIndexes: unusedIdx, largestTables: tables,
      activeLocks: locks, connectionPool: pool,
    };

    const alerts = analyzeResults(resultMap);

    const report: DiagnosticReport = {
      timestamp: new Date().toISOString(),
      ...resultMap,
      alerts,
    };

    // Console report
    console.table(report.connectionPool,  ['state', 'count', 'max_age_sec']);
    console.table(report.slowQueries,     ['query_preview', 'avg_ms', 'max_ms', 'calls']);
    console.table(report.missingIndexes,  ['table_name', 'seq_scan', 'row_count', 'seq_scan_pct']);
    console.table(report.activeLocks,     ['query_preview', 'state', 'age_sec']);
    if (alerts.length) {
      console.warn('⚠️ Alertas encontrados:');
      alerts.forEach(a => console[a.severity === 'critical' ? 'error' : 'warn'](`[${a.severity.toUpperCase()}] ${a.category}: ${a.message}`));
    } else {
      console.info('✅ Nenhum problema crítico detectado.');
    }

    // Envia alertas críticos para Sentry
    alerts
      .filter(a => a.severity === 'critical')
      .forEach(a => Sentry.captureMessage(`[DB] ${a.message}`, {
        level: 'error',
        tags: { category: a.category, type: 'db-diagnostic' },
        extra: { data: a.data },
      }));

    return report;
  } catch (err) {
    console.error('[DB Diagnostics] Erro ao executar diagnóstico:', err);
    return null;
  } finally {
    console.groupEnd();
  }
}

// Expõe no window em DEV para uso via console do browser
if (import.meta.env.DEV) {
  (window as Window & { __sprintflowDiagnostics?: typeof runDiagnostics }).___sprintflowDiagnostics = runDiagnostics;
  console.info('[DB Diagnostics] Disponível via: window.__sprintflowDiagnostics()');
}
