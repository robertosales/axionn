# Correção definitiva de permissões e gestão de times/membros no modelo multi-tenant

## Objetivo
Eliminar a inconsistência entre o modelo legado (`user_roles` / `role_permissions` / `hasPermission("manage_teams")`) e o modelo organizacional (`organization_members`, `organization_member_modules`, RPCs `*_v2`), fazendo com que admins de organização e membros de times como GESP3/Nexo consigam operar corretamente sem depender do modelo legado.

## Escopo e abordagem
Trabalho dividido em 4 camadas: banco (RPCs + backfill), hook central de permissões, refactor dos componentes, e validação. Nada de refatoração cosmética, nada de remover o modelo legado — ele fica como fallback controlado quando `VITE_ORG_TENANCY_ENABLED=false`.

---

## 1. Banco de dados (migrations idempotentes)

### 1.1 Corrigir `get_organization_teams_admin_v2`
Trocar a filtragem restritiva por resolução via `resolve_team_org_id`:

```sql
where coalesce(t.org_id, public.resolve_team_org_id(t.id)) = p_org_id
```

Aplicar o mesmo padrão em `create_organization_team_v2`, `update_organization_team_v2`, `deactivate_organization_team_v2` para não quebrar em times legados (GESP3, Nexo) cujo `org_id` ainda é nulo.

### 1.2 Backfill de `teams.org_id`
Migration idempotente e não destrutiva:

```sql
update public.teams
set org_id = public.resolve_team_org_id(id)
where org_id is null
  and public.resolve_team_org_id(id) is not null;
```

### 1.3 Novas RPCs para membros de time (tenant-scoped, SECURITY DEFINER)
Todas validam: usuário autenticado, organização ativa/trial, executor é platform admin OU org owner/admin, time pertence à org, usuário-alvo é membro ativo da organização, sem cross-tenant. Registram auditoria em `organization_operational_audit_log` quando aplicável.

- `get_organization_team_members_v2(p_org_id uuid, p_team_id uuid)` — lista membros com nome, email, role no time, ativo.
- `add_organization_team_member_v2(p_org_id, p_team_id, p_user_id, p_role)`
- `update_organization_team_member_role_v2(p_org_id, p_team_member_id, p_role)`
- `remove_organization_team_member_v2(p_org_id, p_team_member_id)`

GRANT EXECUTE apenas para `authenticated` e `service_role`. REVOKE em `public` e `anon`.

### 1.4 View/query de diagnóstico
Query SQL parametrizável (guardada em `supabase/audits/`) para validar qualquer usuário: presença em `profiles`, `is_active`, `organization_members` (role, is_active), `organization_member_modules`, `team_members` para times-alvo, `teams.org_id` vs. organização esperada. Sem hardcode de nomes.

---

## 2. Hook central de permissões — `useTeamManagementPermissions`

Novo arquivo `src/features/admin/hooks/useTeamManagementPermissions.ts`. Retorna:

```
canViewTeams, canCreateTeam, canUpdateTeam, canDeleteTeam,
canViewTeamMembers, canAddTeamMember, canRemoveTeamMember, canUpdateTeamMember
```

Regras:
- `VITE_ORG_TENANCY_ENABLED=true` → deriva de `OrganizationContext`:
  - `isPlatformAdmin` → tudo `true`.
  - `isOrganizationAdmin` (owner/admin em `organization_members` da org atual, org com status operacional) → tudo `true`.
  - membro comum → apenas leitura do que já é acessível.
- `VITE_ORG_TENANCY_ENABLED=false` → fallback legado: `isAdmin || hasPermission("manage_teams")`.

Também expor flags nomeadas separadas em `OrganizationContext`/`AuthContext`: `isPlatformAdmin`, `isOrganizationAdmin`, `isLegacyAdmin`, `isModuleAdmin`, `isTeamMember` (sem sobrecarga do termo `isAdmin`).

---

## 3. Refactor de componentes

### 3.1 `TeamManager` / `useTeamsAdmin`
Já usa RPCs `*_v2` quando `enabled`. Ajustes:
- Substituir gates locais por `useTeamManagementPermissions`.
- Remover queries diretas em `user_stories`/`demandas` para bloqueio de exclusão em modo tenancy (validação passa a ser feita na RPC `deactivate_organization_team_v2`).
- Mensagens de erro específicas via `resolveOrganizationOperationalError` estendido.

### 3.2 `TeamMembersManager`
Hoje faz mutação direta em `team_members`. Refatorar para:
- Em modo tenancy: usar as 4 RPCs novas de membros de time.
- Em modo legado: manter comportamento atual.
- Gates via `useTeamManagementPermissions`.

### 3.3 `useUsersAdmin`
- Em modo tenancy: só usa RPCs (`get_organization_members_v2`, `update_organization_member_v2`, `deactivate_organization_member_v2`, `transfer_organization_ownership_v2`).
- Remover updates diretos em `profiles`, `team_members`, `user_module_roles` para ações administrativas.
- Se algum campo de `profiles` precisar mudar por admin org, adicionar RPC dedicada (a decidir no momento, só se houver caller real).

### 3.4 `AdminUsuariosPage`
Remover a checagem `supabase.from("user_roles").select(...).eq("role","admin")` — substituir por `isPlatformAdmin` do contexto.

---

## 4. Mensagens de erro
Estender `resolveOrganizationOperationalError` (ou wrapper novo) para mapear os códigos das novas RPCs para:
- "Você não tem permissão para gerenciar times nesta organização."
- "Este time não pertence à organização selecionada."
- "Usuário não é membro ativo da organização."
- "Organização suspensa ou cancelada: operações bloqueadas."
- "Não foi possível carregar os times da organização."

Detalhes técnicos ficam em `console.error`, nunca em toast.

---

## 5. Testes / validação
Novo arquivo `supabase/tests/database/10_team_membership_management.test.sql` cobrindo os 5 cenários (A platform admin, B org admin, C membro comum, D time legado sem `org_id`, E membership/role variados). Segue o padrão dos testes existentes em `supabase/tests/database/`.

Query de diagnóstico em `supabase/audits/20260708_team_membership_diagnostics.sql` para rodar contra staging/prod validando qualquer usuário e conjunto de times.

---

## Detalhes técnicos

- Migrations: uma para RPCs de teams corrigidas + backfill, outra para RPCs novas de membros. Ambas idempotentes (`create or replace function`, `update ... where org_id is null`).
- Sem `service_role` no frontend. Sem policies abertas. RLS permanece habilitado.
- RPCs `SECURITY DEFINER` com `set search_path = public` e validações explícitas via `auth.uid()`, `is_platform_admin()`, `is_organization_admin()`, `resolve_team_org_id()`, status da organização, membership ativo.
- Nenhum nome de usuário hardcoded.
- Fallback legado preservado atrás de `ORGANIZATION_TENANCY_ENABLED`.

## Fora de escopo
- Remoção do modelo legado.
- Mudanças no `AuthContext` que alterem semântica atual de `hasPermission` para consumidores não-times.
- Novas UIs — apenas ajustes em componentes existentes de gestão de times/membros.

## Como validar após deploy
1. Rodar `supabase/audits/20260708_team_membership_diagnostics.sql` para Leidy e Jo com IDs de GESP3/Nexo.
2. Executar `supabase/tests/database/10_team_membership_management.test.sql`.
3. Smoke manual: login como org admin → listar/criar/editar/inativar time; adicionar/remover membro; verificar toasts com mensagens novas.
