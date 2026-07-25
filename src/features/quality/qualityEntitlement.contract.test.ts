import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260725150000_quality_entitlement_hardening.sql",
  "utf8",
).toLowerCase();

describe("quality commercial entitlement contract", () => {
  it("uses the granular catalog capability as the module gate", () => {
    expect(migration).toContain(
      "entitlement.feature_key = 'quality.cases.view'",
    );
    expect(migration).not.toContain(
      "entitlement.feature_key = 'quality.view'",
    );
  });

  it("resolves effective entitlements so commercial overrides are honored", () => {
    expect(migration).toContain(
      "public.get_effective_organization_entitlements(p_org_id)",
    );
    expect(migration).toContain("and entitlement.enabled");
  });

  it("prevents authenticated users from probing another tenant", () => {
    expect(migration).toContain("auth.uid() is null");
    expect(migration).toContain("public.is_platform_admin(auth.uid())");
    expect(migration).toContain(
      "public.is_organization_member(p_org_id, auth.uid())",
    );
    expect(migration).toContain("quality_entitlement_access_denied");
  });
});
