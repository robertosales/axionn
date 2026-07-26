import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const operation = readFileSync(
  "supabase/operations/20260725_03_okr_v2_cycle_closure_concurrency_validation.sql",
  "utf8",
);

describe("OKR V2 cycle closure remote validation", () => {
  it("is read-only", () => {
    expect(operation).not.toMatch(
      /^\s*(?:insert|update|delete|grant|revoke|alter|create|drop)\b/im,
    );
  });

  it("checks both closure RPCs", () => {
    expect(operation).toContain("start_okr_cycle_closing_v1(uuid)");
    expect(operation).toContain("close_okr_cycle_v1(uuid)");
  });

  it("inspects installed definitions for both concurrency barriers", () => {
    expect(operation).toContain("pg_get_functiondef");
    expect(operation).toContain("row_lock_present");
    expect(operation).toContain("conditional_transition_present");
    expect(operation).toContain("serialization_error_present");
  });

  it("checks security and the execution privilege matrix", () => {
    expect(operation).toContain("p.prosecdef");
    expect(operation).toContain("search_path=public");
    expect(operation).toContain("has_function_privilege('anon'");
    expect(operation).toContain("has_function_privilege('authenticated'");
    expect(operation).toContain("has_function_privilege('service_role'");
  });

  it("publishes a cumulative gate", () => {
    expect(operation).toContain("okr_v2_cycle_closure_concurrency_validation_ok");
    expect(operation).toContain("bool_and(");
  });
});
