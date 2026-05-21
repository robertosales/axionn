/**
 * PERF-002: useStableCallback
 * Garante identidade estável de callbacks mesmo quando as deps mudam,
 * sem violar a regra dos hooks. Útil para handlers passados a componentes
 * memoizados que não precisam de re-render ao mudar deps internas.
 *
 * Uso:
 *   const handleClick = useStableCallback(() => doSomething(value));
 */
import { useRef, useCallback } from "react";

export function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef<T>(fn);
  ref.current = fn;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(((...args) => ref.current(...args)) as T, []);
}
