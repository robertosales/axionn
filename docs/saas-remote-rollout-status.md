# Axion SaaS — estado central do rollout remoto

Este documento é a fonte de verdade operacional do rollout SaaS no Lovable Cloud.

## Branches

- `main`: congelada. Não será alterada nesta etapa.
- `develop`: base funcional atual do projeto.
- `codex/saas-remote-rollout`: branch única do rollout remoto, criada a partir de `codex/apf-security-hardening`, que por sua vez parte de `develop`.

## Estado já concluído

### Organização licenciada

- Organização: `SALES CONSULTORIA`
- ID preservado: `d7f226d9-9f08-43a7-b565-482cca58f00d`
- Slug: `sales-consultoria`
- Plano: `enterprise`
- Status: `active`
- Membros: 4
- Contratos: 2
- A correção foi feita por rename-in-place, preservando memberships, papéis, limites e referências.

### APF / ponto de função

- As migrations `20260702000026` a `20260702000031` estão fisicamente materializadas no banco remoto.
- Funções, RPCs, triggers, views, índices e constraint finais foram comparados com o repositório.
- As correções de contagem já estão em produção.
- Não reaplicar as migrations 26–31.
- Não executar backfill da migration 28 novamente.
- O hardening de privilégios APF está preparado em `supabase/operations/20260703_apf_security_hardening.sql` e não altera fórmulas, fatores, PF ou contagens.

### Enforcement

- O enforcement de tenancy continua ausente/desligado.
- Não chamar `set_tenancy_enforcement(true)` durante a instalação.

## Estado da série 20260630

O histórico remoto termina em `20260623180256`. A série abaixo não está registrada no histórico.

| Versão | Objeto | Estado remoto | Decisão |
|---|---|---|---|
| `20260630010000` | governança de uso de IA | ausente | aplicar |
| `20260630011000` | rate limits de IA | ausente | aplicar depois de 10000 |
| `20260630015900` | `min(uuid)` temporário | ausente | usar somente durante o backfill da fundação |
| `20260630019000` | correção do trigger de auditoria | ausente | aplicar |
| `20260630019500` | compatibilidade `contract_teams` | parcialmente materializada | não aplicar o arquivo original; preservar tabela/policies e evitar índices redundantes |
| `20260630020000` | fundação multi-tenant | ausente | aplicar com backfills não destrutivos |
| `20260630020500` | limpeza de `min(uuid)` | ausente | executar imediatamente após a fundação |
| `20260630021000` | hardening dos wrappers | ausente | aplicar |
| `20260630022000` | isolamento progressivo | ausente | aplicar mantendo `tenancy_enforcement=false` |
| `20260630023000` | hardening e readiness report | ausente | aplicar |

## Ordem de implementação

### Operação 0 — hardening APF

Executar o arquivo já preparado:

`supabase/operations/20260703_apf_security_hardening.sql`

Resultado esperado: `apf_security_hardening_ok = true`.

### Operação 1 — governança de IA

Instalar, em uma única transação:

- `20260630010000_ai_usage_governance.sql`
- `20260630011000_ai_rate_limits.sql`

Não altera contagens APF nem tenancy enforcement.

### Operação 2 — fundação multi-tenant

Instalar, em uma única transação:

- helper temporário de UUID;
- correção do trigger de auditoria;
- compatibilidade segura da tabela existente `contract_teams`, sem recriação e sem índices redundantes;
- `20260630020000_multitenant_foundation.sql`;
- remoção do helper temporário;
- `20260630021000_org_access_wrappers.sql`.

Resultado esperado:

- `platform_user_roles` criada;
- `companies.org_id`, `teams.org_id` e `projects.org_id` criados;
- SALES CONSULTORIA propagada para empresas, times e projetos inequívocos;
- wrappers tenant-scoped instalados;
- enforcement ainda desligado/ausente.

### Operação 3 — isolamento instalado, mas desligado

Instalar, em uma única transação:

- `20260630022000_org_resource_isolation.sql`;
- `20260630023000_org_resource_isolation_hardening.sql`.

Resultado esperado:

- `saas_runtime_settings.tenancy_enforcement.enabled = false`;
- funções e triggers de consistência instalados;
- policies restritivas instaladas, mas neutralizadas pelo enforcement desligado;
- `get_tenancy_readiness_report()` disponível somente ao backend.

### Operação 4 — validação e histórico

- Executar o readiness report.
- Corrigir somente pendências reais de dados.
- Validar frontend com feature flag desligada.
- Alinhar o histórico apenas depois da equivalência física integral.
- Não ativar enforcement nesta operação.

## Proibições durante o rollout

- não alterar `main`;
- não executar `supabase db push` contra produção;
- não executar `supabase db reset`;
- não reparar histórico em massa;
- não reaplicar migrations APF 26–31;
- não ativar tenancy enforcement;
- não excluir/recriar `contract_teams`;
- não criar uma nova organização para SALES CONSULTORIA.

## Próximo trabalho de código

Preparar as três operações de produção idempotentes, com transação, advisory lock, validações prévias e pós-condições. O usuário executará apenas os arquivos de operação, não as migrations individuais.