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
 *   - Armazenamento distribuído obrigatório: Upstash Redis via REST
 *   - Falha fechada se Redis estiver ausente ou indisponível
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

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
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

  const script = [
    "local count = redis.call('INCR', KEYS[1])",
    "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
    "local ttl = redis.call('TTL', KEYS[1])",
    "return {count, ttl}",
  ].join("\n");
  const res = await fetch(redisUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["EVAL", script, "1", key, String(windowSec)]),
    signal: AbortSignal.timeout(3_000),
  });

  if (!res.ok) throw new Error(`Redis rate-limit command failed: ${res.status}`);
  const payload = await res.json() as { result?: [number, number] };
  if (!Array.isArray(payload.result) || payload.result.length !== 2) throw new Error("Invalid Redis rate-limit response");
  const count = Number(payload.result[0]);
  const ttl = Number(payload.result[1]) > 0 ? Number(payload.result[1]) : windowSec;
  if (!Number.isFinite(count) || !Number.isFinite(ttl)) throw new Error("Invalid Redis counters");
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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 4_096) {
      return new Response(JSON.stringify({ allowed: false, error: "Payload too large" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    if (!redisUrl || !redisToken) {
      console.error("[auth-rate-limiter] distributed store is not configured");
      return new Response(
        JSON.stringify({ allowed: false, remaining: 0, error: "rate limiter unavailable", retryAfter: 60 }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } },
      );
    }
    const results = await Promise.all(
      rateLimitKeys.map((key) => redisCheck(key, config.max, config.windowSec, redisUrl, redisToken)),
    );
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
