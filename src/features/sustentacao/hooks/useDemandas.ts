/**
 * useDemandas — migrado para TanStack Query (Semana 2)
 *
 * ANTES: useState + useEffect + loadingRef manual
 *   - fetch em todo mount, sem cache, sem deduplicação
 *   - realtime atualizava state local (não compartilhado)
 *
 * DEPOIS: useQuery com staleTime: 30s
 *   - cache compartilhado entre todos os componentes
 *   - realtime invalida queryClient → todos os subscribers atualizam
 *   - mutations usam invalidateQueries para coerência
 *   - API pública idêntica (demandas, loading, error, reload, create, update, moveTo, remove)
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as svc from '../services/demandas.service';
import type { Demanda, DemandaTransition, DemandaHour } from '../types/demanda';
import { REQUIRES_JUSTIFICATIVA } from '../types/demanda';
import { KEYS } from '@/lib/queryKeys';
import { STALE } from '@/lib/queryClient';

// ─── Enrich responsáveis (inalterado) ────────────────────────────────────────
async function enrichComResponsaveis(demandas: Demanda[]): Promise<Demanda[]> {
  if (demandas.length === 0) return demandas;
  const ids = demandas.map((d) => d.id);

  const { data } = await supabase
    .from('demanda_responsaveis')
    .select('demanda_id, papel, created_at, profiles(display_name)')
    .in('demanda_id', ids)
    .order('created_at', { ascending: true });

  const rows = (data || []) as any[];

  return demandas.map((d) => {
    const resp = rows.filter((r) => r.demanda_id === d.id);
    const getPorPapel = (papel: string) =>
      resp.find((r) => r.papel === papel)?.profiles?.display_name ?? null;
    const responsaveis_list = resp
      .map((r) => ({
        papel:      r.papel as string,
        nome:       (r.profiles?.display_name ?? '') as string,
        created_at: r.created_at as string,
      }))
      .filter((r) => !!r.nome);

    return {
      ...d,
      responsavel_dev:        getPorPapel('desenvolvedor') ?? d.responsavel_dev,
      responsavel_requisitos: getPorPapel('analista')      ?? d.responsavel_requisitos,
      responsavel_arquiteto:  getPorPapel('arquiteto')     ?? d.responsavel_arquiteto,
      responsavel_teste:      getPorPapel('testador')      ?? d.responsavel_teste,
      responsaveis_list,
    } as Demanda & { responsaveis_list: { papel: string; nome: string; created_at: string }[] };
  });
}

// ─── Fetch principal ──────────────────────────────────────────────────────────
async function fetchDemandasEnriched(teamId: string): Promise<Demanda[]> {
  const data = await svc.fetchDemandas(teamId);
  return enrichComResponsaveis(data);
}

// ─── Hook principal ───────────────────────────────────────────────────────────
export function useDemandas() {
  const { currentTeamId, user } = useAuth();
  const qc = useQueryClient();

  // ── Query ──────────────────────────────────────────────────────────────────
  const queryKey = KEYS.demandas.list(currentTeamId ?? '');

  const { data: demandas = [], isLoading: loading, error: queryError } = useQuery({
    queryKey,
    queryFn:   () => fetchDemandasEnriched(currentTeamId!),
    enabled:   !!currentTeamId,
    staleTime: STALE.REALTIME,
  });

  const error = queryError ? (queryError as Error).message : null;

  // ── Realtime: invalida cache com Debounce para poupar CPU ────────────────
  useEffect(() => {
    if (!currentTeamId) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const channel = supabase
      .channel(`demandas-rt-${currentTeamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demandas', filter: `team_id=eq.${currentTeamId}` },
        () => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            console.log('[Sustentação] Realtime: Invalidando cache de demandas...');
            qc.invalidateQueries({ queryKey: KEYS.demandas.all(currentTeamId) });
          }, 2000); // 2s de debounce
        },
      )
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [currentTeamId, qc]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => qc.invalidateQueries({ queryKey: KEYS.demandas.all(currentTeamId!) });

  const create = async (d: Partial<Demanda>) => {
    if (!currentTeamId) return;
    try {
      const created = await svc.createDemanda({ ...d, team_id: currentTeamId, rhm: d.rhm! });
      if (user) {
        await svc.addTransition({
          demanda_id:   created.id,
          from_status:  null,
          to_status:    'nova',
          user_id:      user.id,
          justificativa: null,
        });
      }
      toast.success('Demanda criada com sucesso');
      // Realtime dispara invalidação, mas invalidamos aqui também
      // para resposta imediata caso Realtime tenha latência
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
          demanda_id:   demanda.id,
          from_status:  demanda.situacao,
          to_status:    newStatus,
          user_id:      user.id,
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
    reload: invalidate,   // API pública mantida: reload() agora = invalidate
    create,
    update,
    moveTo,
    remove,
  };
}

// ─── useTransitions (migrado) ─────────────────────────────────────────────────
export function useTransitions(demandaId: string | null) {
  const { data: transitions = [], isLoading: loading, refetch } = useQuery({
    queryKey:  KEYS.demandas.transitions(demandaId ?? ''),
    queryFn:   () => svc.fetchTransitions(demandaId!),
    enabled:   !!demandaId,
    staleTime: STALE.REALTIME,
  });
  return { transitions, loading, reload: refetch };
}

// ─── useHours (migrado) ───────────────────────────────────────────────────────
export function useHours(demandaId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: hours = [], isLoading: loading } = useQuery({
    queryKey:  KEYS.demandas.hours(demandaId ?? ''),
    queryFn:   () => svc.fetchHours(demandaId!),
    enabled:   !!demandaId,
    // staleTime: 0 garante que ao mudar de demanda o React Query nunca serve
    // o cache vazio (registrado quando demandaId era null) — sempre refaz o fetch
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
