import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guard = readFileSync(
  "src/features/okr/components/OkrV2AccessGuard.tsx",
  "utf8",
);
const routes = readFileSync("src/App.tsx", "utf8");
const legacyHook = readFileSync("src/features/okr/hooks/useOkr.ts", "utf8");
const v2Sources = [
  "src/features/okr/hooks/useOkrCycles.ts",
  "src/features/okr/hooks/useOkrObjectivesV2.ts",
  "src/features/okr/hooks/useOkrKeyResultsV2.ts",
].map((path) => readFileSync(path, "utf8")).join("\n");

describe("OKR V2 access and coexistence contract", () => {
  it("fails closed on flag, entitlement loading and resolver failure", () => {
    expect(guard).toContain("OKR_V2_ENABLED");
    expect(guard).toContain("resolution.loading");
    expect(guard).toContain("resolution.unavailable || error");
    expect(guard).toContain("bloqueado por segurança");
  });

  it("protects each V2 route with the appropriate capability", () => {
    expect(routes).toContain(
      '<OkrV2AccessGuard feature="okr.cycle_management"><OkrCyclesPage />',
    );
    expect(routes).toContain(
      '<OkrV2AccessGuard feature="okr.view"><OkrObjectivesPage />',
    );
  });

  it("keeps V2 mutations on RPCs while explicitly isolating legacy debt", () => {
    expect(v2Sources).not.toMatch(
      /\.from\("okr_[^"]+"\)\.(?:insert|update|upsert|delete)\(/,
    );
    expect(v2Sources).toContain('.rpc(name, args)');
    expect(legacyHook).toContain('.from("okr_objectives").insert(');
    expect(legacyHook).toContain('.from("okr_objectives").delete()');
  });
});
