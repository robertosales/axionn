/**
 * useKpisSustentacao — P0-fix: migração para KEYS.kpis.sustentacao
 *
 * ANTES: chave customizada ['kpis-sustentacao', teamId, backlogDias]
 *   → silo de cache isolado; quando useDemandas invalidava KEYS.demandas.all,
 *     os KPIs NÃO eram invalidados — descompasso visual entre Kanban e Dashboard.
 *
 * DEPOIS: KEYS.kpis.sustentacao(teamId, backlogDias)
 *   → useDemandas invalida KEYS.demandas.all E KEYS.kpis.all em cascata,
 *     garantindo consistência entre todas as views sem canal RT extra.
 *
 * O canal RT próprio deste hook é MANTIDO como fallback (ex: quando o Dashboard
 * está aberto sozinho sem o Kanban montado), mas agora o invalidate usa KEYS.
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

// ─── Fetch via RPC ─────────────────────────────────────────────────────────────────
async function fetchKpis(teamId: string, backlogDias: number): Promise<KpisSustentacao> {
  const { data, error } = await supabase.rpc('calc_kpis_sustentacao', {
    p_team_id:      teamId,
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
    // P0-fix: usa KEYS centralizado em vez de literal avulsa
    queryKey:  KEYS.kpis.sustentacao(currentTeamId ?? '', backlogDias),
    queryFn:   () => fetchKpis(currentTeamId!, backlogDias),
    enabled:   !!currentTeamId,
    staleTime: STALE.KPI,   // 60s — agregação pesada
  });

  // Canal RT de fallback — ativo quando o Dashboard abre sem o Kanban montado.
  // Quando useDemandas está montado no mesmo contexto, ele já invalida
  // KEYS.kpis.all via cascata, tornando este canal redundante mas inofensivo.
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
            // P0-fix: invalida via KEYS em vez de literal
            qc.invalidateQueries({ queryKey: KEYS.kpis.sustentacao(currentTeamId, backlogDias) });
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
