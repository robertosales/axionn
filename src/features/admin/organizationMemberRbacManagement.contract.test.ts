import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260730210000_organization_member_rbac_management.sql",
  "utf8",
);
const manager = readFileSync("src/components/UserRolesManager.tsx", "utf8");
const page = readFileSync(
  "src/features/admin/pages/AdminUsuariosPage.tsx",
  "utf8",
);
const adminHook = readFileSync(
  "src/features/admin/hooks/useUsersAdmin.ts",
  "utf8",
);
const validation = readFileSync(
  "supabase/operations/20260730_04_organization_member_rbac_validation.sql",
  "utf8",
);

describe("organization member RBAC management", () => {
  it("exposes one tenant-scoped transactional mutation", () => {
    expect(migration).toContain(
      "function public.manage_organization_member_v1(",
    );
    expect(migration).toContain(
      "public.is_organization_admin(p_org_id, v_actor)",
    );
    expect(migration).toContain("for update");
    expect(migration).toContain("organization_owner_requires_transfer");
    expect(migration).toContain("organization_member_self_deactivation_forbidden");
    expect(migration).toContain("organization_member_module_required");
    expect(migration).toContain(
      "organization_member_shared_profile_name_forbidden",
    );
  });

  it("keeps grants narrow and records tenant audit", () => {
    expect(migration).toContain(
      "revoke all on function public.manage_organization_member_v1(",
    );
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated, service_role");
    expect(migration).toContain("organization_membership_audit_log");
    expect(migration).toContain("'member_managed'");
  });

  it("ships a read-only post-migration validation gate", () => {
    expect(validation).toContain("manage_organization_member_v1");
    expect(validation).toContain("anon_can_manage_organization_members");
    expect(validation).toContain("manage_member_security_boundary_invalid");
    expect(validation).toContain("organization_member_rbac_validation_ok");
    expect(validation).not.toMatch(/\b(insert|update|delete|alter|drop|create)\b/i);
  });

  it("routes tenant edits and status changes through the scoped RPC", () => {
    expect(
      manager.match(/"manage_organization_member_v1"/g),
    ).toHaveLength(2);
    expect(
      manager.match(/"manage_organization_member_profile_v2"/g),
    ).toHaveLength(1);
    expect(manager).toContain("p_display_name: trimmed");
    expect(manager).toContain("p_module_roles:");
    expect(manager).toContain("p_is_active: newActive");
    expect(manager).toContain("p_is_active: false");
  });

  it("uses invitations instead of client-side sign-up after tenancy cutover", () => {
    expect(page).toContain('navigate("/organization/members")');
    expect(page).toContain('"Convidar Usuário"');
    expect(page).toContain(
      "(!ORGANIZATION_TENANCY_ENABLED || !currentOrganizationId)",
    );
  });

  it("uses the organization authority for both reads and writes", () => {
    for (const source of [manager, adminHook]) {
      expect(source).toContain(
        "ORGANIZATION_TENANCY_ENABLED && Boolean(currentOrganizationId)",
      );
      expect(source).not.toContain(
        '"is_organization_legacy_permission_fallback_enabled"',
      );
    }
    expect(manager).toContain("persistedSignature !== expectedSignature");
    expect(manager).toContain("Perfil atualizado e confirmado.");
  });
});
