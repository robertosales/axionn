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
import { FunctionsHttpError } from "@supabase/supabase-js";

export type AuthEndpoint = "login" | "signup" | "reset_password" | "otp";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
  unavailable?: boolean;
}

const LIMITER_UNAVAILABLE_RETRY_SECONDS = 60;

function unavailableResult(): RateLimitResult {
  return {
    allowed: false,
    remaining: 0,
    retryAfter: LIMITER_UNAVAILABLE_RETRY_SECONDS,
    unavailable: true,
  };
}

export async function checkAuthRateLimit(
  endpoint: AuthEndpoint,
  identifier?: string,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.functions.invoke("auth-rate-limiter", {
      body: { endpoint, identifier: identifier?.trim().toLowerCase() },
    });

    if (error) {
      if (error instanceof FunctionsHttpError && error.context instanceof Response) {
        const response = error.context;
        const retryAfterHeader = Number(response.headers.get("Retry-After"));
        const payload = await response.clone().json().catch(() => null) as { retryAfter?: number } | null;
        const retryAfter = Number.isFinite(payload?.retryAfter)
          ? payload!.retryAfter
          : Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
            ? retryAfterHeader
            : LIMITER_UNAVAILABLE_RETRY_SECONDS;
        if (response.status === 429) return { allowed: false, remaining: 0, retryAfter };
      }
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
