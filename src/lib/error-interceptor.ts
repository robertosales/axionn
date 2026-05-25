/**
 * PILAR 3 — Interceptor Global de Erros Supabase
 * Captura 5xx, timeouts, erros de rede e os encaminha para Sentry + console estruturado.
 * Integra com o cliente Supabase existente via wrapper.
 */

import * as Sentry from '@sentry/react';
import { supabase } from '@/integrations/supabase/client';

// ─── Tipos ─────────────────────────────────────────────────────────────────
export interface SupabaseErrorLog {
  timestamp: string;
  table: string;
  operation: string;
  code: string | null;
  message: string;
  details?: string | null;
  hint?: string | null;
  severity: 'warning' | 'error' | 'critical';
}

// ─── Classificação de erros ────────────────────────────────────────────────
function classifyError(code: string | null, message: string): SupabaseErrorLog['severity'] {
  if (!code) return 'error';

  // Postgres error codes → https://www.postgresql.org/docs/current/errcodes-appendix.html
  const criticalCodes = [
    '57P03', // cannot_connect_now
    '53300', // too_many_connections
    '53200', // out_of_memory
    '40P01', // deadlock_detected
    '55P03', // lock_not_available
    'XX000', // internal_error
  ];

  const warningCodes = [
    '23505', // unique_violation
    '23503', // foreign_key_violation
    '42501', // insufficient_privilege (RLS)
    'PGRST116', // PostgREST: row not found
  ];

  if (criticalCodes.includes(code)) return 'critical';
  if (warningCodes.includes(code))  return 'warning';
  if (message.toLowerCase().includes('timeout')) return 'critical';
  if (message.toLowerCase().includes('connection')) return 'critical';
  return 'error';
}

// ─── Buffer em memória (ring buffer de 100 entradas) ──────────────────────
const ERROR_BUFFER_SIZE = 100;
const errorBuffer: SupabaseErrorLog[] = [];

function pushToBuffer(log: SupabaseErrorLog): void {
  if (errorBuffer.length >= ERROR_BUFFER_SIZE) errorBuffer.shift();
  errorBuffer.push(log);
}

export function getErrorBuffer(): Readonly<SupabaseErrorLog[]> {
  return errorBuffer;
}

export function clearErrorBuffer(): void {
  errorBuffer.length = 0;
}

// ─── Handler central ──────────────────────────────────────────────────────
export function handleSupabaseError(
  error: { code?: string | null; message: string; details?: string | null; hint?: string | null },
  context: { table: string; operation: string }
): void {
  const severity = classifyError(error.code ?? null, error.message);

  const log: SupabaseErrorLog = {
    timestamp: new Date().toISOString(),
    table: context.table,
    operation: context.operation,
    code: error.code ?? null,
    message: error.message,
    details: error.details,
    hint: error.hint,
    severity,
  };

  pushToBuffer(log);

  // Console estruturado
  const prefix = severity === 'critical' ? '🔴' : severity === 'error' ? '🟠' : '🟡';
  console[severity === 'warning' ? 'warn' : 'error'](
    `${prefix} [Supabase ${severity.toUpperCase()}] ${context.operation.toUpperCase()} → ${context.table}`,
    { code: error.code, message: error.message, details: error.details, hint: error.hint }
  );

  // Sentry — apenas erros e críticos (warnings só vão pro buffer)
  if (severity !== 'warning') {
    Sentry.captureException(new Error(`[Supabase] ${error.message}`), {
      level: severity === 'critical' ? 'fatal' : 'error',
      tags: {
        supabase_table: context.table,
        supabase_operation: context.operation,
        error_code: error.code ?? 'unknown',
        severity,
      },
      extra: {
        code: error.code,
        details: error.details,
        hint: error.hint,
        timestamp: log.timestamp,
      },
    });
  }
}

// ─── Wrapper tipado para queries Supabase ─────────────────────────────────
// Uso: const data = await safeQuery(supabase.from('user_stories').select('*'), 'user_stories', 'SELECT');
export async function safeQuery<T>(
  queryPromise: PromiseLike<{ data: T | null; error: { code?: string; message: string; details?: string; hint?: string } | null }>,
  table: string,
  operation: string
): Promise<T | null> {
  const { data, error } = await queryPromise;

  if (error) {
    handleSupabaseError(error, { table, operation });
    return null;
  }

  return data;
}

// ─── Monitor de conexão global (online/offline) ────────────────────────────
export function initConnectionMonitor(): () => void {
  let wasOffline = false;

  const handleOffline = () => {
    wasOffline = true;
    Sentry.captureMessage('[Network] Conexão perdida — usuário offline', {
      level: 'warning',
      tags: { type: 'network', event: 'offline' },
    });
    console.warn('🔌 [Network] Conexão perdida.');
  };

  const handleOnline = () => {
    if (wasOffline) {
      console.info('✅ [Network] Conexão restaurada.');
      wasOffline = false;
    }
  };

  window.addEventListener('offline', handleOffline);
  window.addEventListener('online',  handleOnline);

  return () => {
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('online',  handleOnline);
  };
}

// ─── Interceptor de erros não tratados (uncaught + unhandledrejection) ─────
export function initGlobalErrorHandlers(): () => void {
  const handleUncaught = (event: ErrorEvent) => {
    // Ignora erros de extensões de browser
    if (event.filename?.includes('extension://')) return;

    Sentry.captureException(event.error ?? new Error(event.message), {
      level: 'error',
      tags: { type: 'uncaught-error' },
      extra: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    // Ignora AbortError (gerado intencionalmente pelo AbortController)
    if (reason?.name === 'AbortError') return;

    Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)), {
      level: 'error',
      tags: { type: 'unhandled-rejection' },
    });
  };

  window.addEventListener('error',               handleUncaught);
  window.addEventListener('unhandledrejection',  handleUnhandledRejection);

  return () => {
    window.removeEventListener('error',              handleUncaught);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  };
}
