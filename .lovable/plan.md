# Correções no módulo Sustentação

## 1. Busca de Responsável apenas dentro do time ativo
Hoje a busca consulta a tabela `profiles` inteira (todos os usuários do sistema). Vamos restringir aos membros do time ativo.

- Em `src/features/sustentacao/services/profiles.service.ts` → `searchProfilesByName`: aceitar um parâmetro `teamId` e fazer JOIN com `team_members` (filtrando `team_id = :teamId`).
- Em `src/features/sustentacao/services/responsaveis.service.ts` → `searchProfiles`: idem (parâmetro `teamId` obrigatório).
- Callers atualizados para passar `currentTeamId` do `AuthContext`:
  - `src/features/sustentacao/components/DemandaForm.tsx` (linha 174)
  - `src/features/sustentacao/components/DemandaDetail.tsx` (linha 598)
- Se `teamId` for nulo (sem time ativo), retornar lista vazia.

## 2. Board Kanban — projetos duplicados / fora do time
Causa: o dropdown faz `set.add(d.projeto)` em string crua, então "DEMANDAS AVULSAS GLOBALWEB" e "Demandas Avulsas Globalweb" entram como entradas distintas.

- Em `src/features/sustentacao/components/SustentacaoBoard.tsx` (`projetosDisponiveis`, linha 595): deduplicar por chave normalizada (`trim().toLowerCase()`), preservando uma forma canônica de exibição (a primeira ocorrência ordenada alfabeticamente). O filtro `selectedProjetos` em `filtered` (linha 628) também passa a comparar normalizado.
- Como o board já é carregado via `get_demandas_with_responsaveis(p_team_id)`, os projetos exibidos já são do time ativo. Vou confirmar lendo o hook `useDemandasWithResponsaveis` para garantir que `p_team_id = currentTeamId` (sem fallback para outros times).

## 3. Excluir do banco a demanda de teste
Demanda encontrada: `rhm = '0123456789'`, título "TESTE DEMANDAS", projeto "Demandas Avulsas Globalweb" (id `64b0d98c-c837-46c5-a543-c81180ef0606`). Nenhum registro com título "TESTE DEMANDAS 1" existe atualmente.

- Apagar a demanda e suas dependências (eventos, evidências, horas, responsáveis, transitions, fases) em uma operação única via `supabase--insert` (DELETE).

## 4. Isolamento entre times
Validar que cada time veja apenas suas demandas:

- O carregamento do board e da lista já usa `get_demandas_with_responsaveis(currentTeamId)`, que filtra `demandas.team_id = p_team_id`. Vou conferir os hooks `useDemandasPaginadas` e `useDemandasWithResponsaveis` para garantir que **nenhum** caminho carregue sem `teamId` (ou faça fallback global). Se houver, adicionar guarda `if (!teamId) return []`.
- Não há alteração de RLS — as policies de `demandas` já restringem por `team_members`.

## Detalhes Técnicos

```text
profiles.service.ts
  searchProfilesByName(query, limit, teamId)
    .from('team_members')
    .select('user_id, profiles!inner(id, user_id, display_name)')
    .eq('team_id', teamId)
    .ilike('profiles.display_name', `%${q}%`)
    .eq('profiles.is_active', true)
    .limit(limit)
```

```text
SustentacaoBoard.tsx
  projetosDisponiveis:
    Map<normalized, displayLabel>  →  Array sorted by displayLabel
  filter:
    selectedSet = new Set(selectedProjetos.map(normalize))
    items.filter(d => selectedSet.has(normalize(d.projeto)))
```

```text
DELETE (via supabase--insert):
  DELETE FROM demanda_eventos       WHERE demanda_id = '64b0d98c-...';
  DELETE FROM demanda_evidencias    WHERE demanda_id = '64b0d98c-...';
  DELETE FROM demanda_hours         WHERE demanda_id = '64b0d98c-...';
  DELETE FROM demanda_responsaveis  WHERE demanda_id = '64b0d98c-...';
  DELETE FROM demanda_transitions   WHERE demanda_id = '64b0d98c-...';
  DELETE FROM demanda_fases         WHERE demanda_id = '64b0d98c-...';
  DELETE FROM demandas              WHERE id = '64b0d98c-...';
```

## Validação
- `/sustentacao` → abrir filtro "Projetos": "DEMANDAS AVULSAS GLOBALWEB" aparece **uma única vez**.
- Demanda RHM `0123456789` "TESTE DEMANDAS" não aparece em nenhum time.
- Em "Nova Demanda" e "Detalhes → Responsáveis", a busca retorna **apenas** membros do time ativo.
- Trocar de time recarrega o board com somente as demandas daquele time.
