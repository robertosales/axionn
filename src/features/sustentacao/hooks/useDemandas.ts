/**
 * useDemandas — F2-B: invalidação em cascata nas mutations
 *
 * ANTES: create/update/moveTo/remove chamavam invalidate() que atingia
 *   apenas KEYS.demandas.all. KPIs e infinite query ficavam defasados
 *   por até 2s (aguardando o debounce do canal RT).
 *
 * DEPOIS: mutations invalidam em cascata:
 *   1. KEYS.demandas.all(teamId)  — lista completa (Kanban)
 *   2. KEYS.kpis.all(teamId)      — KPIs do Dashboard (imediato)
 *   3. reset KEYS.demandas.infinite — lista paginada reinicia
 *
 * Alinhado com o padrão já adotado em useDemandaMutations (Fase 1).
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth }                  from '@/contexts/AuthContext';
import { toast }                    from 'sonner';
import { supabase }                 from '@/integrations/supabase/client';
import * as svc                     from '../services/demandas.service';
import type { Demanda, DemandaTransition, DemandaHour } from '../types/demanda';
import { REQUIRES_JUSTIFICATIVA }   from '../types/demanda';
import { KEYS }                     from '@/lib/queryKeys';
import { STALE }                    from '@/lib/queryClient';

export function useDemandas() {
  const { currentTeamId, user } = useAuth();
  const qc = useQueryClient();

  const queryKey = KEYS.demandas.list(currentTeamId ?? '');

  const { data: demandas = [], isLoading: loading, error: queryError } = useQuery({
    queryKey,
    queryFn:   () => svc.fetchDemandasEnriched(currentTeamId!),
    enabled:   !!currentTeamId,
    staleTime: STALE.REALTIME,
  });

  const error = queryError ? (queryError as Error).message : null;

  // ── Realtime: invalidação em cascata (inalterada) ───────────────────────────
  useEffect(() => {
    if (!currentTeamId) return;
    let timeoutId: ReturnType<typeof setTimeout>;

    const channel = supabase
      .channel(`demandas-rt-${currentTeamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demandas', filter: `team_id=eq.${currentTeamId}` },
        () => {
          if (typeof document !== 'undefined' && document.hidden) return;
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            qc.invalidateQueries({ queryKey: KEYS.demandas.all(currentTeamId) });
            qc.invalidateQueries({ queryKey: KEYS.kpis.all(currentTeamId) });
            qc.resetQueries({     queryKey: KEYS.demandas.infinite(currentTeamId) });
          }, 2000);
        },
      )
      .subscribe();

    return () => { clearTimeout(timeoutId); supabase.removeChannel(channel); };
  }, [currentTeamId, qc]);

  // ── Invalidação completa (usada pelas mutations) ─────────────────────────────
  // F2-B: alinhado com useDemandaMutations — atinge kpis + infinite imediatamente
  const invalidateAll = () => Promise.all([
    qc.invalidateQueries({ queryKey: KEYS.demandas.all(currentTeamId!) }),
    qc.invalidateQueries({ queryKey: KEYS.kpis.all(currentTeamId!) }),
    qc.resetQueries({     queryKey: KEYS.demandas.infinite(currentTeamId!) }),
  ]);

  const create = async (d: Partial<Demanda>) => {
    if (!currentTeamId) return;
    try {
      const created = await svc.createDemanda({ ...d, team_id: currentTeamId, rhm: d.rhm! });
      if (user) {
        await svc.addTransition({
          demanda_id:    created.id,
          from_status:   null,
          to_status:     'fila_atendimento',
          user_id:       user.id,
          justificativa: null,
        });
      }
      toast.success('Demanda criada com sucesso');
      await invalidateAll();
    } catch {
      toast.error('Erro ao criar demanda');
    }
  };

  const update = async (id: string, updates: Partial<Demanda>) => {
    try {
      await svc.updateDemanda(id, updates);
      toast.success('Demanda atualizada com sucesso');
      await invalidateAll();
    } catch {
      toast.error('Erro ao atualizar demanda');
    }
  };

  const moveTo = async (demanda: Demanda, newStatus: string, justificativa?: string) => {
    if ((REQUIRES_JUSTIFICATIVA as readonly string[]).includes(newStatus) && !justificativa) {
      toast.error('Justificativa obrigatória para este status');
      return false;
    }
    try {
      await svc.updateDemanda(demanda.id, { situacao: newStatus });
      if (user) {
        await svc.addTransition({
          demanda_id:    demanda.id,
          from_status:   demanda.situacao,
          to_status:     newStatus,
          user_id:       user.id,
          justificativa: justificativa || null,
        });
      }
      toast.success('Status atualizado com sucesso');
      await invalidateAll();
      return true;
    } catch {
      toast.error('Erro ao atualizar status');
      return false;
    }
  };

  const remove = async (id: string) => {
    try {
      await svc.deleteDemanda(id);
      toast.success('Demanda excluída com sucesso');
      await invalidateAll();
    } catch {
      toast.error('Erro ao excluir demanda');
    }
  };

  return {
    demandas,
    loading,
    error,
    reload: invalidateAll,
    create,
    update,
    moveTo,
    remove,
  };
}

// ── useTransitions ──────────────────────────────────────────────────────────────────
export function useTransitions(demandaId: string | null) {
  const { data: transitions = [], isLoading: loading, refetch } = useQuery({
    queryKey:  KEYS.demandas.transitions(demandaId ?? ''),
    queryFn:   () => svc.fetchTransitions(demandaId!),
    enabled:   !!demandaId,
    staleTime: STALE.REALTIME,
  });
  return { transitions, loading, reload: refetch };
}

// ── useHours ────────────────────────────────────────────────────────────────────────
export function useHours(demandaId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // F2-C: staleTime 0 → STALE.REALTIME (30s)
  // Não há canal RT em demanda_hours — o refetch imediato não trazia dados
  // mais frescos, apenas adicionava latência. Invalidação explícita nas
  // mutations garante consistência sem depender de refetch automático.
  const { data: hours = [], isLoading: loading } = useQuery({
    queryKey:  KEYS.demandas.hours(demandaId ?? ''),
    queryFn:   () => svc.fetchHours(demandaId!),
    enabled:   !!demandaId,
    staleTime: STALE.REALTIME,  // F2-C: era 0
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: KEYS.demandas.hours(demandaId!) });

  const add = async (h: { horas: number; fase: string; descricao: string; created_at?: string }) => {
    if (!demandaId || !user) return;
    try {
      await svc.addHours({ demanda_id: demandaId, user_id: user.id, ...h });
      toast.success('Horas registradas com sucesso');
      await invalidate();
    } catch {
      toast.error('Erro ao registrar horas');
    }
  };

  const update = async (
    id: string,
    h: { horas: number; fase: string; descricao: string; user_id?: string },
  ) => {
    try {
      await svc.updateHour(id, h);
      toast.success('Registro atualizado com sucesso');
      await invalidate();
    } catch {
      toast.error('Erro ao atualizar registro');
    }
  };

  const remove = async (id: string) => {
    try {
      await svc.deleteHour(id);
      toast.success('Registro excluído com sucesso');
      await invalidate();
    } catch {
      toast.error('Erro ao excluir registro');
    }
  };

  const total = hours.reduce((s, h) => s + Number(h.horas), 0);
  return { hours, loading, add, update, remove, total, reload: invalidate };
}
