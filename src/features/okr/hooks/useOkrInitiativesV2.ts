import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import type {
  OkrInitiativeV2,
  OkrInitiativeV2Input,
  OkrInitiativeV2Update,
} from "../types/initiative";

async function callRpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw error;
  return data as T;
}

export function useOkrInitiativesV2(objectiveId: string | null, includeArchived = false) {
  const { currentOrganizationId } = useOrganization();
  const qc = useQueryClient();

  const list = useQuery<OkrInitiativeV2[]>({
    queryKey: ["okr_initiatives_v2", currentOrganizationId ?? "none", objectiveId ?? "none", includeArchived],
    enabled: !!currentOrganizationId && !!objectiveId,
    staleTime: 20_000,
    queryFn: async () => {
      if (!currentOrganizationId || !objectiveId) return [];
      const rows = await callRpc<OkrInitiativeV2[]>("list_okr_initiatives_v1", {
        p_org_id: currentOrganizationId,
        p_objective_id: objectiveId,
        p_include_archived: includeArchived,
      });
      return rows ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["okr_initiatives_v2"] });
    qc.invalidateQueries({ queryKey: ["okr_alerts_v2"] });
  };

  const create = useMutation({
    mutationFn: async (input: OkrInitiativeV2Input) => {
      if (!currentOrganizationId || !objectiveId) {
        throw new Error("Organização ou objective não selecionados.");
      }
      return callRpc<string>("create_okr_initiative_v1", {
        p_org_id: currentOrganizationId,
        p_objective_id: objectiveId,
        p_payload: input,
      });
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: OkrInitiativeV2Update }) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc("update_okr_initiative_v1", {
        p_org_id: currentOrganizationId,
        p_initiative_id: id,
        p_payload: payload,
      });
    },
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string | null }) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc("archive_okr_initiative_v1", {
        p_org_id: currentOrganizationId,
        p_initiative_id: id,
        p_reason: reason ?? null,
      });
    },
    onSuccess: invalidate,
  });

  const addDependency = useMutation({
    mutationFn: async ({
      initiativeId,
      dependsOnId,
      type,
    }: { initiativeId: string; dependsOnId: string; type?: string }) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc<string>("add_okr_initiative_dependency_v1", {
        p_org_id: currentOrganizationId,
        p_initiative_id: initiativeId,
        p_depends_on_initiative_id: dependsOnId,
        p_dependency_type: type ?? "blocks",
      });
    },
    onSuccess: invalidate,
  });

  return {
    initiatives: list.data ?? [],
    isLoading: list.isLoading,
    refetch: list.refetch,
    create,
    update,
    archive,
    addDependency,
  };
}