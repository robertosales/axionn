import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve("supabase/migrations/20260818230000_apf_export_authorization_hardening.sql"), "utf8");
const service = readFileSync(resolve("src/features/apf/services/apfEvidenceDossier.service.ts"), "utf8");

describe("APF export authorization", () => {
  it("checks the granular permission on dossier and batch exports", () => {
    expect(sql).toContain("authorize_apf_dossier_export");
    expect(sql).toContain("authorize_apf_batch_export");
    expect(sql).toContain("apf.dossier.export");
  });

  it("authorizes before returning browser export data", () => {
    expect(service).toContain('"authorize_apf_batch_export"');
    expect(service).toContain('"authorize_apf_dossier_export"');
  });

  it("guards records introduced after the permission foundation", () => {
    for (const table of ["apf_counting_metric_reviews", "apf_logical_file_reviews", "apf_exception_reviews", "apf_audit_findings", "apf_traceability_suggestions", "apf_evidence_quality_assessments"]) expect(sql).toContain(table);
  });
});
