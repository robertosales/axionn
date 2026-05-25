import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { supabaseCircuitBreaker, CircuitOpenError } from '@/lib/circuit-breaker';
import { retryQuery } from '@/lib/query-retry';

// A Anon Key é uma chave PÚBLICA por design.
// A segurança dos dados é garantida pelo RLS (Row Level Security) no Supabase.
const SUPABASE_URL      = 'https://rgikyyazotqapaxijwui.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnaWt5eWF6b3RxYXBheGlqd3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjM5NTIsImV4cCI6MjA4OTgzOTk1Mn0.ADQ3VDenVwNL3fgyNc2Fgu-Si66T7SHdG5se4Hvf5eg';

/**
 * instrumentedFetch — wraps every Supabase HTTP request with:
 *  • Circuit Breaker (CLOSED/OPEN/HALF_OPEN)  → fast-fail quando DB está inacessível
 *  • Retry com exponential backoff (3 tentativas, 500ms base)
 *  • 15 s hard timeout   → tela nunca trava indefinidamente
 *  • slow-query warning  → log de queries > 1 s no console
 *  • error logging       → log de respostas HTTP >= 400
 */
const instrumentedFetch: typeof fetch = (url, options) => {
  const start = performance.now();
  const path = typeof url === 'string'
    ? (() => { try { return new URL(url).pathname; } catch { return String(url); } })()
    : String(url);

  // AbortController para o timeout — independente do AbortController do chamador
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort();
    console.error(`[Supabase TIMEOUT] 15 s excedido → ${path}`);
  }, 15_000);

  // Combina o signal do chamador (se houver) com o signal de timeout
  const callerSignal = (options as RequestInit | undefined)?.signal as AbortSignal | undefined;
  let combinedSignal = timeoutController.signal;
  if (callerSignal) {
    if (typeof AbortSignal.any === 'function') {
      combinedSignal = AbortSignal.any([timeoutController.signal, callerSignal]);
    } else {
      callerSignal.addEventListener('abort', () => timeoutController.abort(), { once: true });
    }
  }

  // Executa dentro do Circuit Breaker + Retry
  const doFetch = () =>
    fetch(url, { ...options, signal: combinedSignal })
      .then((res) => {
        const ms = Math.round(performance.now() - start);
        if (ms > 1_000) console.warn(`[Supabase SLOW] ${ms} ms → ${path}`);
        if (!res.ok)    console.error(`[Supabase ERROR] HTTP ${res.status} → ${path}`);
        return res;
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error(`[Supabase TIMEOUT] requisição cancelada após 15 s: ${path}`);
        }
        throw err;
      });

  return supabaseCircuitBreaker
    .execute(() => retryQuery(doFetch, { maxAttempts: 3, baseDelayMs: 500, signal: combinedSignal }))
    .catch((err: unknown) => {
      if (err instanceof CircuitOpenError) {
        console.error(`[Supabase CIRCUIT OPEN] requisição bloqueada → ${path}`);
      }
      throw err;
    })
    .finally(() => clearTimeout(timeoutId));
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: instrumentedFetch,
  },
  realtime: {
    timeout: 30_000,
    heartbeatIntervalMs: 15_000,
    reconnectAfterMs: (tries: number) => Math.min(tries * 1_000, 30_000),
  },
});
