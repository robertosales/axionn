import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260725180000_okr_v2_atomic_check_in.sql",
  "utf8",
);
const service = readFileSync(
  "src/features/okr/services/okrMeasurement.service.ts",
  "utf8",
);

describe("OKR V2 atomic manual check-in", () => {
  it("implements the existing RPC stub as one transactional boundary", () => {
    expect(migration).toContain("function public.record_okr_check_in_v2(");
    expect(migration).toContain("for update of kr");
    expect(migration).toContain("insert into public.okr_check_ins");
    expect(migration).toContain("update public.okr_key_results");
    expect(migration).toContain("insert into public.okr_key_result_snapshots");
    expect(migration).toContain("recalculate_okr_objective_v2");
    expect(migration).toContain("insert into public.okr_audit_log");
  });

  it("enforces tenant, entitlement, lifecycle and KR mode", () => {
    expect(migration).toContain("_okr_v2_guard(p_org_id, 'okr.check_in')");
    expect(migration).toContain("v_org_id <> p_org_id");
    expect(migration).toContain("v_lifecycle <> 'active'");
    expect(migration).toContain("v_update_type = 'automatic'");
  });

  it("keeps the RPC deny-by-default", () => {
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to authenticated, service_role");
  });

  it("removes the multi-write sequence from the frontend service", () => {
    expect(service).toContain('.rpc("record_okr_check_in_v2"');
    expect(service).not.toMatch(/\.from\("okr_(?:check_ins|key_results|key_result_snapshots|objectives)"\)/);
    expect(service).not.toContain("calculateKrProgress");
    expect(service).not.toContain("recalculateObjective");
  });
});
