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

    const [profilesResult, permissionsResult] = await Promise.all([
      supabase.rpc("list_rbac_profiles_v1", {
        p_org_id: currentOrganizationId,
      }),
      supabase.rpc("list_rbac_permissions_v1", {
        p_org_id: currentOrganizationId,
      }),
    ]);

    if (profilesResult.error || permissionsResult.error) {
      console.error("[useRbacProfiles] load failed", {
        profilesError: profilesResult.error,
        permissionsError: permissionsResult.error,
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
    setPermissions(
      (permissionsResult.data ?? []).map(normalizePermission),
    );
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
        const { data, error: saveError } = await supabase.rpc(
          "save_rbac_profile_v1",
          {
            p_org_id: currentOrganizationId,
            p_profile_key: draft.profileKey,
            p_display_name: draft.displayName.trim(),
            p_description: draft.description.trim(),
            p_category: draft.category,
            p_color_token: draft.colorToken,
            p_icon_name: draft.iconName,
            p_module_keys: draft.moduleKeys,
            p_permission_keys: draft.permissionKeys,
          },
        );

        if (saveError) throw saveError;
        await refresh();
        toast.success(
          draft.profileKey ? "Perfil atualizado com sucesso" : "Perfil criado com sucesso",
        );
        return String(data);
      } finally {
        setSaving(false);
      }
    },
    [currentOrganizationId, refresh],
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
