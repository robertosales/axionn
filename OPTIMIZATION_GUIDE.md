# Guia de Otimização de Performance — Axion Board

Este guia contém as diretrizes técnicas para reduzir o estresse de CPU (94%) e Disk IO no banco de dados, focando nas telas de Kanban e Sustentação.

## 1. Otimização do Board Kanban (`/sala-agile/board`)

O hook `useKanbanBoard.ts` atual executa fetch massivo de dados (Stories, Devs, Epics, Sprints) e possui um listener Realtime que invalida tudo a cada mudança.

### Checklist de Melhorias:
- [ ] **Fetch Paginado/Seletivo:** O `user_stories` faz fetch de até 500 registros. Implementar filtro por `sprint_id` direto na query do Supabase para trazer apenas o necessário.
- [ ] **Debouncing de Realtime:** Atualmente, qualquer `postgres_changes` dispara um `load()` completo. Introduzir um debounce de 2 segundos para evitar rajadas de select quando múltiplos cards são movidos.
- [ ] **Select Específico:** Alterar o `select('*')` das colunas de workflow para selecionar apenas os campos utilizados (id, key, label, sort_order).
- [ ] **Cache Estendido para Referências:** Epics e Devs mudam raramente. Aumentar o `staleTime` desses dados para 5 minutos no QueryClient.

## 2. Otimização da Sustentação (`/sustentacao`)

O hook `useDemandas.ts` já usa TanStack Query, mas o enriquecimento de responsáveis é custoso.

### Checklist de Melhorias:
- [ ] **View de Banco para Enriquecimento:** Atualmente, o app faz um fetch manual em `demanda_responsaveis` e mapeia no JS. Criar uma View no PostgreSQL que já traga os nomes dos responsáveis via JOIN, reduzindo o processamento no frontend e o número de queries.
- [ ] **RT Invalidation Granular:** Em vez de invalidar `demandas.all`, invalidar apenas a query específica da lista atual para evitar refetch de dados de background.

## 3. Monitoramento de Banco (Comandos SQL)

Execute estes scripts no SQL Editor do Supabase para identificar gargalos em tempo real:

### Identificar Queries Lentas ou Travadas:
```sql
SELECT pid, now() - xact_start AS duration, query, state
FROM pg_stat_activity
WHERE state != 'idle' AND (now() - xact_start) > interval '5 seconds'
ORDER BY duration DESC;
```

### Identificar Locks de Tabela (Causa provável do travamento ao salvar):
```sql
SELECT
    relation::regclass AS table_name,
    mode AS lock_mode,
    waiting,
    query AS blocked_query
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE NOT mode = 'RowExclusiveLock';
```

## 4. Upgrade de Infraestrutura

### Recomendações para a Instância 'Tiny':
- **Risco de Downtime:** O upgrade de instância no Lovable/Supabase geralmente envolve um restart do banco de ~30 a 60 segundos. **Deve ser feito fora do horário comercial.**
- **Região:** Mudar para o Brasil (São Paulo) reduz a latência (RTT), mas exige migração de dados completa (dump/restore). **Foco Prioritário:** Subir o tamanho da instância para 1 vCPU dedicada (Small/Medium) antes de mudar a região. O custo de CPU atual (94%) é o gargalo real, não a distância geográfica.
