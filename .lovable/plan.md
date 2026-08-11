# Ambiente de homologação APF por Contrato/TR — escopo autorizado

Escopo: criação do ambiente isolado, configuração segura, neutralização de integrações e análise estática. Sem replay de migrations, sem M1–M4, sem teste 21, sem cópia de dados, sem qualquer alteração no ambiente atual.

## Passo 1 — Criação do projeto (ação sua, indispensável)

Não existe ferramenta que crie projetos Lovable a partir daqui. Faça o Remix deste projeto com o nome `Axionn HML APF Contrato/TR`. O Remix provisiona um backend Cloud próprio — URL, chaves, banco, storage e edge functions independentes, sem credencial compartilhada com produção.

## Passo 2 — Artefatos que eu crio agora (arquivos inertes, nenhum banco tocado)

`docs/hml-apf-contrato-tr-runbook.md` — runbook do ambiente: configuração segura, tabela de neutralização de integrações, política de fixtures sintéticas, ordem de aplicação de M1–M4, execução do pgTAP e descarte.

`supabase/audits/20260811_hml_initial_state.sql` — script **somente leitura** de verificação de estado inicial, para rodar no projeto novo: versão do PostgreSQL, extensões, disponibilidade de pgTAP, contagem de tabelas/views/funções/policies/triggers, tabelas sem RLS, confirmação de que M1–M4 não constam no histórico, ausência de cron jobs e volumetria zero nas tabelas sensíveis.

## Passo 3 — Configuração segura do projeto novo

- Nenhum secret de produção copiado: GitLab, Redmine, Oracle, APEX, Teams/Graph, Upstash e provedores de IA ficam vazios.
- `SITE_URL` e `PUBLIC_SITE_URL` apontando para a URL de preview do ambiente novo, nunca `axionn.app`.
- `VITE_BACKOFFICE_MFA_REQUIRED=false` para não bloquear a homologação.

## Passo 4 — Neutralização de integrações externas

Edge functions de integração não publicadas (ou publicadas com `INTEGRATIONS_DISABLED=true`); nenhum webhook registrado em qualquer direção; GitHub Actions sem secrets do ambiente novo; e-mails transacionais e de auth desligados; nenhum job em `pg_cron`.

## Passo 5 — Análise estática das migrations

Baseline já levantado por leitura do ambiente atual: PostgreSQL 17.6; extensões `pg_cron 1.6.4`, `pg_net 0.20.0`, `pg_stat_statements 1.11`, `pg_trgm 1.6`, `pgcrypto 1.3`, `plpgsql 1.0`, `supabase_vault 0.3.1`, `uuid-ossp 1.1`, `vector 0.8.0`; **pgTAP não instalado**; 374 migrations no repositório, a última `20260810125835_...`.

A análise estática de M1–M4 fica pendente: os quatro arquivos e o `21_apf_profile_versioning.test.sql` não existem neste workspace, pois a branch `feature/apf-contrato-tr-etapa-3` não foi publicada. Nada será gerado nem substituído — quando os arquivos chegarem, confirmo nomes e hashes SHA-256 antes de qualquer execução.

## Fora deste escopo, aguardando nova autorização

Replay das migrations existentes, aplicação de M1–M4, execução do teste 21 e qualquer cópia de dados.
