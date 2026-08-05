import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

describe("distributed authentication rate limiter", () => {
  it("requires Redis unless local fallback is explicitly enabled", () => {
    const edge = source("supabase/functions/auth-rate-limiter/index.ts");
    expect(edge).toContain('AUTH_RATE_LIMIT_ALLOW_MEMORY_FALLBACK") === "true"');
    expect(edge).toContain("DISTRIBUTED_RATE_LIMITER_NOT_CONFIGURED");
    expect(edge).toContain("DISTRIBUTED_RATE_LIMITER_UNAVAILABLE");
    expect(edge).toContain("AbortSignal.timeout(3_000)");
  });

  it("limits both IP and a hashed account identifier", () => {
    const edge = source("supabase/functions/auth-rate-limiter/index.ts");
    expect(edge).toContain("crypto.subtle.digest");
    expect(edge).toContain("rl:ip:");
    expect(edge).toContain("rl:id:");
    expect(edge).not.toContain("rl:${ip}:${endpoint}");
  });

  it("fails closed in the browser wrapper", () => {
    const client = source("src/lib/authRateLimiter.ts");
    expect(client).toContain("allowed: false, remaining: 0");
    expect(client).toContain("unavailable: true");
    expect(client).not.toContain("fail open");
    expect(client).not.toContain("allowed: true, remaining: -1");
  });

  it("protects password login, recovery and MFA verification", () => {
    const auth = source("src/pages/Auth.tsx");
    const reset = source("src/pages/ResetPassword.tsx");
    const mfa = source("src/features/security/pages/MfaSecurityPage.tsx");
    expect(auth).toContain('checkAuthRateLimit("login", email)');
    expect(auth).toContain('checkAuthRateLimit("reset_password", email)');
    expect(reset).toContain('checkAuthRateLimit("reset_password", normalizedEmail)');
    expect(mfa).toContain('checkAuthRateLimit("otp", factorId)');
  });
});
