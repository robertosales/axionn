import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260731190000_rbac_profile_management_v1.sql",
  "utf8",
);
const validation = readFileSync(
  "supabase/operations/20260731_06_rbac_profile_management_validation.sql",
  "utf8",
);
const workspace = readFileSync("src/features/rbac/RbacWorkspace.tsx", "utf8");
const manager = readFileSync(
  "src/features/rbac/components/RbacProfilesManager.tsx",
  "utf8",
);
const wizard = readFileSync(
  "src/features/rbac/components/RbacProfileWizard.tsx",
  "utf8",
);
const matrix = readFileSync(
  "src/features/rbac/components/RbacPermissionMatrix.tsx",
  "utf8",
);
const assignments = readFileSync("src/components/UserRolesManager.tsx", "utf8");

describe("tenant-scoped RBAC profile management", () => {
  it("separates profile governance from user assignments", () => {
    expect(workspace).toContain('value="profiles"');
    expect(workspace).toContain('value="assignments"');
    expect(workspace).toContain("<RbacProfilesManager />");
    expect(workspace).toContain("<UserRolesManager />");
    expect(workspace).toContain('value="simulator"');
    expect(workspace).toContain('value="history"');
  });

  it("implements the four-step profile wizard and permission controls", () => {
    for (const step of ["Identidade", "Módulos", "Permissões", "Revisão"]) {
      expect(wizard).toContain(step);
    }
    expect(wizard).toContain('aria-label="Etapas do perfil"');
    expect(wizard).toContain("RbacPermissionMatrix");
    expect(wizard).toContain("Usuários impactados");
    expect(matrix).toContain("Pesquisar permissões");
    expect(matrix).toContain("Selecionar grupo inteiro");
    expect(matrix).toContain('checked === true');
  });

  it("provides loading, empty, error, success and responsive states", () => {
    expect(manager).toContain("RbacProfilesSkeleton");
    expect(manager).toContain("EmptyProfiles");
    expect(manager).toContain('variant="destructive"');
    expect(manager).toContain('aria-live="polite"');
    expect(manager).toContain("highlightedKey");
    expect(manager).toContain("sm:grid-cols-2");
    expect(manager).toContain("2xl:grid-cols-3");
  });

  it("persists custom profiles within the organization boundary", () => {
    expect(migration).toContain("organization_id uuid references public.organizations");
    expect(migration).toContain("function public.save_rbac_profile_v1(");
    expect(migration).toContain("function public.archive_rbac_profile_v1(");
    expect(migration).toContain("public.is_organization_admin(p_org_id, v_actor)");
    expect(migration).toContain("rbac_profile_permission_scope_invalid");
    expect(migration).toContain("rbac_system_profile_immutable");
    expect(migration).toContain("set search_path = public, pg_temp");
  });

  it("uses the same profile catalog when assigning access to users", () => {
    expect(assignments).toContain('"list_rbac_profiles_v1"');
    expect(assignments).toContain("profileOptionsByModule");
    expect(assignments).toContain('"manage_organization_member_profile_v2"');
    expect(migration).toContain("is_rbac_profile_available_v1");
    expect(assignments).toContain("persistedSignature !== expectedSignature");
    expect(assignments).not.toContain(
      '"is_organization_legacy_permission_fallback_enabled"',
    );
  });

  it("ships a read-only database validation gate", () => {
    expect(validation).toContain("profiles_are_tenant_scoped");
    expect(validation).toContain("member_assignment_uses_profile_scope_guard");
    expect(validation).toContain("rbac_profile_management_validation_ok");
    expect(validation).not.toMatch(
      /^\s*(insert\s+into|update|delete\s+from|alter|drop|create)\b/im,
    );
  });
});
