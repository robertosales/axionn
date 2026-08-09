import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260807153000_quality_findings_lifecycle.sql"), "utf8").replace(/\r\n/g, "\n");

describe("Quality findings lifecycle migration", () => {
  it("authorizes mutations through the canonical tenant permission", () => {
    expect(sql).toContain("can_quality_permission_v1(p_org_id,'manage_quality_findings')");
    expect(sql).toContain("quality_finding_create_denied");
    expect(sql).toContain("quality_finding_update_denied");
  });

  it("validates tenant ownership for run items and steps", () => {
    expect(sql).toContain("ri.organization_id=p_org_id");
    expect(sql).toContain("sr.organization_id=p_org_id");
    expect(sql).toContain("quality_finding_run_item_mismatch");
    expect(sql).toContain("quality_finding_step_mismatch");
  });

  it("audits lifecycle changes and exposes only the RPCs", () => {
    expect(sql).toContain("quality.finding.created");
    expect(sql).toContain("quality.finding.status_changed");
    expect(sql).toContain("revoke all on function public.create_quality_finding_v1");
    expect(sql).toContain("grant execute on function public.create_quality_finding_v1");
  });
});
