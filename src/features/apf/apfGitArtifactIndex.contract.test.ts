import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("supabase/migrations/20260817190000_apf_index_git_artifacts.sql"), "utf8");

describe("APF Git artifact index contract", () => {
  it("only indexes commits already materialized in the dossier tenant", () => {
    expect(migration).toContain("apf_can_access_dossier(p_dossier_id)");
    expect(migration).toContain("parent.commit_sha = gc.commit_sha");
    expect(migration).toContain("gc.organization_id = v_dossier.organization_id");
  });

  it("classifies technical artifacts deterministically", () => {
    for (const category of ["'test'", "'database'", "'api'", "'interface'", "'code'"]) expect(migration).toContain(category);
    expect(migration).toContain("jsonb_to_recordset");
  });

  it("is idempotent and preserves commit provenance", () => {
    expect(migration).toContain("evidence.file_path = changed.path");
    expect(migration).toContain("v_artifact.commit_sha || ':' || v_artifact.path");
    expect(migration).toContain("'parent_commit_sha'");
  });
});
