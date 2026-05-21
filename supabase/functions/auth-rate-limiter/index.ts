/**
 * SEC-002 + SEC-004 — Edge Function: auth-rate-limiter
 *
 * SEC-002: Rate limiting contra brute force e credential stuffing
 * SEC-004: Migrado de SUPABASE_ANON_KEY para SUPABASE_PUBLISHABLE_KEYS
 *
 * Estratégia:
 *   - Chave: IP + endpoint (ex: "1.2.3.4:login")
 *   - Janela deslizante de 60 segundos
 *   - Limites configuráveis por endpoint
 *   - Armazenamento: Upstash Redis via REST
 *     → Fallback para in-memory se UPSTASH_REDIS_REST_URL não configurado
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

// ─── In-memory store (fallback sem Redis) ────────────────────────────────────
const memStore = new Map<string, { count: number; resetAt: number }>();

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
  });

  if (!res.ok) throw new Error(`Redis pipeline failed: ${res.status}`);

  const results = await res.json() as Array<{ result: number }>;
  const count  = results[0].result;
  const ttl    = results[2].result > 0 ? results[2].result : windowSec;
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

  const corsHeaders = {
    "Access-Control-Allow-Origin":  Deno.env.get("SITE_URL") ?? "*",
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
    const body = await req.json().catch(() => ({}));
    const endpoint = (body?.endpoint ?? "default").toLowerCase().replace(/[^a-z_]/g, "");
    const config = LIMITS[endpoint] ?? LIMITS.default;

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const rateLimitKey = `rl:${ip}:${endpoint}`;

    const redisUrl   = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

    const result = (redisUrl && redisToken)
      ? await redisCheck(rateLimitKey, config.max, config.windowSec, redisUrl, redisToken)
      : memCheck(rateLimitKey, config.max, config.windowSec);

    const rateLimitHeaders = {
      ...corsHeaders,
      "Content-Type":          "application/json",
      "X-RateLimit-Limit":     String(config.max),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset":     String(result.resetAt),
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
      JSON.stringify({ allowed: true, remaining: -1, warning: "rate limiter unavailable" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
