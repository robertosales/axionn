# Axion SaaS — validação multi-tenant em staging

## Objetivo

Comprovar, antes de qualquer ativação em produção, que os recursos empresariais estão corretamente associados a uma organização e que usuários de organizações distintas não conseguem cruzar dados ou vínculos.

A validação foi dividida em dois níveis:

1. **banco local efêmero**, recriado a partir de todas as migrations em cada execução;
2. **staging remoto**, executado manualmente e protegido pelo ambiente `staging` do GitHub.

Nenhum workflow desta fase ativa automaticamente o enforcement multi-tenant.

## Testes locais

O workflow `.github/workflows/database-tests.yml` executa:

```bash
supabase db start
supabase test db supabase/tests/database
```

Os testes locais verificam:

- existência de colunas `org_id` nos recursos centrais;
- existência das RPCs de acesso por organização;
- existência e natureza restritiva das policies;
- permissões das funções administrativas;
- triggers de consistência de contratos, times e projetos;
- isolamento das RPCs entre organizações A e B;
- bloqueio de vínculos cruzados;
- bloqueio de escrita sem organização quando o enforcement é ativado;
- bloqueio operacional de organizações suspensas;
- acesso de suporte do `platform_admin`.

Cada arquivo pgTAP é executado dentro de uma transação e os dados de teste são revertidos ao final.

## Configuração do ambiente GitHub `staging`

Criar um environment chamado `staging` e configurar proteção por aprovação manual. Adicionar os secrets:

| Secret | Uso |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | autenticação da CLI no Supabase |
| `SUPABASE_STAGING_PROJECT_REF` | referência exclusiva do projeto de staging |
| `SUPABASE_STAGING_DB_PASSWORD` | senha do banco de staging |
| `SUPABASE_STAGING_DB_URL` | connection string PostgreSQL de staging, com caracteres especiais percent-encoded |

Os valores de staging não devem reutilizar credenciais ou referências de produção.

## Execução do workflow remoto

Workflow:

```text
🧭 Staging tenancy validation
```

### Somente auditoria

Executar com:

```text
apply_migrations = false
confirmation = vazio
```

O workflow:

1. valida os secrets;
2. vincula a CLI ao projeto de staging;
3. executa `supabase db push --dry-run`;
4. roda os testes de isolamento contra o banco remoto;
5. roda o gate de prontidão pré-enforcement;
6. publica os logs como artifact por 14 dias.

### Aplicação de migrations em staging

Executar com:

```text
apply_migrations = true
confirmation = APPLY-STAGING
```

A confirmação é obrigatória e sensível a maiúsculas. O environment `staging` deve exigir aprovação antes da execução.

O workflow aplica somente migrations pendentes reconhecidas pelo histórico do projeto. Ele não utiliza `--include-all`, não executa reset remoto e não ativa o enforcement.

## Gate de prontidão

O arquivo `supabase/tests/staging/01_pre_enforcement_readiness.test.sql` exige:

- relatório de prontidão sem registros afetados;
- todas as organizações com owner ou admin;
- existência de pelo menos um `platform_admin`;
- enforcement ainda desligado durante a auditoria.

O relatório considera:

- empresas sem `org_id`;
- contratos sem `org_id`;
- times sem `org_id`;
- projetos sem `org_id`;
- contrato e empresa em organizações diferentes;
- contrato e time em organizações diferentes;
- contrato e sala em organizações diferentes;
- projeto e contrato em organizações diferentes;
- projeto e time em organizações diferentes.

## Ativação posterior do enforcement

A ativação não pertence ao workflow de auditoria. Ela deve ocorrer somente após:

1. workflow remoto aprovado;
2. relatório com zero inconsistências;
3. testes com usuários reais de duas organizações;
4. validação do frontend com `VITE_ORG_TENANCY_ENABLED=true`;
5. backup e procedimento de rollback verificados;
6. aprovação formal da mudança.

Com acesso de backend `service_role`:

```sql
select public.set_tenancy_enforcement(true);
```

Rollback operacional:

```sql
select public.set_tenancy_enforcement(false);
```

Desligar o enforcement não remove `org_id`, memberships, policies ou triggers de consistência. Apenas retorna as policies ao modo de compatibilidade durante o saneamento.

## Evidências obrigatórias

Antes do rollout, registrar:

- número da execução do workflow;
- commit validado;
- resultado do dry-run de migrations;
- resultado dos testes pgTAP;
- resultado do relatório de prontidão;
- aprovação do responsável pelo staging;
- horário de ativação e eventual rollback.
