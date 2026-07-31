import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260731230000_rbac_governance_temporary_access_v1.sql"), "utf8");
const validation = fs.readFileSync(path.join(root, "supabase/operations/20260731_08_rbac_governance_temporary_access_validation.sql"), "utf8");

describe("RBAC governance and temporary access contract", () => {
  it("enforces four-eyes approval for privileged changes", () => {
    expect(migration).toContain("rbac_profile_change_requests");
    expect(migration).toContain("v_request.requested_by = v_actor");
    expect(migration).toContain("rbac_four_eyes_reviewer_required");
    expect(migration).toContain("rbac_privileged_profile_requires_approval");
  });

  it("persists time-bound assignments and filters them in runtime guards", () => {
    expect(migration).toContain("assignment_justification");
    expect(migration).toContain("access.expires_at is null or access.expires_at > now()");
    expect(migration).toContain("interval '365 days'");
  });

  it("derives least-privilege signals from tenant usage events", () => {
    expect(migration).toContain("public.user_usage_events");
    expect(migration).toContain("interval '90 days'");
    expect(migration).toContain("events_90d");
  });

  it("ships a read-only validation operation", () => {
    expect(validation.toLowerCase()).not.toMatch(/\b(insert|update|delete|alter|drop|create|grant|revoke)\b/);
    expect(validation).toContain("rbac_governance_temporary_access_validation_ok");
  });
});
