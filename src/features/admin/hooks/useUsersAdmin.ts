import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ORGANIZATION_TENANCY_ENABLED } from "@/lib/featureFlags";
import { toast } from "sonner";

export interface UserModuleRole {
  module: string;
  role_name: string;
}

export interface UserAdmin {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  module_access: string;
  team_id: string | null;
  team_name?: string;
  teams: { id: string; name: string }[];
  module_roles: UserModuleRole[];
  contract_role: "admin_contrato" | "member" | null;
  is_admin: boolean;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

/**
 * contractId: quando fornecido, retorna apenas usuários vinculados
 * a esse contrato via user_contracts.
 * null = todos os usuários.
 */
export function useUsersAdmin(contractId?: string | null) {
  const { currentOrganizationId, refreshOrganizations, refreshModuleAccess } =
    useOrganization();
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOrganizationAuthorityCutover = useCallback(async () => {
    if (!ORGANIZATION_TENANCY_ENABLED) return false;
    const { data: fallbackEnabled, error: fallbackError } =
      await (supabase as any).rpc(
        "is_organization_legacy_permission_fallback_enabled",
      );
    return fallbackError === null && fallbackEnabled !== true;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let allowedUserIds: Set<string> | null = null;
      if (contractId) {
        const { data: ucData } = await supabase
          .from("user_contracts")
          .select("user_id")
          .eq("contract_id", contractId);
        allowedUserIds = new Set(
          (ucData ?? []).map((row: any) => row.user_id as string),
        );
      }

      const useOrganizationAuthority =
        (await isOrganizationAuthorityCutover()) &&
        Boolean(currentOrganizationId);

      if (useOrganizationAuthority && currentOrganizationId) {
        const [membersRes, contractRolesRes] = await Promise.all([
          (supabase as any).rpc("get_organization_members_v2", {
            p_org_id: currentOrganizationId,
          }),
          supabase.from("user_contracts").select("user_id, role"),
        ]);

        if (membersRes.error) {
          setError(`Erro ao buscar membros: ${membersRes.error.message}`);
          return;
        }

        const contractRoleMap: Record<string, "admin_contrato" | "member"> = {};
        (contractRolesRes.error ? [] : contractRolesRes.data || []).forEach(
          (contractRole: any) => {
            if (contractRole.user_id) {
              contractRoleMap[contractRole.user_id] = contractRole.role;
            }
          },
        );

        setUsers(
          ((membersRes.data ?? []) as any[])
            .filter((member) =>
              allowedUserIds ? allowedUserIds.has(member.user_id) : true,
            )
            .map((member) => {
              const moduleKeys = (member.module_keys ?? []) as string[];
              const roleName =
                member.membership_role === "owner" ||
                member.membership_role === "admin"
                  ? "admin"
                  : "member";

              return {
                id: String(member.user_id),
                user_id: String(member.user_id),
                display_name: String(member.display_name ?? ""),
                email: String(member.email ?? ""),
                module_access: moduleKeys[0] ?? "sala_agil",
                team_id: null,
                team_name: undefined,
                teams: [],
                module_roles: moduleKeys.map((moduleKey) => ({
                  module: moduleKey,
                  role_name: roleName,
                })),
                contract_role: contractRoleMap[member.user_id] ?? null,
                is_admin:
                  member.membership_role === "owner" ||
                  member.membership_role === "admin",
                is_active: Boolean(member.is_active),
                must_change_password: false,
                created_at: String(member.joined_at ?? ""),
              };
            }),
        );
        return;
      }

      const [
        profilesRes,
        rolesRes,
        membersRes,
        moduleRolesRes,
        contractRolesRes,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, user_id, display_name, email, module_access, team_id, must_change_password, is_active, created_at",
          )
          .order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("team_members").select("user_id, teams(id, name)"),
        supabase
          .from("user_module_roles")
          .select("user_id, module, role_name"),
        supabase.from("user_contracts").select("user_id, role"),
      ]);

      if (profilesRes.error) {
        setError(`Erro ao buscar usuários: ${profilesRes.error.message}`);
        return;
      }

      const profiles = (profilesRes.data || []).filter((profile: any) =>
        allowedUserIds ? allowedUserIds.has(profile.user_id) : true,
      );
      const roles = rolesRes.data || [];
      const members = membersRes.data || [];
      const moduleRoles = moduleRolesRes.error ? [] : moduleRolesRes.data || [];
      const contractRoles = contractRolesRes.error
        ? []
        : contractRolesRes.data || [];

      const adminSet = new Set(
        roles
          .filter((role: any) => role.role === "admin")
          .map((role: any) => role.user_id),
      );

      const teamsMap: Record<string, { id: string; name: string }[]> = {};
      members.forEach((member: any) => {
        if (!member.user_id || !member.teams) return;
        if (!teamsMap[member.user_id]) teamsMap[member.user_id] = [];
        const teams = Array.isArray(member.teams)
          ? member.teams
          : [member.teams];
        teams.forEach((team: any) => {
          if (team?.id && team?.name) {
            teamsMap[member.user_id].push({ id: team.id, name: team.name });
          }
        });
      });

      const moduleRolesMap: Record<string, UserModuleRole[]> = {};
      moduleRoles.forEach((moduleRole: any) => {
        if (!moduleRole.user_id) return;
        if (!moduleRolesMap[moduleRole.user_id]) {
          moduleRolesMap[moduleRole.user_id] = [];
        }
        moduleRolesMap[moduleRole.user_id].push({
          module: moduleRole.module,
          role_name: moduleRole.role_name,
        });
      });

      const contractRoleMap: Record<string, "admin_contrato" | "member"> = {};
      contractRoles.forEach((contractRole: any) => {
        if (contractRole.user_id) {
          contractRoleMap[contractRole.user_id] = contractRole.role;
        }
      });

      setUsers(
        profiles.map((profile: any) => {
          const assignedModuleRoles = moduleRolesMap[profile.user_id] || [];
          const fallbackRoles: UserModuleRole[] =
            assignedModuleRoles.length === 0
              ? [
                  {
                    module:
                      profile.module_access === "admin"
                        ? "sala_agil"
                        : profile.module_access || "sala_agil",
                    role_name: "member",
                  },
                ]
              : assignedModuleRoles;

          return {
            id: profile.id,
            user_id: profile.user_id,
            display_name: profile.display_name || "",
            email: profile.email || "",
            module_access: profile.module_access || "sala_agil",
            team_id: profile.team_id || null,
            team_name: undefined,
            teams: teamsMap[profile.user_id] || [],
            module_roles: fallbackRoles,
            contract_role: contractRoleMap[profile.user_id] ?? null,
            is_admin: adminSet.has(profile.user_id),
            is_active: profile.is_active ?? true,
            must_change_password: profile.must_change_password ?? false,
            created_at: profile.created_at,
          };
        }),
      );
    } catch (err: any) {
      console.error("[useUsersAdmin] Erro:", err);
      setError("Erro inesperado ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }, [contractId, currentOrganizationId, isOrganizationAuthorityCutover]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveModuleRoles = async (
    userId: string,
    moduleRoles: UserModuleRole[],
  ) => {
    if (await isOrganizationAuthorityCutover()) {
      if (!currentOrganizationId) throw new Error("Organizacao nao selecionada.");
      const { error: updateError } = await (supabase as any).rpc(
        "update_organization_member_v2",
        {
          p_org_id: currentOrganizationId,
          p_user_id: userId,
          p_role: null,
          p_is_active: null,
          p_module_keys: moduleRoles.map((moduleRole) => moduleRole.module),
        },
      );
      if (updateError) throw updateError;
      await Promise.all([
        refreshOrganizations(),
        refreshModuleAccess(currentOrganizationId),
      ]);
      return;
    }

    const { error: deleteError } = await supabase
      .from("user_module_roles")
      .delete()
      .eq("user_id", userId);
    if (deleteError) throw deleteError;

    if (moduleRoles.length > 0) {
      const { error: insertError } = await supabase
        .from("user_module_roles")
        .insert(
          moduleRoles.map((moduleRole) => ({
            user_id: userId,
            module: moduleRole.module,
            role_name: moduleRole.role_name,
          })),
        );
      if (insertError) throw insertError;
    }

    const primaryModule = moduleRoles[0]?.module || "sala_agil";
    const legacyValue = moduleRoles.length > 1 ? "admin" : primaryModule;
    await supabase
      .from("profiles")
      .update({ module_access: legacyValue })
      .eq("user_id", userId);
  };

  const saveContractRole = async (
    userId: string,
    contractRole: "admin_contrato" | "member",
  ) => {
    if (!contractId) {
      throw new Error(
        "Selecione um contrato antes de atribuir um papel contratual ao usuário.",
      );
    }

    const { error: roleError } = await supabase.from("user_contracts").upsert(
      {
        user_id: userId,
        contract_id: contractId,
        role: contractRole,
      },
      { onConflict: "user_id,contract_id" },
    );
    if (roleError) throw roleError;
  };

  const update = async (
    userId: string,
    data: {
      display_name?: string;
      module_access?: string;
      team_id?: string | null;
      is_active?: boolean;
      module_roles?: UserModuleRole[];
      contract_role?: "admin_contrato" | "member";
    },
  ) => {
    try {
      const profileData: Record<string, any> = {};
      if (data.display_name !== undefined) {
        profileData.display_name = data.display_name;
      }
      if (data.team_id !== undefined) profileData.team_id = data.team_id;
      if (data.is_active !== undefined) profileData.is_active = data.is_active;
      if (
        data.module_access !== undefined &&
        !(await isOrganizationAuthorityCutover())
      ) {
        profileData.module_access = data.module_access;
      }

      if (Object.keys(profileData).length > 0) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update(profileData)
          .eq("user_id", userId);
        if (profileError) throw profileError;
      }

      if (data.module_roles) {
        await saveModuleRoles(userId, data.module_roles);
      }
      if (data.contract_role) {
        await saveContractRole(userId, data.contract_role);
      }

      toast.success("Usuário atualizado");
      await load();
      return true;
    } catch (updateError: any) {
      toast.error(
        "Erro ao atualizar usuário: " + (updateError?.message ?? ""),
      );
      return false;
    }
  };

