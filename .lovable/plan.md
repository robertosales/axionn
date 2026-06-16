## Objetivo
Na tela **Sala Ágil › Métricas › Desempenho Individual**, ordenar membros alfabeticamente e adicionar paginação.

## Mudanças (apenas `src/components/dashboard/IndividualPerformance.tsx`)

1. **Ordenação alfabética**: criar `sortedMembers = [...members].sort((a,b) => a.name.localeCompare(b.name, 'pt-BR'))`.
2. **Paginação client-side**:
   - `pageSize = 10` (padrão do projeto), state `page` (inicia em 1).
   - `paginatedMembers = sortedMembers.slice((page-1)*pageSize, page*pageSize)`.
   - Resetar `page` para 1 quando `members` mudar.
3. **Render**:
   - Iterar `paginatedMembers` no `tbody` (linha de Total/Média continua somando **todos** os membros, não só a página).
   - Adicionar rodapé de paginação abaixo da tabela com: texto "Mostrando X–Y de N membros" + botões Anterior/Próximo (estilo `ghost`/`outline` já usado no projeto) e indicador "Página P de TP".
   - Ocultar paginação se `sortedMembers.length <= pageSize`.

## Fora do escopo
- KPIs do topo, gráficos e modal de detalhe permanecem usando o conjunto completo de membros.
- Nenhuma mudança em outras telas/componentes.
