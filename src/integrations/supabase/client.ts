import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  supabaseCircuitBreaker,
  CircuitOpenError,
} from "@/lib/circuit-breaker";
import { retryQuery } from "@/lib/query-retry";

const FALLBACK_SUPABASE_URL = "https://rgikyyazotqapaxijwui.supabase.co";
const FALLBACK_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6InJnaWt5eWF6b3RxYXBheGlqd3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjM5NTIsImV4cCI6MjA4OTgzOTk1Mn0.ADQ3VDenVwNL3fgyNc2Fgu-Si66T7SHdG5se4Hvf5eg";

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const configuredKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const SUPABASE_URL = configuredUrl || FALLBACK_SUPABASE_URL;
const SUPABASE_ANON_KEY = configuredKey || FALLBACK_SUPABASE_KEY;

if (!configuredUrl || !configuredKey) {
  console.warn(
    "[Supabase] Variáveis de ambiente ausentes. Usando a configuração legada apenas para compatibilidade de transição.",
  );
}

const instrumentedFetch: typeof fetch = (url, options) => {
  const start = performance.now();
  const path =
    typeof url === "string"
      ? (() => {
          try {
            return new URL(url).pathname;
          } catch {
            return String(url);
          }
        })()
      : String(url);

  const isAuthRequest = /\/auth\/v\d+\//.test(path);
  if (isAuthRequest) {
    if (/\/auth\/v\d+\/user(\b|\/|\?|$)/.test(path)) {
      const windowWithCounter = window as unknown as {
        __authUserCallCount?: number;
      };
      windowWithCounter.__authUserCallCount =
        (windowWithCounter.__authUserCallCount ?? 0) + 1;
    }

    return fetch(url, options).then((response) => {
      const durationMs = Math.round(performance.now() - start);
      if (durationMs > 1_000) {
        console.warn(`[Supabase AUTH SLOW] ${durationMs} ms → ${path}`);
      }
      if (!response.ok) {
        console.error(`[Supabase AUTH ERROR] HTTP ${response.status} → ${path}`);
      }
      return response;
    });
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort();
    console.error(`[Supabase TIMEOUT] 15 s excedido → ${path}`);
  }, 15_000);

  const callerSignal = (options as RequestInit | undefined)?.signal as
    | AbortSignal
    | undefined;
  let combinedSignal = timeoutController.signal;

  if (callerSignal) {
    if (typeof AbortSignal.any === "function") {
      combinedSignal = AbortSignal.any([
        timeoutController.signal,
        callerSignal,
      ]);
    } else {
      callerSignal.addEventListener(
        "abort",
        () => timeoutController.abort(),
        { once: true },
      );
    }
  }

  const doFetch = () =>
    fetch(url, { ...options, signal: combinedSignal })
      .then((response) => {
        const durationMs = Math.round(performance.now() - start);
        if (durationMs > 1_000) {
          console.warn(`[Supabase SLOW] ${durationMs} ms → ${path}`);
        }
        if (!response.ok) {
          console.error(`[Supabase ERROR] HTTP ${response.status} → ${path}`);
        }
        return response;
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(
            `[Supabase TIMEOUT] requisição cancelada após 15 s: ${path}`,
          );
        }
        throw error;
      });

  return supabaseCircuitBreaker
    .execute(() =>
      retryQuery(doFetch, {
        maxAttempts: 3,
        baseDelayMs: 500,
        signal: combinedSignal,
      }),
    )
    .catch((error: unknown) => {
      if (error instanceof CircuitOpenError) {
        console.error(
          `[Supabase CIRCUIT OPEN] requisição bloqueada → ${path}`,
        );
      }
      throw error;
    })
    .finally(() => clearTimeout(timeoutId));
};

const _supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    ...({ lockAcquireTimeout: 30_000 } as Record<string, unknown>),
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = _supabase as unknown as SupabaseClient<any>;
