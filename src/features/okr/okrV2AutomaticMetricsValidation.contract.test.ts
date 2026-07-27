import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const operation = readFileSync(
  "supabase/operations/20260726_01_okr_v2_automatic_metrics_validation.sql",
  "utf8",
);

describe("OKR V2 automatic metrics validation operation", () => {
  it("validates catalog, queue concurrency, grants and retry policy", () => {
    expect(operation).toContain("metric_tables_with_rls");
    expect(operation).toContain("procedure.proconfig");
    expect(operation).toContain("'search_path=public' = any(runtime_settings)");
    expect(operation).toContain("queue_claim_uses_skip_locked");
    expect(operation).toContain("queue_retry_policy_present");
    expect(operation).toContain("anon_cannot_apply_measurements");
    expect(operation).toContain("service_role_can_apply_measurements");
    expect(operation).toContain("canonical_metric_catalog_available");
  });

  it("exposes one cumulative approval flag", () => {
    expect(operation).toContain("okr_v2_automatic_metrics_validation_ok");
  });
});
