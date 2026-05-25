/**
 * SEC-001 — Security Utilities
 *
 * Funções centralizadas de segurança:
 * - sanitizeInput: strip de HTML/scripts em inputs de usuário
 * - validateUrl: whitelist de domínios permitidos
 * - rateLimiter: client-side rate limit para ações sensíveis
 * - maskSensitiveData: ofusca dados sensíveis em logs
 * - generateNonce: nonce para CSP dinâmico
 */

// ─── Sanitização básica de texto livre ─────────────────────────────────────────
export function sanitizeInput(value: string, maxLength = 2000): string {
  if (typeof value !== "string") return "";
  return value
    .slice(0, maxLength)
    .replace(/<script[^>]*>.*?<\/script>/gis, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

// ─── Validação de URLs ─────────────────────────────────────────────────────────
const ALLOWED_URL_ORIGINS = [
  typeof window !== "undefined" ? window.location.origin : "",
  "https://supabase.co",
  "https://supabase.com",
];

export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Permite caminhos relativos e origens whitelistadas
    return (
      parsed.protocol === "https:" &&
      ALLOWED_URL_ORIGINS.some((o) => o && parsed.origin.endsWith(o.replace("https://", "")))
    );
  } catch {
    // URL relativa é sempre permitida
    return url.startsWith("/");
  }
}

// ─── Rate limiter client-side ─────────────────────────────────────────────────
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const _store = new Map<string, RateLimitEntry>();

/**
 * Verifica se a ação está dentro do limite.
 * @param key     - Identificador único da ação (ex: "login", "submit_form")
 * @param limit   - Máximo de chamadas permitidas na janela
 * @param windowMs - Janela de tempo em ms (padrão: 60s)
 * @returns true se permitido, false se bloqueado
 */
export function checkRateLimit(key: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = _store.get(key);

  if (!entry || now > entry.resetAt) {
    _store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}

export function resetRateLimit(key: string): void {
  _store.delete(key);
}

// ─── Mascaramento de dados sensíveis para logs ────────────────────────────────
export function maskEmail(email: string): string {
  if (!email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

export function maskToken(token: string): string {
  if (token.length < 8) return "***";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

// ─── Nonce para CSP dinâmico ─────────────────────────────────────────────────
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

// ─── Validação de variáveis de ambiente obrigatórias ────────────────────────
const REQUIRED_ENV_VARS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const;

export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(
    (key) => !import.meta.env[key]
  );
  if (missing.length > 0) {
    throw new Error(
      `[SEC-001] Variáveis de ambiente obrigatórias ausentes: ${missing.join(", ")}\n` +
      `Crie o arquivo .env com os valores corretos.`
    );
  }
}

// ─── Proteção contra clickjacking (frame buster) ─────────────────────────────
export function ensureNoIframe(): void {
  if (typeof window === "undefined") return;
  if (window.top !== window.self) {
    window.top!.location.href = window.location.href;
  }
}
