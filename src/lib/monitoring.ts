/**
 * PILAR 1 — APM & Observabilidade de Infraestrutura
 * Sentry (erros + performance traces) + Web Vitals (LCP, INP, CLS, FID, TTFB)
 *
 * Dependências necessárias:
 *   npm install @sentry/react web-vitals
 *
 * Variáveis de ambiente (.env):
 *   VITE_SENTRY_DSN=https://xxxx@sentry.io/yyyy
 *   VITE_APP_ENV=production | staging | development
 *   VITE_APP_VERSION=1.0.0
 */

import * as Sentry from '@sentry/react';
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

// ─── Thresholds de Core Web Vitals (Google 2024) ───────────────────────────
const THRESHOLDS = {
  LCP:  { good: 2500, poor: 4000 },  // ms — Largest Contentful Paint
  INP:  { good:  200, poor:  500 },  // ms — Interaction to Next Paint
  CLS:  { good: 0.1,  poor:  0.25 }, // score — Cumulative Layout Shift
  FCP:  { good: 1800, poor: 3000 },  // ms — First Contentful Paint
  TTFB: { good:  800, poor: 1800 },  // ms — Time to First Byte
} as const;

type MetricName = keyof typeof THRESHOLDS;

function classifyMetric(name: MetricName, value: number): 'good' | 'needs-improvement' | 'poor' {
  const t = THRESHOLDS[name];
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}

// ─── Sentry Init ───────────────────────────────────────────────────────────
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn('[Monitoring] VITE_SENTRY_DSN não definido — Sentry desabilitado.');
    return;
  }

  // ⚡ Em desenvolvimento o Sentry fica completamente desligado para não
  // consumir cota nem gerar ruído de 429 durante testes e hot-reload.
  const isProduction = import.meta.env.PROD;

  Sentry.init({
    dsn,
    enabled: isProduction,
    environment: import.meta.env.VITE_APP_ENV ?? 'development',
    release: import.meta.env.VITE_APP_VERSION ?? 'unknown',

    // Performance tracing — 5% em produção (era 10%), 0% em dev
    tracesSampleRate: isProduction ? 0.05 : 0,

    // Replay de sessão — 0% normal (era 10%), 50% só em erros (era 100%)
    // O Replay é o maior consumidor de cota no plano free do Sentry.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: isProduction ? 0.5 : 0,

    // Ignora erros de rede cancelados (AbortController) e chunks de lazy load
    ignoreErrors: [
      'AbortError',
      'ChunkLoadError',
      'Loading chunk',
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],

    beforeSend(event) {
      // Remove dados sensíveis antes de enviar
      if (event.request?.headers) {
        delete event.request.headers['Authorization'];
        delete event.request.headers['Cookie'];
      }
      return event;
    },

    integrations: [
      Sentry.browserTracingIntegration(),
      // Replay só é registrado em produção para não desperdiçar cota
      ...(isProduction
        ? [
            Sentry.replayIntegration({
              maskAllText: false,
              blockAllMedia: false,
            }),
          ]
        : []),
    ],
  });

  console.info('[Monitoring] Sentry inicializado — env:', import.meta.env.VITE_APP_ENV);
}

// ─── Web Vitals Reporter ───────────────────────────────────────────────────
function reportVital(metric: Metric): void {
  const name = metric.name as MetricName;
  const value = metric.value;
  const rating = metric.rating ?? classifyMetric(name, value);

  // Envia para Sentry como performance transaction
  Sentry.addBreadcrumb({
    category: 'web-vitals',
    message: `${name}: ${value.toFixed(2)} [${rating}]`,
    level: rating === 'poor' ? 'warning' : 'info',
    data: { name, value, rating, id: metric.id },
  });

  // Loga métricas ruins no console em desenvolvimento
  if (import.meta.env.DEV) {
    const color = rating === 'good' ? '\x1b[32m' : rating === 'poor' ? '\x1b[31m' : '\x1b[33m';
    console.log(`${color}[WebVitals] ${name}: ${value.toFixed(2)} (${rating})\x1b[0m`);
  }

  // Alerta Sentry se métrica for "poor"
  if (rating === 'poor') {
    Sentry.captureMessage(`[WebVitals] ${name} degradado: ${value.toFixed(2)}`, {
      level: 'warning',
      tags: { metric: name, rating },
      extra: { value, threshold_good: THRESHOLDS[name]?.good, threshold_poor: THRESHOLDS[name]?.poor },
    });
  }
}

