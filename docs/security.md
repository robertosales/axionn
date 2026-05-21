# SEC-001 — Security Hardening

## Visão Geral

Este documento descreve as medidas de segurança implementadas no epic `perf-security-hardening`.

---

## 1. HTTP Security Headers

Configurados em `public/_headers` (Netlify/Cloudflare) e `vercel.json` (Vercel).

| Header | Valor | Proteção |
|---|---|---|
| `X-Frame-Options` | `DENY` | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | XSS legado |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Vazamento de URL |
| `Permissions-Policy` | `camera=(), microphone=()...` | APIs sensíveis |
| `Strict-Transport-Security` | `max-age=31536000; preload` | HTTPS forçado |
| `Content-Security-Policy` | (ver abaixo) | XSS / injeção |

### Content Security Policy

```
default-src 'self'
script-src  'self' 'strict-dynamic'
style-src   'self' 'unsafe-inline'       ← necessário para Tailwind/shadcn
img-src     'self' data: blob: https:
font-src    'self' data:
connect-src 'self' https://*.supabase.co wss://*.supabase.co
frame-src   'none'
object-src  'none'
base-uri    'self'
form-action 'self'
upgrade-insecure-requests
```

---

## 2. Input Sanitization (`src/lib/security.ts`)

- `sanitizeInput(value, maxLength)` — remove tags HTML, `<script>`, handlers `on*` e `javascript:`
- Aplicar em todos os campos de texto livre antes de persistir no Supabase

```ts
import { sanitizeInput } from "@/lib/security";
const safe = sanitizeInput(userInput, 500);
```

---

## 3. Rate Limiting Client-Side (`src/lib/security.ts`)

> ⚠️ Rate limiting client-side é uma camada de UX, não de segurança real.
> Para proteção real, use Row Level Security (RLS) e rate limiting no Supabase Edge Functions.

```ts
import { checkRateLimit } from "@/lib/security";

const handleSubmit = () => {
  if (!checkRateLimit("form_submit", 5, 60_000)) {
    toast.error("Muitas tentativas. Aguarde 1 minuto.");
    return;
  }
  // ... continua
};
```

---

## 4. Idle Session Guard

- `IdleSessionGuard` + `useIdleTimeout` — auto-logout após 30min de inatividade
- Aviso modal 2min antes do logout
- Ativado apenas quando há sessão ativa

---

## 5. Env Validation (`src/lib/envValidation.ts`)

```ts
// main.tsx
import { validateEnvVars } from "@/lib/envValidation";
validateEnvVars(); // lança erro em produção se vars ausentes
```

---

## 6. Próximos Passos (fora do escopo desta PR)

- [ ] RLS audit — revisar todas as policies do Supabase
- [ ] Edge Function rate limiting para auth endpoints
- [ ] Supabase Vault para secrets sensíveis
- [ ] Audit log de ações administrativas
