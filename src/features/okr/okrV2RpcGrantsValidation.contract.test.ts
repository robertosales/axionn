import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const operation = readFileSync(
  "supabase/operations/20260725_02_okr_v2_objective_rpc_grants_validation.sql",
  "utf8",
);

describe("OKR V2 objective RPC grants remote validation", () => {
  it("is read-only", () => {
    expect(operation).not.toMatch(
      /^\s*(?:insert|update|delete|grant|revoke|alter|create|drop)\b/im,
    );
  });

  it("checks every hardened Objective RPC", () => {
    expect(operation).toContain("create_okr_objective_v2(uuid,jsonb)");
    expect(operation).toContain("update_okr_objective_v2(uuid,uuid,jsonb)");
    expect(operation).toContain("archive_okr_objective_v2(uuid,uuid,text)");
  });

  it("checks the complete execution privilege matrix", () => {
    expect(operation).toContain("has_function_privilege('public'");
    expect(operation).toContain("has_function_privilege('anon'");
    expect(operation).toContain("has_function_privilege('authenticated'");
    expect(operation).toContain("has_function_privilege('service_role'");
  });

  it("checks SECURITY DEFINER and a safe search_path", () => {
    expect(operation).toContain("p.prosecdef");
    expect(operation).toContain("search_path=public");
  });

  it("publishes one explicit cumulative gate", () => {
    expect(operation).toContain("okr_v2_objective_rpc_grants_validation_ok");
    expect(operation).toContain("bool_and(");
  });
});
