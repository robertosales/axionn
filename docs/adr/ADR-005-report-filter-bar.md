# ADR-005 — Contagem e limpeza no ReportFilterBar

**Status:** aceito  
**Data:** 21/08/2026

## Contexto

O `ReportFilterBar` atende relatórios reativos em dois contratos: `fields/values` na Sala Ágil e período/analista em Sustentação. Os consumidores possuíam reset, mas não informavam quantos filtros estavam ativos e usavam o rótulo genérico “Limpar”.

## Decisão

- exibir sempre a contagem singular/plural de filtros ativos quando houver ação de limpeza;
- usar o rótulo único “Limpar todos”;
- manter a ação visível e desabilitada quando a contagem for zero;
- anunciar mudanças da contagem com `aria-live="polite"`;
- associar labels aos respectivos inputs e triggers;
- usar `defaultValues` no modo `fields/values`, pois defaults como “5 sprints” não podem ser inferidos corretamente;
- permitir `activeFilterCount` como override para semânticas de domínio especializadas;
- no modo relatório, contar período diferente de 30 dias como um filtro e analista diferente de “all” como outro.

O componente continua reativo. Ele não introduz botão “Aplicar”, não altera fetching e não é unificado com `MetricasFilterBar`, `DashboardFilters` ou filtros do Kanban.

## Compatibilidade

`defaultValues` e `activeFilterCount` são opcionais. Os cinco consumidores `fields/values` existentes passam defaults explícitos. Callbacks `onClear` e `onReset` preservam sua implementação original.
