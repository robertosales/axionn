import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260726100000_okr_v2_automatic_metrics_queue.sql",
  "utf8",
);
const worker = readFileSync("supabase/functions/okr-recalculation/index.ts", "utf8");
const manualScopeMigration = readFileSync(
  "supabase/migrations/20260807130000_okr_manual_queue_scope.sql",
  "utf8",
);

describe("OKR V2 automatic metrics boundary", () => {
  it("creates a versioned metric catalog and tenant bindings", () => {
    expect(migration).toContain("public.okr_metric_definitions");
    expect(migration).toContain("public.okr_metric_versions");
    expect(migration).toContain("public.okr_metric_bindings");
    expect(migration).toContain("organization_id uuid not null");
  });

  it("claims jobs atomically with bounded leases", () => {
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("lease_expires_at");
    expect(migration).toContain("attempts = queue.attempts + 1");
    expect(migration).toContain("least(coalesce(p_limit, 25), 100)");
  });

  it("implements retry backoff and dead-letter", () => {
    expect(migration).toContain("interval '1 minute'");
    expect(migration).toContain("interval '5 minutes'");
    expect(migration).toContain("interval '15 minutes'");
    expect(migration).toContain("interval '1 hour'");
    expect(migration).toContain("v_status := 'dead_letter'");
  });

  it("keeps measurement application idempotent and backend-owned", () => {
    expect(migration).toContain("function public.apply_okr_measurement_v2(");
    expect(migration).toContain("on conflict (idempotency_key) do nothing");
    expect(migration).toContain("public.calculate_okr_kr_progress_v2(");
    expect(migration).toContain("public.recalculate_okr_objective_v2(");
    expect(migration).toContain("OKR_V2_AUTOMATIC_METRICS_ENTITLEMENT_REQUIRED");
  });

  it("restricts queue and apply RPCs to service role", () => {
    expect(migration).toContain("to service_role;");
    expect(migration).toContain("from public, anon, authenticated;");
    expect(migration).toContain("grant execute on function public.request_okr_measurement_v2(uuid)");
  });

  it("makes the edge function an RPC orchestrator", () => {
    expect(worker).toContain('"claim_okr_recalculation_jobs_v1"');
    expect(worker).toContain('"apply_okr_measurement_v2"');
    expect(worker).toContain('"finish_okr_recalculation_job_v1"');
    expect(worker).not.toContain('.from("okr_key_results").update(');
    expect(worker).not.toContain('.from("okr_recalculation_queue").update(');
  });

  it("prevents a manual request from draining other organizations' jobs", () => {
    expect(manualScopeMigration).toContain("claim_okr_recalculation_job_v2");
    expect(manualScopeMigration).toContain("where queue.id = p_job_id");
    expect(manualScopeMigration).toContain("from public, anon, authenticated");
    expect(worker).toContain('requestedJobId = String(jobId)');
    expect(worker).toContain('"claim_okr_recalculation_job_v2"');
    expect(worker).toContain("const claim = isScheduled");
  });
});
