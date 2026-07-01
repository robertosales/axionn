import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("tenant isolation SQL contract", () => {
  it("keeps the canonical pgTAP suites and legacy entrypoint in the repository", () => {
    const contractSuite = read("supabase/tests/database/01_tenancy_contract.test.sql");
    const isolationSuite = read("supabase/tests/database/02_tenancy_isolation.test.sql");
    const legacyEntrypoint = read("supabase/tests/tenant_isolation.sql");

    expect(contractSuite).toContain("select plan(28)");
    expect(contractSuite).toContain("get_tenancy_readiness_report");

    expect(isolationSuite).toContain("select plan(32)");
    expect(isolationSuite).toContain("get_accessible_contracts_v2");
    expect(isolationSuite).toContain("get_accessible_projects_v2");
    expect(isolationSuite).toContain("get_accessible_teams_v2");
    expect(isolationSuite).toContain("can_operate_organization");
    expect(isolationSuite).toContain("contract_team_organization_mismatch");
    expect(isolationSuite).toContain("contract_room_team_organization_mismatch");
    expect(isolationSuite).toContain("project_relationship_organization_mismatch");
    expect(isolationSuite).toContain("set_tenancy_enforcement(true)");
    expect(isolationSuite).toContain("rollback;");

    expect(legacyEntrypoint).toContain("database/01_tenancy_contract.test.sql");
    expect(legacyEntrypoint).toContain("database/02_tenancy_isolation.test.sql");
  });

  it("keeps a staging/local runner for the canonical SQL suite", () => {
    const runner = read("scripts/run-tenant-isolation-tests.sh");

    expect(runner).toContain("SUPABASE_DB_URL");
    expect(runner).toContain("psql");
    expect(runner).toContain("supabase/tests/database");
  });
});
