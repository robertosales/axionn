## Objetivo

Corrigir o erro `AI_EVIDENCE_RANGE_MISMATCH` do Axionn Briefing, dar sobrevida à listagem do Histórico (paginação + busca por texto e por tipo), inferir participantes a partir da transcrição quando não informados, apagar todos os briefings cadastrados, e melhorar a gestão de Perfis (RBAC): corrigir a ação "Desativar", permitir desativação em massa, e remover do banco todos os usuários vinculados a times de Sustentação (preservando `tiago.vieira2@globalweb.com.br`).

---

## 1. Axionn Briefing — correções no backend e no fluxo

### 1.1 Corrigir `AI_EVIDENCE_RANGE_MISMATCH`
Em `supabase/functions/process-ai-briefing/index.ts` (função `validateEvidence`, linha ~393):

- Substituir o `throw` por **auto-correção**: quando `sourceContent.slice(start, end) !== quote`, tentar recalcular via `sourceContent.indexOf(quote)`. Se encontrado, sobrescrever `sourceStart`/`sourceEnd` com os índices corretos e continuar.
- Se `indexOf` retornar `-1` (não deveria, pois `AI_EVIDENCE_NOT_IN_SOURCE` já cobriu), aí sim descartar os índices (`undefined`) em vez de estourar 422 — mantém o briefing rodando, já que o `quote` literal ainda é válido.
- Manter `AI_EVIDENCE_NOT_IN_SOURCE` como erro (evidência inventada continua bloqueando).

### 1.2 Participantes inferidos da transcrição
Quando `participants` chegar vazio no `buildPrompt`:
- Adicionar uma instrução extra ao prompt pedindo à IA para extrair a lista de participantes a partir de nomes citados/falantes da própria transcrição, no campo `evidence[].speaker` e num novo campo top-level opcional `inferredParticipants: string[]` (armazenado em `ai_briefings.participants` via update pós-processamento).
- Após parse do JSON, se `analysis.inferredParticipants` existir e `briefing.participants` estava vazio, chamar `admin.from("ai_briefings").update({ participants }).eq("id", briefingId)`.
- Ajustar `briefingAnalysisSchema` (`src/features/briefing/schemas/briefingAnalysis.schema.ts`) para aceitar `inferredParticipants: z.array(z.string()).max(50).optional()`.

### 1.3 Apagar todos os briefings cadastrados
Migração de dados (via `supabase--insert`):
```sql
DELETE FROM public.ai_briefing_runs;
DELETE FROM public.ai_suggestion_evidence;
DELETE FROM public.ai_suggestion_applications;
DELETE FROM public.ai_briefing_suggestions;
DELETE FROM public.ai_briefings;
```

---

## 2. Histórico da equipe (BriefingPage)

Em `src/features/briefing/pages/BriefingPage.tsx` e `src/features/briefing/services/briefing.service.ts`:

- **Remover `.limit(20)`** de `listTeamBriefings` para trazer todo o histórico do time.
- Adicionar acima da lista de histórico:
  - `Input` de **busca por texto** (procura em `title` — debounce 300ms via `useDebounce`).
  - `Select` de **tipo de reunião** com opções: Todos, Daily, Planning, Review, Retrospectiva, Discovery, Reunião livre.
- Filtrar `history` em `useMemo` por texto + tipo.
- Aplicar `usePagination` (pageSize 10) na lista filtrada + `PaginationControls` no rodapé.

---

## 3. RBAC — Perfis

### 3.1 Corrigir "Desativar"
Investigação: `confirmToggleActive` faz `UPDATE profiles SET is_active` diretamente. Falha silenciosa provavelmente vem de RLS que exige rota de admin. Trocar para a Edge Function existente `admin-user-management` com nova `action: "toggle_active"` (ou reutilizar padrão já usado em `change_email`), que roda com service role. Se a action ainda não existir na edge function, adicionar `case "toggle_active"` que faz `admin.auth.admin.updateUserById` + `update profiles.is_active`. Fallback: manter o `UPDATE` client-side apenas se a invoke falhar, com toast do erro real (hoje o erro é engolido por `err?.message`).

### 3.2 Desativação em massa (multi-seleção)
Em `src/components/UserRolesManager.tsx`:
- Adicionar coluna de `Checkbox` no início do `Table` (header com "select all" da página atual).
- Estado `selectedUserIds: Set<string>`.
- Barra flutuante quando `selectedUserIds.size > 0`: mostra "N selecionados" + botão **Desativar selecionados** + **Limpar seleção**.
- Botão abre `ConfirmDialog` (`Dialog` local) → itera em `Promise.allSettled` chamando o mesmo caminho de `confirmToggleActive` (via edge function) para cada `user_id`. Toast agregado ("X desativados, Y falharam").
- Após conclusão: limpar seleção e `fetchUsers()`.

### 3.3 Limpeza de usuários dos times de Sustentação
Migração de dados (via `supabase--insert`) — remover todos os usuários pertencentes a times cujo `module = 'sustentacao'`, exceto `tiago.vieira2@globalweb.com.br`:

```sql
-- Passo 1: identificar user_ids alvo
WITH sust_teams AS (
  SELECT id FROM public.teams WHERE module = 'sustentacao'
),
target_users AS (
  SELECT DISTINCT tm.user_id
  FROM public.team_members tm
  JOIN sust_teams st ON st.id = tm.team_id
  JOIN public.profiles p ON p.user_id = tm.user_id
  WHERE lower(p.email) <> 'tiago.vieira2@globalweb.com.br'
)
-- Passo 2: remover vínculos e desativar (não deletar auth.users)
DELETE FROM public.team_members
 WHERE user_id IN (SELECT user_id FROM target_users)
   AND team_id IN (SELECT id FROM sust_teams);

UPDATE public.profiles
   SET is_active = false
 WHERE user_id IN (SELECT user_id FROM target_users);
```

**Nota:** por diretriz do projeto (`NEVER delete tables/columns`), e para preservar histórico/auditoria, os usuários serão **removidos dos times de Sustentação e marcados como `is_active = false`**, em vez de `DELETE FROM auth.users` (o que quebraria FKs de demandas, HUs, briefings, auditoria). Se você quiser exclusão física (via `auth.admin.deleteUser`), me confirme antes de rodar.

---

## Detalhes técnicos

- **Arquivos editados:**
  - `supabase/functions/process-ai-briefing/index.ts` (validateEvidence + prompt + persistência inferredParticipants)
  - `src/features/briefing/schemas/briefingAnalysis.schema.ts` (novo campo opcional)
  - `src/features/briefing/services/briefing.service.ts` (remover limit)
  - `src/features/briefing/pages/BriefingPage.tsx` (filtros + paginação)
  - `src/components/UserRolesManager.tsx` (checkboxes, bulk deactivate, fix toggle)
  - `supabase/functions/admin-user-management/index.ts` (nova action `toggle_active` se ausente)
- **Migrações de dados (não schema):** via `supabase--insert` — DELETE dos briefings + cleanup dos usuários de Sustentação.
- Redeploy da edge function `process-ai-briefing` e `admin-user-management` após as alterações.

## Fora de escopo
- Não alterar RLS/policies das tabelas de briefing (o problema é lógico, não de acesso).
- Não excluir fisicamente contas em `auth.users` (a menos que confirmado).
- Não mexer no fluxo de retry/backoff já implementado.
