
## Diagnóstico

O erro `GET https://uwjralsqmppgwemeymyw.supabase.co/auth/v1/user 403 (Forbidden)` acontece porque o frontend está apontando para um projeto Supabase **diferente** do backend real deste app.

Evidências encontradas no código e nos logs:

1. **Backend real do app (Lovable Cloud)** — projeto `rgikyyazotqapaxijwui.supabase.co`
   - É o projeto retornado por `project_info`.
   - É onde rodam todas as Edge Functions (`admin-user-management`, `delete-user`, `apf-generate`).
   - É onde estão configurados RLS, tabelas (`profiles`, `user_roles`, `teams`, etc.) e o provedor Google.
   - Os logs de auth mostram logins Google bem-sucedidos AGORA neste projeto (ex.: Roberto Sales, 14/05 16:34, `login_method: oidc, provider: google`).
   - É o `project_id` em `supabase/config.toml`.

2. **Frontend** — `src/integrations/supabase/client.ts` (linhas 6–7)
   - Aponta para `https://uwjralsqmppgwemeymyw.supabase.co` com a anon key desse outro projeto.
   - Esse projeto **não é** o Lovable Cloud deste app.

### Por que isso causa o loop "processa e volta para o login"

O fluxo de Google é:
1. Usuário clica em "Entrar com Google" → `lovable.auth.signInWithOAuth` redireciona para o broker do Lovable.
2. Broker autentica no projeto Cloud real (`rgikyyazotqapaxijwui`) e devolve `access_token`/`refresh_token` emitidos por **esse** projeto.
3. `AuthCallback` chama `supabase.auth.setSession({ access_token, refresh_token })`.
4. O cliente `supabase` foi configurado com a URL de **outro** projeto (`uwjralsqmppgwemeymyw`).
5. Toda chamada subsequente — `auth/v1/user`, `from('profiles')`, `from('user_roles')`, `from('teams')` — vai para `uwjralsqmppgwemeymyw` com um token assinado por `rgikyyazotqapaxijwui`.
6. O servidor rejeita com **403 Forbidden** (token de outra issuer/projeto).
7. `getSession`/`onAuthStateChange` perdem a sessão válida ou ela nunca persiste, e o `ProtectedRoute` devolve o usuário para `/auth`.

Isso também explica por que o erro aparece em `lovable.js` no console: é a chamada `auth/v1/user` que o cliente faz após o setSession.

### Por que a sugestão de "trocar o client.ts" não resolveu

A instrução anterior foi exatamente para fixar `uwjralsqmppgwemeymyw` no `client.ts` — esse é justamente o projeto **errado** para este app. Os tokens emitidos pelo Cloud (rgikyyazotqapaxijwui) nunca vão valer naquele endpoint.

---

## Pergunta antes de aplicar a correção

Existem dois cenários possíveis e preciso confirmar qual é o seu antes de mexer no código:

**Cenário A — você quer continuar usando o Lovable Cloud atual (recomendado)**
Os usuários, perfis, RLS, edge functions e configuração do Google já estão em `rgikyyazotqapaxijwui`. A correção é restaurar o `client.ts` para apontar para esse projeto. É o caminho rápido e mantém todos os dados existentes.

**Cenário B — você realmente migrou tudo para o projeto `uwjralsqmppgwemeymyw`**
Nesse caso, o problema não está no `client.ts`, e sim no fato de que o Lovable Cloud (broker OAuth, edge functions, etc.) continua ligado ao projeto antigo. Migrar de provedor Cloud é um trabalho diferente e não é resolvido editando o `client.ts`.

Qual dos dois é o seu caso?

---

## Plano de correção (assumindo Cenário A)

### O que vou alterar
- `src/integrations/supabase/client.ts`: trocar `SUPABASE_URL` e `SUPABASE_ANON_KEY` para os do projeto Cloud real:
  - URL: `https://rgikyyazotqapaxijwui.supabase.co`
  - Anon key: a chave anon válida do projeto (já disponível no system context).
- Manter o resto do arquivo igual (opções `auth` com `localStorage`, `persistSession`, `autoRefreshToken`).

### O que NÃO vou alterar
- `AuthContext.tsx`, `Auth.tsx`, `AuthCallback.tsx`, `App.tsx`, rotas, `lovable/index.ts` — todo o fluxo OAuth está correto.
- Edge functions, RLS, migrações.
- `vite.config.ts` (os defines `APP_SUPABASE_URL/KEY` não são usados pelo `client.ts` e não interferem).

### Validação após o fix
1. Recarregar `/auth`.
2. Clicar em "Entrar com Google".
3. Confirmar redirecionamento para `/auth/callback`, depois para `/dashboard-admin` ou módulo apropriado, sem loop.
4. Conferir no console que não há mais 403 em `auth/v1/user`.
5. Testar também login por email/senha, para garantir que perfis (`profiles`, `user_roles`, `teams`) carregam.

Me confirme o cenário (A ou B) e eu aplico a correção.
