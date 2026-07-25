import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const validation = readFileSync(
  "supabase/operations/20260725_01_quality_intelligence_cumulative_validation.sql",
  "utf8",
).toLowerCase();

describe("Quality Intelligence cumulative validation contract", () => {
  it("is read-only and leaves no transaction state behind", () => {
    expect(validation).toContain("set transaction read only");
    expect(validation).toContain("rollback;");
    expect(validation).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create)\b/im,
    );
  });

  it("validates the complete tenant and commercial boundary", () => {
    expect(validation).toContain("tables_with_rls = 14");
    expect(validation).toContain("rpcs_available = 19");
    expect(validation).toContain("quality.cases.view");
    expect(validation).toContain("anon_cannot_check_entitlement");
    expect(validation).toContain("authenticated_cannot_insert_cases_directly");
  });

  it("publishes one explicit operational gate", () => {
    expect(validation).toContain(
      "quality_intelligence_cumulative_validation_ok",
    );
  });
});
