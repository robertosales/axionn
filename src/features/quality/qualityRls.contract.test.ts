import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260804205000_quality_rls_membership_wrapper.sql",
  "utf8",
).toLowerCase();

describe("Quality tenant read-policy contract", () => {
  it("uses the authenticated tenant-scoped membership wrapper", () => {
    expect(migration).toContain(
      "using (public.can_read_organization(organization_id))",
    );
    expect(migration).not.toContain(
      "using (public.is_organization_member(organization_id, auth.uid()))",
    );
  });

  it("repairs every Quality table protected by the original policy rollout", () => {
    const protectedTables = [
      "quality_test_cases",
      "quality_test_steps",
      "quality_test_case_links",
      "quality_test_case_versions",
      "quality_test_suites",
      "quality_test_suite_items",
      "quality_test_plans",
      "quality_test_plan_items",
      "quality_test_runs",
      "quality_test_run_items",
      "quality_test_step_results",
      "quality_test_evidences",
      "quality_findings",
    ];

    protectedTables.forEach((table) => expect(migration).toContain(`'${table}'`));
  });
});
