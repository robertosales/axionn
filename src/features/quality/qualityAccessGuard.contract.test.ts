import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guard = readFileSync(
  "src/features/quality/components/QualityAccessGuard.tsx",
  "utf8",
);
const routes = readFileSync("src/App.tsx", "utf8");

describe("Quality Intelligence route access contract", () => {
  it("combines feature flag, commercial entitlement and RBAC", () => {
    expect(guard).toContain("QUALITY_MANAGEMENT_ENABLED");
    expect(guard).toContain("hasQualityEntitlement");
    expect(guard).toContain("can.viewQuality");
  });

  it("fails closed while the entitlement is unavailable", () => {
    expect(guard).toContain("entitlementLoading");
    expect(guard).toContain("entitlementError");
    expect(guard).toContain("Acesso não autorizado");
    expect(guard).toContain("Não foi possível validar");
  });

  it("protects every Quality route with the dedicated guard", () => {
    const qualityRoutes =
      routes.match(/<Route path="\/sala-agil\/qualidade[^"]*"/g) ?? [];
    const guardedRoutes =
      routes.match(
        /<Route path="\/sala-agil\/qualidade[^"]*"[^]*?<QualityAccessGuard>/g,
      ) ?? [];

    expect(qualityRoutes).toHaveLength(6);
    expect(guardedRoutes).toHaveLength(qualityRoutes.length);
  });
});
