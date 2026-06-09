## Diagnóstico

Ao alternar com ALT+TAB ou minimizar/restaurar a janela, o Supabase Auth dispara eventos de `onAuthStateChange` (tipicamente `TOKEN_REFRESHED` e/ou re-emissão de `SIGNED_IN`/`INITIAL_SESSION`) quando a aba reganha o foco e o cliente re-valida a sessão.

No `src/contexts/AuthContext.tsx` (linhas ~282–307) o callback trata **todos** os eventos da mesma forma:

1. Marca `setLoading(true)` para "evitar race nos guards de rota";
2. Chama `loadUserData(userId)` recarregando perfil, times, roles e module roles.

Enquanto `loading === true`, o `ProtectedRoute` renderiza `<PageLoader />`, **desmontando toda a árvore da rota atual**. Quando a carga termina, a árvore é re-montada — e qualquer estado local de formulário (inputs, drawers de HU, modais de demanda, etc.) é perdido. Para o usuário isso parece um "reload da tela".

O `useAppResilience` também invalida queries ativas no `visibilitychange`, o que agrava o efeito (refetches simultâneos), mas o gatilho do unmount é o `setLoading(true)` no AuthContext.

## Correção (mínima, só lógica)

### 1. `src/contexts/AuthContext.tsx`
Tornar o callback de `onAuthStateChange` idempotente para o mesmo usuário:

- Guardar o último `user.id` carregado em um `ref` (`loadedUserIdRef`).
- No callback:
  - Se `session?.user.id === loadedUserIdRef.current` → **não** chamar `setLoading(true)` nem `loadUserData`. Apenas atualizar `session`/`user` (necessário para token novo).
  - Se for outro usuário (login real) ou primeira carga → manter fluxo atual (`setLoading(true)` + `loadUserData`).
  - No logout (`!session`) → resetar `loadedUserIdRef` e seguir fluxo atual.
- Após `loadUserData` bem-sucedido, gravar `loadedUserIdRef.current = userId`.

Isso elimina o unmount/remount da árvore em `TOKEN_REFRESHED` e re-emissões de `SIGNED_IN` causadas por foco/visibilidade.

### 2. `src/hooks/useAppResilience.ts`
Suavizar a reação ao voltar do background para não disparar uma onda de refetches que também pode desmontar componentes via Suspense de queries:

- Ao voltar para `visible`, **não** invalidar queries ativas imediatamente. Apenas chamar `focusManager.setFocused(true)`; o React Query, com `refetchOnWindowFocus: false` (já definido em `queryClient.ts`), naturalmente não refaz fetch.
- Manter `cancelQueries()` ao ir para background (economia de rede inalterada).

## Escopo / não-escopo

- **Não** mexer em UI, estilos, layout, rotas, RLS, migrations, RPCs.
- **Não** alterar `useSessionTimeout` nem `useIdleTimeout` (timers de inatividade continuam funcionando — eles só resetam por **interação do usuário**, não por foco da janela).
- **Não** tocar em `selectedTeamId` / `moduleRoles`; o ref evita reload sem alterar dados persistidos.

## Validação

1. Abrir uma demanda/HU, digitar texto num campo, **ALT+TAB para outro app e voltar** → o texto deve permanecer e a tela **não** deve piscar `PageLoader`.
2. Minimizar a janela do Chrome e restaurar → idem.
3. Login normal (de fato sair e entrar com outro usuário) → fluxo de carga completo continua acontecendo.
4. Token refresh em segundo plano (após ~1h de sessão) → sem flash de loader.
5. Logout funciona normalmente e redireciona para `/auth`.
