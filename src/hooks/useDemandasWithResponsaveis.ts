/**
 * useDemandasWithResponsaveis
 *
 * ANTES: useState + useEffect direto — 1 fetch isolado por componente montado,
 *   sem cache compartilhado. Múltiplos DemandasPorTimeSection na mesma tela
 *   disparavam N fetches paralelos da mesma RPC pesada.
 *
 * DEPOIS: TanStack Query com a mesma queryKey de KEYS.demandas.list(teamId)
 *   usada pelo Kanban da Sustentação. Resultado: se o Kanban já buscou as
 *   demandas do time, o ContractDetail reutiliza o cache sem nenhuma request
 *   adicional. staleTime de 30s (STALE.REALTIME) — consistente com o board.
 */
import { useQuery }  from '@tanstack/react-query';
import { KEYS }      from '@/lib/queryKeys';
import { STALE }     from '@/lib/queryClient';
import { fetchDemandasEnriched } from '@/features/sustentacao/services/demandas.service';
import type { Demanda } from '@/features/sustentacao/types/demanda';

export type { Demanda as DemandaWithProjeto };

export function useDemandasWithResponsaveis(teamId: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: KEYS.demandas.list(teamId ?? ''),
    queryFn:  () => fetchDemandasEnriched(teamId!),
    enabled:  !!teamId,
    staleTime: STALE.REALTIME,
  });

  return {
    data:    (data ?? []) as Demanda[],
    loading: isLoading,
    error:   error ? (error as Error) : null,
  };
}
