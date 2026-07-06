import * as Sentry from "@sentry/react";
import {
  onCLS,
  onFCP,
  onINP,
  onLCP,
  onTTFB,
  type Metric,
} from "web-vitals";

const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
} as const;

type MetricName = keyof typeof THRESHOLDS;

function classifyMetric(
  name: MetricName,
  value: number,
): "good" | "needs-improvement" | "poor" {
  const threshold = THRESHOLDS[name];
  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

function redactEvent(event: Sentry.ErrorEvent) {
  if (event.request) {
    if (event.request.headers) {
      delete event.request.headers.Authorization;
      delete event.request.headers.authorization;
      delete event.request.headers.Cookie;
      delete event.request.headers.cookie;
    }

    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;

    if (event.request.url) {
      try {
        const url = new URL(event.request.url);
        event.request.url = `${url.origin}${url.pathname}`;
      } catch {
        event.request.url = event.request.url.split("?")[0];
      }
    }
  }

  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }

  return event;
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn("[Monitoring] VITE_SENTRY_DSN não definido — Sentry desabilitado.");
    return;
  }

  const isProduction = import.meta.env.PROD;

  Sentry.init({
    dsn,
    enabled: isProduction,
    environment: import.meta.env.VITE_APP_ENV ?? "development",
    release: import.meta.env.VITE_APP_VERSION ?? "unknown",
    tracesSampleRate: isProduction ? 0.05 : 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: isProduction ? 0.2 : 0,
    sendDefaultPii: false,
    ignoreErrors: [
      "AbortError",
      "ChunkLoadError",
      "Loading chunk",
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
    ],
    beforeSend: redactEvent,
    integrations: [
      Sentry.browserTracingIntegration(),
      ...(isProduction
        ? [
            Sentry.replayIntegration({
              maskAllText: true,
              blockAllMedia: true,
              maskAllInputs: true,
            }),
          ]
        : []),
    ],
  });

  console.info(
    "[Monitoring] Sentry inicializado com mascaramento de dados — env:",
    import.meta.env.VITE_APP_ENV,
  );
}

function reportVital(metric: Metric): void {
  const name = metric.name as MetricName;
  const value = metric.value;
  const rating = metric.rating ?? classifyMetric(name, value);

  Sentry.addBreadcrumb({
    category: "web-vitals",
    message: `${name}: ${value.toFixed(2)} [${rating}]`,
    level: rating === "poor" ? "warning" : "info",
    data: { name, value, rating, id: metric.id },
  });

  if (import.meta.env.DEV) {
    console.log(`[WebVitals] ${name}: ${value.toFixed(2)} (${rating})`);
  }

  if (rating === "poor") {
    Sentry.captureMessage(
      `[WebVitals] ${name} degradado: ${value.toFixed(2)}`,
      {
        level: "warning",
        tags: { metric: name, rating },
        extra: {
          value,
          threshold_good: THRESHOLDS[name]?.good,
          threshold_poor: THRESHOLDS[name]?.poor,
        },
      },
    );
  }
}

export function initWebVitals(): void {
  onLCP(reportVital);
  onINP(reportVital);
  onCLS(reportVital);
  onFCP(reportVital);
  onTTFB(reportVital);
}

const MEMORY_WARN_MB = 150;
const MEMORY_CRIT_MB = 300;
let memoryInterval: ReturnType<typeof setInterval> | null = null;

export function startMemoryMonitor(intervalMs = 30_000): () => void {
  if (!("memory" in performance)) return () => {};

  memoryInterval = setInterval(() => {
    const memory = (
      performance as Performance & {
        memory: {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
          jsHeapSizeLimit: number;
        };
      }
    ).memory;

    const usedMB = memory.usedJSHeapSize / 1_048_576;
    const totalMB = memory.totalJSHeapSize / 1_048_576;
    const limitMB = memory.jsHeapSizeLimit / 1_048_576;
    const percent = (usedMB / limitMB) * 100;

    if (usedMB >= MEMORY_CRIT_MB) {
      Sentry.captureMessage(
        `[Memory] CRÍTICO: ${usedMB.toFixed(1)}MB usados (${percent.toFixed(1)}% do limite)`,
        {
          level: "error",
          tags: { type: "memory-leak", severity: "critical" },
          extra: { usedMB, totalMB, limitMB, percent },
        },
      );
    } else if (usedMB >= MEMORY_WARN_MB) {
      Sentry.captureMessage(
        `[Memory] AVISO: ${usedMB.toFixed(1)}MB usados (${percent.toFixed(1)}% do limite)`,
        {
          level: "warning",
          tags: { type: "memory-leak", severity: "warning" },
          extra: { usedMB, totalMB, limitMB, percent },
        },
      );
    }
  }, intervalMs);

  return () => {
    if (memoryInterval) clearInterval(memoryInterval);
  };
}

export function startLongTaskMonitor(): () => void {
  if (!("PerformanceObserver" in window)) return () => {};

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const duration = entry.duration;
      if (duration <= 50) continue;

      Sentry.addBreadcrumb({
        category: "performance",
        message: `Long Task detectado: ${duration.toFixed(0)}ms`,
        level: duration > 200 ? "warning" : "info",
        data: { duration, startTime: entry.startTime, name: entry.name },
      });

      if (duration > 500) {
        Sentry.captureMessage(
          `[CPU] Long Task crítico: ${duration.toFixed(0)}ms na main thread`,
          {
            level: "warning",
            tags: { type: "long-task", severity: "critical" },
            extra: { duration, startTime: entry.startTime },
          },
        );
      }
    }
  });

  try {
    observer.observe({ type: "longtask", buffered: true });
  } catch {
    return () => {};
  }

  return () => observer.disconnect();
}

export function initMonitoring(): () => void {
  initSentry();
  initWebVitals();
  const stopMemory = startMemoryMonitor();
  const stopLongTask = startLongTaskMonitor();

  return () => {
    stopMemory();
    stopLongTask();
  };
}
