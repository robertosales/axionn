import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260731170000_organization_member_module_role_persistence.sql",
  "utf8",
);
const validation = readFileSync(
  "supabase/operations/20260731_05_organization_member_module_role_persistence_validation.sql",
  "utf8",
);
const manager = readFileSync("src/components/UserRolesManager.tsx", "utf8");
const profileSheet = readFileSync(
  "src/components/UserProfileSheet.tsx",
  "utf8",
);
const adminHook = readFileSync(
  "src/features/admin/hooks/useUsersAdmin.ts",
  "utf8",
);
const organizationMembersHook = readFileSync(
  "src/features/organization/hooks/useOrganizationMembers.ts",
  "utf8",
);
const organizationMembersPage = readFileSync(
  "src/features/organization/pages/OrganizationMembersPage.tsx",
  "utf8",
);

describe("organization member module-role persistence", () => {
  it("stores validated module and role pairs in the tenant boundary", () => {
    expect(migration).toContain(
      "function public.manage_organization_member_profile_v2(",
    );
    expect(migration).toContain("p_module_roles jsonb default null");
    expect(migration).toContain(
      "public.is_organization_admin(p_org_id, v_actor)",
    );
    expect(migration).toContain("organization_member_module_role_invalid");
    expect(migration).toContain("organization_member_module_role_duplicate");
    expect(migration).toContain(
      "insert into public.organization_member_modules",
    );
    expect(migration).toContain("role_name,");
    expect(migration).toContain("'member_profile_managed'");
  });

  it("provides an admin-only tenant-scoped reader", () => {
    expect(migration).toContain(
      "function public.get_organization_member_module_roles_v1(",
    );
    expect(migration).toContain(
      "public.is_organization_admin(p_org_id, auth.uid())",
    );
    expect(migration).toContain("module_access.org_id = p_org_id");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public, pg_temp");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated, service_role");
  });

  it("reads and writes authoritative roles in both administration flows", () => {
    for (const source of [manager, adminHook]) {
      expect(source).toContain(
        '"get_organization_member_module_roles_v1"',
      );
      expect(source).toContain('"manage_organization_member_profile_v2"');
      expect(source).toContain("p_module_roles:");
      expect(source).toContain("module_key:");
      expect(source).toContain("role_name:");
      expect(source).toContain("if (moduleRolesRes.error)");
    }
  });

  it("preserves specialized roles when organization access is edited", () => {
    expect(organizationMembersHook).toContain(
      '"get_organization_member_module_roles_v1"',
    );
    expect(organizationMembersHook).toContain(
      '"manage_organization_member_profile_v2"',
    );
    expect(organizationMembersHook).toContain(
      "currentRolesByModule.get(moduleKey) ?? \"member\"",
    );
    expect(organizationMembersHook).not.toContain(
      '"update_organization_member_v2"',
    );
    expect(organizationMembersPage).toContain(
      'busy || !isNameValid || (!isOwner && moduleKeys.length === 0)',
    );
    expect(organizationMembersPage).toContain(
      "Selecione pelo menos um módulo.",
    );
  });

  it("edits the member name through the tenant-scoped profile mutation", () => {
    expect(organizationMembersHook).toContain(
      "p_display_name: input.displayName?.trim() || null",
    );
    expect(organizationMembersPage).toContain('id="member-display-name"');
    expect(organizationMembersPage).toContain(
      "displayName: normalizedDisplayName",
    );
  });

  it("keeps role identifiers canonical and controls accessible", () => {
    expect(profileSheet).toContain(
      '{ value: "developer",     label: "Desenvolvedor" }',
    );
    expect(profileSheet).toContain(
      '{ value: "qa",            label: "Analista de QA" }',
    );
    expect(profileSheet).toContain(
      'return role === "qa" ? "qa_analyst" : role;',
    );
    expect(profileSheet).toContain("Acesso ao módulo ${mod.label}");
    expect(profileSheet).toContain("Perfil em ${mod.label}");
  });

  it("ships a read-only validation gate for the complete contract", () => {
    expect(validation).toContain("module_role_reader_exists");
    expect(validation).toContain("module_role_manager_exists");
    expect(validation).toContain("manager_persists_module_role_name");
    expect(validation).toContain("reader_is_tenant_scoped");
    expect(validation).toContain(
      "organization_member_module_role_persistence_validation_ok",
    );
    expect(validation).not.toMatch(
      /^\s*(insert\s+into|update|delete\s+from|alter|drop|create)\b/im,
    );
  });
});
