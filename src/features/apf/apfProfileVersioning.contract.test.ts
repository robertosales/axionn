import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readMigration = (name: string) => readFileSync(`supabase/migrations/${name}`, "utf8").toLowerCase();

const m1 = readMigration("20260810130000_apf_profile_versioning_foundation.sql");
const m2 = readMigration("20260810130100_apf_versioned_ruleset_catalogs.sql");
const m3 = readMigration("20260810130200_apf_profile_version_lifecycle.sql");
const m4 = readMigration("20260810130300_apf_profile_security_audit.sql");
const all = [m1, m2, m3, m4].join("\n");

describe("APF profile versioning M1-M4 contract", () => {
  it("creates only the approved profile and versioned catalog concepts", () => {
    [
      "apf_profiles",
      "apf_profile_versions",
      "apf_profile_rulesets",
      "apf_profile_function_types",
      "apf_profile_function_weights",
      "apf_profile_factors",
      "apf_profile_maintenance_rules",
      "apf_profile_precedence_rules",
    ].forEach((table) => expect(all).toContain(`create table if not exists public.${table}`));
    expect(all).not.toContain("create table if not exists public.rulesets");
  });

  it("does not mutate the legacy runtime or remove existing data", () => {
    expect(all).not.toMatch(/alter table public\.apf_counting_(sessions|items)/);
    expect(all).not.toMatch(/\b(drop table|truncate table|delete from)\b/);
    expect(all).not.toContain("drop function public.open_counting_session");
  });

  it("keeps undecided financial policy explicit and blocks incomplete publication", () => {
    expect(m2).toContain("rounding_mode text,");
    expect(m2).toContain("decimal_scale smallint,");
    expect(m2).toContain("rounding_stage text,");
    expect(m2).not.toMatch(/rounding_mode text[^,]*default/);
    expect(m3).toContain("apf_profile_version_financial_policy_incomplete");
  });

  it("implements deterministic hash, effective overlap protection and immutability", () => {
    expect(m3).toContain("create or replace function public.apf_canonical_jsonb");
    expect(m3).toContain("'sha256'");
    expect(m3).toContain("pg_advisory_xact_lock");
    expect(m3).toContain("apf_profile_version_effective_overlap");
    expect(m3).toContain("apf_published_version_update_forbidden");
    expect(m3).toContain("apf_published_version_configuration_immutable");
  });

  it("uses tenant-derived security definer helpers with hardened search paths", () => {
    const securityDefinerCount = (m4.match(/security definer/g) ?? []).length;
    const hardenedPathCount = (m4.match(/set search_path = public, pg_temp/g) ?? []).length;
    expect(securityDefinerCount).toBeGreaterThanOrEqual(9);
    expect(hardenedPathCount).toBeGreaterThanOrEqual(securityDefinerCount);
    expect(m4).toContain("public.is_organization_admin(contract.org_id, p_user_id)");
    expect(m4).toContain("public.user_contracts");
    expect(m4).not.toMatch(/p_organization_id/);
  });

  it("enables RLS, denies anon writes and restricts publication RPCs", () => {
    [
      "apf_profiles",
      "apf_profile_versions",
      "apf_profile_rulesets",
      "apf_profile_function_types",
      "apf_profile_function_weights",
      "apf_profile_factors",
      "apf_profile_maintenance_rules",
      "apf_profile_precedence_rules",
      "apf_profile_audit_events",
    ].forEach((table) => expect(m4).toContain(`alter table public.${table} enable row level security`));
    expect(m4).toContain("revoke all on function public.publish_apf_profile_version(uuid,bigint,text) from public, anon");
    expect(m4).toContain("grant execute on function public.publish_apf_profile_version(uuid,bigint,text) to authenticated");
  });
});
