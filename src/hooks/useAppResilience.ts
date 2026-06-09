/**
 * useAppResilience — Resiliência e Performance
 *
 * Não executa mais nenhuma ação em visibilitychange/focus.
 * ALT+TAB e minimizar/restaurar não podem cancelar queries, invalidar cache
 * nem alternar o foco global do React Query, pois isso causava recarregamento
 * visual/remount e perda de estado local em formulários.
 */
export function useAppResilience() {
  return;
}
