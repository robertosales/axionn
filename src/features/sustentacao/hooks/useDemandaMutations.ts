/**
 * useDemandaMutations — P0-B: hook de mutations sem fetch
 *
 * Motivação:
 *   DemandasList precisa de create/update/moveTo/remove, mas importava
 *   useDemandas que internamente executa fetchDemandasEnriched (dataset completo).
 *   Isso causava:
 *     1. Uma RPC pesada extra no mount da página Demandas (dados ignorados)
 *     2. Um canal Realtime extra 'demandas-rt-{teamId}' em paralelo com
 *        o canal já existente em useDemandasPaginadas
 *
 *   Este hook expõe apenas as mutations. Sem useQuery, sem canal RT.
 *   A invalidação após cada mutation atinge KEYS.demandas.all E
 *   KEYS.demandas.infinite, mantendo Kanban e lista paginada sincronizados.
 *
 * Uso:
 *   const { create, update, moveTo, remove } = useDemandaMutations();
 */

import { useQueryClient }           from '@tanstack/react-query';
import { useAuth }                  from '@/contexts/AuthContext';
import { toast }                    from 'sonner';
import * as svc                     from '../services/demandas.service';
import type { Demanda }             from '../types/demanda';
import { REQUIRES_JUSTIFICATIVA }   from '../types/demanda';
import { KEYS }                     from '@/lib/queryKeys';

export function useDemandaMutations() {
  const { currentTeamId, user } = useAuth();
  const qc = useQueryClient();

  // Invalida lista completa (Kanban) + infinite query (DemandasList)
  const invalidateAll = () => Promise.all([
    qc.invalidateQueries({ queryKey: KEYS.demandas.all(currentTeamId!) }),
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

  return { create, update, moveTo, remove };
}
