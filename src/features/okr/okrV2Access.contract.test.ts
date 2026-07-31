import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guard = readFileSync(
  "src/features/okr/components/OkrV2AccessGuard.tsx",
  "utf8",
);
const routes = readFileSync("src/App.tsx", "utf8");
const featureFlags = readFileSync("src/lib/featureFlags.ts", "utf8");
const sectionNav = readFileSync(
  "src/features/okr/components/OkrSectionNav.tsx",
  "utf8",
);
const sectionPages = [
  "src/features/okr/pages/OkrDashboardPage.tsx",
  "src/features/okr/pages/OkrCyclesPage.tsx",
  "src/features/okr/pages/OkrObjectivesPage.tsx",
].map((path) => readFileSync(path, "utf8"));
const legacyHook = readFileSync("src/features/okr/hooks/useOkr.ts", "utf8");
const v2Sources = [
  "src/features/okr/hooks/useOkrCycles.ts",
  "src/features/okr/hooks/useOkrObjectivesV2.ts",
  "src/features/okr/hooks/useOkrKeyResultsV2.ts",
].map((path) => readFileSync(path, "utf8")).join("\n");

describe("OKR V2 access and coexistence contract", () => {
  it("keeps the validated rollout active by default with an explicit rollback switch", () => {
    expect(featureFlags).toContain(
      'import.meta.env.VITE_OKR_V2_ENABLED !== "false"',
    );
    expect(featureFlags).toContain("VITE_OKR_V2_ENABLED=false");
  });

  it("fails closed on flag, entitlement loading and resolver failure", () => {
    expect(guard).toContain("OKR_V2_ENABLED");
    expect(guard).toContain("resolution.loading");
    expect(guard).toContain("resolution.unavailable || error");
    expect(guard).toContain("bloqueado por segurança");
  });

  it("protects each V2 route with the appropriate capability", () => {
    expect(routes).toContain(
      '<OkrV2AccessGuard feature="okr.cycle_management"><AppShell module="sala_agil"><OkrCyclesPage />',
    );
    expect(routes).toContain(
      '<OkrV2AccessGuard feature="okr.view"><AppShell module="sala_agil"><OkrObjectivesPage />',
    );
  });

  it("keeps every OKR V2 page inside the Sala Ágil application shell", () => {
    expect(routes).toContain(
      '<AppShell module="sala_agil"><OkrDashboardPage /></AppShell>',
    );
    expect(routes).toContain(
      '<AppShell module="sala_agil"><OkrCyclesPage /></AppShell>',
    );
    expect(routes).toContain(
      '<AppShell module="sala_agil"><OkrObjectivesPage /></AppShell>',
    );
  });

  it("offers persistent contextual navigation from every OKR V2 page", () => {
    expect(sectionNav).toContain('to: "/okr/dashboard"');
    expect(sectionNav).toContain('to: "/okr/ciclos"');
    expect(sectionNav).toContain('to: "/okr/objectives"');
    expect(sectionNav).toContain('aria-label="Navegação do OKR"');
    for (const page of sectionPages) {
      expect(page).toContain("<OkrSectionNav />");
    }
  });

  it("keeps V2 mutations on RPCs and makes the legacy hook read-only", () => {
    expect(v2Sources).not.toMatch(
      /\.from\("okr_[^"]+"\)\.(?:insert|update|upsert|delete)\(/,
    );
    expect(v2Sources).toContain('.rpc(name, args)');
    expect(legacyHook).not.toMatch(/\.(?:insert|update|upsert|delete)\(/);
    expect(legacyHook).toContain("rejectLegacyMutation");
    expect(legacyHook).toContain("const canCreate = false");
    expect(legacyHook).toContain("const canEdit = false");
    expect(legacyHook).toContain("const canArchive = false");
    expect(legacyHook).toContain("const canCheckIn = false");
  });

  it("keeps legacy writes reachable only through the explicit rollback switch", () => {
    expect(routes).toMatch(
      /\{OKR_V2_ENABLED\s*\?\s*<Navigate to="\/okr\/dashboard" replace \/>/,
    );
    expect(routes).toContain(": <OkrPage />");
  });
});
