## Objetivo

Na aba **Atividades** do detalhe da demanda (`DemandaDetail.tsx`, tab `horas`), adicionar a mesma barra de filtros usada no relatório **Produtividade da Equipe** e paginar a tabela de lançamentos.

## Escopo (apenas frontend / apresentação)

Arquivo único: `src/features/sustentacao/components/DemandaDetail.tsx` — bloco `<TabsContent value="horas">` (linhas ~1146-1239).

Nada de mudança em serviços, RLS, schema ou na regra de cálculo do `total` (que continua somando TODOS os lançamentos da demanda, independente do filtro — o filtro afeta só a tabela exibida).

## Mudanças

### 1. Barra de filtros (reuso de `ReportFilterBar`)
Inserir acima da tabela, abaixo do card "Lançar Horas":

- **Período**: 7/15/30/60/90 dias + Personalizado (default: 30 dias)
- **Data Início** / **Data Fim** (`date`)
- **Analista**: dropdown com os usuários que possuem lançamentos nesta demanda (deduplicados via `buildAnalistasDedup` a partir de `hours[].user_id` + `profilesMap`)
- **Limpar** + contador "X registros"

Componente: `ReportFilterBar` (`src/shared/components/reports/ReportFilterBar.tsx`) — já suporta exatamente este layout (modo "relatório", igual ao screenshot).

Estado local novo no componente:
```ts
const [periodo, setPeriodo]       = useState("30");
const [dataInicio, setDataInicio] = useState(daysAgo(30));
const [dataFim, setDataFim]       = useState(today());
const [analista, setAnalista]     = useState("all");
const [horasPage, setHorasPage]   = useState(1);
```

### 2. Lista filtrada (memo)
```ts
const filteredHours = useMemo(() => {
  const ini = dataInicio ? new Date(dataInicio + "T00:00:00") : null;
  const fim = dataFim    ? new Date(dataFim    + "T23:59:59") : null;
  return hours.filter(h => {
    const d = new Date(h.created_at);
    if (ini && d < ini) return false;
    if (fim && d > fim) return false;
    if (!analistaMatches(analista, h.user_id)) return false;
    return true;
  });
}, [hours, dataInicio, dataFim, analista]);
```

Opções de analista deduplicadas com `buildAnalistasDedup` (`src/features/sustentacao/utils/analistasDedup.ts`) — mesmo util usado nos relatórios.

Resetar `horasPage` para 1 sempre que filtros mudarem (`useEffect`).

### 3. Paginação (reuso de `usePagination` + `PaginationControls`)
- `usePagination(filteredHours, { pageSize: 10 })` — 10 por página, padrão do projeto.
- Renderizar `paginatedItems` em vez de `hours.map(...)` na `<tbody>`.
- `<PaginationControls />` (`src/shared/components/common/Pagination.tsx`) abaixo da tabela.

### 4. Vazio / total
- Se `filteredHours.length === 0` mas `hours.length > 0`: mostrar mensagem leve "Nenhum lançamento no período/analista selecionado" no lugar da tabela.
- Card "Total Acumulado" no topo continua somando `total` (não muda) — é o acumulado real da demanda. A barra mostra "X registros" do filtro atual, evitando confusão.

## Fora de escopo

- Não alterar `useDemandaHoras` / serviço — paginação é client-side sobre o array já carregado, igual ao padrão dos relatórios.
- Não mexer em RLS nem na busca de responsáveis (já corrigida nas iterações anteriores).
- Não tocar nas outras abas (detalhes / histórico / responsáveis / evidências).

## Validação

1. Abrir demanda com >10 lançamentos: paginação aparece, navega corretamente.
2. Selecionar período "7 dias": tabela filtra; contador atualiza; "Total Acumulado" permanece inalterado.
3. Trocar analista: tabela filtra; ao escolher "Todos", volta ao conjunto completo.
4. "Limpar" reseta período=30, datas, analista=all, página=1.
5. Demanda sem lançamentos: filtros ficam disabled ou ocultos (manter comportamento atual — só renderizar a barra se `hours.length > 0`).
