import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

const qualityEntitlementKey = (orgId: string | null) => 
  ["quality", "entitlement", orgId] as const;

function useQualityEntitlement(
  organizationId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: qualityEntitlementKey(organizationId),
    queryFn: async () => {
      if (!organizationId) return false;
      const { data, error } = await supabase.rpc(
        "check_organization_has_quality_module",
        { p_org_id: organizationId }
      );
      if (error) throw error;
      return data as boolean;
    },
    enabled: enabled && Boolean(organizationId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useQualityPermissions(
  options: { entitlementEnabled?: boolean } = {},
) {
  const { hasPermission } = useAuth();
  const {
    enabled: organizationTenancyEnabled,
    hasModuleAccess,
    getModuleRole,
    isOrganizationAdmin,
    isPlatformAdmin,
    currentOrganizationId,
  } = useOrganization();

  const qualityEnabled = import.meta.env.VITE_QUALITY_MANAGEMENT_ENABLED === "true";
  const entitlementEnabled =
    qualityEnabled && (options.entitlementEnabled ?? true);
  const qualityEntitlement = useQualityEntitlement(
    currentOrganizationId,
    entitlementEnabled,
  );
  const hasQualityEntitlement = qualityEntitlement.data ?? false;

  const isSalaAgilModuleAdmin = getModuleRole("sala_agil") === "admin";
  const hasSalaAgilAccess = hasModuleAccess("sala_agil");

  const userPermissions = useMemo<Set<string>>(() => {
    const perms = new Set<string>();

    if (!qualityEnabled) {
      return perms;
    }

    if (!hasQualityEntitlement) {
      return perms;
    }

    if (isPlatformAdmin) {
      QUALITY_PERMISSIONS.forEach((p) => perms.add(p));
      return perms;
    }

    if (isOrganizationAdmin) {
      QUALITY_PERMISSIONS.forEach((p) => perms.add(p));
      return perms;
    }

    if (hasSalaAgilAccess && isSalaAgilModuleAdmin) {
      QUALITY_PERMISSIONS.forEach((p) => perms.add(p));
      return perms;
    }

    if (organizationTenancyEnabled && hasSalaAgilAccess) {
      const moduleRole = getModuleRole("sala_agil");
      if (moduleRole) {
        perms.add("view_quality");
        perms.add("view_test_cases");

        const rolePermissions = getSystematicRolePermissions(moduleRole);
        rolePermissions.forEach((p) => perms.add(p));
      }
    }

    QUALITY_PERMISSIONS.forEach((p) => {
      if (hasPermission(p)) perms.add(p);
    });

    return perms;
  }, [
    hasPermission,
    isPlatformAdmin,
    isOrganizationAdmin,
    hasSalaAgilAccess,
    isSalaAgilModuleAdmin,
    organizationTenancyEnabled,
    getModuleRole,
    qualityEnabled,
    hasQualityEntitlement,
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

  return {
    can,
    userPermissions,
    isSalaAgilModuleAdmin,
    hasQualityEntitlement,
    entitlementLoading: qualityEntitlement.isLoading,
    entitlementError: qualityEntitlement.isError,
  };
}

function getSystematicRolePermissions(moduleRole: string): string[] {
  const basePermissions = ['view_quality', 'view_test_cases'];

  switch (moduleRole) {
    case 'qa_analyst':
      return [
        ...basePermissions,
        'manage_test_cases',
        'manage_test_suites', 
        'manage_test_plans',
        'execute_tests',
        'manage_test_runs',
        'manage_quality_findings',
        'approve_quality_gate'
      ];
      
    case 'product_owner':
    case 'scrum_master':
      return [
        ...basePermissions,
        'view_test_cases',
        'manage_test_plans',
        'manage_test_runs',
        'execute_tests',
        'manage_quality_findings',
        'export_quality_audit'
      ];
      
    case 'developer':
    case 'analyst': 
    case 'architect':
      return [
        ...basePermissions,
        'view_test_cases',
        'execute_tests'
      ];
      
    case 'admin':
      return [
        ...basePermissions,
        'manage_test_cases',
        'manage_test_suites',
        'manage_test_plans', 
        'execute_tests',
        'manage_test_runs',
        'manage_quality_findings',
        'approve_quality_gate',
        'manage_quality_settings'
      ];
      
    case 'viewer':
      return basePermissions;
      
    default:
      return basePermissions;
  }
}
