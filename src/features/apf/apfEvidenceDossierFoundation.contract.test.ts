import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260817120000_apf_evidence_dossiers_foundation.sql"),
  "utf8",
);

describe("APF evidence dossier persistence contract", () => {
  it.each([
    "apf_evidence_dossiers",
    "apf_acceptance_criteria",
    "apf_evidence_sources",
    "apf_evidence_catalog_entries",
    "apf_traceability_links",
    "apf_audit_scenarios",
    "apf_dossier_versions",
    "apf_dossier_events",
  ])("creates and protects %s", (table) => {
    expect(migration).toContain(`create table public.${table}`);
    expect(migration).toContain(`'${table}'`);
  });

  it("freezes the contractual inputs required for deterministic export", () => {
    expect(migration).toContain("contract_snapshot jsonb not null");
    expect(migration).toContain("baseline_snapshot jsonb not null");
    expect(migration).toContain("ruleset_snapshot jsonb not null");
    expect(migration).toContain("rendered_markdown text not null");
    expect(migration).toContain("content_hash text not null");
  });

  it("makes versions and audit events append-only", () => {
    expect(migration).toContain("apf_versions_immutable before update or delete");
    expect(migration).toContain("apf_events_immutable before update or delete");
    expect(migration).toContain("apf_dossier_version_is_immutable");
  });

  it("enforces tenant access through organization membership", () => {
    expect(migration).toContain("public.is_organization_member(organization_id, auth.uid())");
    expect(migration).toContain("public.apf_can_access_dossier(dossier_id)");
  });
});
