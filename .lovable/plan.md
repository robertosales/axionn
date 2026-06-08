## Objetivo

Tratar a planilha como **fonte oficial da situação** da demanda na importação: deixar visualmente claro qual é a situação atual e qual será a situação final, e bloquear situações inexistentes no cadastro com mensagem de validação.

A escrita no banco já é feita corretamente pela RPC `upsert_demandas_batch` (a coluna `situacao` é sobrescrita com o valor da planilha em todo update). O trabalho é em validação e UI.

---

## Mudanças

### 1. `ImportacaoView.tsx` — normalização e validação da situação

**Mapa de situações (`SITUACAO_MAP`)**
- Adicionar entradas faltantes para cobrir todas as situações do cadastro, especialmente:
  - `"concluida"` / `"concluída"` / `"fila concluida"` / `"fila concluída"` → `fila_concluida`
  - `"rejeitada"` (já existe na chave canônica, garantir variações)
  - `"cancelada"` / `"cancelado"` → `cancelada`
  - `"bloqueada"` / `"bloqueado"` → `bloqueada`

**`normalizeSituacao(raw)`**
- Trocar assinatura para `normalizeSituacao(raw): string | null`.
- Retornar `null` quando o valor limpo não existir em `SITUACAO_MAP` (em vez do fallback silencioso para `fila_atendimento`).

**Loop de parsing em `handleFileDemandas`**
- Após calcular `situacao`, se for `null` adicionar erro de validação:
  - `errs.push({ linha, mensagem: "Situação '<valor original>' não reconhecida. Use uma situação válida do cadastro." });` e `return;`
- A linha não entra em `parsed` e portanto fica fora da migração.

### 2. `ImportacaoPreviewTable.tsx` — colunas mais intuitivas

**Coluna "Diferença" → renomear para "Resultado da Migração"**
- Para `tipoAcao === "atualizacao"`:
  - Renderizar duas linhas/badges empilhadas e legendadas:
    - `Atual: <label situacaoSistema>` (badge cinza)
    - `Final: <label situacao da planilha>` (badge âmbar destacada, com seta `→` antes)
  - Texto auxiliar abaixo: `"A situação do sistema será substituída pela situação da planilha."`
- Para `tipoAcao === "novo"`:
  - `Será criado com situação: <label da planilha>` (badge verde).
- Para `tipoAcao === "sem_alteracao"`:
  - `Situação mantida: <label>` (muted).

**Coluna "Ação"**
- Renomear badge de `"Atualização"` para `"Atualizar situação"` para reforçar a intenção.
- Tooltip/legenda no rodapé da tabela: `"A planilha é a fonte oficial. Em caso de divergência, a situação atual do sistema é sobrescrita pela situação da planilha."`

**Legenda existente (barra laranja)**
- Atualizar texto para: `"Linhas destacadas terão a situação do sistema substituída pela situação da planilha."`

### 3. Garantia de escrita

Nenhuma mudança no backend é necessária: `upsertDemandas` → `upsert_demandas_batch` já faz `situacao = v_row->>'situacao'` no `UPDATE` (linha 41 da migration `20260520080000_rpc_upsert_demandas_batch.sql`). Apenas confirmar no comentário do `handleImport` que `row.situacao` é enviado como veio da planilha (já é).

---

## Arquivos alterados

- `src/features/sustentacao/components/ImportacaoView.tsx`
  - Expandir `SITUACAO_MAP` (incluir `fila_concluida` e variações).
  - `normalizeSituacao` passa a retornar `string | null`.
  - Validação no loop bloqueia linhas com situação desconhecida.
- `src/features/sustentacao/components/ImportacaoPreviewTable.tsx`
  - Renomear coluna `"Diferença"` → `"Resultado da Migração"`.
  - Renderização nova: "Atual: X → Final: Y" com labels amigáveis.
  - Label do badge da ação `"Atualização"` → `"Atualizar situação"`.
  - Texto da legenda e nota no rodapé reforçando que a planilha é fonte oficial.

Sem alterações em backend, RPC, hooks, serviços ou tipos.