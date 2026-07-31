import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import type {
  RbacModuleKey,
  RbacPermission,
  RbacProfile,
  RbacProfileCategory,
  RbacProfileDraft,
} from "@/features/rbac/types";

function normalizeProfile(row: Record<string, unknown>): RbacProfile {
  const permissionKeys = Array.isArray(row.permission_keys)
    ? row.permission_keys.map(String)
    : [];
  const moduleKeys = (Array.isArray(row.module_keys) ? row.module_keys : [])
    .map(String)
    .filter((key): key is RbacModuleKey =>
      ["sala_agil", "sustentacao", "rdm"].includes(key),
    );

  return {
    key: String(row.profile_key),
    displayName: String(row.display_name ?? "Perfil"),
    description: String(row.description ?? ""),
    category: String(row.category ?? "custom") as RbacProfileCategory,
    colorToken: String(row.color_token ?? "violet"),
    iconName: String(row.icon_name ?? "shield-check"),
    moduleKeys,
    permissionKeys,
    permissionCount: Number(row.permission_count ?? permissionKeys.length),
    userCount: Number(row.user_count ?? 0),
    isSystem: Boolean(row.is_system),
    isActive: Boolean(row.is_active ?? true),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

function normalizePermission(row: Record<string, unknown>): RbacPermission {
  return {
    key: String(row.permission_key),
    label: String(row.label ?? row.permission_key),
    description: row.description ? String(row.description) : null,
    groupKey: String(row.group_key ?? "general"),
    moduleKey: String(row.module_key ?? "sala_agil") as RbacModuleKey,
  };
}

export function useRbacProfiles() {
  const { currentOrganizationId } = useOrganization();
  const [profiles, setProfiles] = useState<RbacProfile[]>([]);
  const [permissions, setPermissions] = useState<RbacPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentOrganizationId) {
      setProfiles([]);
      setPermissions([]);
      setError("Selecione uma organização para gerenciar seus perfis.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [profilesResult, permissionsResult, privilegedResult] = await Promise.all([
      supabase.rpc("list_rbac_profiles_v1", {
        p_org_id: currentOrganizationId,
      }),
      supabase.rpc("list_rbac_permissions_v1", {
        p_org_id: currentOrganizationId,
      }),
      (supabase as any).rpc("list_rbac_privileged_permissions_v1", {
        p_org_id: currentOrganizationId,
      }),
    ]);

    if (profilesResult.error || permissionsResult.error || privilegedResult.error) {
      console.error("[useRbacProfiles] load failed", {
        profilesError: profilesResult.error,
        permissionsError: permissionsResult.error,
        privilegedError: privilegedResult.error,
      });
      setProfiles([]);
      setPermissions([]);
      setError(
        "Não foi possível carregar os perfis. Verifique o contrato RBAC ou tente novamente.",
      );
      setLoading(false);
      return;
    }

    setProfiles(
      (profilesResult.data ?? []).map(normalizeProfile),
    );
    const privileged = new Map(
      (privilegedResult.data ?? []).map((row: Record<string, unknown>) => [
        String(row.permission_key),
        row,
      ]),
    );
    setPermissions((permissionsResult.data ?? []).map((row) => {
      const permission = normalizePermission(row);
      const risk = privileged.get(permission.key);
      return {
        ...permission,
        isPrivileged: Boolean(risk),
        riskLevel: risk?.risk_level as RbacPermission["riskLevel"],
        riskReason: risk ? String(risk.reason) : undefined,
      };
    }));
    setLoading(false);
  }, [currentOrganizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveProfile = useCallback(
    async (draft: RbacProfileDraft) => {
      if (!currentOrganizationId) {
        throw new Error("Organização não selecionada.");
      }

      setSaving(true);
      try {
        const currentProfile = profiles.find((profile) => profile.key === draft.profileKey);
        const privilegedKeys = new Set(
          permissions.filter((permission) => permission.isPrivileged).map((permission) => permission.key),
        );
        const requiresApproval = draft.permissionKeys.some((key) => privilegedKeys.has(key))
          || Boolean(currentProfile?.permissionKeys.some((key) => privilegedKeys.has(key)));
        const payload = {
            p_org_id: currentOrganizationId,
            p_profile_key: draft.profileKey,
            p_display_name: draft.displayName.trim(),
            p_description: draft.description.trim(),
            p_category: draft.category,
            p_color_token: draft.colorToken,
            p_icon_name: draft.iconName,
            p_module_keys: draft.moduleKeys,
            p_permission_keys: draft.permissionKeys,
        };
        const { data, error: saveError } = requiresApproval
          ? await (supabase as any).rpc("submit_rbac_profile_change_v1", payload)
          : await supabase.rpc("save_rbac_profile_v1", payload);

        if (saveError) throw saveError;
        await refresh();
        if (requiresApproval) {
          toast.success("Alteração enviada para aprovação", {
            description: "Outro administrador deve revisar a solicitação em Governança.",
          });
          return String((data as Record<string, unknown>)?.profile_key ?? draft.profileKey ?? "pending");
        }
        toast.success(draft.profileKey ? "Perfil atualizado com sucesso" : "Perfil criado com sucesso");
        return String(data);
      } finally {
        setSaving(false);
      }
    },
    [currentOrganizationId, permissions, profiles, refresh],
  );

  const archiveProfile = useCallback(
    async (profile: RbacProfile) => {
      if (!currentOrganizationId) {
        throw new Error("Organização não selecionada.");
      }

      setSaving(true);
      try {
        const { error: archiveError } = await supabase.rpc(
          "archive_rbac_profile_v1",
          {
            p_org_id: currentOrganizationId,
            p_profile_key: profile.key,
          },
        );
        if (archiveError) throw archiveError;
        await refresh();
        toast.success("Perfil arquivado");
      } finally {
        setSaving(false);
      }
    },
    [currentOrganizationId, refresh],
  );

  return {
    profiles,
    permissions,
    loading,
    saving,
    error,
    refresh,
    saveProfile,
    archiveProfile,
  };
}
