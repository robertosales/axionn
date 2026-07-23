import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import type { OkrCycle, OkrCycleInput } from "../types/cycle";

const KEY = (orgId: string | null) => ["okr_cycles", orgId ?? "none"];

async function callRpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw error;
  return data as T;
}

export function useOkrCycles() {
  const { currentOrganizationId } = useOrganization();
  const qc = useQueryClient();

  const list = useQuery<OkrCycle[]>({
    queryKey: KEY(currentOrganizationId),
    enabled: !!currentOrganizationId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!currentOrganizationId) return [];
      const rows = await callRpc<OkrCycle[]>("list_okr_cycles_v1", {
        p_org_id: currentOrganizationId,
      });
      return rows ?? [];
    },
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: KEY(currentOrganizationId) });

  const create = useMutation({
    mutationFn: async (input: OkrCycleInput) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc<string>("create_okr_cycle_v1", {
        p_org_id: currentOrganizationId,
        p_payload: input,
      });
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<OkrCycleInput> }) =>
      callRpc("update_okr_cycle_v1", { p_cycle_id: id, p_payload: payload }),
    onSuccess: invalidate,
  });

  const publish = useMutation({
    mutationFn: async (id: string) => callRpc("publish_okr_cycle_v1", { p_cycle_id: id }),
    onSuccess: invalidate,
  });

  const startClosing = useMutation({
    mutationFn: async (id: string) =>
      callRpc("start_okr_cycle_closing_v1", { p_cycle_id: id }),
    onSuccess: invalidate,
  });

  const close = useMutation({
    mutationFn: async (id: string) => callRpc("close_okr_cycle_v1", { p_cycle_id: id }),
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: async (id: string) => callRpc("archive_okr_cycle_v1", { p_cycle_id: id }),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      callRpc("cancel_okr_cycle_v1", { p_cycle_id: id, p_reason: reason }),
    onSuccess: invalidate,
  });

  return {
    organizationId: currentOrganizationId,
    cycles: list.data ?? [],
    isLoading: list.isLoading,
    isError: list.isError,
    error: list.error,
    refetch: list.refetch,
    create,
    update,
    publish,
    startClosing,
    close,
    archive,
    cancel,
  };
}