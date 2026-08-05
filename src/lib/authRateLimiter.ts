/**
 * SEC-002 — Client wrapper para a Edge Function auth-rate-limiter
 *
 * Chama a Edge Function antes de cada operação de auth sensível.
 * Em caso de falha da Edge Function, bloqueia a operação sensível por padrão.
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
        const payload = await response.clone().json().catch(() => null) as {
          retryAfter?: number;
        } | null;
        const retryAfter = Number.isFinite(payload?.retryAfter)
          ? payload!.retryAfter
          : Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
            ? retryAfterHeader
            : 60;

        if (response.status === 429) {
          return { allowed: false, remaining: 0, retryAfter };
        }
      }

      console.warn("[authRateLimiter] Edge Function unavailable; blocking sensitive operation.");
      return { allowed: false, remaining: 0, retryAfter: 60, unavailable: true };
    }

    return {
      allowed:    data?.allowed === true,
      remaining:  Number.isFinite(data?.remaining) ? data.remaining : 0,
      retryAfter: data?.retryAfter,
      unavailable: data?.error === "rate limiter unavailable",
    };
  } catch (err) {
    console.warn("[authRateLimiter] Network failure; blocking sensitive operation.");
    return { allowed: false, remaining: 0, retryAfter: 60, unavailable: true };
  }
}
