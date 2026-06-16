/**
 * useDemandas — F2-B: invalidação em cascata nas mutations
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth }                  from '@/contexts/AuthContext';
import { toast }                    from 'sonner';
import { supabase }                 from '@/integrations/supabase/client';
import * as svc                     from '../services/demandas.service';
import type { Demanda, DemandaHour } from '../types/demanda';
import { ALL_SITUACOES } from '../types/demanda';
import { KEYS }                     from '@/lib/queryKeys';
import { STALE }                    from '@/lib/queryClient';

// Exports de compatibilidade (usados por outros módulos)
export const DEMANDAS_QUERY_KEY = 'demandas';
export const ALL_VALID_SITUACOES = ALL_SITUACOES as readonly string[];

// ── useDemandas ──────────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (!currentTeamId) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel(`demandas-rt-${currentTeamId}`)
      .on('postgres_changes',
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
    } catch (err: any) {
      const code = err?.code ?? err?.cause?.code;
      const msg  = String(err?.message ?? '');
      const details = String(err?.details ?? '');
      const blob = `${msg} ${details}`;
      if (code === '23505' && (blob.includes('demandas_team_rhm_projeto_uniq_idx') || blob.includes('demandas_team_id_rhm_key'))) {
        toast.error(`Já existe uma demanda com o número #${d.rhm ?? ''} no projeto "${d.projeto ?? ''}".`);
      } else if (code === '23505' || blob.includes('demandas_no_duplicates_idx')) {
        toast.error('Já existe uma demanda ativa com mesmo título, projeto, tipo e regime neste time.');
      } else {
        toast.error(`Erro ao criar demanda${msg ? `: ${msg}` : ''}`);
      }
      throw err;
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
    const extraUpdates: Partial<Demanda> =
      newStatus === 'fila_concluida' ? { aceite_data: new Date().toISOString() } : {};
    try {
      await svc.updateDemanda(demanda.id, { situacao: newStatus, ...extraUpdates });
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

  return { demandas, loading, error, reload: invalidateAll, create, update, moveTo, remove };
}

// Alias para compatibilidade com código legado que usava useDemandas com opções
export function useDemandasByStatus(teamId?: string) {
  return useDemandas();
}

export function useDemandasConcluidas(teamId?: string) {
  return useDemandas();
}

// ── useTransitions ───────────────────────────────────────────────────────────
export function useTransitions(demandaId: string | null) {
  const { data: transitions = [], isLoading: loading, refetch } = useQuery({
    queryKey:  KEYS.demandas.transitions(demandaId ?? ''),
    queryFn:   () => svc.fetchTransitions(demandaId!),
    enabled:   !!demandaId,
    staleTime: STALE.REALTIME,
  });
  return { transitions, loading, reload: refetch };
}

// ── useHours ─────────────────────────────────────────────────────────────────
export function useHours(demandaId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: hours = [], isLoading: loading } = useQuery({
    queryKey:  KEYS.demandas.hours(demandaId ?? ''),
    queryFn:   () => svc.fetchHours(demandaId!),
    enabled:   !!demandaId,
    staleTime: STALE.REALTIME,
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

  const update = async (id: string, h: { horas: number; fase: string; descricao: string; user_id?: string }) => {
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
