import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260731133000_okr_v2_publish_lock_scope_fix.sql",
  "utf8",
);
const validation = readFileSync(
  "supabase/operations/20260731_03_okr_v2_publish_lock_scope_validation.sql",
  "utf8",
);

describe("OKR V2 objective publish lock scope", () => {
  it("locks only the objective on the cycle left join", () => {
    expect(migration).toMatch(/left\s+join\s+public\.okr_cycles\s+c/i);
    expect(migration).toMatch(/for\s+update\s+of\s+o\s*;/i);
    expect(migration).not.toMatch(/where\s+o\.id\s*=\s*p_objective_id\s+for\s+update\s*;/i);
  });

  it("preserves publication rules, canonical audit and hardened execution", () => {
    expect(migration).toContain("_okr_v2_guard(p_org_id, 'okr.edit')");
    expect(migration).toContain("OKR_V2_PUBLISH_REQUIRES_KR");
    expect(migration).toContain("lifecycle_status = 'active'");
    expect(migration).toContain("action, metadata, created_at");
    expect(migration).toContain("set search_path = public, pg_temp");
    expect(migration).toContain("to authenticated, service_role");
  });

  it("provides a read-only runtime contract validation", () => {
    expect(validation).toContain("publish_locks_only_objective");
    expect(validation).toContain("publish_audit_uses_metadata");
    expect(validation).toContain("publish_keeps_permission_guard");
    expect(validation).toContain("okr_v2_publish_lock_scope_validation_ok");
  });
});
