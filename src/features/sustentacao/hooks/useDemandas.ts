/**
 * useDemandas — P0-fix: RT canal invalida também KPIs e infinite query
 *
 * ANTES: invalidação cobria apenas KEYS.demandas.all
 *   → KPIs do Dashboard ficavam desatualizados até seu próprio canal RT disparar
 *   → useDemandasPaginadas precisava de canal RT próprio para ser notificado
 *
 * DEPOIS: invalidação em cascata cobre:
 *   1. KEYS.demandas.all(teamId)  → lista completa (Kanban)
 *   2. KEYS.kpis.all(teamId)      → KPIs do Dashboard (sincronismo garantido)
 *   3. KEYS.demandas.infinite(teamId) reset → infinite query da página Demandas
 *      (elimina a necessidade de canal RT duplicado em useDemandasPaginadas)
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

// ── Hook principal ────────────────────────────────────────────────────────────
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

  // ── Realtime: invalida cache em cascata ───────────────────────────────────
  // P0-fix: além de KEYS.demandas.all, invalida também:
  //   - KEYS.kpis.all → KPIs do Dashboard ficam sincronizados sem canal extra
  //   - KEYS.demandas.infinite → useDemandasPaginadas não precisa de canal próprio
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
            // 1. Lista completa (Kanban, SustentacaoDashboard)
            qc.invalidateQueries({ queryKey: KEYS.demandas.all(currentTeamId) });
            // 2. KPIs (Dashboard) — P0-fix: consistência sem canal RT extra
            qc.invalidateQueries({ queryKey: KEYS.kpis.all(currentTeamId) });
            // 3. Infinite query (página Demandas) — P0-fix: elimina canal duplicado
            qc.resetQueries({ queryKey: KEYS.demandas.infinite(currentTeamId) });
          }, 2000);
        },
      )
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [currentTeamId, qc]);

  // ── Mutations ──────────────────────────────────────────────────────────────────
  const invalidate = () => qc.invalidateQueries({ queryKey: KEYS.demandas.all(currentTeamId!) });

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
      await invalidate();
    } catch {
      toast.error('Erro ao criar demanda');
    }
  };

  const update = async (id: string, updates: Partial<Demanda>) => {
    try {
      await svc.updateDemanda(id, updates);
      toast.success('Demanda atualizada com sucesso');
      await invalidate();
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
      await invalidate();
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
      await invalidate();
    } catch {
      toast.error('Erro ao excluir demanda');
    }
  };

  return {
    demandas,
    loading,
    error,
    reload: invalidate,
    create,
    update,
    moveTo,
    remove,
  };
}

// ── useTransitions ──────────────────────────────────────────────────────────────
export function useTransitions(demandaId: string | null) {
  const { data: transitions = [], isLoading: loading, refetch } = useQuery({
    queryKey:  KEYS.demandas.transitions(demandaId ?? ''),
    queryFn:   () => svc.fetchTransitions(demandaId!),
    enabled:   !!demandaId,
    staleTime: STALE.REALTIME,
  });
  return { transitions, loading, reload: refetch };
}

// ── useHours ───────────────────────────────────────────────────────────────────
export function useHours(demandaId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: hours = [], isLoading: loading } = useQuery({
    queryKey:  KEYS.demandas.hours(demandaId ?? ''),
    queryFn:   () => svc.fetchHours(demandaId!),
    enabled:   !!demandaId,
    staleTime: 0,
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
