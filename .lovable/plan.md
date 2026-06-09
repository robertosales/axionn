## Correções no modal de detalhes do Painel de Capacidade

### 1. Bug: erro ao carregar HUs (Sala Ágil)

A query atual usa `sprints(name, is_active)` sem desambiguar — existem múltiplas FKs entre `user_stories` e `sprints` (provavelmente `sprint_id` e algum campo histórico/origem), e o PostgREST retorna:

> Could not embed because more than one relationship was found for 'user_stories' and 'sprints'

**Fix em `src/features/admin/hooks/useMemberCapacityDetail.ts`:**
- Trocar o embed implícito por hint explícito: `sprint:sprints!user_stories_sprint_id_fkey(name, is_active)` (ou o nome real da FK confirmado via introspecção antes da escrita).
- Ajustar o mapeamento `r.sprints?.name` → `r.sprint?.name`.
- Mesma checagem no embed `activities → user_stories` (`hu:user_stories!activities_hu_id_fkey(title)`) e em `demanda_responsaveis`/`demanda_hours` para evitar o mesmo problema.

### 2. Layout mais profissional do modal

Refatorar `src/features/admin/components/CapacityMemberDetailDialog.tsx` mantendo a paleta por módulo (verde Ágil / azul Sustentação) e usando apenas tokens semânticos:

**Cabeçalho:**
- Avatar (UserAvatar) + nome em destaque, abaixo: time + módulo como chips.
- Faixa de KPIs (4 cards compactos) — Ágil: HUs ativas · Story Points totais · Horas estimadas · Atividades abertas. Sustentação: Demandas ativas · Horas no mês · Demandas em SLA crítico · Tipo predominante.
- Borda inferior sutil (`border-b`) separando do conteúdo.

**Abas:**
- `TabsList` em estilo "pill" alinhado à esquerda, com contadores em `Badge` discretos.
- Conteúdo dentro de `Card` com `ScrollArea` (substitui `overflow-auto` cru), altura fixa controlada.

**Tabelas:**
- Trocar `<table>` cru pelo componente shadcn `Table` (cabeçalho sticky, zebra leve `even:bg-muted/30`, hover row).
- Tipografia consistente (`text-sm`), espaçamento `py-2.5`.
- Badges de status com cores semânticas (Concluída = success, Em andamento = secondary, SLA estourado = destructive).
- Coluna de progresso nas HUs com `<Progress />` (atividades concluídas / total).
- Datas formatadas `dd MMM yyyy` em `text-muted-foreground text-xs`.
- Empty state com ícone + texto centrado (`EmptyState` compartilhado).
- Loading com `SkeletonList` em vez de skeletons soltos.

**Dimensões:**
- `max-w-5xl`, `h-[80vh]`, layout flex em coluna para evitar scroll duplo.

### Fora de escopo

- Sem mudança de regra de negócio, schema ou RLS.
- Sem novos endpoints — só ajuste de embed/joins e UI.
