import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

const ORGANIZATION_SALA_AGIL_WRITE_PERMISSIONS = new Set([
  "create_backlog",
  "edit_backlog",
  "create_sprint",
  "edit_sprint",
  "delete_sprint",
  "report_impediment",
]);

export function useSalaAgilPermission(permission: string) {
  const { hasPermission } = useAuth();
  const {
    enabled: organizationTenancyEnabled,
    hasModuleAccess,
    getModuleRole,
    isOrganizationAdmin,
  } = useOrganization();

  if (hasPermission(permission)) return true;
  if (!organizationTenancyEnabled) return false;

  const hasSalaAgil = hasModuleAccess("sala_agil");
  const isModuleAdmin = getModuleRole("sala_agil") === "admin";

  if (
    ORGANIZATION_SALA_AGIL_WRITE_PERMISSIONS.has(permission) &&
    (hasSalaAgil || isOrganizationAdmin || isModuleAdmin)
  ) {
    return true;
  }

  return false;
}
