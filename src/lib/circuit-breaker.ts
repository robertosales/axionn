/**
 * CircuitBreaker — padrão de resiliência para chamadas ao Supabase.
 *
 * Estados:
 *  CLOSED    → operação normal, chamadas passam livremente
 *  OPEN      → circuito aberto, chamadas são bloqueadas imediatamente (fast-fail)
 *  HALF_OPEN → teste: 1 chamada passa; se OK → CLOSED, se falhar → OPEN novamente
 *
 * Configuração padrão:
 *  - 3 falhas consecutivas abrem o circuito
 *  - 30 s de cooldown antes de tentar HALF_OPEN
 *  - Log no console em cada transição de estado
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Nº de falhas consecutivas para abrir o circuito (padrão: 3) */
  failureThreshold?: number;
  /** Milissegundos de cooldown antes de tentar HALF_OPEN (padrão: 30 000) */
  cooldownMs?: number;
  /** Nome do circuito — aparece nos logs */
  name?: string;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private lastFailureTime = 0;

  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs       = options.cooldownMs       ?? 30_000;
    this.name             = options.name             ?? 'CircuitBreaker';
  }

  /** Retorna o estado atual do circuito */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Executa `fn` dentro do circuit breaker.
   * - CLOSED   → executa normalmente
   * - OPEN     → lança CircuitOpenError imediatamente (fast-fail)
   * - HALF_OPEN → executa 1 chamada de teste
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.cooldownMs) {
        this._transition('HALF_OPEN');
      } else {
        const remaining = Math.ceil((this.cooldownMs - elapsed) / 1_000);
        throw new CircuitOpenError(
          `[${this.name}] Circuito ABERTO — aguarde ${remaining}s para nova tentativa.`
        );
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  /** Reseta manualmente o circuito para CLOSED (útil em testes ou admin) */
  reset(): void {
    this.failures = 0;
    this._transition('CLOSED');
  }

  private _onSuccess(): void {
    this.failures = 0;
    if (this.state !== 'CLOSED') {
      this._transition('CLOSED');
    }
  }

  private _onFailure(): void {
    this.failures += 1;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this._transition('OPEN');
    }
  }

  private _transition(next: CircuitState): void {
    if (this.state === next) return;
    console.warn(`[${this.name}] ${this.state} → ${next}`);
    this.state = next;
  }
}

/** Erro lançado quando o circuito está OPEN e a chamada é bloqueada */
export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

/** Instância singleton para chamadas ao Supabase */
export const supabaseCircuitBreaker = new CircuitBreaker({
  name: 'Supabase',
  failureThreshold: 3,
  cooldownMs: 30_000,
});
