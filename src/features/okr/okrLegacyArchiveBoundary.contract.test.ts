import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hook = readFileSync("src/features/okr/hooks/useOkr.ts", "utf8");

describe("OKR legacy archive boundary", () => {
  it("does not physically delete objectives, KRs or check-ins", () => {
    expect(hook).not.toMatch(
      /\.from\(["']okr_(?:objectives|key_results|check_ins)["']\)\.delete/,
    );
  });

  it("hides archived records from the legacy active view", () => {
    expect(hook.match(/\.neq\("lifecycle_status", "archived"\)/g)).toHaveLength(2);
  });

  it("archives objectives through the tenant-scoped V2 RPC", () => {
    expect(hook).toContain('.rpc("archive_okr_objective_v2"');
    expect(hook).toContain("p_org_id: currentOrganizationId");
    expect(hook).toContain("p_objective_id: id");
  });

  it("archives KRs through the tenant-scoped V2 RPC", () => {
    expect(hook).toContain('.rpc("archive_okr_key_result_v2"');
    expect(hook).toContain("p_key_result_id: id");
  });

  it("requires archive entitlement for both legacy removal actions", () => {
    expect(
      hook.match(/assertEntitlement\(canArchive, "okr\.archive"\)/g),
    ).toHaveLength(2);
  });
});
