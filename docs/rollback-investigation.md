# Rollback Investigation & Technical Notes

## Status: fila_concluida — Introdução (2026-06-08)

### Contexto

Em **08/06/2026**, foi introduzido o novo status `fila_concluida` (label: **"Concluída"**) no sistema Axion/SprintFlow.
Esta nota documenta o impacto no histórico de transições e os cuidados necessários para rollback.

### O que mudou

| Camada | Arquivo | Alteração |
|---|---|---|
| Banco de dados | `20260608000000_add_fila_concluida_to_validators.sql` | `validate_demanda_transition` atualizada para aceitar `fila_concluida` |
| Tipos TS | `src/features/sustentacao/types/demanda.ts` | `fila_concluida` adicionado em `ALL_SITUACOES`, `FLOW_PRINCIPAL`, `SITUACAO_LABELS`, `SITUACAO_COLORS`, `TERMINAL_STATUSES` |
| Workflow | `src/features/sustentacao/hooks/useWorkflowSteps.ts` | Passo `fila_concluida` adicionado na ordem 11 |
| Mutations | `src/features/sustentacao/hooks/useDemandaMutations.ts` | Transition para `fila_concluida` registra `aceite_data` automaticamente |
| Importação | `src/features/sustentacao/components/ImportacaoView.tsx` | Suporte a `.xlsx` via SheetJS + mapeamento de "Concluída" → `fila_concluida` |
| UI Preview | `src/features/sustentacao/components/ImportacaoPreviewTable.tsx` | Badge verde para status `fila_concluida` |

### Impacto no histórico de transições

- A trigger `validate_demanda_transition` grava em `demanda_transitions` a cada mudança de status.
- Demandas movidas para `fila_concluida` terão `to_status = 'fila_concluida'` no histórico.
- O campo `aceite_data` é preenchido automaticamente na mutation para este status.

### Procedimento de Rollback

Caso seja necessário reverter:

1. **Banco**: Execute a migration anterior que não continha `fila_concluida` no array `valid_statuses`, ou adicione uma nova migration que recrie a função sem o novo status.
2. **Dados**: Demandas que já estiverem em `fila_concluida` precisarão ser migradas manualmente para `ag_aceite_final` ou `cancelada`.
3. **Frontend**: Reverter o commit desta branch ou remover `fila_concluida` de `ALL_SITUACOES` e `SITUACAO_LABELS`.
4. **Cache**: Forçar `invalidateQueries` com a chave `demandas` após o rollback.

> ⚠️ **Atenção**: Não remova a migration `20260608000000` diretamente. Crie sempre uma nova migration de rollback para manter o histórico de schema auditável.
