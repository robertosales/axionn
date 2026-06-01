/**
 * useKpisSustentacao — Semana 4-5
 *
 * Consome a RPC calc_kpis_sustentacao no banco, eliminando a necessidade
 * de buscar demandas + transitions + hours no cliente só para calcular KPIs.
 *
 * Cache: staleTime: 60s (STALE.KPI) — agregação pesada, não precisa de
 * atualização tão frequente quanto o Kanban.
 *
 * Invalidação: debounce 2s no canal Realtime (igual ao useDemandas)
 * para evitar recálculo imediato em cascata com 150 usuários simultâneos.
 *
 * API pública compatível com o retorno de kpiCalculations.ts:
 *   { atendimento, tempos, sla, kpiGeral, produtividade, loading, error, refetch }
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { KEYS } from '@/lib/queryKeys';
import { STALE } from '@/lib/queryClient';

// ─── Tipos (espelho do retorno da RPC) ─────────────────────────────────────────

export interface KpiAtendimento {
  total:          number;
  abertosHoje:    number;
  resolvidosHoje: number;
  backlog:        number;
  backlogDias:    number;
}

export interface KpiTempos {
  tmr:       number;
  mttr:      number;
  tma:       number;
  mtta:      number;
  tmrCount:  number;
  mttrCount: number;
  mttaCount: number;
}

export interface KpiSLA {
  total:      number;
  dentro:     number;
  emRisco:    number;
  violados:   number;
  compliance: number;
}

export interface KpiGeral {
  total:      number;
  resolvidos: number;
  emAberto:   number;
  taxa:       number;
  totalHoras: number;
  mttrGeral:  number;
}

export interface KpiAnalista {
  userId:        string;
  nome:          string;
  atribuidos:    number;
  resolvidos:    number;
  emAberto:      number;
  horasLancadas: number;
  taxaResolucao: number;
}

export interface KpisSustentacao {
  atendimento:  KpiAtendimento;
  tempos:       KpiTempos;
  sla:          KpiSLA;
  kpiGeral:     KpiGeral;
  produtividade: KpiAnalista[];
}

// ─── Chave de query dedicada ─────────────────────────────────────────────────────────
const kpisKey = (teamId: string, backlogDias: number) =>
  ['kpis-sustentacao', teamId, backlogDias] as const;

// ─── Fetch via RPC ─────────────────────────────────────────────────────────────────
async function fetchKpis(teamId: string, backlogDias: number): Promise<KpisSustentacao> {
  const { data, error } = await supabase.rpc('calc_kpis_sustentacao', {
    p_team_id:     teamId,
    p_backlog_dias: backlogDias,
    p_sla_risco_h:  2,
  });
  if (error) throw new Error(error.message);
  return data as unknown as KpisSustentacao;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────────
export function useKpisSustentacao(backlogDias = 30) {
  const { currentTeamId } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey:  kpisKey(currentTeamId ?? '', backlogDias),
    queryFn:   () => fetchKpis(currentTeamId!, backlogDias),
    enabled:   !!currentTeamId,
    staleTime: STALE.KPI,   // 60s — agregação pesada
  });

  // Debounce 2s: evita recálculo imediato em cascata com muitos usuários
  // (mesmo padrão do useDemandas)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentTeamId) return;

    const channel = supabase
      .channel(`kpis-sustentacao-rt-${currentTeamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demandas', filter: `team_id=eq.${currentTeamId}` },
        () => {
          if (typeof document !== 'undefined' && document.hidden) return;
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            qc.invalidateQueries({ queryKey: kpisKey(currentTeamId, backlogDias) });
          }, 2000);
        },
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [currentTeamId, backlogDias, qc]);

  const error = queryError ? (queryError as Error).message : null;

  // Defaults seguros para evitar undefined em componentes
  const kpis: KpisSustentacao = data ?? {
    atendimento:  { total: 0, abertosHoje: 0, resolvidosHoje: 0, backlog: 0, backlogDias },
    tempos:       { tmr: 0, mttr: 0, tma: 0, mtta: 0, tmrCount: 0, mttrCount: 0, mttaCount: 0 },
    sla:          { total: 0, dentro: 0, emRisco: 0, violados: 0, compliance: 100 },
    kpiGeral:     { total: 0, resolvidos: 0, emAberto: 0, taxa: 0, totalHoras: 0, mttrGeral: 0 },
    produtividade: [],
  };

  return { ...kpis, loading, error, refetch };
}
