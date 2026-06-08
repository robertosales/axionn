## Causa raiz

A importação mostra "155 erros / 0 atualizados" porque a tabela `demandas` tem uma CHECK constraint antiga (`demandas_situacao_check`) que **não inclui o status `fila_concluida`**. O export do Redmine traz muitas linhas "Concluída" → normalizadas para `fila_concluida` → toda tentativa de UPDATE/INSERT viola o CHECK. A RPC `upsert_demandas_batch` engole o erro num `EXCEPTION WHEN OTHERS`, conta como erro e segue, sem reportar o motivo.

Hoje em produção há 0 demandas com `fila_concluida` (justamente porque o CHECK bloqueia), mas o trigger `validate_demanda_transition`, o front (`ALL_SITUACOES`) e o normalizador da importação já tratam esse status como válido — só faltou alinhar a constraint.

## Mudanças

### 1. Migration

- `ALTER TABLE public.demandas DROP CONSTRAINT demandas_situacao_check` e recriar incluindo `'fila_concluida'`, mantendo todos os demais status atuais.
- `CREATE OR REPLACE FUNCTION public.upsert_demandas_batch` adicionando coleta de `SQLERRM` por linha que falhar e retornando, além de `importados/atualizados/erros`, uma chave `falhas` (jsonb array com `rhm`, `projeto`, `motivo`). Assinatura `(p_team_id uuid, p_rows jsonb) RETURNS jsonb` preservada.

### 2. Frontend

- `src/features/sustentacao/services/demandas.service.ts`: estender o tipo de retorno de `upsertDemandas` para incluir `falhas?: { rhm: string; projeto: string; motivo: string }[]`.
- `src/features/sustentacao/components/ImportacaoView.tsx`: em `handleImport`, mesclar `res.falhas` no array `falhas` local antes do `setResult`. O painel de erros já existe e passará a exibir o motivo real por linha.

### 3. Validação

- Reimportar a planilha do print: esperado ~155 atualizados, 0 erros.
- Caso restem erros, o painel "Erros" mostrará RHM + projeto + motivo (ex.: violação de check, mismatch de projeto, etc.) para diagnóstico imediato.

## Garantias

- Nenhuma coluna/tabela é removida.
- Assinatura da RPC preservada — chamadas existentes continuam funcionando.
- Mudança escopada à importação da Sustentação (módulo Azul); não afeta Sala Ágil.
