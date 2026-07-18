import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

const QUALITY_PERMISSIONS = [
  "view_quality",
  "view_test_cases",
  "manage_test_cases",
  "manage_test_suites",
  "manage_test_plans",
  "execute_tests",
  "manage_test_runs",
  "manage_quality_findings",
] as const;

export type QualityPermission = (typeof QUALITY_PERMISSIONS)[number];

export function useQualityPermissions() {
  const { hasPermission, roles } = useAuth();
  const {
    enabled: organizationTenancyEnabled,
    hasModuleAccess,
    getModuleRole,
    isOrganizationAdmin,
    isPlatformAdmin,
  } = useOrganization();

  const isSalaAgilModuleAdmin = getModuleRole("sala_agil") === "admin";
  const hasSalaAgilAccess = hasModuleAccess("sala_agil");

  const userPermissions = useMemo<Set<string>>(() => {
    const perms = new Set<string>();

    // Platform admin: todas
    if (isPlatformAdmin) {
      QUALITY_PERMISSIONS.forEach((p) => perms.add(p));
      return perms;
    }

    // Organization admin: todas
    if (isOrganizationAdmin) {
      QUALITY_PERMISSIONS.forEach((p) => perms.add(p));
      return perms;
    }

    // Módulo admin: todas
    if (hasSalaAgilAccess && isSalaAgilModuleAdmin) {
      QUALITY_PERMISSIONS.forEach((p) => perms.add(p));
      return perms;
    }

    // Permissões via role_permissions (banco de dados)
    QUALITY_PERMISSIONS.forEach((p) => {
      if (hasPermission(p)) perms.add(p);
    });

    // Via organization_members + role_permissions (módulo sala_agil)
    if (organizationTenancyEnabled && hasSalaAgilAccess) {
      const moduleRole = getModuleRole("sala_agil");
      if (moduleRole) {
        // Permissões básicas para qualquer role no módulo
        perms.add("view_quality");
        perms.add("view_test_cases");

        if (moduleRole === "qa_analyst") {
          QUALITY_PERMISSIONS.forEach((p) => perms.add(p));
        }
        if (["product_owner", "scrum_master"].includes(moduleRole)) {
          perms.add("manage_test_plans");
          perms.add("manage_test_runs");
          perms.add("manage_quality_findings");
          perms.add("execute_tests");
        }
        if (["developer", "analyst", "architect"].includes(moduleRole)) {
          perms.add("execute_tests");
        }
      }
    }

    return perms;
  }, [
    hasPermission,
    isPlatformAdmin,
    isOrganizationAdmin,
    hasSalaAgilAccess,
    isSalaAgilModuleAdmin,
    organizationTenancyEnabled,
    getModuleRole,
  ]);

  const can = useMemo(
    () => ({
      viewQuality: userPermissions.has("view_quality"),
      viewTestCases: userPermissions.has("view_test_cases"),
      manageTestCases: userPermissions.has("manage_test_cases"),
      manageTestSuites: userPermissions.has("manage_test_suites"),
      manageTestPlans: userPermissions.has("manage_test_plans"),
      executeTests: userPermissions.has("execute_tests"),
      manageTestRuns: userPermissions.has("manage_test_runs"),
      manageQualityFindings: userPermissions.has("manage_quality_findings"),
      canRead: userPermissions.has("view_quality"),
      canWrite:
        userPermissions.has("manage_test_cases") ||
        userPermissions.has("manage_test_suites") ||
        userPermissions.has("manage_test_plans"),
      canExecute: userPermissions.has("execute_tests"),
    }),
    [userPermissions],
  );

  return { can, userPermissions, isSalaAgilModuleAdmin };
}
