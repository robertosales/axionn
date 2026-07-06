import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export type OrganizationMemberRole = "owner" | "admin" | "member";
export type OrganizationModuleKey = "sala_agil" | "sustentacao" | "rdm";
export type OrganizationInvitationStatus =
  | "pending"
  | "accepted"
  | "expired"
  | "revoked";

export interface OrganizationMember {
  userId: string;
  displayName: string;
  email: string;
  membershipRole: OrganizationMemberRole;
  isActive: boolean;
  joinedAt: string;
  moduleKeys: OrganizationModuleKey[];
}

export interface OrganizationInvitation {
  invitationId: string;
  email: string;
  invitationRole: Exclude<OrganizationMemberRole, "owner">;
  moduleKeys: OrganizationModuleKey[];
  invitationStatus: OrganizationInvitationStatus;
  expiresAt: string;
  invitedByName: string;
  sendCount: number;
  createdAt: string;
}

interface InviteMemberInput {
  email: string;
  role: "admin" | "member";
  moduleKeys: OrganizationModuleKey[];
}

interface UpdateMemberInput {
  userId: string;
  role?: "admin" | "member";
  isActive?: boolean;
  moduleKeys?: OrganizationModuleKey[];
}

function normalizeMember(row: Record<string, unknown>): OrganizationMember {
  return {
    userId: String(row.user_id),
    displayName: String(row.display_name ?? "Usuário"),
    email: String(row.email ?? ""),
    membershipRole: String(
      row.membership_role ?? "member",
    ) as OrganizationMemberRole,
    isActive: Boolean(row.is_active),
    joinedAt: String(row.joined_at),
    moduleKeys: ((row.module_keys ?? []) as string[]).filter((moduleKey) =>
      ["sala_agil", "sustentacao", "rdm"].includes(moduleKey),
    ) as OrganizationModuleKey[],
  };
}

function normalizeInvitation(
  row: Record<string, unknown>,
): OrganizationInvitation {
  return {
    invitationId: String(row.invitation_id),
    email: String(row.email ?? ""),
    invitationRole: String(row.invitation_role ?? "member") as
      | "admin"
      | "member",
    moduleKeys: ((row.module_keys ?? []) as string[]).filter((moduleKey) =>
      ["sala_agil", "sustentacao", "rdm"].includes(moduleKey),
    ) as OrganizationModuleKey[],
    invitationStatus: String(
      row.invitation_status ?? "pending",
    ) as OrganizationInvitationStatus,
    expiresAt: String(row.expires_at),
    invitedByName: String(row.invited_by_name ?? "Administrador"),
    sendCount: Number(row.send_count ?? 1),
    createdAt: String(row.created_at),
  };
}

export function useOrganizationMembers() {
  const {
    currentOrganizationId,
    currentOrganization,
    isOrganizationAdmin,
    refreshOrganizations,
    refreshModuleAccess,
  } = useOrganization();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentOrganizationId || !isOrganizationAdmin) {
      setMembers([]);
      setInvitations([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [membersResult, invitationsResult] = await Promise.all([
      (supabase as any).rpc("get_organization_members_v2", {
        p_org_id: currentOrganizationId,
      }),
      (supabase as any).rpc("get_organization_invitations_v2", {
        p_org_id: currentOrganizationId,
      }),
    ]);

    if (membersResult.error || invitationsResult.error) {
      console.error("[useOrganizationMembers] load failed", {
        membersError: membersResult.error,
        invitationsError: invitationsResult.error,
      });
      setError("Não foi possível carregar membros e convites da organização.");
      setLoading(false);
      return;
    }

    setMembers(
      ((membersResult.data ?? []) as Array<Record<string, unknown>>).map(
        normalizeMember,
      ),
    );
    setInvitations(
      ((invitationsResult.data ?? []) as Array<Record<string, unknown>>).map(
        normalizeInvitation,
      ),
    );
    setLoading(false);
  }, [currentOrganizationId, isOrganizationAdmin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const inviteMember = useCallback(
    async (input: InviteMemberInput) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      setMutating(true);
      try {
        const { data, error: invokeError } = await supabase.functions.invoke(
          "organization-invitations",
          {
            body: {
              action: "create",
              organization_id: currentOrganizationId,
              email: input.email,
              role: input.role,
              module_keys: input.moduleKeys,
            },
          },
        );

        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(String(data.error));
        await refresh();
        return data;
      } finally {
        setMutating(false);
      }
    },
    [currentOrganizationId, refresh],
  );

  const resendInvitation = useCallback(
    async (invitationId: string) => {
      setMutating(true);
      try {
        const { data, error: invokeError } = await supabase.functions.invoke(
          "organization-invitations",
          {
            body: { action: "resend", invitation_id: invitationId },
          },
        );
        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(String(data.error));
        await refresh();
        return data;
      } finally {
        setMutating(false);
      }
    },
    [refresh],
  );

  const revokeInvitation = useCallback(
    async (invitationId: string) => {
      setMutating(true);
      try {
        const { error: mutationError } = await (supabase as any).rpc(
          "revoke_organization_invitation_v2",
          { p_invitation_id: invitationId },
        );
        if (mutationError) throw mutationError;
        await refresh();
      } finally {
        setMutating(false);
      }
    },
    [refresh],
  );

  const updateMember = useCallback(
    async (input: UpdateMemberInput) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      setMutating(true);
      try {
        const { error: mutationError } = await (supabase as any).rpc(
          "update_organization_member_v2",
          {
            p_org_id: currentOrganizationId,
            p_user_id: input.userId,
            p_role: input.role ?? null,
            p_is_active: input.isActive ?? null,
            p_module_keys: input.moduleKeys ?? null,
          },
        );
        if (mutationError) throw mutationError;
        await Promise.all([
          refresh(),
          refreshOrganizations(),
          refreshModuleAccess(currentOrganizationId),
        ]);
      } finally {
        setMutating(false);
      }
    },
    [
      currentOrganizationId,
      refresh,
      refreshModuleAccess,
      refreshOrganizations,
    ],
  );

  const deactivateMember = useCallback(
    async (userId: string) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      setMutating(true);
      try {
        const { error: mutationError } = await (supabase as any).rpc(
          "deactivate_organization_member_v2",
          { p_org_id: currentOrganizationId, p_user_id: userId },
        );
        if (mutationError) throw mutationError;
        await refresh();
      } finally {
        setMutating(false);
      }
    },
    [currentOrganizationId, refresh],
  );

  const transferOwnership = useCallback(
    async (userId: string) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      setMutating(true);
      try {
        const { error: mutationError } = await (supabase as any).rpc(
          "transfer_organization_ownership_v2",
          { p_org_id: currentOrganizationId, p_new_owner_id: userId },
        );
        if (mutationError) throw mutationError;
        await Promise.all([refresh(), refreshOrganizations()]);
      } finally {
        setMutating(false);
      }
    },
    [currentOrganizationId, refresh, refreshOrganizations],
  );

  return useMemo(
    () => ({
      organization: currentOrganization,
      members,
      invitations,
      loading,
      mutating,
      error,
      refresh,
      inviteMember,
      resendInvitation,
      revokeInvitation,
      updateMember,
      deactivateMember,
      transferOwnership,
    }),
    [
      currentOrganization,
      deactivateMember,
      error,
      invitations,
      inviteMember,
      loading,
      members,
      mutating,
      refresh,
      resendInvitation,
      revokeInvitation,
      transferOwnership,
      updateMember,
    ],
  );
}
