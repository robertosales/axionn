/**
 * SEC-001 — useSecureForm
 *
 * Hook que combina sanitização de inputs + rate limiting para
 * formulários sensíveis (login, cadastro, comentários, etc.).
 *
 * Uso:
 *   const { secureValue, handleChange, isRateLimited, resetLimit } =
 *     useSecureForm("form_key", { maxLength: 500, rateLimit: 5 });
 */
import { useState, useCallback } from "react";
import { sanitizeInput, checkRateLimit, resetRateLimit } from "@/lib/security";

interface Options {
  maxLength?: number;
  rateLimit?: number;      // máx submissões por janela
  rateLimitWindowMs?: number;
}

export function useSecureForm(key: string, options: Options = {}) {
  const {
    maxLength = 2000,
    rateLimit = 5,
    rateLimitWindowMs = 60_000,
  } = options;

  const [isRateLimited, setIsRateLimited] = useState(false);

  const sanitize = useCallback(
    (value: string) => sanitizeInput(value, maxLength),
    [maxLength],
  );

  const checkSubmit = useCallback((): boolean => {
    const allowed = checkRateLimit(key, rateLimit, rateLimitWindowMs);
    setIsRateLimited(!allowed);
    return allowed;
  }, [key, rateLimit, rateLimitWindowMs]);

  const resetLimit = useCallback(() => {
    resetRateLimit(key);
    setIsRateLimited(false);
  }, [key]);

  return { sanitize, checkSubmit, isRateLimited, resetLimit };
}
