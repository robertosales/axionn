import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260731123000_okr_v2_audit_metadata_contract_fix.sql",
  "utf8",
);
const validation = readFileSync(
  "supabase/operations/20260731_02_okr_v2_audit_metadata_contract_validation.sql",
  "utf8",
);

const affectedFunctions = [
  "create_okr_objective_v2(uuid,jsonb)",
  "update_okr_objective_v2(uuid,uuid,jsonb)",
  "archive_okr_objective_v2(uuid,uuid,text)",
  "create_okr_alignment_v1(uuid,jsonb)",
  "archive_okr_alignment_v1(uuid,uuid)",
  "create_okr_key_result_v2(uuid,uuid,jsonb)",
  "update_okr_key_result_v2(uuid,uuid,jsonb)",
  "archive_okr_key_result_v2(uuid,uuid,text)",
  "publish_okr_objective_v2(uuid,uuid)",
];

describe("OKR V2 canonical audit metadata contract", () => {
  it("patches every affected active RPC by its exact signature", () => {
    for (const signature of affectedFunctions) {
      expect(migration).toContain(`public.${signature}`);
      expect(validation).toContain(`public.${signature}`);
    }
  });

  it("replaces only the legacy audit column and remains idempotent", () => {
    expect(migration).toContain("pg_get_functiondef");
    expect(migration).toContain("regexp_replace");
    expect(migration).toContain("v_payload_pattern");
    expect(migration).toContain("v_metadata_pattern");
    expect(migration).not.toMatch(/add\s+column(?:\s+if\s+not\s+exists)?\s+payload/i);
  });

  it("validates the canonical table and all corrected function definitions", () => {
    expect(validation).toContain("all_audit_inserts_use_metadata");
    expect(validation).toContain("no_audit_insert_uses_payload");
    expect(validation).toContain("audit_metadata_column_exists");
    expect(validation).toContain("audit_payload_column_does_not_exist");
    expect(validation).toContain(
      "okr_v2_audit_metadata_contract_validation_ok",
    );
  });
});
