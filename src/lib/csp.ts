/**
 * SEC-001 — Content Security Policy
 *
 * Define a política CSP para injeção via meta tag no index.html ou
 * via headers HTTP no servidor/CDN.
 *
 * USO VIA META TAG (desenvolvimento / Netlify sem headers config):
 *   Ver: src/lib/csp.ts -> getCSPMetaContent()
 *
 * USO VIA HTTP HEADER (produção / Vercel / Netlify):
 *   Copiar o valor de getCSPHeader() para o config do hosting.
 */

const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ??
  "https://*.supabase.co";

// Extrai só a origem (sem path)
function toOrigin(url: string): string {
  try { return new URL(url).origin; } catch { return url; }
}

const SUPABASE_ORIGIN = toOrigin(SUPABASE_URL);

const DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src":  ["'self'", "'strict-dynamic'"],
  "style-src":   ["'self'", "'unsafe-inline'"],           // shadcn/tailwind injeta estilos inline
  "img-src":     ["'self'", "data:", "blob:", "https:"],  // avatares/uploads externos
  "font-src":    ["'self'", "data:"],
  "connect-src": [
    "'self'",
    SUPABASE_ORIGIN,
    "https://*.supabase.co",
    "wss://*.supabase.co",                                // Realtime WebSocket
  ],
  "frame-src":    ["'none'"],
  "object-src":   ["'none'"],
  "base-uri":     ["'self'"],
  "form-action":  ["'self'"],
  "upgrade-insecure-requests": [],
};

export function getCSPString(): string {
  return Object.entries(DIRECTIVES)
    .map(([directive, sources]) =>
      sources.length > 0
        ? `${directive} ${sources.join(" ")}`
        : directive
    )
    .join("; ");
}

/** Para uso em <meta http-equiv="Content-Security-Policy"> */
export function getCSPMetaContent(): string {
  return getCSPString();
}

/** Para logging/documentação */
export function logCSP(): void {
  if (import.meta.env.DEV) {
    // Apenas em dev — removido pelo terser em produção
    console.groupCollapsed("[SEC-001] Content-Security-Policy");
    Object.entries(DIRECTIVES).forEach(([d, s]) => {
      console.log(`  ${d}:`, s.join(" ") || "(none)");
    });
    console.groupEnd();
  }
}
