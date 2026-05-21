# Segurança — SprintFlow

> Documento unificado: SEC-001 (headers + sanitização) e SEC-002 (RLS audit + rate limiting)

---

## SEC-001 — Security Hardening

### HTTP Security Headers

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
style-src   'self' 'unsafe-inline'
img-src     'self' data: blob: https:
font-src    'self' data:
connect-src 'self' https://*.supabase.co wss://*.supabase.co
frame-src   'none'
object-src  'none'
base-uri    'self'
form-action 'self'
upgrade-insecure-requests
```

### Utilitários (`src/lib/security.ts`)

- `sanitizeInput(value, maxLength)` — strip HTML, scripts e handlers `on*`
- `checkRateLimit(key, limit, windowMs)` — rate limiter client-side
- `maskEmail / maskToken` — ofuscação em logs
- `generateNonce()` — nonce CSP dinâmico
- `ensureNoIframe()` — frame buster

### Env Validation

```ts
// main.tsx
import { validateEnvVars } from "@/lib/envValidation";
validateEnvVars();
```

---

## SEC-002 — RLS Audit & Server-Side Rate Limiting

### RLS Audit

Migration: `supabase/migrations/20260520220000_sec002_rls_audit.sql`

#### Tabelas auditadas e políticas aplicadas

| Tabela | RLS | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|---|
| `profiles` | ✅ | own + admin | own | own + admin | admin |
| `team_members` | ✅ | team + admin | self/admin | admin | admin |
| `sprints` | ✅ | team + admin | team + admin | team + admin | admin |
| `user_stories` | ✅ | team (via sprint) + admin | team + admin | team + admin | team + admin |
| `activities` | ✅ | team (via HU) + admin | próprio profile + admin | próprio + admin | próprio + admin |
| `impediments` | ✅ | team (via HU) + admin | team + admin | team + admin | admin |
| `sprint_impediments` | ✅ | team + admin | team + admin | team + admin | admin |
| `apf_generations` | ✅ | próprio + admin | próprio | próprio + admin | próprio + admin |
| `rdm_demandas` | ✅ | participante/responsável/admin | autenticado | responsável + admin | admin |
| `rdm_participantes` | ✅ | participante/responsável/admin | responsável + admin | — | responsável + admin |
| `rdm_fases` | ✅ | autenticado | admin | admin | admin |
| `rdm_checklist_*` | ✅ | autenticado | admin | admin | admin |
| `rdm_deployment_*` | ✅ | autenticado | admin | admin | admin |
| `user_module_roles` | ✅ | próprio + admin | admin | admin | admin |
| `user_management_audit_log` | ✅ | admin | via SECURITY DEFINER | — | — |

#### Query de validação (Supabase SQL Editor)

```sql
-- Tabelas SEM RLS no schema public:
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND NOT rowsecurity
ORDER BY tablename;

-- Tabelas com RLS mas SEM nenhuma policy (bloqueio total acidental):
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p
  ON p.tablename = t.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public' AND t.rowsecurity AND p.policyname IS NULL
ORDER BY t.tablename;
```

---

### Rate Limiting — Edge Function

Edge Function: `supabase/functions/auth-rate-limiter/index.ts`

#### Limites por endpoint

| Endpoint | Máx. requisições | Janela |
|---|---|---|
| `login` | 10 | 60s |
| `signup` | 5 | 60s |
| `reset_password` | 3 | 300s |
| `otp` | 5 | 60s |
| `default` | 20 | 60s |

#### Integração no frontend

```ts
import { checkAuthRateLimit } from "@/lib/authRateLimiter";

const { allowed, retryAfter } = await checkAuthRateLimit("login");
if (!allowed) {
  toast.error(`Muitas tentativas. Aguarde ${retryAfter}s.`);
  return;
}
await supabase.auth.signInWithPassword({ email, password });
```

#### Deploy da Edge Function

```bash
# Via Supabase CLI
supabase functions deploy auth-rate-limiter --project-ref SEU_PROJECT_REF

# Variáveis de ambiente (opcional — ativa Redis para produção):
supabase secrets set UPSTASH_REDIS_REST_URL=https://...
supabase secrets set UPSTASH_REDIS_REST_TOKEN=...
supabase secrets set SITE_URL=https://seudominio.com
```

> ⚠️ Sem as variáveis Redis, a função usa armazenamento in-memory (cada instância independente). Para produção com múltiplas instâncias, configure o Upstash Redis.

---

## Próximos Passos (SEC-003+)

- [ ] Supabase Vault para secrets sensíveis
- [ ] Audit log de ações administrativas via trigger (todas as tabelas críticas)
- [ ] PITR (Point-in-Time Recovery) habilitado no projeto Supabase
- [ ] Revisão periódica de policies com `pg_policies` view
