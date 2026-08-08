import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260730160000_okr_v2_dashboard_export_hardening.sql",
  "utf8",
).toLowerCase();
const route = readFileSync("src/App.tsx", "utf8");
const page = readFileSync(
  "src/features/okr/pages/OkrDashboardPage.tsx",
  "utf8",
);

describe("OKR V2 dashboard and export boundary", () => {
  it("keeps dashboard queries tenant-scoped and permission-gated", () => {
    expect(migration).toContain("function public.get_okr_dashboard_v1(");
    expect(migration).toContain("_okr_v2_guard(p_org_id, 'okr.view')");
    expect(migration).toContain("_okr_v2_guard(p_org_id, 'okr.executive_dashboard')");
    expect(migration).toContain("o.organization_id = p_org_id");
    expect(migration).toContain("c.organization_id = p_org_id");
  });

  it("governs exports by RBAC, entitlement, format and monthly quota", () => {
    expect(migration).toContain("function public.request_okr_export_v1(");
    expect(migration).toContain("_okr_v2_guard(p_org_id, 'okr.export')");
    expect(migration).toContain("check_okr_limit_v1(p_org_id, 'okr.export', v_used)");
    expect(migration).toContain("okr_v2_export_format_not_included:pdf");
    expect(migration).toContain("pg_advisory_xact_lock");
  });

  it("does not expose export audit rows to authenticated clients", () => {
    expect(migration).toContain(
      "revoke all on public.okr_export_events from public, anon, authenticated",
    );
    expect(migration).toContain("alter table public.okr_export_events enable row level security");
  });

  it("registers an entitled route and accessible chart fallback", () => {
    expect(route).toContain('path="/okr/dashboard"');
    expect(route).toContain('feature="okr.view"');
    expect(page).toContain('<caption className="sr-only">');
    expect(page).toContain("accessibilityLayer");
  });
});
