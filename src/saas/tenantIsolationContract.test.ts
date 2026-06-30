import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("tenant isolation SQL contract", () => {
  it("keeps the executable pgTAP suite in the repository", () => {
    const sql = read("supabase/tests/tenant_isolation.sql");

    expect(sql).toContain("select plan(18)");
    expect(sql).toContain("get_accessible_contracts_v2");
    expect(sql).toContain("get_accessible_projects_v2");
    expect(sql).toContain("get_accessible_teams_v2");
    expect(sql).toContain("can_operate_organization");
    expect(sql).toContain("contract_team_organization_mismatch");
    expect(sql).toContain("contract_room_team_organization_mismatch");
    expect(sql).toContain("project_relationship_organization_mismatch");
    expect(sql).toContain("set_tenancy_enforcement(true)");
    expect(sql).toContain("rollback;");
  });

  it("keeps a staging/local runner for the SQL suite", () => {
    const runner = read("scripts/run-tenant-isolation-tests.sh");

    expect(runner).toContain("SUPABASE_DB_URL");
    expect(runner).toContain("psql");
    expect(runner).toContain("tenant_isolation.sql");
  });
});
