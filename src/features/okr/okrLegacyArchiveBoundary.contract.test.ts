import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hook = readFileSync("src/features/okr/hooks/useOkr.ts", "utf8");

describe("OKR legacy read-only boundary", () => {
  it("does not expose direct or RPC-backed mutations", () => {
    expect(hook).not.toMatch(/\.(?:insert|update|upsert|delete)\(/);
    expect(hook).not.toContain("archive_okr_objective");
    expect(hook).not.toContain("archive_okr_key_result");
  });

  it("rejects every legacy mutation entry point", () => {
    expect(hook).toContain("rejectLegacyMutation");
    expect(hook).toContain("addObjective: rejectLegacyMutation");
    expect(hook).toContain("updateObjective: rejectLegacyMutation");
    expect(hook).toContain("deleteObjective: rejectLegacyMutation");
    expect(hook).toContain("addCheckIn: rejectLegacyMutation");
  });

  it("disables all mutation capabilities", () => {
    expect(hook).toContain("const canCreate = false");
    expect(hook).toContain("const canEdit = false");
    expect(hook).toContain("const canArchive = false");
    expect(hook).toContain("const canCheckIn = false");
    expect(hook).toContain("const canAutoMetrics = false");
  });

  it("uses progress calculated by the backend", () => {
    expect(hook).toContain("(obj as any).calculated_progress ?? obj.progress ?? 0");
    expect(hook).not.toContain("calculateKrProgress");
    expect(hook).not.toContain("calculateObjectiveProgress");
  });

  it("hides archived records from the legacy active view", () => {
    expect(hook.match(/\.neq\("lifecycle_status", "archived"\)/g)).toHaveLength(2);
  });
});
