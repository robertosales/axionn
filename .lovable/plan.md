# Correção: usuário volta para a tela de "Troca de senha obrigatória" após login

## Diagnóstico (pente fino executado)

Consultei o banco para o usuário afetado (`rejane.rocha@globalweb.com.br`):

```
must_change_password = true
updated_at           = 18:40   ← ANTES da troca de senha (18:45)
```

E os auth-logs mostram:
- `18:45` — `PUT /auth/v1/user` → `200` (senha trocada com sucesso no GoTrue)
- `18:48` — `PUT /user` → `403 session_not_found` (sessão antiga já invalidada)
- `18:48` — `POST /logout` → `403 session_not_found`
- `18:49` — novo login

**Conclusão:** a senha É trocada no Auth, mas o `UPDATE profiles SET must_change_password=false` **nunca chega no banco** — por isso, no próximo login, o `App.tsx` (`if (profile?.must_change_password) renderiza ForcePasswordChange`) joga o usuário de volta para a mesma tela.

### Por que o UPDATE em `profiles` falha silenciosamente

1. Hoje o fluxo em `ForcePasswordChange.handleSubmit` é: **(a)** `PUT /auth/v1/user` → **(b)** `supabase.from("profiles").update(...)`.
2. Imediatamente após o `PUT /user`, o GoTrue invalida todas as sessões existentes do usuário (comportamento padrão do Supabase ao trocar senha).
3. Entre (a) e (b), o `auto-refresh` interno do supabase-js tenta renovar o token, recebe `session_not_found`, e **zera a sessão local**.
4. O `UPDATE profiles` segue **sem JWT**, `auth.uid()` vira `NULL`, a policy `profiles_update_own (user_id = auth.uid())` bloqueia, e o PostgREST retorna **0 linhas afetadas mas sem erro** (comportamento padrão de RLS em UPDATE). O `if (profErr)` não dispara, o código segue para a tela de sucesso, mas a flag continua `true` no banco.

## Solução

### 1. `src/pages/ForcePasswordChange.tsx` — inverter a ordem das operações

Fazer a baixa da flag **ANTES** da troca de senha, enquanto a sessão ainda é 100% válida; só depois disparar o `PUT /auth/v1/user`; em caso de falha do PUT, reverter a flag para manter o estado consistente.

Novo fluxo do `handleSubmit`:

```text
1. Validações de campo (≥6 chars, confirmação)
2. UPDATE profiles SET must_change_password=false WHERE user_id=uid
   .select("user_id")   ← detecta RLS-deny (0 linhas) e aborta com erro claro
   se falhar/0 linhas → toast "Sessão expirada, faça login novamente" + signOut
3. PUT /auth/v1/user (fetch direto, sem lock — já implementado)
   se falhar → ROLLBACK: UPDATE profiles SET must_change_password=true
                          + toast com a razão (same_password, weak, etc.)
4. Sucesso → tela de diagnóstico (mantida) → signOut em 5s
```

### 2. Manter intactos

- `instrumentedFetch` em `src/integrations/supabase/client.ts` (bypass de retry/circuit-breaker e contador `__authUserCallCount` para `/auth/v1/user`).
- `lockAcquireTimeout: 30_000`.
- `AuthContext.onAuthStateChange` com `setTimeout(0)` (evita segurar o lock).
- Tela de sucesso com diagnóstico de chamadas.

### 3. Sobre "erros de tipagem antigos em AgileHistory"

Rodei `npx tsc --noEmit` agora e a build TypeScript está **limpa** (exit 0, zero erros). Não há erro real em `AgileHistory.tsx` no código atual — eram resíduos da validação automática de mensagens anteriores. Não vou tocar no componente. Se voltar a aparecer após este patch, me mande o texto exato do erro para eu corrigir cirurgicamente, sem mexer fora do escopo.

## Detalhes técnicos

**Arquivo único a editar:** `src/pages/ForcePasswordChange.tsx`

**Trecho-chave (rollback)** quando o `PUT /auth/v1/user` falhar após a flag já ter sido zerada:

```ts
await supabase.from("profiles")
  .update({ must_change_password: true })
  .eq("user_id", uid);
```

**Detecção de RLS-deny** no UPDATE inicial:

```ts
const { data, error } = await supabase
  .from("profiles")
  .update({ must_change_password: false })
  .eq("user_id", user.id)
  .select("user_id");
if (error || !data || data.length === 0) {
  // sessão expirada / sem permissão → forçar relogin
}
```

**Não haverá mudanças em:** `AuthContext`, `client.ts`, `App.tsx`, RLS, migrations, ou qualquer outra tela.

## Resultado esperado

- 1 única chamada `PUT /auth/v1/user` por troca (contador permanece em **1**).
- `profiles.must_change_password` efetivamente persistido como `false`.
- Próximo login leva direto ao dashboard, sem reaparecer a tela de troca obrigatória.
- Em caso de falha do GoTrue (senha igual, fraca, etc.), a flag é restaurada — sem deixar o perfil em estado inconsistente.
