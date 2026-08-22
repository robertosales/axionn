# ADR-004 — Contrato de PageHeader operacional

**Status:** aceito para piloto  
**Data:** 21/08/2026

## Contexto

O Axionn possui `ReportPageHeader` para relatórios, um `PageHeader` administrativo sem título e diversos cabeçalhos locais. O shell operacional não fornece o título da página; o shell Admin já o fornece na topbar.

## Decisão

`src/shared/components/common/PageHeader.tsx` passa a definir o contrato de composição para páginas:

- variante `operational` como padrão, com `title` obrigatório e exatamente um `h1`;
- variante `admin`, sem heading, para evitar duplicidade com a topbar administrativa;
- descrição associada semanticamente ao `h1` operacional;
- ícone decorativo, badges de contexto e área de ações;
- composição responsiva, empilhada no mobile e horizontal a partir de `sm`;
- ação opcional de retorno com botão nativo e foco fornecido pelo primitive compartilhado.

O wrapper `src/features/admin/components/PageHeader.tsx` preserva sua API e delega layout e semântica à variante `admin`.

`ReportPageHeader` permanece como variante especializada de relatórios nesta fase. Ele não será migrado até que seus contratos legados (`titulo`, `subtitulo`, `modulo` e exportação CSV) sejam inventariados separadamente.

## Piloto

`src/features/kanban/pages/KanbanPage.tsx` usa o contrato operacional. O título, contagem de HUs, sprint ativa, indicação de resultado parcial e ação de atualização foram preservados. A ação icon-only agora possui nome acessível.

## Critérios de expansão

- confirmar se o shell consumidor já fornece `h1`;
- manter badges apenas para contexto/status, não para ações;
- fornecer nomes acessíveis a ações icon-only;
- não migrar páginas de relatório nem shells nesta fase;
- validar em mobile, desktop, zoom e navegação por teclado.
