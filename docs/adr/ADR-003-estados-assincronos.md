# ADR-003 — Contrato mínimo de estados assíncronos

**Status:** aceito para piloto  
**Data:** 21/08/2026

## Contexto

As telas do Axionn representam carregamento, ausência de dados, ausência de resultados após filtros e falhas com marcações locais diferentes. A semântica de domínio e os guards de permissão devem continuar sob responsabilidade de cada feature.

## Decisão

O contrato mínimo de apresentação passa a distinguir:

- **Loading:** skeleton ou indicador local existente, com `role="status"` quando houver texto dinâmico;
- **Empty:** não existem dados no contexto selecionado;
- **Filtered Empty:** existem filtros ativos, mas nenhum item corresponde a eles;
- **Error:** falha de carregamento anunciada com `role="alert"` e retry apenas quando a operação já oferece refetch seguro;
- **Permission Restricted:** permanece nos guards e componentes de autorização existentes; não é uma variante de vazio.

`EmptyState` expõe `variant="empty" | "filtered-empty"`, usando `empty` como padrão retrocompatível. A variante é publicada em `data-state-variant` para testes e instrumentação. Estados vazios usam uma região de status educada (`role="status"`, `aria-live="polite"`).

`ErrorState` usa `role="alert"`. Nenhum componente compartilhado cria fetching, retry, regra de permissão ou estado de processamento de domínio.

## Piloto

`src/components/UserStoryManager.tsx` é o piloto de Sala Ágil. A tela já possui `hasFilters`, `clearFilters` e paginação, permitindo diferenciar ausência real de User Stories de resultado filtrado vazio sem alterar consultas ou regras de negócio.

## Compatibilidade e expansão

- consumidores existentes continuam compilando sem novas props;
- loading e permission restricted não são centralizados nesta decisão;
- expansão para RDM e APF exige inventário local e preservação dos estados especializados;
- ações de “limpar filtros” devem restaurar também a primeira página quando houver paginação.

## Critérios de aceite

- variantes distinguíveis por semântica e teste;
- erros anunciados imediatamente;
- piloto oferece limpeza de filtros por controle focável;
- testes de componente, lint e build aprovados.
