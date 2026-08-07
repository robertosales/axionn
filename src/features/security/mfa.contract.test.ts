import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

describe("backoffice MFA contract", () => {
  it("uses Supabase TOTP enrollment and AAL2 verification", () => {
    const page = source("src/features/security/pages/MfaSecurityPage.tsx");
    expect(page).toContain('factorType: "totp"');
    expect(page).toContain("supabase.auth.mfa.challengeAndVerify");
    expect(page).toContain('autoComplete="one-time-code"');
    expect(page).not.toContain("localStorage");
    expect(page).not.toContain("sessionStorage");
  });

  it("protects backoffice behind an explicit rollout flag", () => {
    const app = source("src/App.tsx");
    const guard = source("src/features/security/components/BackofficeMfaGuard.tsx");
    const flags = source("src/lib/featureFlags.ts");
    expect(app).toContain("<BackofficeMfaGuard>");
    expect(app).toContain('path="/security/mfa"');
    expect(guard).toContain("currentLevel !== \"aal2\"");
    expect(guard).toContain("verifiedFactors.length === 0");
    expect(flags).toContain("VITE_BACKOFFICE_MFA_REQUIRED");
  });

  it("does not require a database migration", () => {
    const hook = source("src/features/security/hooks/useMfaStatus.ts");
    expect(hook).toContain("supabase.auth.mfa.listFactors()");
    expect(hook).toContain("supabase.auth.mfa.getAuthenticatorAssuranceLevel()");
    expect(hook).not.toContain('.from("');
    expect(hook).not.toContain(".rpc(");
  });
});
