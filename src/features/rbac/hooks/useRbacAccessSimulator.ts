import { useCallback, useEffect, useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import type {
  RbacAccessSimulation,
  RbacMemberOption,
  RbacModuleKey,
  RbacSimulatedModuleProfile,
} from "@/features/rbac/types";

function normalizeModuleProfile(value: unknown): RbacSimulatedModuleProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const moduleKey = String(row.module_key ?? "");
  if (!(["sala_agil", "sustentacao", "rdm"] as string[]).includes(moduleKey)) {
    return null;
  }

  const permissions = Array.isArray(row.permissions)
    ? row.permissions.flatMap((permission) => {
        if (!permission || typeof permission !== "object" || Array.isArray(permission)) {
          return [];
        }
        const item = permission as Record<string, unknown>;
        return [{
          key: String(item.permission_key),
          label: String(item.label ?? item.permission_key),
          description: item.description ? String(item.description) : null,
          groupKey: String(item.group_key ?? "general"),
        }];
      })
    : [];

  return {
    moduleKey: moduleKey as RbacModuleKey,
    profileKey: String(row.profile_key ?? "member"),
    profileName: String(row.profile_name ?? row.profile_key ?? "Membro"),
    isProfileActive: Boolean(row.is_profile_active),
    permissionCount: Number(row.permission_count ?? permissions.length),
    permissions,
  };
}

function normalizeSimulation(value: unknown): RbacAccessSimulation {
  const row = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const moduleProfiles = Array.isArray(row.module_profiles)
    ? row.module_profiles.map(normalizeModuleProfile).filter(Boolean) as RbacSimulatedModuleProfile[]
    : [];

  return {
    userId: String(row.user_id),
    displayName: String(row.display_name ?? "Usuário"),
    membershipRole: String(row.membership_role ?? "member"),
    isActive: Boolean(row.is_active),
    hasAdministrativeBypass: Boolean(row.has_administrative_bypass),
    permissionCount: Number(row.permission_count ?? 0),
    moduleProfiles,
  };
}

export function useRbacAccessSimulator() {
  const { currentOrganizationId } = useOrganization();
  const [members, setMembers] = useState<RbacMemberOption[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<RbacAccessSimulation | null>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!currentOrganizationId) {
      setMembers([]);
      setMembersError("Selecione uma organização para simular acessos.");
      setMembersLoading(false);
      return;
    }

    setMembersLoading(true);
    setMembersError(null);
    const { data, error } = await supabase.rpc("get_organization_members_v2", {
      p_org_id: currentOrganizationId,
    });

    if (error) {
      console.error("[useRbacAccessSimulator] members load failed", error);
      setMembers([]);
      setMembersError("Não foi possível carregar os membros da organização.");
    } else {
      setMembers((data ?? []).map((member) => ({
        userId: member.user_id,
        displayName: member.display_name || member.email,
        email: member.email,
        membershipRole: member.membership_role,
        isActive: member.is_active,
      })));
    }
    setMembersLoading(false);
  }, [currentOrganizationId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const simulate = useCallback(async (userId: string) => {
    if (!currentOrganizationId) return;
    setSimulationLoading(true);
    setSimulationError(null);
    setSimulation(null);

    const { data, error } = await supabase.rpc("simulate_rbac_user_access_v1", {
      p_org_id: currentOrganizationId,
      p_user_id: userId,
    });

    if (error) {
      console.error("[useRbacAccessSimulator] simulation failed", error);
      setSimulationError(
        "Não foi possível simular este acesso. Aplique a migration de insights ou tente novamente.",
      );
    } else {
      setSimulation(normalizeSimulation(data));
    }
    setSimulationLoading(false);
  }, [currentOrganizationId]);

  const resetSimulation = useCallback(() => {
    setSimulation(null);
    setSimulationError(null);
  }, []);

  return {
    members,
    membersLoading,
    membersError,
    reloadMembers: loadMembers,
    simulation,
    simulationLoading,
    simulationError,
    simulate,
    resetSimulation,
  };
}
