import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260725170000_okr_v2_cycle_closure_concurrency_hardening.sql",
  "utf8",
);

describe("OKR V2 cycle closure concurrency boundary", () => {
  it.each([
    "start_okr_cycle_closing_v1",
    "close_okr_cycle_v1",
  ])("replaces %s without changing its signature", (rpc) => {
    expect(migration).toContain(`function public.${rpc}(p_cycle_id uuid)`);
  });

  it("serializes both lifecycle reads", () => {
    expect(migration.match(/for update;/gi)).toHaveLength(2);
  });

  it("uses conditional writes as a second concurrency barrier", () => {
    expect(migration).toContain("and status = 'active'");
    expect(migration).toContain("and status = 'closing'");
    expect(migration.match(/OKR_CYCLE_CONCURRENT_TRANSITION/g)).toHaveLength(2);
    expect(migration.match(/errcode = '40001'/g)).toHaveLength(2);
  });

  it("keeps authorization and open-objective validation inside the transaction", () => {
    expect(migration.match(/_okr_v2_guard/g)).toHaveLength(2);
    expect(migration).toContain("OKR_CYCLE_HAS_OPEN_OBJECTIVES");
  });

  it("retains deny-by-default execution grants", () => {
    expect(migration.match(/from public, anon, authenticated/gi)).toHaveLength(2);
    expect(migration.match(/to authenticated, service_role/gi)).toHaveLength(2);
  });
});
