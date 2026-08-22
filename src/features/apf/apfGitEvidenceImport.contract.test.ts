import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("supabase/migrations/20260817180000_apf_import_git_evidence.sql"), "utf8");

describe("APF Git evidence import contract", () => {
  it("restricts imports to the dossier tenant and linked user story", () => {
    expect(migration).toContain("apf_can_access_dossier(p_dossier_id)");
    expect(migration).toContain("link.hu_id = v_dossier.user_story_id");
    expect(migration).toContain("link.organization_id = v_dossier.organization_id");
  });

  it("supports both historical MR link identifiers", () => {
    expect(migration).toContain("link.git_entity_id in (mr.id::text, mr.mr_iid::text)");
    expect(migration).toContain("create or replace function public.get_hu_merge_requests");
  });

  it("persists provenance and prevents duplicate materialization", () => {
    expect(migration).toContain("'git_entity_id'");
    expect(migration).toContain("evidence.commit_sha = gc.commit_sha");
    expect(migration).toContain("'verified'");
    expect(migration).toContain("pg_advisory_xact_lock");
  });
});
