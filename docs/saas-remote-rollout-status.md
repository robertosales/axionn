# Axion SaaS — estado central do rollout no Lovable Cloud

Este documento é a fonte de verdade operacional do rollout SaaS.

## Ambiente e branches

- O Supabase do Axion é o backend gerenciado pelo **Lovable Cloud**.
- Não existe um projeto Supabase de staging separado para este rollout.
- O banco do Lovable Cloud é o banco remoto de produção.
- `main` permanece congelada e fora deste rollout.
- `develop` é a base de integração.
- `codex/saas-remote-rollout` concentra o pacote operacional antes do merge em `develop`.

## Restrições permanentes

- não usar Supabase CLI contra o Lovable Cloud;
- não executar `supabase db push`, `supabase db reset` ou `supabase migration repair`;
- não reparar o histórico de migrations em massa;
- não reaplicar as migrations APF `20260702000026` a `20260702000031`;
- não excluir ou recriar `contract_teams`;
- não criar outra organização para SALES CONSULTORIA;
- não colocar credenciais do Lovable Cloud no GitHub;
- executar arquivos de `supabase/operations` manualmente e em ordem no SQL Editor do Lovable Cloud.

## Estado concluído e confirmado

### Organização licenciada

- Organização: `SALES CONSULTORIA`.
- ID preservado: `d7f226d9-9f08-43a7-b565-482cca58f00d`.
- Slug: `sales-consultoria`.
- Plano/status: `enterprise` / `active`.
- Membros preservados: 4.
- Contratos vinculados: 2.

### APF

- As migrations `20260702000026` a `20260702000031` estão fisicamente materializadas no Lovable Cloud.
- Funções, RPCs, triggers, views, índices e constraints finais foram confrontados com o repositório.
- As correções de contagem já estão em produção.
- O backfill da migration 28 não deve ser repetido.
- O hardening APF não altera fórmulas, fatores, PF ou decisões humanas.

### Fundação e isolamento com enforcement desligado

As evidências registradas no SQL Editor indicam:

- Operação 2: `multitenant_foundation_ok = true`;
- Operação 2: `tenant_rpcs_available = true`;
- Operação 2: `internal_wrappers_secured = true`;
- Operação 2: `tenancy_enforcement_absent_or_disabled = true`;
- Operação 3: `org_resource_isolation_ready_enforcement_off = true`;
- Operação 3: 7 policies tenant boundary e 6 triggers de consistência;
- Operação 4: `final_readiness_ok_enforcement_off = true`;
- Operação 4: `readiness_affected_rows = 0`;
- Operação 4: `organizations_without_owner_or_admin = 0`;
- Operação 4: `platform_admins = 9`;
- Operação 4: `tenancy_setting_enabled = false`.

### Canário do frontend

- aplicação validada com `VITE_ORG_TENANCY_ENABLED=true`;
- Operação 055 de hardening contra recursão RLS aplicada;
- wrappers `can_read_contract_v2` e `can_operate_contract_v2` instalados;
- enforcement permaneceu desligado durante o canário.

A Operação 055 é obrigatória depois da Operação 5 e antes da Operação 6 em qualquer nova execução do fluxo. Ela não deve ser tratada como opcional, porque os gates posteriores dependem dos wrappers instalados por ela.

## Pacote implementado no repositório

O pacote de rollout contém:

1. `20260703_apf_security_hardening.sql` — hardening APF;
2. `20260703_015_audit_log_prereq.sql` — pré-requisito condicional de auditoria;
3. `20260703_01_ai_governance_rollout.sql` — governança e rate limits de IA;
4. `20260703_02_multitenant_foundation_rollout.sql` — fundação multi-tenant;
5. `20260703_03_org_resource_isolation_rollout.sql` — isolamento instalado com enforcement desligado;
6. `20260703_04_final_readiness_validation.sql` — validação estrutural e de dados;
7. `20260703_05_frontend_canary_validation.sql` — entrada do canário;
8. `20260703_055_frontend_canary_rls_recursion_hotfix.sql` — wrappers e policies sem recursão;
9. `20260703_06_frontend_canary_closeout_validation.sql` — fechamento do canário;
10. `20260703_07_canary_observation_gate.sql` — gate de observação;
11. `20260703_08_enforcement_activation_preflight.sql` — pré-ativação sem alterar estado;
12. `20260703_09_enable_tenancy_enforcement.sql` — ativação controlada;
13. `20260703_09_disable_tenancy_enforcement_rollback.sql` — rollback imediato;
14. `20260703_10_post_enforcement_monitoring.sql` — monitoramento pós-ativação.

## Estado da ativação

O repositório registra que a ativação formal foi autorizada e que a Operação 9 foi preparada com rollback explícito. O resultado de execução da Operação 10 ainda não está registrado neste documento.

Até existir evidência do SQL Editor com `post_enforcement_monitoring_ok = true`, o monitoramento pós-ativação deve ser tratado como pendente.

Durante essa janela, o arquivo abaixo deve permanecer pronto para execução imediata:

`supabase/operations/20260703_09_disable_tenancy_enforcement_rollback.sql`

## O que ainda falta

### Implementação de código

Para o escopo atual do rollout, não falta uma nova operação SQL estrutural. O pacote cobre fundação, isolamento, canário, ativação, rollback e monitoramento.

### Execução e comprovação operacional

Falta registrar, conforme o estado real do Lovable Cloud:

- o resultado da Operação 6, caso ainda não tenha sido armazenado;
- o resultado da Operação 7;
- o resultado da Operação 8;
- o resultado da Operação 9 ou do rollback, conforme o estado atual;
- o resultado da Operação 10: `post_enforcement_monitoring_ok = true`.

Não repetir operações já comprovadamente executadas apenas para preencher documentação.

### Histórico de migrations

O alinhamento do histórico remoto continua deliberadamente adiado. Ele só poderá ocorrer por mecanismo suportado pelo Lovable Cloud e após equivalência física integral. A ausência no histórico não autoriza reexecução de migrations.

## Próxima decisão operacional

Antes de qualquer novo SQL, confirmar o estado real de `public.is_tenancy_enforced()` no resultado mais recente já disponível. A partir desse estado:

- se estiver `false`, não executar a Operação 10 e não ativar sem nova autorização formal;
- se estiver `true`, executar o monitoramento pós-ativação e manter o rollback pronto;
- em qualquer falha crítica de acesso, isolamento ou operação, executar imediatamente o rollback.
