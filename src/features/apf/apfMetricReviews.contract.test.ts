import { readFileSync } from "node:fs"; import { resolve } from "node:path"; import { describe, expect, it } from "vitest";
const migration = readFileSync(resolve("supabase/migrations/20260817220000_apf_metric_reviews.sql"), "utf8");
describe("APF metric review contract",()=>{
  it("separates suggested and confirmed metrics",()=>{expect(migration).toContain("suggested_det");expect(migration).toContain("confirmed_det");expect(migration).toContain("confirmed_ftr");expect(migration).toContain("confirmed_ret");});
  it("requires justification and dossier ownership",()=>{expect(migration).toContain("nullif(trim(p_justification),'')");expect(migration).toContain("session_id = v_dossier.counting_session_id");expect(migration).toContain("apf_can_access_dossier");});
  it("preserves an auditable human event",()=>{expect(migration).toContain("reviewed_by=auth.uid()");expect(migration).toContain("apf_dossier_events");});
});
