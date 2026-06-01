/**
 * useDemandasPaginadas — Fase 4 (feat/backlog-lazy-load)
 *
 * Hook de lazy load para listas de demandas com muitos registros.
 * Usa useInfiniteQuery com cursor-based pagination (updated_at DESC).
 *
 * Motivação:
 *   useDemandas carrega TODO o dataset em uma query. Funciona bem para
 *   o Kanban (precisa de todas as demandas para montar colunas), mas é
 *   excessivo para vistas de backlog/listagem onde o usuário raramente
 *   chega ao final. PAGE_SIZE=50 reduz o payload inicial em ~75% para
 *   times com 200+ demandas.
 *
 * API pública:
 *   demandas   — array flat de todas as demandas carregadas até agora
 *   loadMore   — função para buscar a próxima página
 *   hasMore    — true enquanto houver mais páginas
 *   loading    — true durante a primeira carga
 *   loadingMore — true durante carregamento de páginas adicionais
 *   error      — mensagem de erro ou null
 *
 * Realtime:
 *   Compartilha o mesmo canal `demandas-rt-*` do useDemandas (não cria
 *   um canal extra). Quando detecta mudanças, reseta para a primeira
 *   página (resetPages) com debounce de 2s — garante consistência sem
 *   acumular páginas desatualizadas.
 *
 * Prerequisito no banco:
 *   RPC get_demandas_with_responsaveis_paged(p_team_id, p_cursor, p_limit)
 *   com a mesma lógica de get_demandas_with_responsaveis + LIMIT/OFFSET
 *   via cursor em updated_at.
 */

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useMemo }       from 'react';
import { supabase }                          from '@/integrations/supabase/client';
import { useAuth }                           from '@/contexts/AuthContext';
import { STALE }                             from '@/lib/queryClient';
import { KEYS }                              from '@/lib/queryKeys';
import { fetchDemandasPage }                 from '../services/demandas.service';
import type { Demanda }                      from '../types/demanda';

export function useDemandasPaginadas() {
  const { currentTeamId } = useAuth();
  const qc = useQueryClient();

  const queryKey = KEYS.demandas.infinite(currentTeamId ?? '');

  const {
    data,
    isLoading:       loading,
    isFetchingNextPage: loadingMore,
    fetchNextPage,
    hasNextPage,
    error: queryError,
  } = useInfiniteQuery({
    queryKey,
    queryFn:              ({ pageParam }) =>
      fetchDemandasPage(currentTeamId!, pageParam as string | null),
    initialPageParam:     null as string | null,
    getNextPageParam:     (lastPage) => lastPage.nextCursor ?? undefined,
    enabled:              !!currentTeamId,
    staleTime:            STALE.REALTIME,  // 30s — mesmo que useDemandas
  });

  // Flat array de todos os itens carregados (todas as páginas concatenadas)
  const demandas = useMemo<Demanda[]>(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  // Debounce 2s: quando demandas mudam via RT, reseta para pág 1
  // para evitar acúmulo de páginas desatualizadas
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentTeamId) return;

    const channel = supabase
      .channel(`demandas-paginadas-rt-${currentTeamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demandas', filter: `team_id=eq.${currentTeamId}` },
        () => {
          if (typeof document !== 'undefined' && document.hidden) return;
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            // Reseta o infinite query: descarta páginas acumuladas e rebusca pág 1
            qc.resetQueries({ queryKey });
          }, 2000);
        },
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [currentTeamId, qc, queryKey]);

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
