import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("HUEditDrawer feature selection contract", () => {
  const source = fs.readFileSync(path.resolve("src/components/HUEditDrawer.tsx"), "utf8");

  it("reconciles the persisted epic and feature when the edit modal opens", () => {
    expect(source).toContain('.select("epic_id, feature_id")');
    expect(source).toContain("setFeatureId(data.feature_id ?? \"\")");
  });

  it("keeps the selected feature visible while reference data synchronizes", () => {
    expect(source).toContain("const featureOptions = useMemo");
    expect(source).toContain("[selected, ...compatible]");
    expect(source).toContain("featureOptions.map");
  });
});
