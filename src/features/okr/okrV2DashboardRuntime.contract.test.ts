import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260730200000_okr_v2_dashboard_grouping_fix.sql",
  "utf8",
).toLowerCase();

const runtimeValidation = readFileSync(
  "supabase/operations/20260730_04_okr_v2_dashboard_runtime_validation.sql",
  "utf8",
).toLowerCase();

describe("OKR V2 dashboard runtime hardening", () => {
  it("adds updated_at to the objective focus grouping idempotently", () => {
    expect(migration).toContain(
      "o\\.calculated_progress,[[:space:]]*o\\.updated_at",
    );
    expect(migration).toContain("regexp_replace");
    expect(migration).toContain(
      "okr_v2_dashboard_grouping_patch_target_not_found",
    );
  });

  it("reloads PostgREST after replacing the function", () => {
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it("executes a transactional runtime probe without returning business data", () => {
    expect(runtimeValidation).toContain("begin;");
    expect(runtimeValidation).toContain("rollback;");
    expect(runtimeValidation).toContain("set_config('request.jwt.claim.sub'");
    expect(runtimeValidation).toContain("get_okr_dashboard_v1(");
    expect(runtimeValidation).toContain(
      "order by member.org_id, member.user_id",
    );
    expect(runtimeValidation).not.toContain("member.joined_at");
    expect(runtimeValidation).toContain(
      "okr_v2_dashboard_runtime_validation_ok",
    );
    expect(runtimeValidation).not.toContain("select payload");
  });
});
