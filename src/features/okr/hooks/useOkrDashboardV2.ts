import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import type {
  OkrDashboardData,
  OkrDashboardMode,
} from "../types/dashboard";

const EMPTY_OPERATIONS = {
  open_alerts: 0,
  critical_alerts: 0,
  blocked_initiatives: 0,
  overdue_initiatives: 0,
};

interface DashboardRpcClient {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: Error | null }>;
}

export function useOkrDashboardV2(
  primaryCycleId: string | null,
  compareCycleId: string | null,
  mode: OkrDashboardMode,
) {
  const { currentOrganizationId } = useOrganization();

  return useQuery<OkrDashboardData>({
    queryKey: [
      "okr_dashboard_v2",
      currentOrganizationId ?? "none",
      primaryCycleId ?? "auto",
      compareCycleId ?? "none",
      mode,
    ],
    enabled: Boolean(currentOrganizationId),
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      if (!currentOrganizationId) {
        return {
          mode,
          generated_at: new Date().toISOString(),
          primary_cycle_id: null,
          compare_cycle_id: null,
          cycles: [],
          teams: [],
          focus_objectives: [],
          operations: EMPTY_OPERATIONS,
        };
      }

      const { data, error } = await (supabase as unknown as DashboardRpcClient).rpc(
        "get_okr_dashboard_v1",
        {
          p_org_id: currentOrganizationId,
          p_cycle_id: primaryCycleId,
          p_compare_cycle_id: compareCycleId,
          p_mode: mode,
        },
      );

      if (error) throw error;

      const result = (data ?? {}) as Partial<OkrDashboardData>;
      return {
        mode,
        generated_at: result.generated_at ?? new Date().toISOString(),
        primary_cycle_id: result.primary_cycle_id ?? primaryCycleId,
        compare_cycle_id: result.compare_cycle_id ?? compareCycleId,
        cycles: result.cycles ?? [],
        teams: result.teams ?? [],
        focus_objectives: result.focus_objectives ?? [],
        operations: result.operations ?? EMPTY_OPERATIONS,
      };
    },
  });
}
