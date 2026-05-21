/**
 * SEC-002 — Client wrapper para a Edge Function auth-rate-limiter
 *
 * Chama a Edge Function antes de cada operação de auth sensível.
 * Em caso de falha da Edge Function, fail-open (não bloqueia o usuário).
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

export async function checkAuthRateLimit(
  endpoint: AuthEndpoint,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.functions.invoke("auth-rate-limiter", {
      body: { endpoint },
    });

    if (error) {
      console.warn("[authRateLimiter] Edge Function error — fail open:", error);
      return { allowed: true, remaining: -1 };
    }

    return {
      allowed:    data?.allowed ?? true,
      remaining:  data?.remaining ?? -1,
      retryAfter: data?.retryAfter,
    };
  } catch (err) {
    // Fail open — não bloqueia o usuário por falha de rede
    console.warn("[authRateLimiter] network error — fail open:", err);
    return { allowed: true, remaining: -1 };
  }
}
