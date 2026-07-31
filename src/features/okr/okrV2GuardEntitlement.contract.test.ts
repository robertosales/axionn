import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260731110000_okr_v2_guard_entitlement_contract_fix.sql",
  "utf8",
);
const validation = readFileSync(
  "supabase/operations/20260731_01_okr_v2_guard_entitlement_contract_validation.sql",
  "utf8",
);
const cycleMigration = readFileSync(
  "supabase/migrations/20260723105159_9e16da13-54bf-4445-b285-52092ee49cb8.sql",
  "utf8",
);

describe("OKR V2 entitlement guard contract", () => {
  it("executes the void limit guard instead of projecting a nonexistent result", () => {
    expect(migration).toMatch(
      /perform\s+public\.check_okr_limit_v1\(_org_id, _entitlement, 0\)/i,
    );
    expect(migration).not.toMatch(
      /select\s+allowed\s+from\s+public\.check_okr_limit_v1/i,
    );
  });

  it("keeps authentication, RBAC and hardened execution on the shared guard", () => {
    expect(migration).toContain("if auth.uid() is null");
    expect(migration).toContain("has_okr_permission_v2(auth.uid(), _permission, _org_id)");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public, pg_temp");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated, service_role");
  });

  it("retains entitlement enforcement on cycle creation and exposes a read-only gate", () => {
    expect(cycleMigration).toContain(
      "_okr_v2_guard(p_org_id, 'okr.cycle_management', 'okr.cycle_management')",
    );
    expect(validation).toContain("guard_performs_limit_check");
    expect(validation).toContain(
      "okr_v2_guard_entitlement_contract_validation_ok",
    );
  });
});
