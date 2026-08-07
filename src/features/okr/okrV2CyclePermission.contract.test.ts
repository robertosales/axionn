import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260731143000_okr_v2_cycle_permission_contract_fix.sql",
  "utf8",
);
const validation = readFileSync(
  "supabase/operations/20260731_04_okr_v2_cycle_permission_contract_validation.sql",
  "utf8",
);
const permissionSeed = readFileSync(
  "supabase/migrations/20260722142726_53e54aad-00f1-4c2e-b7f3-2ad3e9d291fd.sql",
  "utf8",
);

const affectedFunctions = [
  "start_okr_cycle_closing_v1(uuid)",
  "close_okr_cycle_v1(uuid)",
  "approve_okr_objective_review_v1(uuid,uuid,boolean,text)",
  "upsert_okr_cycle_review_v1(uuid,jsonb)",
  "approve_okr_cycle_review_v1(uuid,boolean)",
];

describe("OKR V2 canonical cycle permission contract", () => {
  it("patches each approval and closure RPC by exact signature", () => {
    for (const signature of affectedFunctions) {
      expect(migration).toContain(`public.${signature}`);
      expect(validation).toContain(`public.${signature}`);
    }
  });

  it("uses the permission present in the RBAC catalog", () => {
    expect(permissionSeed).toContain("'okr.cycle_management'");
    expect(permissionSeed).not.toContain("'okr.close_cycle'");
    expect(migration).toContain("'okr.close_cycle'");
    expect(migration).toContain("'okr.cycle_management'");
    expect(migration).toContain("set search_path = public, pg_temp");
  });

  it("validates functions, catalog mapping and removal of the legacy key", () => {
    expect(validation).toContain("no_function_uses_legacy_close_permission");
    expect(validation).toContain("all_functions_use_canonical_cycle_permission");
    expect(validation).toContain("admin_has_canonical_cycle_permission");
    expect(validation).toContain("okr_v2_cycle_permission_contract_validation_ok");
  });
});
