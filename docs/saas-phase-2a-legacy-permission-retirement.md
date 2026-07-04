# SaaS Phase 2A - Lote 6: Legacy Permission Retirement

Este lote prepara o cutover em que a autorizacao organizacional deixa de aceitar fontes globais legadas quando `VITE_ORG_TENANCY_ENABLED=true` e o fallback operacional estiver desligado.

## Fontes de Autoridade

Fontes novas:

- `public.organization_members`: membership e papel `owner`, `admin` ou `member` por organizacao.
- `public.organization_member_modules`: acesso a `sala_agil`, `sustentacao` e `rdm` por membership.
- `public.platform_user_roles`: somente administradores globais da plataforma, com `role = 'platform_admin'`.

Fontes legadas mantidas fisicamente, mas sem autoridade apos o cutover:

- `profiles.module_access`
- `user_module_roles`
- `user_roles.role = 'admin'`

As tabelas legadas nao sao removidas neste lote para preservar rollback, auditoria historica e compatibilidade com fluxos ainda nao migrados fora do runtime organizacional.

## Chave Operacional

A migration `supabase/migrations/20260704060000_organization_permission_authority.sql` registra em `public.saas_runtime_settings`:

- `organization_legacy_permission_fallback_enabled`
- estado inicial: `true`

Funcoes:

- `public.is_organization_legacy_permission_fallback_enabled()`
- `public.set_organization_legacy_permission_fallback(boolean)`

A alteracao e permitida para `service_role` ou `platform_admin`. `anon` nao recebe permissao de execucao para a funcao de alteracao.

## Preflight

Execute somente leitura:

```sql
supabase/audits/20260704_06_legacy_permission_retirement_preflight.sql
```

O preflight reporta contagens para memberships sem modulos, usuarios single-org dependentes do legado, usuarios multi-org incompletos, modulos orfaos, memberships inativos com modulos, modulos invalidos, admins legados sem `platform_admin`, platform admins existentes, usuarios ativos sem organizacao, usuarios que perderiam todos os modulos e divergencias da SALES CONSULTORIA (`d7f226d9-9f08-43a7-b565-482cca58f00d`).

Resultado esperado antes do cutover:

- `legacy_permission_retirement_preflight_ok = true`

## Sequencia no Lovable Cloud

1. Executar o preflight somente leitura.
2. Resolver todos os bloqueadores.
3. Executar a migration/rollout pelo SQL Editor suportado pelo Lovable.
4. Publicar o frontend.
5. Validar o frontend ainda com fallback ligado.
6. Executar `supabase/operations/20260704_06_disable_legacy_permission_fallback.sql`.
7. Fazer smoke test imediato.
8. Executar `supabase/operations/20260704_06_post_cutover_validation.sql`.
9. Usar `supabase/operations/20260704_06_enable_legacy_permission_fallback_rollback.sql` imediatamente em caso de falha critica.

Nao execute `supabase db push`, `supabase db reset` ou `supabase migration repair` contra o ambiente remoto.

## Resultados Booleanos Esperados

- Preflight: `legacy_permission_retirement_preflight_ok = true`
- Cutover: `legacy_permission_cutover_ok = true`
- Rollback: `legacy_permission_rollback_ok = true`
- Pos-cutover: `legacy_permission_post_cutover_ok = true`

## Smoke Test Frontend

Com fallback ligado:

- Login de Roberto.
- Selecionar SALES CONSULTORIA.
- Confirmar que os modulos esperados aparecem.
- Confirmar que times disponiveis pertencem a organizacao selecionada.

Depois do cutover:

- Repetir login e selecao de SALES CONSULTORIA.
- Confirmar que `sala_agil`, `sustentacao` e `rdm` aparecem apenas se vierem de `organization_member_modules`.
- Trocar de organizacao, quando houver mais de uma, e confirmar que o time ativo e limpo se nao pertencer ao novo contexto.
- Simular falha de RPC ou bloquear chamada no navegador e confirmar que a interface nao concede acesso por `profiles.module_access`.

## Riscos Multi-Organizacao

Permissoes legadas nao possuem `org_id`. Por isso o backfill automatico nunca propaga `user_module_roles` ou `profiles.module_access` para usuarios com duas ou mais organizacoes ativas. Esses usuarios exigem configuracao explicita em cada organizacao antes do cutover.

## Fail-Closed

Com `VITE_ORG_TENANCY_ENABLED=true` e fallback desligado, erro ou indisponibilidade em `get_my_organization_module_roles()` nao volta para legado. O runtime limpa `moduleRoles`, limpa time ativo quando necessario e bloqueia acesso ao modulo.

## SALES CONSULTORIA e Roberto

Antes do cutover, confirme no preflight que `sales_consultoria_gaps = 0`. Depois, confirme manualmente:

```sql
select member.org_id, member.user_id, member.role, array_agg(module.module_key order by module.module_key) as modules
from public.organization_members member
left join public.organization_member_modules module
  on module.org_id = member.org_id
 and module.user_id = member.user_id
where member.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
group by member.org_id, member.user_id, member.role
order by member.role, member.user_id;
```

Roberto deve permanecer como membro/admin/owner esperado da SALES CONSULTORIA e possuir modulos explicitos em `organization_member_modules`, ou `platform_admin` preservado em `platform_user_roles` quando aplicavel.

## Rollback

Se o smoke test falhar criticamente, execute somente:

```sql
supabase/operations/20260704_06_enable_legacy_permission_fallback_rollback.sql
```

O rollback religa apenas `organization_legacy_permission_fallback_enabled`. Ele nao remove dados, nao desfaz memberships, nao altera modulos organizacionais e nao muda `tenancy_enforcement`.
