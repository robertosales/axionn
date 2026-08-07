import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260730190000_okr_v2_membership_argument_order_fix.sql",
  "utf8",
).toLowerCase();

const validation = readFileSync(
  "supabase/operations/20260730_03_okr_v2_membership_argument_order_validation.sql",
  "utf8",
).toLowerCase();

describe("OKR V2 canonical membership argument order", () => {
  it("uses organization id before user id in guards and cycle listing", () => {
    expect(migration).toContain(
      "is_organization_member(_org_id, _user_id)",
    );
    expect(migration).toContain(
      "is_organization_member(p_org_id, auth.uid())",
    );
    expect(migration).not.toContain(
      "is_organization_member(_user_id, _org_id)",
    );
    expect(migration).not.toContain(
      "is_organization_member(auth.uid(), p_org_id)",
    );
  });

  it("repairs the OKR cycle and alignment RLS policies", () => {
    expect(migration).toContain(
      "using (public.is_organization_member(organization_id, auth.uid()))",
    );
    expect(migration).toContain("okr_cycles_org_member_select");
    expect(migration).toContain("okr_alignments_select");
  });

  it("ships a cumulative read-only validation and schema reload", () => {
    expect(validation).toContain(
      "okr_v2_membership_argument_order_validation_ok",
    );
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });
});
