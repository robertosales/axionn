# Axion SaaS — estado central do rollout no Lovable Cloud

Este documento é a fonte de verdade operacional do rollout SaaS.

## Ambiente real

- O Supabase do Axion é o backend gerenciado pelo **Lovable Cloud**.
- Não existe um projeto Supabase de staging separado para este rollout.
- O banco do Lovable Cloud é o banco remoto em produção que estamos saneando.
- Não usar Supabase CLI contra esse banco.
- Não executar `supabase db push`, `supabase db reset` ou `supabase migration repair`.
- Os arquivos em `supabase/migrations` permanecem como fonte de código e replay de ambientes limpos; eles não serão aplicados em massa no Lovable Cloud.
- As alterações de produção serão entregues como arquivos em `supabase/operations` e executadas manualmente, uma por vez, no terminal/SQL Editor do Lovable Cloud.
- Depois de cada operação, o resultado final retornado pelo próprio SQL será usado como gate antes da próxima.
- Edge Functions, variáveis e secrets continuam sob o gerenciamento do Lovable Cloud. Nenhuma credencial de produção será colocada em GitHub Actions.

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

- As migrations `20260702000026` a `20260702000031` estão fisicamente materializadas no banco do Lovable Cloud.
- Funções, RPCs, triggers, views, índices e constraint finais foram comparados com o repositório.
- As correções de contagem já estão em produção.
- Não reaplicar as migrations 26–31.
- Não executar novamente o backfill da migration 28.
- O hardening de privilégios APF está preparado em `supabase/operations/20260703_apf_security_hardening.sql` e não altera fórmulas, fatores, PF ou contagens.

### Enforcement

- O enforcement de tenancy continua ausente/desligado.
- Não chamar `set_tenancy_enforcement(true)` durante a instalação.

## Estado da série 20260630

O histórico remoto termina em `20260623180256`. A série abaixo não está registrada no histórico do banco do Lovable Cloud.

| Versão | Objeto | Estado remoto | Decisão |
|---|---|---|---|
| `20260630010000` | governança de uso de IA | ausente | incorporar na Operação 1 |
| `20260630011000` | rate limits de IA | ausente | incorporar na Operação 1 |
| `20260630015900` | `min(uuid)` temporário | ausente | usar somente dentro da Operação 2 |
| `20260630019000` | correção do trigger de auditoria | ausente | incorporar na Operação 2 |
| `20260630019500` | compatibilidade `contract_teams` | parcialmente materializada | não executar o arquivo original; preservar tabela/policies e evitar índices redundantes |
| `20260630020000` | fundação multi-tenant | ausente | incorporar na Operação 2 com backfills não destrutivos |
| `20260630020500` | limpeza de `min(uuid)` | ausente | executar dentro da mesma transação da Operação 2 |
| `20260630021000` | hardening dos wrappers | ausente | incorporar na Operação 2 |
| `20260630022000` | isolamento progressivo | ausente | incorporar na Operação 3 mantendo `tenancy_enforcement=false` |
| `20260630023000` | hardening e readiness report | ausente | incorporar na Operação 3 |

## Ordem de implementação no Lovable Cloud

### Operação 0 — hardening APF

Executar manualmente no SQL Editor do Lovable Cloud:

`supabase/operations/20260703_apf_security_hardening.sql`

Resultado esperado: `apf_security_hardening_ok = true`.

### Operação 1 — governança de IA

Arquivo preparado:

`supabase/operations/20260703_01_ai_governance_rollout.sql`

Instala, em uma única transação:

- governança de uso de IA;
- reserva e finalização de consumo;
- rate limits por usuário, empresa e concorrência;
- ACLs restritas ao backend/service role.

Não altera contagens APF, contratos, organizações ou tenancy enforcement.

### Operação 2 — fundação multi-tenant

Será entregue como um único arquivo de operação para o Lovable Cloud contendo:

