/**
 * useImrPeriodo — Semana 7+
 *
 * Consome a RPC calc_imr_periodo, eliminando o fetch de todas as demandas
 * + eventos IMR no cliente só para calcular os índices do contrato.
 *
 * Parâmetros:
 *   inicio    : Date — início do período
 *   fim       : Date — fim do período (default: NOW)
 *   e8Alerta  : number — dias de atraso para alerta E8 (default 45)
 *   e8Glosa   : number — dias de atraso para glosa  E8 (default 60)
 *
 * Cache: staleTime: 60s (STALE.KPI) — pesado, não precisa de refresh
 * contínuo. Invalida com debounce 2s quando demandas do time mudam via Realtime.
 *
 * FIX (fix/sustentacao-realtime — item 4):
 *   Canal Realtime agora escuta também demanda_transitions e demanda_hours,
 *   garantindo que o IMR seja recalculado quando:
 *   - uma demanda muda de situação (nova transição registrada)
 *   - horas são lançadas, editadas ou removidas
 *
 * API pública compatível com imrCalculations.ts:
 *   { iap, iqs, ict, iss, glosas, e8Alerts, loading, error, refetch }
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { STALE } from '@/lib/queryClient';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ImrIAP   { valor: number; qdap: number; qdtot: number }
export interface ImrIQS   { valor: number; qdr:  number; qde:  number }
export interface ImrICT   { valor: number; total: number }
export interface ImrISS   { valor: number; total: number }

export interface ImrGlosas {
  totalIntegral: number;
  totalLimitada: number;
  byEvento: Record<string, { count: number; total: number }>;
}

export interface ImrE8Alert {
  demandaId:   string;
  rhm:         string;
  projeto:     string;
  tipo:        string;
  situacao:    string;
  prazo:       string | null;
  diasAtraso:  number;
  tipo_alerta: 'alerta' | 'glosa';
}

export interface ImrPeriodo {
  iap:       ImrIAP;
  iqs:       ImrIQS;
  ict:       ImrICT;
  iss:       ImrISS;
  glosas:    ImrGlosas;
  e8Alerts:  ImrE8Alert[];
}

// ─── Query key ────────────────────────────────────────────────────────────────────
const imrKey = (teamId: string, inicio: string, fim: string) =>
  ['imr-periodo', teamId, inicio, fim] as const;

// ─── Fetch via RPC ────────────────────────────────────────────────────────────────
async function fetchImr(
  teamId: string,
  inicio: Date,
  fim: Date,
  e8Alerta: number,
  e8Glosa: number,
): Promise<ImrPeriodo> {
  const { data, error } = await supabase.rpc('calc_imr_periodo', {
    p_team_id:   teamId,
    p_inicio:    inicio.toISOString(),
    p_fim:       fim.toISOString(),
    p_e8_alerta: e8Alerta,
    p_e8_glosa:  e8Glosa,
  });
  if (error) throw new Error(error.message);
  return data as unknown as ImrPeriodo;
}

// ─── Defaults ──────────────────────────────────────────────────────────────────────
/** Início do mês corrente (00:00:00 local) como parâmetro default */
export function inicioDeMes(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const EMPTY: ImrPeriodo = {
  iap:    { valor: 0, qdap: 0, qdtot: 0 },
  iqs:    { valor: 0, qdr:  0, qde:  0  },
  ict:    { valor: 0, total: 0           },
  iss:    { valor: 0, total: 0           },
  glosas: { totalIntegral: 0, totalLimitada: 0, byEvento: {} },
  e8Alerts: [],
};

// ─── Hook ─────────────────────────────────────────────────────────────────────────
export function useImrPeriodo({
  inicio    = inicioDeMes(),
  fim       = new Date(),
  e8Alerta  = 45,
  e8Glosa   = 60,
}: {
  inicio?:   Date;
  fim?:      Date;
  e8Alerta?: number;
  e8Glosa?:  number;
} = {}) {
  const { currentTeamId } = useAuth();
  const qc = useQueryClient();

  const inicioISO = inicio.toISOString().slice(0, 10);
  const fimISO    = fim.toISOString().slice(0, 10);

  const { data, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey:  imrKey(currentTeamId ?? '', inicioISO, fimISO),
    queryFn:   () => fetchImr(currentTeamId!, inicio, fim, e8Alerta, e8Glosa),
    enabled:   !!currentTeamId,
    staleTime: STALE.KPI,   // 60s — agregação pesada
  });

  // Debounce 2s: evita recálculo em cascata com muitos usuários simultâneos
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentTeamId) return;

    // FIX (item 4): canal unificado escuta 3 tabelas que afetam o IMR:
    //   1. demandas          — criação, atualização ou remoção de demandas
    //   2. demanda_transitions — cada mudança de situação (base dos índices IAP/IQS)
    //   3. demanda_hours       — lançamento/edição de horas (base do índice ICT)
    // Todos compartilham o mesmo debounce de 2s para evitar recálculos em cascata.
    const invalidate = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        qc.invalidateQueries({ queryKey: imrKey(currentTeamId, inicioISO, fimISO) });
      }, 2000);
    };

    const channel = supabase
      .channel(`imr-rt-${currentTeamId}-${inicioISO}`)
      // Tabela principal de demandas
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demandas', filter: `team_id=eq.${currentTeamId}` },
        invalidate,
      )
      // FIX: mudanças de situação — afetam IAP e IQS diretamente
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demanda_transitions', filter: `team_id=eq.${currentTeamId}` },
        invalidate,
      )
      // FIX: lançamentos de horas — afetam ICT diretamente
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demanda_hours', filter: `team_id=eq.${currentTeamId}` },
        invalidate,
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [currentTeamId, inicioISO, fimISO, qc]);

  const error = queryError ? (queryError as Error).message : null;
  const imr   = data ?? EMPTY;

  return {
    iap:      imr.iap,
    iqs:      imr.iqs,
    ict:      imr.ict,
    iss:      imr.iss,
    glosas:   imr.glosas,
    e8Alerts: imr.e8Alerts,
    loading,
    error,
    refetch,
  };
}
