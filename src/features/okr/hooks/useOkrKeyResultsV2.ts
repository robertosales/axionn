import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import type {
  OkrKeyResultV2,
  OkrKeyResultV2Input,
  OkrKeyResultV2Update,
} from "../types/keyResult";

const KR_KEY = (orgId: string | null, objectiveId: string | null) =>
  ["okr_key_results_v2", orgId ?? "none", objectiveId ?? "none"] as const;

async function callRpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw error;
  return data as T;
}

export function useOkrKeyResultsV2(
  objectiveId: string | null,
  includeArchived = false,
) {
  const { currentOrganizationId } = useOrganization();
  const qc = useQueryClient();

  const list = useQuery<OkrKeyResultV2[]>({
    queryKey: KR_KEY(currentOrganizationId, objectiveId),
    enabled: !!currentOrganizationId && !!objectiveId,
    staleTime: 20_000,
    queryFn: async () => {
      if (!currentOrganizationId || !objectiveId) return [];
      const rows = await callRpc<OkrKeyResultV2[]>("list_okr_key_results_v2", {
        p_org_id: currentOrganizationId,
        p_objective_id: objectiveId,
        p_include_archived: includeArchived,
      });
      return rows ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["okr_key_results_v2"] });
    qc.invalidateQueries({ queryKey: ["okr_objectives_v2"] });
  };

  const create = useMutation({
    mutationFn: async (input: OkrKeyResultV2Input) => {
      if (!currentOrganizationId || !objectiveId) {
        throw new Error("Organização ou objective não selecionados.");
      }
      return callRpc<string>("create_okr_key_result_v2", {
        p_org_id: currentOrganizationId,
        p_objective_id: objectiveId,
        p_payload: input,
      });
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: OkrKeyResultV2Update }) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc("update_okr_key_result_v2", {
        p_org_id: currentOrganizationId,
        p_key_result_id: id,
        p_payload: payload,
      });
    },
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string | null }) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc("archive_okr_key_result_v2", {
        p_org_id: currentOrganizationId,
        p_key_result_id: id,
        p_reason: reason ?? null,
      });
    },
    onSuccess: invalidate,
  });

  return {
    keyResults: list.data ?? [],
    isLoading: list.isLoading,
    isError: list.isError,
    error: list.error,
    refetch: list.refetch,
    create,
    update,
    archive,
  };
}