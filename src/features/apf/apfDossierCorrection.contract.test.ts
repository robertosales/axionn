import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("supabase/migrations/20260817170000_apf_dossier_correction_flow.sql"), "utf8");

describe("APF dossier correction flow", () => {
  it("only creates successors from homologated dossiers", () => {
    expect(migration).toContain("v_source.status <> 'homologated'");
    expect(migration).toContain("previous_dossier_id");
  });
  it("copies evidence but requires it to be verified again", () => {
    expect(migration).toContain("v_evidence.summary, v_evidence.content_hash, 'unverified'");
  });
  it("supersedes the original only when the successor is homologated", () => {
    expect(migration).toContain("new.status = 'homologated'");
    expect(migration).toContain("status = 'superseded'");
    expect(migration).toContain("successor_dossier_id");
  });
});
