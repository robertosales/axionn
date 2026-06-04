import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Tipos retornados por fn_sla_dashboard_batch ───────────────────────────────

export interface SLADemandaRow {
  demandaId:       string;
  titulo:          string | null;
  situacao:        string;
  teamId:          string;
  projectId:       string | null;
  contractId:      string | null;
  horasAcumuladas: number;
  prazoHoras:      number;
  statusSLA:       'dentro' | 'em_risco' | 'violado' | 'concluido';
  resolutionPct:   number;
  slaColor:        'green' | 'orange' | 'red' | 'blue';
  slaSource:       'contract_matrix' | 'legacy_fallback';
}

export interface SLASummary {
  total:          number;
  dentro:         number;
  em_risco:       number;
  violado:        number;
  concluido:      number;
  compliance_pct: number;
}

export interface SLADashboardData {
  summary:  SLASummary;
  demandas: SLADemandaRow[];
}

interface UseSLADashboardParams {
  teamId?:     string | null;
  projectId?:  string | null;
  contractId?: string | null;
  limit?:      number;
  /** Desabilita a query enquanto false. Default: true */
  enabled?:    boolean;
}

const EMPTY_SUMMARY: SLASummary = {
  total: 0, dentro: 0, em_risco: 0, violado: 0, concluido: 0, compliance_pct: 0,
};

/**
 * Hook que chama fn_sla_dashboard_batch via Supabase RPC.
 * Retorna summary de compliance + lista de demandas com status SLA individual.
 * TanStack Query faz cache por staleTime: 60s.
 */
export function useSLADashboard({
  teamId     = null,
  projectId  = null,
  contractId = null,
  limit      = 100,
  enabled    = true,
}: UseSLADashboardParams = {}) {

  const hasFilter = !!(teamId || projectId || contractId);

  const { data, isLoading, error, refetch } = useQuery<SLADashboardData>({
    queryKey: ['sla-dashboard', teamId, projectId, contractId, limit],
    enabled:  enabled && hasFilter,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: raw, error: rpcError } = await supabase.rpc(
        'fn_sla_dashboard_batch',
        {
          p_team_id:     teamId     ?? null,
          p_project_id:  projectId  ?? null,
          p_contract_id: contractId ?? null,
          p_limit:       limit,
        },
      );

      if (rpcError) throw new Error(rpcError.message);

      // fn_sla_dashboard_batch retorna { summary, demandas }
      const payload = raw as { summary: SLASummary; demandas: SLADemandaRow[] };

      return {
        summary:  payload?.summary  ?? EMPTY_SUMMARY,
        demandas: payload?.demandas ?? [],
      };
    },
  });

  return {
    summary:  data?.summary  ?? EMPTY_SUMMARY,
    demandas: data?.demandas ?? [],
    loading:  isLoading,
    error:    error ? (error as Error).message : null,
    refetch,
  };
}
