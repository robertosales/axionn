import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const migration = readFileSync(resolve("supabase/migrations/20260817200000_apf_traceability_suggestions.sql"), "utf8");
describe("APF traceability suggestions contract", () => {
  it("keeps suggestions pending and separate from confirmed links", () => { expect(migration).toContain("status text not null default 'pending'"); expect(migration).toContain("review_apf_traceability_suggestion"); });
  it("records method, confidence and rationale", () => { expect(migration).toContain("method text not null"); expect(migration).toContain("confidence numeric"); expect(migration).toContain("rationale text not null"); });
  it("requires a human decision before creating a link", () => { expect(migration).toContain("if p_accept and not exists"); expect(migration).toContain("confirmed_by, confirmed_at"); expect(migration).toContain("public.apf_can_access_dossier"); });
});