  const toggleAdmin = async (userId: string, isAdmin: boolean) => {
    if (await isOrganizationAuthorityCutover()) {
      if (!currentOrganizationId) {
        toast.error("Organizacao nao selecionada");
        return false;
      }
      const { error: memberError } = await (supabase as any).rpc(
        "update_organization_member_v2",
        {
          p_org_id: currentOrganizationId,
          p_user_id: userId,
          p_role: isAdmin ? "admin" : "member",
          p_is_active: null,
          p_module_keys: null,
        },
      );
      if (memberError) {
        toast.error("Erro ao alterar papel organizacional");
        return false;
      }
      toast.success(isAdmin ? "Membro promovido a admin" : "Papel admin removido");
      await load();
      return true;
    }

    if (isAdmin) {
      const { error: adminError } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" });
      if (adminError) {
        toast.error("Erro ao promover usuário");
        return false;
      }
      toast.success("Usuário promovido a admin");
    } else {
      const { error: adminError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (adminError) {
        toast.error("Erro ao remover papel admin");
        return false;
      }
      toast.success("Papel admin removido");
    }

    await load();
    return true;
  };

  const toggleActive = async (userId: string, active: boolean) => {
    const { error: activeError } = await supabase
      .from("profiles")
      .update({ is_active: active })
      .eq("user_id", userId);
    if (activeError) {
      toast.error("Erro ao alterar status");
      return false;
    }

    toast.success(active ? "Usuário reativado" : "Usuário desativado");
    await load();
    return true;
  };

  const resetPassword = async (email: string) => {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/reset-password` },
    );
    if (resetError) {
      toast.error("Erro ao enviar reset de senha");
      return false;
    }

    toast.success(`Link de reset enviado para ${email}`);
    return true;
  };

  const createUser = async (data: {
    email: string;
    password: string;
    display_name: string;
    module_roles: UserModuleRole[];
    team_id: string | null;
    contract_role?: "admin_contrato" | "member";
  }) => {
    try {
      if (data.contract_role && !contractId) {
        toast.error(
          "Selecione um contrato antes de criar um usuário com papel contratual.",
        );
        return false;
      }

      if (await isOrganizationAuthorityCutover()) {
        toast.error(
          "Crie membros pela administracao da organizacao apos o cutover.",
        );
        return false;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { display_name: data.display_name } },
      });

      if (authError || !authData.user) {
        toast.error("Erro ao criar usuário: " + authError?.message);
        return false;
      }

      const primaryModule = data.module_roles[0]?.module || "sala_agil";
      const legacyValue =
        data.module_roles.length > 1 ? "admin" : primaryModule;

      await supabase
        .from("profiles")
        .update({
          display_name: data.display_name,
          module_access: legacyValue,
          team_id: data.team_id,
          must_change_password: true,
        })
        .eq("user_id", authData.user.id);

      await saveModuleRoles(authData.user.id, data.module_roles);
      if (data.contract_role) {
        await saveContractRole(authData.user.id, data.contract_role);
      }
      if (data.team_id) {
        await supabase.from("team_members").upsert({
          user_id: authData.user.id,
          team_id: data.team_id,
        });
      }

      toast.success("Usuário criado com sucesso.");
      await load();
      return true;
    } catch (createError: any) {
      toast.error(
        "Erro ao criar usuário: " + (createError?.message ?? ""),
      );
      return false;
    }
  };

  return {
    users,
    loading,
    error,
    reload: load,
    update,
    toggleAdmin,
    toggleActive,
    resetPassword,
    createUser,
  };
}
