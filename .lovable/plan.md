## Branch
`fix/responsaveis-search-by-contract`

## Diagnóstico

A busca de responsáveis está escopada por **time** (`team_members` filtrado pelo `team_id` da demanda). Quando o contrato tem múltiplos times (ex.: TIME 1, TIME 2, TIME 3 do mesmo contrato), só aparecem usuários do mesmo time da demanda — usuários de times "irmãos" no contrato ficam invisíveis. O escopo correto é **contrato**: qualquer pessoa que faça parte do contrato deve ser localizável como responsável, independentemente do time.

Arquivos envolvidos:
- `src/features/sustentacao/services/responsaveis.service.ts` — `searchProfiles(query, teamId)`
- `src/features/sustentacao/services/profiles.service.ts` — `searchProfilesByName(query, limit, teamId)`
- `src/features/sustentacao/components/DemandaDetail.tsx` (linha 621-625) — passa `demanda.team_id`
- `src/features/sustentacao/components/DemandaForm.tsx` — idem
- Tabelas: `demandas.contract_id`, `contract_room_teams (contract_id, team_id)`, `contract_members (contract_id, user_id)`, `team_members`, `profiles`

## Solução

Mudar o escopo de busca de **time** para **contrato**, preservando fallback por time quando a demanda não tem `contract_id`.

### 1. `responsaveis.service.ts` — nova assinatura

```ts
searchProfiles(query, opts: { contractId?: string|null; teamId?: string|null })
```

Algoritmo:
1. Se `contractId`: coletar `user_id`s de DUAS fontes em paralelo
   - `contract_room_teams.team_id WHERE contract_id = X AND is_active = true` → `team_members.user_id`
   - `contract_members.user_id WHERE contract_id = X`
   Unir (Set) os user_ids.
2. Senão, se `teamId`: manter o fluxo atual (`team_members` do time).
3. Filtrar `profiles` por `.in(user_id, ids) + is_active + ilike(display_name|email)` limit 10.

Manter compatibilidade: aceitar a chamada antiga `searchProfiles(q, teamId)` (string como 2º arg) com type-guard.

### 2. `profiles.service.ts` — `searchProfilesByName`

Mesma extensão: aceitar `{ contractId, teamId }`. Mesma lógica de união (room_teams + contract_members).

### 3. Call sites

**`DemandaDetail.tsx` (`handleSearch`)**
```ts
const contractId = (demanda as any)?.contract_id ?? null;
const teamId     = (demanda as any)?.team_id ?? currentTeamId;
const results    = await respSvc.searchProfiles(q, { contractId, teamId });
```

**`DemandaForm.tsx` (`searchDemandante`)**
- Em edição: passar `contractId = demanda.contract_id`, `teamId = demanda.team_id ?? currentTeamId`.
- Em criação: usar o `contractId`/`teamId` já selecionados no form (mesma fonte que popula o select de time).

### 4. Sem mudanças

- Sem migração SQL. RLS de `contract_room_teams`, `contract_members`, `team_members` e `profiles` já permite leitura aos membros autenticados/admins.
- Sem alteração nos hooks de relatórios (correções anteriores permanecem).

## Validação

1. Admin / gestor abre demanda do CONTRATO X (time A) → busca "tiago" → retorna usuários do time A, B e C do mesmo contrato.
2. Usuário comum em time B do contrato X → busca de responsáveis de demanda do time A do mesmo contrato funciona.
3. Demanda sem `contract_id` (legado) → fallback por `team_id` continua funcionando.
4. Busca não vaza usuários de OUTROS contratos.

## Notas técnicas

- Dedup por `user_id` via `Set` antes do `.in()`.
- Limite de 10 mantido após o filtro `ilike` no `profiles`.
- Sanitização do termo (`replace /[,()]/g`) preservada.
