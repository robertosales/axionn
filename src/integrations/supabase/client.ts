import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// A Anon Key é uma chave PÚBLICA por design.
// A segurança dos dados é garantida pelo RLS (Row Level Security) no Supabase.
const SUPABASE_URL = 'https://rgikyyazotqapaxijwui.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnaWt5eWF6b3RxYXBheGlqd3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjM5NTIsImV4cCI6MjA4OTgzOTk1Mn0.ADQ3VDenVwNL3fgyNc2Fgu-Si66T7SHdG5se4Hvf5eg';

/**
 * instrumentedFetch — wraps every Supabase HTTP request with:
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
    // AbortSignal.any está disponível nos browsers modernos e no Node 20+
    if (typeof AbortSignal.any === 'function') {
      combinedSignal = AbortSignal.any([timeoutController.signal, callerSignal]);
    } else {
      // fallback: propaga cancelamento do chamador manualmente
      callerSignal.addEventListener('abort', () => timeoutController.abort(), { once: true });
    }
  }

  return fetch(url, { ...options, signal: combinedSignal })
    .then((res) => {
      const ms = Math.round(performance.now() - start);
      if (ms > 1_000) {
        console.warn(`[Supabase SLOW] ${ms} ms → ${path}`);
      }
      if (!res.ok) {
        console.error(`[Supabase ERROR] HTTP ${res.status} → ${path}`);
      }
      return res;
    })
    .catch((err: unknown) => {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`[Supabase TIMEOUT] requisição cancelada após 15 s: ${path}`);
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
    // Timeout para handshake inicial do WebSocket
    timeout: 30_000,
    // Heartbeat a cada 15 s — detecta conexão morta mais rápido
    heartbeatIntervalMs: 15_000,
    // Backoff exponencial: 1 s, 2 s, 3 s … até 30 s entre tentativas
    reconnectAfterMs: (tries: number) => Math.min(tries * 1_000, 30_000),
  },
});
