# Runbook — ambiente de homologação APF por Contrato/TR

Ambiente isolado para validar `feature/apf-contrato-tr-etapa-3`. Nenhum passo deste documento toca o ambiente de produção.

## 1. Criação do ambiente (ação manual, obrigatória)

Remix deste projeto com o nome `Axionn HML APF Contrato/TR`. O Remix provisiona um backend Lovable Cloud próprio: URL, chaves publicáveis, banco, storage e edge functions independentes. Não há conexão nem credencial compartilhada com o ambiente atual.

## 2. Configuração inicial segura (no projeto novo)

- Não copiar nenhum secret do ambiente atual. Devem permanecer ausentes: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, tokens GitLab, Redmine, Oracle, APEX, Teams/Graph e chaves de provedores de IA.
- `SITE_URL` e `PUBLIC_SITE_URL` apontando para a URL de preview do projeto de homologação. Nunca `https://axionn.app`.
- Flags: `VITE_ORG_TENANCY_ENABLED` e `VITE_OKR_V2_ENABLED` conforme o cenário de teste; `VITE_BACKOFFICE_MFA_REQUIRED=false` para não bloquear a homologação.

## 3. Neutralização de integrações externas

| Recurso | Ação |
|---|---|
| Edge functions de integração (`git-webhook-handler`, `redmine-sync`, `oracle-sync`, `apex-webhook`, `teams-meeting-connector`, `teams-bot`, `copilot-plugin`) | Não publicar. Se alguma for necessária, publicar com `INTEGRATIONS_DISABLED=true`. |
| Webhooks externos | Nenhum registro apontando para o novo ambiente; nenhum registro do novo ambiente para produção. |
| GitHub Actions (`okr-recalculation-queue`, `gitlab-issues-reconcile`) | Manter apontadas apenas para produção; não adicionar secrets do ambiente novo. |
| E-mails transacionais e de auth | Desligados no projeto de homologação. |
| `pg_cron` | Nenhum job agendado (verificado pelo passo 7 do script de auditoria). |

## 4. Verificação de estado inicial

Executar, no projeto de homologação, `supabase/audits/20260811_hml_initial_state.sql`. É somente leitura. Critérios de aprovação:

- PostgreSQL 17.x;
- extensões presentes: `pgcrypto`, `uuid-ossp`, `pg_trgm`, `vector`, `pg_net`, `supabase_vault`;
- `pgtap` listado em `pg_available_extensions`;
- consulta 6 retornando vazio (M1–M4 não aplicadas);
- consulta 7 retornando vazio (sem cron jobs);
- consultas 8 e 9 com volumetria zero ou apenas fixtures sintéticas.

Baseline do ambiente atual, para comparação: PostgreSQL 17.6; extensões `pg_cron 1.6.4`, `pg_net 0.20.0`, `pg_stat_statements 1.11`, `pg_trgm 1.6`, `pgcrypto 1.3`, `plpgsql 1.0`, `supabase_vault 0.3.1`, `uuid-ossp 1.1`, `vector 0.8.0`; **pgTAP não instalado**; 374 migrations no repositório, a última `20260810125835_...`.

## 5. Dados

Nenhum dado de produção é copiado. Quando fixtures forem necessárias, gerar dados sintéticos: 1 organização, 1 contrato, 1 time, 2 projetos, itens APF de exemplo e usuários com e-mail `@hml.invalid`. Sem dados pessoais, tokens, senhas ou chaves.

## 6. Migrations APF M1–M4 (bloqueadas)

Aplicar somente após autorização explícita, e apenas os arquivos vindos da branch, sem reescrita:

```text
supabase/migrations/20260810130000_apf_profile_versioning_foundation.sql
supabase/migrations/20260810130100_apf_versioned_ruleset_catalogs.sql
supabase/migrations/20260810130200_apf_profile_version_lifecycle.sql
supabase/migrations/20260810130300_apf_profile_security_audit.sql
```

Antes da aplicação, registrar nome e hash de cada arquivo:

```bash
shasum -a 256 supabase/migrations/202608101300*.sql \
  supabase/tests/database/21_apf_profile_versioning.test.sql
```

Ordem de execução: replay completo das migrations existentes -> auditoria de estado inicial -> M1 -> M2 -> M3 -> M4, uma por vez, conferindo o resultado entre elas.

## 7. Teste pgTAP

```sql
create extension if not exists pgtap;
```

```bash
supabase test db supabase/tests/database/21_apf_profile_versioning.test.sql \
  --db-url "$HML_DB_URL"
```

Em Lovable Cloud não há connection string administrativa exposta; nesse caso o teste roda pelas ferramentas de banco dentro do projeto de homologação, ou em banco local efêmero (`supabase db start`), padrão já usado pelo workflow `database-tests.yml`.

## 8. Descarte

O projeto de homologação pode ser deletado ao fim, sem qualquer efeito sobre produção.
