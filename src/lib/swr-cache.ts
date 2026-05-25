/**
 * SWR Cache (stale-while-revalidate) para SprintContext.
 *
 * Evita re-fetches desnecessários quando o usuário navega entre seções.
 * Os dados são considerados "frescos" por `ttlMs` (padrão: 30 s).
 * Após o TTL, os dados ficam "stale" — são retornados imediatamente
 * enquanto o fetch em background os atualiza.
 *
 * Uso:
 *   const cache = new SwrCache<DataType>(30_000);
 *   cache.set('team-abc', data);
 *   const entry = cache.get('team-abc');
 *   if (entry.isStale) refetch(); // busca em background
 *   use(entry.data);              // usa dado stale imediatamente
 */

export interface CacheEntry<T> {
  data: T;
  /** O dado ainda está dentro do TTL */
  isFresh: boolean;
  /** O dado expirou mas pode ser usado enquanto o refresh acontece */
  isStale: boolean;
  /** Timestamp da última atualização */
  updatedAt: number;
}

export class SwrCache<T> {
  private store = new Map<string, { data: T; updatedAt: number }>();
  private readonly ttlMs: number;

  constructor(ttlMs = 30_000) {
    this.ttlMs = ttlMs;
  }

  /** Armazena ou atualiza uma entrada no cache */
  set(key: string, data: T): void {
    this.store.set(key, { data, updatedAt: Date.now() });
  }

  /**
   * Retorna a entrada do cache.
   * `isFresh` → dentro do TTL, não precisa revalidar.
   * `isStale` → fora do TTL, retornar o dado e revalidar em background.
   * Se não houver entrada, retorna `null`.
   */
  get(key: string): CacheEntry<T> | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const age    = Date.now() - entry.updatedAt;
    const isFresh = age < this.ttlMs;

    return {
      data:      entry.data,
      isFresh,
      isStale:  !isFresh,
      updatedAt: entry.updatedAt,
    };
  }

  /** Remove uma entrada específica do cache (ex: ao trocar de time) */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Limpa todo o cache */
  clear(): void {
    this.store.clear();
  }

  /** Retorna true se a entrada existe E ainda está dentro do TTL */
  isFresh(key: string): boolean {
    return this.get(key)?.isFresh ?? false;
  }
}
