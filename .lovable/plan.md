# Correção do redirecionamento de módulo no login

## Diagnóstico

Verifiquei o cadastro da Rejane no banco:

- `profiles.module_access = 'sustentacao'`
- `user_module_roles = [sustentacao:qa]`
- `team_members`: 3 times, todos do módulo `sustentacao`
- Nenhum vínculo com `sala_agil`

Ou seja, o cadastro está **correto**. O problema é de código.

### Causa raiz (race condition no AuthContext)

Em `src/contexts/AuthContext.tsx`, dentro de `onAuthStateChange` (linhas 282-303), quando o usuário faz login:

1. `setSession(session)` é chamado imediatamente.
2. `loadUserData` (que busca `profile`, `user_roles` e `user_module_roles`) é disparado em `setTimeout(..., 0)` **sem reativar `loading=true`**.
3. Como `loading` já é `false` desde o `getSession` inicial, o `AuthRoute` em `App.tsx` re-renderiza com `session` presente mas `moduleRoles` **ainda vazio** (estado do usuário anterior ou inicial).
4. `hasModuleAccess("sustentacao")` retorna `false` → cai no `return <Navigate to="/sala-agil/dashboard" replace />` (fallback final).

A mesma lógica de fallback aparece em três lugares (`AuthRoute`, `ModuleRedirect`, raiz `/`), todos defaultando para `sala-agil`, o que mascara o bug para qualquer usuário cujo carregamento de `moduleRoles` chegue depois do primeiro redirect.

## Mudanças

### 1. `src/contexts/AuthContext.tsx` — eliminar a race

No callback de `onAuthStateChange`, quando há sessão nova (login):
- Chamar `setLoading(true)` **antes** de disparar `loadUserData`.
- Manter `loadUserData` em `setTimeout(..., 0)` para não segurar o lock do GoTrue.
- Garantir `setLoading(false)` no `.finally()` (já existe).

Isso faz com que `AuthRoute`/`ProtectedRoute` exibam o `PageLoader` até `moduleRoles` estar populado, evitando redirect com estado parcial.

### 2. `src/App.tsx` — fallback seguro baseado em `profile.module_access`

Substituir o fallback `Navigate to="/sala-agil/dashboard"` em `AuthRoute` e `ModuleRedirect` por uma função `resolveHome(profile, hasModuleAccess, isAdmin)` com a seguinte prioridade:

1. `isAdmin || module_access === 'admin'` → `/dashboard-admin`
2. Se `hasModuleAccess('sustentacao')` e não tem `sala_agil` → `/sustentacao`
3. Se `hasModuleAccess('sala_agil')` e não tem `sustentacao` → `/sala-agil/dashboard`
4. Se `hasModuleAccess('rdm')` exclusivo → `/rdm`
5. Se tem **mais de um** módulo → `/modulos` (selector)
6. Se `moduleRoles` vazio mas `profile.module_access` definido → usar `module_access` como autoridade (mesma lógica acima)
7. Último recurso (sem profile e sem moduleRoles) → `/modulos`

Isso remove o viés de "default = sala_agil" que mascarava o problema para todos os usuários, não só a Rejane.

### 3. Validação

- Login da Rejane (`module_access=sustentacao`) → deve ir para `/sustentacao`.
- Login de admin → `/dashboard-admin`.
- Usuário com sala_agil + sustentacao → `/modulos`.
- Usuário só sala_agil → `/sala-agil/dashboard`.
- Verificar console: não deve haver redirect intermediário para `/sala-agil` antes do destino correto.

## Fora de escopo

- Não altero schema nem dados de usuários.
- Não mexo na lógica de troca de senha obrigatória nem na importação de demandas.