export function initWebVitals(): void {
  onLCP(reportVital);
  onINP(reportVital);
  onCLS(reportVital);
  onFCP(reportVital);
  onTTFB(reportVital);
  console.info('[Monitoring] Web Vitals monitoramento ativo.');
}

// ─── Memory Leak Monitor ──────────────────────────────────────────────────
const MEMORY_WARN_MB  = 150;
const MEMORY_CRIT_MB  = 300;
let   memoryInterval: ReturnType<typeof setInterval> | null = null;

export function startMemoryMonitor(intervalMs = 30_000): () => void {
  if (!('memory' in performance)) {
    console.warn('[Monitoring] performance.memory não disponível neste browser.');
    return () => {};
  }

  memoryInterval = setInterval(() => {
    const mem = (performance as Performance & { memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    const usedMB  = mem.usedJSHeapSize  / 1_048_576;
    const totalMB = mem.totalJSHeapSize / 1_048_576;
    const limitMB = mem.jsHeapSizeLimit / 1_048_576;
    const pct     = (usedMB / limitMB) * 100;

    if (import.meta.env.DEV) {
      console.debug(`[Memory] Used: ${usedMB.toFixed(1)}MB / Limit: ${limitMB.toFixed(1)}MB (${pct.toFixed(1)}%)`);
    }

    if (usedMB >= MEMORY_CRIT_MB) {
      Sentry.captureMessage(`[Memory] CRÍTICO: ${usedMB.toFixed(1)}MB usados (${pct.toFixed(1)}% do limite)`, {
        level: 'error',
        tags: { type: 'memory-leak', severity: 'critical' },
        extra: { usedMB, totalMB, limitMB, pct },
      });
    } else if (usedMB >= MEMORY_WARN_MB) {
      Sentry.captureMessage(`[Memory] AVISO: ${usedMB.toFixed(1)}MB usados (${pct.toFixed(1)}% do limite)`, {
        level: 'warning',
        tags: { type: 'memory-leak', severity: 'warning' },
        extra: { usedMB, totalMB, limitMB, pct },
      });
    }
  }, intervalMs);

  return () => {
    if (memoryInterval) clearInterval(memoryInterval);
  };
}

// ─── Autoscaling / CPU Proxy Monitor ─────────────────────────────────────
// O browser não expõe CPU diretamente. Usamos Long Tasks como proxy de CPU.
export function startLongTaskMonitor(): () => void {
  if (!('PerformanceObserver' in window)) return () => {};

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const duration = entry.duration;
      if (duration > 50) { // Long Task = > 50ms bloqueia a main thread
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `Long Task detectado: ${duration.toFixed(0)}ms`,
          level: duration > 200 ? 'warning' : 'info',
          data: { duration, startTime: entry.startTime, name: entry.name },
        });

        if (duration > 500) {
          Sentry.captureMessage(`[CPU] Long Task crítico: ${duration.toFixed(0)}ms na main thread`, {
            level: 'warning',
            tags: { type: 'long-task', severity: 'critical' },
            extra: { duration, startTime: entry.startTime },
          });
        }
      }
    }
  });

  try {
    observer.observe({ type: 'longtask', buffered: true });
    console.info('[Monitoring] Long Task Observer ativo.');
  } catch {
    console.warn('[Monitoring] Long Task API não suportada.');
  }

  return () => observer.disconnect();
}

// ─── Bootstrap — chame no main.tsx ────────────────────────────────────────
export function initMonitoring(): () => void {
  initSentry();
  initWebVitals();
  const stopMemory   = startMemoryMonitor();
  const stopLongTask = startLongTaskMonitor();

  return () => {
    stopMemory();
    stopLongTask();
  };
}
