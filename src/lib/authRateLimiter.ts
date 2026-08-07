/**
 * SEC-002 — Client wrapper para a Edge Function auth-rate-limiter
 *
 * Chama a Edge Function antes de cada operação de auth sensível.
 * Em caso de falha da Edge Function, falha fechado para impedir que uma
 * indisponibilidade remova a proteção contra brute force.
 *
 * Uso:
 *   import { checkAuthRateLimit } from "@/lib/authRateLimiter";
 *
 *   const { allowed, retryAfter } = await checkAuthRateLimit("login");
 *   if (!allowed) {
 *     toast.error(`Muitas tentativas. Tente em ${retryAfter}s.`);
 *     return;
 *   }
 *   // ... chama supabase.auth.signInWithPassword()
 */

import { supabase } from "@/integrations/supabase/client";

export type AuthEndpoint = "login" | "signup" | "reset_password" | "otp";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

const LIMITER_UNAVAILABLE_RETRY_SECONDS = 60;

function unavailableResult(): RateLimitResult {
  return {
    allowed: false,
    remaining: 0,
    retryAfter: LIMITER_UNAVAILABLE_RETRY_SECONDS,
  };
}

export async function checkAuthRateLimit(
  endpoint: AuthEndpoint,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.functions.invoke("auth-rate-limiter", {
      body: { endpoint },
    });

    if (error) {
      console.warn("[authRateLimiter] Edge Function indisponível; acesso bloqueado temporariamente");
      return unavailableResult();
    }

    if (typeof data?.allowed !== "boolean" || typeof data?.remaining !== "number") {
      console.warn("[authRateLimiter] resposta inválida; acesso bloqueado temporariamente");
      return unavailableResult();
    }

    return {
      allowed:    data.allowed,
      remaining:  data.remaining,
      retryAfter: data?.retryAfter,
    };
  } catch {
    console.warn("[authRateLimiter] falha de rede; acesso bloqueado temporariamente");
    return unavailableResult();
  }
}
