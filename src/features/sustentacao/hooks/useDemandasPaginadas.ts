/**
 * useDemandasPaginadas — P0-fix: remoção do canal Realtime duplicado
 *
 * ANTES: criava canal 'demandas-paginadas-rt-{teamId}' próprio
 *   → junto com o canal 'demandas-rt-{teamId}' do useDemandas,
 *     resultava em 2 canais WebSocket por usuário na página Demandas.
 *   → Com 150 usuários: 300 canais (limite Pro do Supabase: 200 por padrão)
 *
 * DEPOIS: canal RT removido deste hook.
 *   → O canal único do useDemandas agora chama
 *     qc.resetQueries({ queryKey: KEYS.demandas.infinite(teamId) })
 *     garantindo que a infinite query seja reiniciada quando houver mudanças.
 *   → 150 usuários = 150 canais (dentro do limite)
 *
 * O debounce de 2s e a lógica de reset (pág 1) continuam funcionando,
 * agora orquestrados centralmente pelo useDemandas.
 */

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo }                          from 'react';
import { useAuth }                          from '@/contexts/AuthContext';
import { STALE }                            from '@/lib/queryClient';
import { KEYS }                             from '@/lib/queryKeys';
import { fetchDemandasPage }                from '../services/demandas.service';
import type { Demanda }                     from '../types/demanda';

export function useDemandasPaginadas() {
  const { currentTeamId } = useAuth();
  const qc = useQueryClient(); // eslint-disable-line @typescript-eslint/no-unused-vars

  const queryKey = KEYS.demandas.infinite(currentTeamId ?? '');

  const {
    data,
    isLoading:          loading,
    isFetchingNextPage: loadingMore,
    fetchNextPage,
    hasNextPage,
    error: queryError,
  } = useInfiniteQuery({
    queryKey,
    queryFn:          ({ pageParam }) =>
      fetchDemandasPage(currentTeamId!, pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled:          !!currentTeamId,
    staleTime:        STALE.REALTIME,  // 30s
  });

  // Flat array de todos os itens carregados (todas as páginas concatenadas)
  const demandas = useMemo<Demanda[]>(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  // P0-fix: canal RT removido.
  // O canal 'demandas-rt-{teamId}' em useDemandas chama:
  //   qc.resetQueries({ queryKey: KEYS.demandas.infinite(teamId) })
  // ...garantindo reset para pág 1 com debounce de 2s, sem canal duplicado.

  const error = queryError ? (queryError as Error).message : null;

  return {
    demandas,
    loadMore:    fetchNextPage,
    hasMore:     hasNextPage ?? false,
    loading,
    loadingMore,
    error,
  };
}
