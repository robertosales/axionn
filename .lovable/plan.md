## Problema

Ao clicar em "Contar PF" para a HU-028, aparece:

> Projeto 178baae3-8343-485b-be9b-9d6f53d7d451 não encontrado ou sem contrato vinculado

Esse UUID é do **time** `[NEXO] - TIME A - B`, não de um projeto. O bug está em `ApfFunctionPointTab.tsx` (linha 172):

```ts
supabase.rpc("open_counting_session", {
  p_project_id: teamId,   // ❌ passando time como se fosse projeto
  ...
})
```

A RPC procura em `public.projects` e não encontra nada. Mesmo se passasse um projeto, a tabela `user_stories` não tem `project_id` — a HU está ligada a `team_id` e (opcionalmente) `contract_id`. Hoje a HU-028 está com `contract_id = NULL` e o time não tem registro em `contract_teams`, então não há como inferir o contrato automaticamente.

Existe apenas **1 modelo APF ativo** (contrato `d59ab6dc...`).

## Plano

### 1. Tornar a RPC `open_counting_session` baseada em contrato, não em projeto

Migration alterando a função para aceitar `p_contract_id` diretamente (e tornar `p_project_id` opcional, apenas para metadados):

```sql
CREATE OR REPLACE FUNCTION public.open_counting_session(
  p_contract_id  UUID,
  p_project_id   UUID DEFAULT NULL,
  p_sprint_ref   TEXT DEFAULT NULL,
  p_release_ref  TEXT DEFAULT NULL,
  p_redmine_ref  TEXT DEFAULT NULL,
  p_baseline_id  UUID DEFAULT NULL
) RETURNS UUID ...
```

Resolução do `model_id` passa a ser direta pelo `contract_id`. Se `p_contract_id` for nulo, tenta resolver via `projects.contract_id`. Mantém GRANT EXECUTE para `authenticated`.

A versão antiga (assinatura atual) é mantida como wrapper para não quebrar nada que ainda use a chamada antiga.

### 2. Ajustar `ApfFunctionPointTab.tsx` para resolver o contrato corretamente

Ordem de resolução do `contractId` no front-end:
1. `hu.contract_id` (se a HU já tiver contrato);
2. contrato do time via `contract_teams` (quando existir);
3. fallback: contrato do único `apf_counting_models` ativo associado ao time/módulo.

Se nenhum contrato for resolvido, mostrar toast claro:
> "Esta HU não está vinculada a um contrato. Edite a HU/time e selecione o contrato APF antes de contar PF."

Passar `p_contract_id` (e não mais `teamId` como projeto) para `open_counting_session`.

### 3. Sem mudanças de schema em `user_stories`

A coluna `contract_id` já existe — só precisa ser populada ao criar HU. (Fora do escopo deste fix, mas vou registrar como follow-up.)

## Verificação

- Recarregar a aba APF, clicar "Contar PF" em HU-028 e confirmar que a sessão abre sem erro de "projeto não encontrado".
- Confirmar que HUs com `contract_id` preenchido também funcionam.
- Toast amigável quando não houver contrato resolvível.

## Detalhes técnicos

- Arquivos: `src/features/apf/components/ApfFunctionPointTab.tsx` + nova migration alterando `open_counting_session`.
- Sem alteração em `save_counting_items` (já recebe `session_id`).
- Sem deleção de colunas/tabelas.