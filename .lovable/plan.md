## Diagnóstico

O commit `5f613c3 — feat: add fila_concluida status + xlsx import support` reescreveu drasticamente o módulo de Importação Excel:

- `ImportacaoView.tsx` caiu de **631 → ~190 linhas**, perdendo o **hub com 2 cards** (Demandas Redmine + Projetos de Sustentação), as telas de detalhe com badges de campos obrigatórios/opcionais, validação por linha, dedupe de RHM, criação automática de projetos, cálculo de prazos IMR, parsing de datas e gravação em lote.
- `ImportacaoPreviewTable.tsx` virou uma tabela genérica sem `RowStatus` (erro/ok/duplicado) e sem totais.
- O `fila_concluida` foi adicionado em `types/demanda.ts` e `useWorkflowSteps.ts` como **terminal**, mas **não foi propagado** para os pontos onde as outras filas vivem:
  - `SustentacaoBoard.tsx` → `FLOWPRINCIPAL` (linhas 89-99) **não contém** `fila_concluida` → coluna nunca renderiza no kanban padrão.
  - `COLUMN_COLORS` (linha 101) sem cor para `fila_concluida` → coluna fica sem identidade visual quando custom workflow é usado.
  - `TERMINAL_STATUSES` em `types/demanda.ts` inclui `fila_concluida` → bloqueia transições/edições como se fosse `cancelada`.

## Plano de Correção

### 1. Restaurar Importação Excel (hub + .csv + .xlsx)

- **Restaurar** `src/features/sustentacao/components/ImportacaoView.tsx` e `ImportacaoPreviewTable.tsx` na versão do commit `5f613c3^` (anterior à regressão), preservando:
  - Hub inicial com cards "Demandas (Redmine)" e "Projetos de Sustentação".
  - Tela "Importar Demandas (Redmine)" com badges Obrigatórias (`#`, `Projeto`, `Tipo`, `Criado em`) e Opcionais (`Título`, `Situação`, `Regime de Atendimento`, `Defeito Impeditivo`).
  - Tela "Importar Projetos" com colunas (`Nome`, `Descrição`, `Equipe`, `SLA`) e aviso de duplicados.
  - Validação linha-a-linha com status (`ok` / `erro` / `duplicado`), totais e botão "Importar válidos".
  - Normalização de SITUAÇÃO, TIPO IMR, SLA e datas; auto-criação de projetos; bloqueio de datas retroativas; criação automática de novos tipos de demanda via import (regras já memorizadas).
- **Estender** o parser para aceitar **`.xlsx` além de `.csv`**:
  - Detectar extensão/MIME do arquivo selecionado.
  - Para `.xlsx`, carregar **SheetJS via CDN** em runtime (`https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js`) — sem `npm install`, padrão já validado na versão atual.
  - Converter a primeira worksheet para `Record<string, unknown>[]` e reaproveitar o mesmo pipeline de validação do `.csv`.
  - Atualizar copy do upload: "Arraste o arquivo aqui ou clique para selecionar (`.csv` ou `.xlsx`)" e atualizar `accept` do `<input>`.
- Manter `useDemandas.ts`, `useDemandaMutations.ts` e `useWorkflowSteps.ts` como estão hoje (já corrigidos em loops anteriores). Não restaurar versões antigas desses hooks.

### 2. Fazer `fila_concluida` funcionar como uma fila normal

- `src/features/sustentacao/components/SustentacaoBoard.tsx`:
  - Adicionar `"fila_concluida"` em `FLOWPRINCIPAL` logo após `"ag_aceite_final"`.
  - Adicionar entrada em `COLUMN_COLORS`: `fila_concluida: { hex: "#22c55e" }` (verde, alinhado ao `SITUACAO_COLORS` existente).
- `src/features/sustentacao/types/demanda.ts`:
  - **Remover** `"fila_concluida"` de `TERMINAL_STATUSES` (manter apenas `ag_aceite_final` e `cancelada`) para que a coluna aceite edições, drag-and-drop e movimentação como qualquer outra fila.
  - Manter o helper `isDemandaConcluida` e a entrada em `SITUACAO_LABELS` / `SITUACAO_COLORS` / `ALL_SITUACOES` / `FLOW_PRINCIPAL`.
- `src/features/sustentacao/hooks/useWorkflowSteps.ts`:
  - Remover `"fila_concluida"` de `TERMINAL_STEPS` (continua como step ordinário ordem 11).
- Validar que a migration `20260608000000_add_fila_concluida_to_validators.sql` (já aplicada) cobre as transições no banco — nenhuma nova migration necessária.

### 3. Verificação

- Build sem erros (TS + Vite).
- Em `/sustentacao` → menu **Importação Excel**: hub aparece com os 2 cards; cada card abre a tela própria e aceita `.csv` e `.xlsx`.
- Em **Board Kanban**: coluna **Concluída** renderiza após **Ag. Aceite Final** com cor verde, recebe drag-and-drop e permite mover demandas para fora.
- Criação/edição de demanda via formulário consegue selecionar `Concluída` sem erro 23514 (validador de status).

## Arquivos a alterar

- `src/features/sustentacao/components/ImportacaoView.tsx` (restaurar + xlsx)
- `src/features/sustentacao/components/ImportacaoPreviewTable.tsx` (restaurar)
- `src/features/sustentacao/components/SustentacaoBoard.tsx` (FLOWPRINCIPAL + COLUMN_COLORS)
- `src/features/sustentacao/types/demanda.ts` (TERMINAL_STATUSES)
- `src/features/sustentacao/hooks/useWorkflowSteps.ts` (TERMINAL_STEPS)
