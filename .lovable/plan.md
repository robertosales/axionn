## Causa raiz

`addUserStory` em `src/contexts/SprintContext.tsx` (l. 600–623) faz `INSERT` em `user_stories` e **não atualiza o estado local**. A atualização depende 100% do canal Realtime (`sprint-team-${teamId}` → handler INSERT, l. 323-336), que faz append otimista.

Quando o canal Realtime está em `CHANNEL_ERROR` (já observado no console: `canal sprint-team-… com problema (CHANNEL_ERROR)`), o evento INSERT nunca chega ao cliente e a HU só aparece após F5 (que recarrega via `refreshAll`). O mesmo padrão existe para `addActivity`, `addSprint`, etc. — todos dependem só de Realtime após o insert.

Adicionalmente, o insert atual não usa `.select()`, então nem temos a linha gravada disponível para fazer fallback local.

## Correção

### 1. `src/contexts/SprintContext.tsx` — `addUserStory`
- Trocar `.insert({...})` por `.insert({...}).select().single()`.
- Após sucesso, fazer append idempotente em `setUserStories` usando `mapUserStory(data, [])` (mesma função que o handler Realtime usa). O handler Realtime continua existindo e já é idempotente (`if (prev.some(h => h.id === row.id)) return prev;`), então não há risco de duplicata.
- Disparar `toast.success("HU criada")` para feedback consistente.

Resultado: a HU aparece imediatamente mesmo com Realtime caído; quando o canal volta, o evento INSERT é ignorado pelo guard de duplicata.

### 2. Mesmo padrão de fallback para outros `add*` que dependem só de Realtime
Aplicar a mesma técnica (`.select().single()` + append local idempotente) nos mutators do `SprintContext` que hoje não atualizam estado local após insert:
- `addActivity`
- `addSprint`
- `addEpic`
- `addImpediment`

`addDeveloper` já faz o append local — manter como está.

### 3. Robustez do Realtime (defensivo, não-bloqueante)
No `subscribe()` do canal `sprint-team-${teamId}`, ao detectar `CHANNEL_ERROR` mais de N vezes, chamar `refreshAll()` uma vez como rede de segurança. Já existe lógica de reconexão na l. 541 — apenas adicionar um `refreshAll()` após reconectar com sucesso (status `SUBSCRIBED` após erro prévio) para sincronizar mudanças perdidas durante o downtime.

## Escopo de verificação em outras telas

- **Sustentação (`demandas`)**: usa React Query + canal Realtime via `useDemandasRealtime`. Já invalida cache no INSERT. Sem alteração.
- **Admin / Teams / Users**: usam `reload()` explícito após mutação (ver `useTeamsAdmin.create`). Sem alteração.
- **Releases**: já chama `await load()` após insert. Sem alteração.
- **Retro / Planning**: salas colaborativas, dependência intencional de Realtime. Sem alteração.

## Não fazer

- Não trocar `SprintContext` por React Query (mudança grande, fora do escopo do bug).
- Não mexer em RLS/SQL: `ALTER PUBLICATION supabase_realtime ADD TABLE user_stories` já está aplicado (o handler Realtime funciona quando o canal está saudável).
- Não alterar `useDemandasRealtime`, `useKanbanBoard`, ou hooks do módulo Sustentação.

## Arquivos tocados

- `src/contexts/SprintContext.tsx` (único arquivo).
