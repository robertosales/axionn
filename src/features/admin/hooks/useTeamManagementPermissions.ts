import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ORGANIZATION_TENANCY_ENABLED } from "@/lib/featureFlags";

export interface TeamManagementPermissions {
  /** true when the multi-tenant model is the authority for these checks. */
  tenancyEnabled: boolean;
  canViewTeams: boolean;
  canCreateTeam: boolean;
  canUpdateTeam: boolean;
  canDeleteTeam: boolean;
  canViewTeamMembers: boolean;
  canAddTeamMember: boolean;
  canRemoveTeamMember: boolean;
  canUpdateTeamMember: boolean;
  /** Human-readable reason when the current org blocks writes (e.g. suspended). */
  writeBlockedReason: string | null;
}

/**
 * Centralised permission gate for team & team-member administration.
 *
 * - When multi-tenant is enabled, permissions come from OrganizationContext
 *   (platform admin / org owner / org admin, and org must be operational).
 * - Otherwise, falls back to the legacy `manage_teams` permission.
 */
export function useTeamManagementPermissions(): TeamManagementPermissions {
  const { hasPermission, isAdmin } = useAuth();
  const {
    enabled: orgEnabled,
    isPlatformAdmin,
    isOrganizationAdmin,
    canOperate,
    operationBlockReason,
    currentOrganizationId,
  } = useOrganization();

  return useMemo<TeamManagementPermissions>(() => {
    if (ORGANIZATION_TENANCY_ENABLED && orgEnabled) {
      const isAdminHere = isPlatformAdmin || isOrganizationAdmin;
      const canWrite = isAdminHere && canOperate && Boolean(currentOrganizationId);
      const writeBlocked = !canWrite && isAdminHere && !canOperate
        ? operationBlockReason ?? "Organização suspensa ou cancelada: operações bloqueadas."
        : null;

      return {
        tenancyEnabled: true,
        canViewTeams: true,
        canCreateTeam: canWrite,
        canUpdateTeam: canWrite,
        canDeleteTeam: canWrite,
        canViewTeamMembers: true,
        canAddTeamMember: canWrite,
        canRemoveTeamMember: canWrite,
        canUpdateTeamMember: canWrite,
        writeBlockedReason: writeBlocked,
      };
    }

    const legacy = isAdmin || hasPermission("manage_teams");
    return {
      tenancyEnabled: false,
      canViewTeams: true,
      canCreateTeam: legacy,
      canUpdateTeam: legacy,
      canDeleteTeam: legacy,
      canViewTeamMembers: true,
      canAddTeamMember: legacy,
      canRemoveTeamMember: legacy,
      canUpdateTeamMember: legacy,
      writeBlockedReason: null,
    };
  }, [
    canOperate,
    currentOrganizationId,
    hasPermission,
    isAdmin,
    isOrganizationAdmin,
    isPlatformAdmin,
    operationBlockReason,
    orgEnabled,
  ]);
}