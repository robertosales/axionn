import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("supabase/migrations/20260817160000_apf_homologate_dossier.sql"), "utf8");

describe("APF dossier homologation contract", () => {
  it("requires a validated dossier and a distinct approver", () => {
    expect(migration).toContain("v_dossier.status <> 'validated'");
    expect(migration).toContain("auth.uid() = v_dossier.created_by or auth.uid() = v_dossier.validated_by");
    expect(migration).toContain("dossier_homologation_requires_distinct_user");
  });

  it("only homologates the latest immutable version", () => {
    expect(migration).toContain("max(candidate.version_number)");
    expect(migration).toContain("only_latest_dossier_version_can_be_homologated");
  });

  it("freezes the total and records an audit event", () => {
    expect(migration).toContain("total_homologated_pf = total_impacted_pf");
    expect(migration).toContain("'homologated'");
    expect(migration).toContain("content_hash");
  });
});