- helper temporário de UUID;
- correção do trigger de auditoria;
- compatibilidade segura da tabela existente `contract_teams`, sem recriação e sem índices redundantes;
- fundação multi-tenant;
- backfills apenas quando a organização for inequívoca;
- remoção do helper temporário;
- hardening dos wrappers internos.

Resultado esperado:

- `platform_user_roles` criada;
- `companies.org_id`, `teams.org_id` e `projects.org_id` criados;
- SALES CONSULTORIA propagada para empresas, times e projetos inequívocos;
- wrappers tenant-scoped instalados;
- enforcement ainda desligado/ausente.

### Operação 3 — isolamento instalado, mas desligado

Será entregue como um único arquivo de operação para o Lovable Cloud contendo:

- `saas_runtime_settings`;
- `tenancy_enforcement.enabled = false`;
- funções e triggers de consistência;
- policies restritivas neutralizadas enquanto o enforcement estiver desligado;
- readiness report disponível somente ao backend.

### Operação 4 — validação final

- Executar o readiness report no Lovable Cloud.
- Corrigir somente pendências reais de dados.
- Validar o frontend com feature flag desligada.
- Alinhar o histórico somente depois da equivalência física integral e por mecanismo suportado pelo ambiente.
- Não ativar enforcement nesta operação.

## Proibições durante o rollout

- não alterar `main`;
- não usar Supabase CLI contra o Lovable Cloud;
- não executar `supabase db push`;
- não executar `supabase db reset`;
- não executar `supabase migration repair`;
- não reparar histórico em massa;
- não reaplicar migrations APF 26–31;
- não ativar tenancy enforcement;
- não excluir/recriar `contract_teams`;
- não criar uma nova organização para SALES CONSULTORIA;
- não colocar credenciais do Lovable Cloud no GitHub.

## Próximo trabalho de código

Finalizar a Operação 2 e depois a Operação 3. O usuário executará apenas os arquivos fechados de `supabase/operations`, manualmente no SQL Editor do Lovable Cloud, e enviará somente o resultado final retornado por cada operação.

## Atualização operacional em 2026-07-03

As operações manuais 2, 3 e 4 foram executadas no Lovable Cloud com resultado aprovado.

Evidências registradas pelo SQL Editor:

- Operação 2: `multitenant_foundation_ok = true`, `tenant_rpcs_available = true`, `internal_wrappers_secured = true`, `tenancy_enforcement_absent_or_disabled = true`.
- Operação 3: `org_resource_isolation_ready_enforcement_off = true`, `tenant_boundary_policies = 7`, `tenancy_consistency_triggers = 6`, `tenancy_enforcement_enabled = false`.
- Operação 4: `final_readiness_ok_enforcement_off = true`, `readiness_affected_rows = 0`, `organizations_without_owner_or_admin = 0`, `platform_admins = 9`, `tenancy_setting_enabled = false`.

Estado atual:

- infraestrutura multi-tenant instalada;
- policies e triggers de consistência instaladas;
- readiness sem pendências;
- `saas_runtime_settings.tenancy_enforcement.enabled = false`;
- `set_tenancy_enforcement(true)` não foi chamado e continua fora do escopo desta etapa.

## Próximo passo sem ativar enforcement

O próximo passo é validar a aplicação usando os RPCs tenant-aware com a feature flag de frontend ligada em ambiente controlado:

- executar `supabase/operations/20260703_05_frontend_canary_validation.sql` no SQL Editor do Lovable;
- configurar `VITE_ORG_TENANCY_ENABLED=true` no ambiente de teste/canário do Lovable;
- manter no banco `public.is_tenancy_enforced() = false`;
- validar login, seletor de organização, empresas, contratos, times, projetos, APF/importação e dashboards;
- validar criação/edição de empresa, contrato, time e projeto quando for seguro;
- confirmar que nenhum fluxo chama `public.set_tenancy_enforcement(true)`.

A ativação real do enforcement deve ser uma operação futura separada, com janela, backup e rollback explícito para `select public.set_tenancy_enforcement(false);`.
