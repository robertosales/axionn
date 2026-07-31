import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260731210000_rbac_insights_audit_simulation_v1.sql",
  "utf8",
);
const validation = readFileSync(
  "supabase/operations/20260731_07_rbac_insights_audit_simulation_validation.sql",
  "utf8",
);
const workspace = readFileSync("src/features/rbac/RbacWorkspace.tsx", "utf8");
const comparison = readFileSync("src/features/rbac/components/RbacProfileComparisonDialog.tsx", "utf8");
const audit = readFileSync("src/features/rbac/components/RbacAuditPanel.tsx", "utf8");
const simulator = readFileSync("src/features/rbac/components/RbacAccessSimulator.tsx", "utf8");

describe("RBAC insights, audit and access simulation", () => {
  it("adds navigable, lazy-loaded simulator and history workspaces", () => {
    expect(workspace).toContain('value="simulator"');
    expect(workspace).toContain('value="history"');
    expect(workspace).toContain("RbacAccessSimulator");
    expect(workspace).toContain("RbacAuditPanel");
    expect(workspace).toContain("lazy(() =>");
    expect(workspace).toContain("InsightsSkeleton");
  });

  it("compares two profiles without mutating either one", () => {
    expect(comparison).toContain("Comparar perfis");
    expect(comparison).toContain("leftPermissions");
    expect(comparison).toContain("rightPermissions");
    expect(comparison).toContain("Em comum");
    expect(comparison).toContain("Pesquisar permissões comparadas");
    expect(comparison).not.toContain("save_rbac_profile_v1");
  });

  it("provides searchable simulation with administrative and inactive warnings", () => {
    expect(simulator).toContain("CommandInput");
    expect(simulator).toContain("Simular acesso");
    expect(simulator).toContain("hasAdministrativeBypass");
    expect(simulator).toContain("Acesso administrativo ampliado");
    expect(simulator).toContain("Conta inativa");
    expect(simulator).toContain("SimulatorSkeleton");
  });

  it("provides audit filters, recovery states and CSV export", () => {
    expect(audit).toContain("Histórico de acesso");
    expect(audit).toContain("exportToCsv");
    expect(audit).toContain("Todos os eventos");
    expect(audit).toContain("Nenhuma alteração encontrada");
    expect(audit).toContain("RbacAuditSkeleton");
    expect(audit).toContain("Tentar novamente");
  });

  it("keeps both database readers admin-only and tenant-scoped", () => {
    expect(migration).toContain("function public.list_rbac_audit_events_v1(");
    expect(migration).toContain("function public.simulate_rbac_user_access_v1(");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public, pg_temp");
    expect(migration).toContain("event.org_id = p_org_id");
    expect(migration).toContain("access.org_id = p_org_id");
    expect(migration).toContain("access.user_id = p_user_id");
    expect(migration).toContain("is_organization_admin(p_org_id, auth.uid())");
    expect(migration).toContain("from public, anon");
  });

  it("ships a read-only validation gate for the new RPCs", () => {
    expect(validation).toContain("audit_is_tenant_scoped");
    expect(validation).toContain("simulation_is_tenant_and_module_scoped");
    expect(validation).toContain("rbac_insights_audit_simulation_validation_ok");
    expect(validation).not.toMatch(/^\s*(insert\s+into|update|delete\s+from|alter|drop|create)\b/im);
  });
});
