import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import type {
  OkrAlignmentV1,
  OkrAlignmentV1Input,
  OkrObjectiveV2,
  OkrObjectiveV2Input,
  OkrObjectiveV2Update,
} from "../types/objective";

const OBJ_KEY = (orgId: string | null, cycleId?: string | null) =>
  ["okr_objectives_v2", orgId ?? "none", cycleId ?? "all"] as const;
const ALIGN_KEY = (orgId: string | null, objectiveId?: string | null) =>
  ["okr_alignments_v1", orgId ?? "none", objectiveId ?? "all"] as const;

async function callRpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw error;
  return data as T;
}

export function useOkrObjectivesV2(cycleId: string | null = null, includeArchived = false) {
  const { currentOrganizationId } = useOrganization();
  const qc = useQueryClient();

  const list = useQuery<OkrObjectiveV2[]>({
    queryKey: OBJ_KEY(currentOrganizationId, cycleId),
    enabled: !!currentOrganizationId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!currentOrganizationId) return [];
      const rows = await callRpc<OkrObjectiveV2[]>("list_okr_objectives_v2", {
        p_org_id: currentOrganizationId,
        p_cycle_id: cycleId,
        p_include_archived: includeArchived,
      });
      return rows ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["okr_objectives_v2"] });
    qc.invalidateQueries({ queryKey: ["okr_alignments_v1"] });
  };

  const create = useMutation({
    mutationFn: async (input: OkrObjectiveV2Input) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc<string>("create_okr_objective_v2", {
        p_org_id: currentOrganizationId,
        p_payload: input,
      });
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: OkrObjectiveV2Update }) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc("update_okr_objective_v2", {
        p_org_id: currentOrganizationId,
        p_objective_id: id,
        p_payload: payload,
      });
    },
    onSuccess: invalidate,
  });

  const publish = useMutation({
    mutationFn: async (id: string) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc("publish_okr_objective_v2", {
        p_org_id: currentOrganizationId,
        p_objective_id: id,
      });
    },
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string | null }) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc("archive_okr_objective_v2", {
        p_org_id: currentOrganizationId,
        p_objective_id: id,
        p_reason: reason ?? null,
      });
    },
    onSuccess: invalidate,
  });

  return {
    organizationId: currentOrganizationId,
    objectives: list.data ?? [],
    isLoading: list.isLoading,
    isError: list.isError,
    error: list.error,
    refetch: list.refetch,
    create,
    update,
    publish,
    archive,
  };
}

export function useOkrAlignments(objectiveId: string | null = null) {
  const { currentOrganizationId } = useOrganization();
  const qc = useQueryClient();

  const list = useQuery<OkrAlignmentV1[]>({
    queryKey: ALIGN_KEY(currentOrganizationId, objectiveId),
    enabled: !!currentOrganizationId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!currentOrganizationId) return [];
      const rows = await callRpc<OkrAlignmentV1[]>("list_okr_alignments_v1", {
        p_org_id: currentOrganizationId,
        p_objective_id: objectiveId,
      });
      return rows ?? [];
    },
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["okr_alignments_v1"] });

  const create = useMutation({
    mutationFn: async (input: OkrAlignmentV1Input) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc<string>("create_okr_alignment_v1", {
        p_org_id: currentOrganizationId,
        p_payload: input,
      });
    },
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: async (alignmentId: string) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc("archive_okr_alignment_v1", {
        p_org_id: currentOrganizationId,
        p_alignment_id: alignmentId,
      });
    },
    onSuccess: invalidate,
  });

  return {
    alignments: list.data ?? [],
    isLoading: list.isLoading,
    isError: list.isError,
    error: list.error,
    refetch: list.refetch,
    create,
    archive,
  };
}