import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260731235900_rbac_insights_runtime_repair.sql"),
  "utf8",
);
const validation = fs.readFileSync(
  path.join(root, "supabase/operations/20260731_09_rbac_insights_runtime_repair_validation.sql"),
  "utf8",
);

describe("RBAC insights runtime repair", () => {
  it("reinstalls both RPCs with stable signatures", () => {
    expect(migration).toContain("list_rbac_audit_events_v1(");
    expect(migration).toContain("simulate_rbac_user_access_v1(");
    expect(migration).toContain("p_limit integer default 100");
    expect(migration).toContain("p_user_id uuid");
  });

  it("keeps tenant and administrator boundaries", () => {
    expect(migration).toContain("is_organization_admin(p_org_id, auth.uid())");
    expect(migration).toContain("event.org_id = p_org_id");
    expect(migration).toContain("access.org_id = p_org_id");
    expect(migration).toContain("access.user_id = p_user_id");
  });

  it("does not simulate expired temporary assignments", () => {
    expect(migration).toContain("access.expires_at is null or access.expires_at > now()");
  });

  it("reloads PostgREST and ships a read-only validation", () => {
    expect(migration).toContain("notify pgrst, 'reload schema'");
    expect(validation.toLowerCase()).not.toMatch(/\b(insert|update|delete|alter|drop|create|grant|revoke)\b/);
    expect(validation).toContain("rbac_insights_runtime_repair_validation_ok");
  });
});
