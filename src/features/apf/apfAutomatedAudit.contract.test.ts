import { readFileSync } from "node:fs"; import { resolve } from "node:path"; import { describe, expect, it } from "vitest";
const migration = readFileSync(resolve("supabase/migrations/20260817210000_apf_automated_audit_findings.sql"), "utf8");
describe("APF automated audit contract", () => {
  it("detects the MVP blocking gaps", () => { for (const type of ["criterion_without_decision", "criterion_without_evidence", "unverified_evidence", "counting_item_without_evidence", "override_without_reason", "counting_memory_mismatch"]) expect(migration).toContain(type); });
  it("requires justified human review", () => { expect(migration).toContain("nullif(trim(p_note), '')"); expect(migration).toContain("reviewed_by = auth.uid()"); });
  it("enforces tenant access and audit events", () => { expect(migration).toContain("apf_can_access_dossier"); expect(migration).toContain("apf_dossier_events"); });
});
