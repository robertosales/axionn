/**
 * retryQuery — utilitário de retry com exponential backoff.
 *
 * Tenta executar `fn` até `maxAttempts` vezes.
 * Entre cada tentativa, aguarda `baseDelayMs * 2^tentativa` ms.
 * Aborta imediatamente se o sinal do AbortController for disparado.
 *
 * Exemplo:
 *   const data = await retryQuery(() => supabase.from('sprints').select('*'));
 */

export interface RetryOptions {
  /** Número máximo de tentativas (padrão: 3) */
  maxAttempts?: number;
  /** Delay base em ms — dobra a cada tentativa (padrão: 500) */
  baseDelayMs?: number;
  /** AbortSignal para cancelar o retry a qualquer momento */
  signal?: AbortSignal;
}

/**
 * Aguarda `ms` milissegundos, mas aborta se `signal` for disparado.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

export async function retryQuery<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const signal      = options.signal;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      return await fn();
    } catch (err) {
      // Não tenta novamente em caso de abort
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      if (err instanceof Error && err.name === 'AbortError') throw err;

      lastError = err;
      const isLastAttempt = attempt === maxAttempts - 1;

      if (!isLastAttempt) {
        const delay = baseDelayMs * Math.pow(2, attempt); // 500, 1000, 2000…
        console.warn(
          `[retryQuery] tentativa ${attempt + 1}/${maxAttempts} falhou — próxima em ${delay}ms`,
          err
        );
        await sleep(delay, signal);
      }
    }
  }

  throw lastError;
}
