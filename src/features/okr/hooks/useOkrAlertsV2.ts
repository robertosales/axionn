import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import type { OkrAlertV2 } from "../types/alert";

async function callRpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw error;
  return data as T;
}

export function useOkrAlertsV2(status: string = "open") {
  const { currentOrganizationId } = useOrganization();
  const qc = useQueryClient();

  const list = useQuery<OkrAlertV2[]>({
    queryKey: ["okr_alerts_v2", currentOrganizationId ?? "none", status],
    enabled: !!currentOrganizationId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!currentOrganizationId) return [];
      const rows = await callRpc<OkrAlertV2[]>("list_okr_alerts_v1", {
        p_org_id: currentOrganizationId,
        p_status: status,
      });
      return rows ?? [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["okr_alerts_v2"] });

  const runEngine = useMutation({
    mutationFn: async () => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc<number>("run_okr_alert_engine_v1", { p_org_id: currentOrganizationId });
    },
    onSuccess: invalidate,
  });

  const acknowledge = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string | null }) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc("acknowledge_okr_alert_v1", {
        p_org_id: currentOrganizationId,
        p_alert_id: id,
        p_note: note ?? null,
      });
    },
    onSuccess: invalidate,
  });

  const resolve = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string | null }) => {
      if (!currentOrganizationId) throw new Error("Organização não selecionada.");
      return callRpc("resolve_okr_alert_v1", {
        p_org_id: currentOrganizationId,
        p_alert_id: id,
        p_note: note ?? null,
      });
    },
    onSuccess: invalidate,
  });

  return {
    alerts: list.data ?? [],
    isLoading: list.isLoading,
    runEngine,
    acknowledge,
    resolve,
  };
}