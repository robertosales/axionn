import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const operation = readFileSync(
  "supabase/operations/20260725_04_okr_v2_atomic_check_in_validation.sql",
  "utf8",
);

describe("OKR V2 atomic check-in remote validation", () => {
  it("is read-only", () => {
    expect(operation).not.toMatch(
      /^\s*(?:insert|update|delete|grant|revoke|alter|create|drop)\b/im,
    );
  });

  it("inspects the installed RPC instead of the migration source", () => {
    expect(operation).toContain(
      "public.record_okr_check_in_v2(uuid,uuid,jsonb)",
    );
    expect(operation).toContain("pg_get_functiondef");
  });

  it("checks every atomic write and the row lock", () => {
    expect(operation).toContain("check_in_row_lock_present");
    expect(operation).toContain("check_in_write_present");
    expect(operation).toContain("key_result_write_present");
    expect(operation).toContain("snapshot_write_present");
    expect(operation).toContain("objective_recalculation_present");
    expect(operation).toContain("audit_write_present");
  });

  it("proves the implementation stub is gone", () => {
    expect(operation).toContain("implementation_stub_removed");
    expect(operation).toContain("OKR_V2_NOT_IMPLEMENTED");
  });

  it("checks security, grants and one cumulative gate", () => {
    expect(operation).toContain("check_in_rpc_security_definer");
    expect(operation).toContain("check_in_rpc_safe_search_path");
    expect(operation).toContain("anon_cannot_execute");
    expect(operation).toContain("authenticated_can_execute");
    expect(operation).toContain("service_role_can_execute");
    expect(operation).toContain("okr_v2_atomic_check_in_validation_ok");
  });
});
