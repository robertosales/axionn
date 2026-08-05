/**
 * SEC-002 + SEC-004 — Edge Function: auth-rate-limiter
 *
 * SEC-002: Rate limiting contra brute force e credential stuffing
 * SEC-004: Migrado de SUPABASE_ANON_KEY para SUPABASE_PUBLISHABLE_KEYS
 *
 * Estratégia:
 *   - Chaves: IP + endpoint e hash do identificador + endpoint
 *   - Janela deslizante de 60 segundos
 *   - Limites configuráveis por endpoint
 *   - Armazenamento: Upstash Redis via REST
 *     → Fallback in-memory somente quando explicitamente habilitado para desenvolvimento
 *
 * Headers retornados:
 *   X-RateLimit-Limit     — limite máximo
 *   X-RateLimit-Remaining — requisições restantes
 *   X-RateLimit-Reset     — timestamp Unix do reset
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── Limites por endpoint ─────────────────────────────────────────────────────
const LIMITS: Record<string, { max: number; windowSec: number }> = {
  login:          { max: 10, windowSec: 60 },
  signup:         { max: 5,  windowSec: 60 },
  reset_password: { max: 3,  windowSec: 300 },
  otp:            { max: 5,  windowSec: 60 },
  default:        { max: 20, windowSec: 60 },
};

// ─── In-memory store (fallback explícito para desenvolvimento local) ─────────
const memStore = new Map<string, { count: number; resetAt: number }>();

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function memCheck(key: string, max: number, windowSec: number): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Math.floor(Date.now() / 1000);
  const entry = memStore.get(key);

  if (!entry || now >= entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowSec });
    return { allowed: true, remaining: max - 1, resetAt: now + windowSec };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt };
}

// ─── Redis check via Upstash REST ────────────────────────────────────────────
async function redisCheck(
  key: string,
  max: number,
  windowSec: number,
  redisUrl: string,
  redisToken: string,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Math.floor(Date.now() / 1000);

  const pipeline = [
    ["INCR", key],
    ["EXPIRE", key, windowSec],
    ["TTL", key],
  ];

  const res = await fetch(`${redisUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pipeline),
    signal: AbortSignal.timeout(3_000),
  });

  if (!res.ok) throw new Error(`Redis pipeline failed: ${res.status}`);

  const results = await res.json() as Array<{ result: number }>;
  const count  = Number(results[0]?.result);
  const ttlResult = Number(results[2]?.result);
  if (!Number.isFinite(count)) throw new Error("Redis returned an invalid counter");
  const ttl    = ttlResult > 0 ? ttlResult : windowSec;
  const resetAt = now + ttl;

  if (count > max) {
    return { allowed: false, remaining: 0, resetAt };
  }

  return { allowed: true, remaining: Math.max(0, max - count), resetAt };
}

// ─── Handler principal ───────────────────────────────────────────────────────
serve(async (req: Request) => {
  // SEC-004: fallback para chaves legadas durante período de transição
  const _publishKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  // ANON_KEY disponível se necessário para validação futura
  // const ANON_KEY = _publishKeys ? JSON.parse(_publishKeys).anon : Deno.env.get("SUPABASE_ANON_KEY")!;

  const allowMemoryFallback = Deno.env.get("AUTH_RATE_LIMIT_ALLOW_MEMORY_FALLBACK") === "true";
  const corsHeaders = {
    "Access-Control-Allow-Origin":  Deno.env.get("SITE_URL") ?? (allowMemoryFallback ? "*" : "null"),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (contentLength > 4_096) {
      return new Response(JSON.stringify({ allowed: false, error: "Payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 4_096) {
      return new Response(JSON.stringify({ allowed: false, error: "Payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = rawBody ? JSON.parse(rawBody) : {};
    const endpoint = (body?.endpoint ?? "default").toLowerCase().replace(/[^a-z_]/g, "");
    const config = LIMITS[endpoint] ?? LIMITS.default;
    const identifier = typeof body?.identifier === "string"
      ? body.identifier.trim().toLowerCase().slice(0, 254)
      : "";

    const ip = (
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-real-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      "unknown"
    ).replace(/[^0-9a-fA-F:.,]/g, "").slice(0, 64) || "unknown";

    const rateLimitKeys = [`rl:ip:${ip}:${endpoint}`];
    if (identifier) rateLimitKeys.push(`rl:id:${await sha256(identifier)}:${endpoint}`);

    const redisUrl   = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

    let results: Array<{ allowed: boolean; remaining: number; resetAt: number }>;
    if (redisUrl && redisToken) {
      try {
        results = await Promise.all(
          rateLimitKeys.map((key) => redisCheck(key, config.max, config.windowSec, redisUrl, redisToken)),
        );
      } catch (redisError) {
        console.error("[auth-rate-limiter] Redis unavailable",
          redisError instanceof Error ? redisError.message : "REDIS_UNAVAILABLE");
        if (!allowMemoryFallback) throw new Error("DISTRIBUTED_RATE_LIMITER_UNAVAILABLE");
        results = rateLimitKeys.map((key) => memCheck(key, config.max, config.windowSec));
      }
    } else {
      if (!allowMemoryFallback) throw new Error("DISTRIBUTED_RATE_LIMITER_NOT_CONFIGURED");
      console.warn("[auth-rate-limiter] Explicit local memory fallback enabled");
      results = rateLimitKeys.map((key) => memCheck(key, config.max, config.windowSec));
    }

    const result = {
      allowed: results.every((item) => item.allowed),
      remaining: Math.min(...results.map((item) => item.remaining)),
      resetAt: Math.max(...results.map((item) => item.resetAt)),
    };

    const rateLimitHeaders = {
      ...corsHeaders,
      "Content-Type":          "application/json",
      "X-RateLimit-Limit":     String(config.max),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset":     String(result.resetAt),
      "X-RateLimit-Policy":    redisUrl && redisToken ? "distributed" : "local-development",
    };

    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          allowed: false,
          error: "Too many requests",
          retryAfter: result.resetAt - Math.floor(Date.now() / 1000),
        }),
        { status: 429, headers: { ...rateLimitHeaders, "Retry-After": String(result.resetAt - Math.floor(Date.now() / 1000)) } },
      );
    }

    return new Response(
      JSON.stringify({ allowed: true, remaining: result.remaining }),
      { status: 200, headers: rateLimitHeaders },
    );
  } catch (err) {
    console.error("[auth-rate-limiter] error:", err);
    return new Response(
      JSON.stringify({ allowed: false, remaining: 0, error: "rate limiter unavailable" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } },
    );
  }
});
