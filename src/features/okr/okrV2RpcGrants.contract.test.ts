import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260725160000_okr_v2_objective_rpc_grants_hardening.sql",
  "utf8",
).toLowerCase();

const objectiveRpcs = [
  "create_okr_objective_v2(uuid, jsonb)",
  "update_okr_objective_v2(uuid, uuid, jsonb)",
  "archive_okr_objective_v2(uuid, uuid, text)",
];

describe("OKR V2 Objective RPC grants contract", () => {
  it.each(objectiveRpcs)("revokes broad access from %s", (signature) => {
    expect(migration).toContain(`revoke all on function public.${signature}`);
  });

  it.each(objectiveRpcs)(
    "grants authenticated and service execution to %s",
    (signature) => {
      const start = migration.indexOf(
        `grant execute on function public.${signature}`,
      );
      const statement = migration.slice(start, migration.indexOf(";", start));

      expect(start).toBeGreaterThan(-1);
      expect(statement).toContain("to authenticated, service_role");
    },
  );

  it("is additive and does not replace business functions", () => {
    expect(migration).not.toContain("create or replace function");
    expect(migration).not.toMatch(/\b(drop|delete|truncate)\b/);
  });
});
