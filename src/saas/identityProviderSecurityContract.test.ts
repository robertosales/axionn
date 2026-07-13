import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260711090000_identity_provider_security_hardening.sql";
const migration = readFileSync(migrationPath, "utf8");

describe("identity provider security contract", () => {
  it("removes authenticated access to legacy sensitive RPCs", () => {
    expect(migration).toContain(
      "revoke all on function public.get_default_identity_provider(uuid)",
    );
    expect(migration).toContain(
      "revoke all on function public.sync_keycloak_user(uuid, text, text, text, text, uuid)",
    );
    expect(migration).toContain(
      "grant execute on function public.sync_keycloak_user(uuid, text, text, text, text, uuid)\n  to service_role",
    );
  });

  it("prevents direct authenticated reads of provider secrets", () => {
    expect(migration).toContain(
      "revoke all on table public.identity_providers\n  from public, anon, authenticated",
    );
    expect(migration).toContain(
      "revoke all on table public.keycloak_user_mappings\n  from public, anon, authenticated",
    );
  });

  it("exposes a sanitized member-scoped provider RPC", () => {
    const start = migration.indexOf(
      "create or replace function public.get_identity_provider_public_config",
    );
    const end = migration.indexOf(
      "create or replace function public.get_identity_provider_readiness",
    );
    const safeRpc = migration.slice(start, end);

    expect(safeRpc).toContain("membership.is_active");
    expect(safeRpc).toContain("provider.authorization_endpoint");
    expect(safeRpc).not.toContain("provider.client_secret_encrypted");
    expect(safeRpc).not.toContain("provider.config_json");
  });

  it("keeps SSO activation out of the database hardening", () => {
    expect(migration).not.toContain("signInWithOAuth");
    expect(migration).not.toContain("verify_jwt = false");
    expect(migration).not.toContain("update auth.users");
  });
});
