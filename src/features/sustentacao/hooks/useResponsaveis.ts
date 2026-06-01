/**
 * useResponsaveis — P1: fetch batch de responsáveis com cache TanStack Query
 *
 * ANTES (DemandasList.tsx):
 *   const [responsaveisMap, setResponsaveisMap] = useState(...);
 *   useEffect(() => {
 *     fetchResponsaveisWithPapelByDemandaIds(ids).then(setResponsaveisMap);
 *   }, [demandaIdsHash]);
 *
 *   Problemas:
 *     - Fora do TanStack Query: sem staleTime, sem gcTime, sem deduplicação
 *     - Disparado a cada loadMore() conforme novos IDs entram no hash
 *     - Cada chamada busca TODOS os IDs acumulados (payload cresce sem limite)
 *     - Dois usuários com a mesma lista disparam duas queries independentes
 *
 * DEPOIS (este hook):
 *   const { responsaveisMap } = useResponsaveis(currentTeamId, demandas);
 *
 *   Benefícios:
 *     - staleTime: STALE.REFERENCE (5 min) — evita refetch a cada scroll
 *     - gcTime padrão (5 min) — cache sobrevive ao unmount para navegação rápida
 *     - Deduplicação automática: mesmo queryKey = mesma request compartilhada
 *     - queryKey estável baseada em hash ordenado de IDs
 *
 * Estratégia de queryKey:
 *   KEYS.responsaveis.byDemandas(teamId, idsHash)
 *   O hash é o join ordenado dos IDs — muda apenas quando o conjunto de
 *   demandas carregadas muda, não a cada re-render.
 */

import { useQuery }                    from '@tanstack/react-query';
import { useMemo }                     from 'react';
import { KEYS }                        from '@/lib/queryKeys';
import { STALE }                       from '@/lib/queryClient';
import { fetchResponsaveisWithPapelByDemandaIds } from '../services/profiles.service';
import type { Demanda }                from '../types/demanda';

export function useResponsaveis(
  teamId: string | null | undefined,
  demandas: Demanda[],
) {
  // Hash estável: só muda quando o CONJUNTO de IDs muda
  const idsHash = useMemo(
    () => demandas.map((d) => d.id).sort().join(','),
    [demandas],
  );

  const ids = useMemo(() => demandas.map((d) => d.id), [demandas]);

  const { data: responsaveisMap = new Map() } = useQuery({
    queryKey: KEYS.responsaveis.byDemandas(teamId ?? '', idsHash),
    queryFn:  () => fetchResponsaveisWithPapelByDemandaIds(ids),
    enabled:  !!teamId && demandas.length > 0,
    staleTime: STALE.REFERENCE,   // 5 min — responsáveis mudam raramente
  });

  return { responsaveisMap };
}
