# Ambiente de homologação APF por Contrato/TR

Objetivo: um backend Lovable Cloud separado, isolado de produção, pronto para receber as migrations APF M1–M4 e o teste pgTAP 21 — sem aplicá-los e sem tocar no banco atual.

## Limitação assumida

Eu não consigo criar projetos a partir daqui. O projeto Lovable de homologação precisa ser criado por você (Remix/duplicar este projeto). Ao ser criado, ele provisiona automaticamente um backend Cloud próprio, com URL, chaves e banco totalmente independentes deste. Nada neste plano executa comandos contra o banco atual.

## Passo 1 — Você cria o projeto de homologação

Remix deste projeto com um nome explícito, por exemplo `Axionn HML APF Contrato/TR`. Depois me diga que ele existe e trabalhe comigo dentro dele para os passos 2 em diante.

## Passo 2 — Clone do schema (no projeto novo)

O clone é feito por replay de migrations, não por dump de dados:

- todas as migrations de `supabase/migrations/` são reaplicadas na ordem, recriando extensões, tabelas, views, sequences, funções, triggers, constraints, índices, RLS, grants e roles;
- nenhuma linha de dados de produção é copiada;
- validação pós-replay: contagem de tabelas, funções e políticas comparada com a estrutura esperada.

## Passo 3 — Fixtures seguras em vez de dados reais

Seed sintético mínimo para exercitar APF: 1 organização, 1 contrato, 1 time, 2 projetos, alguns itens de contagem APF e usuários de teste com e-mails `@hml.invalid`. Sem dados pessoais, sem tokens, sem chaves, sem credenciais de terceiros.

## Passo 4 — Neutralização de efeitos externos

No projeto novo:

- nenhum secret de integração é copiado (GitLab, Redmine, Oracle, APEX, Teams, Upstash, provedores de IA ficam vazios);
- Edge Functions com efeito externo não são publicadas; se alguma for necessária, sobe com `INTEGRATIONS_DISABLED=true` e guarda de saída;
- webhooks e cron/GitHub Actions apontando para produção permanecem desligados;
- e-mails transacionais desativados;
- `SITE_URL` do ambiente aponta para a URL de preview do projeto de homologação, nunca `axionn.app`.

## Passo 5 — Estado inicial confirmado (antes de M1–M4)

Relatório com: identificador do projeto, versão do PostgreSQL, extensões instaladas, disponibilidade de pgTAP, confirmação de que as quatro migrations APF não constam no histórico, e confirmação de que webhooks/e-mails/integrações estão inativos.

## Passo 6 — Aguardar a branch

Nada de APF é gerado, reescrito ou aplicado. Quando `feature/apf-contrato-tr-etapa-3` estiver publicada e sincronizada, eu confirmo nomes e hashes SHA-256 de:

```text
supabase/migrations/20260810130000_apf_profile_versioning_foundation.sql
supabase/migrations/20260810130100_apf_versioned_ruleset_catalogs.sql
supabase/migrations/20260810130200_apf_profile_version_lifecycle.sql
supabase/migrations/20260810130300_apf_profile_security_audit.sql
supabase/tests/database/21_apf_profile_versioning.test.sql
```

e só aplico após autorização explícita sua.

## Detalhes técnicos

- Credenciais: cada projeto Lovable Cloud injeta as suas próprias (`VITE_SUPABASE_URL`, chave publicável) automaticamente; não há gravação de credencial em arquivo versionado. Service role key e senha do banco não são expostas em Lovable Cloud — não posso entregar connection string administrativa.
- Execução de SQL e pgTAP no ambiente novo: pelas ferramentas de banco do Lovable dentro daquele projeto. Se você precisar de `supabase test db` via CLI, isso exige um projeto Supabase próprio seu, fora do Cloud gerenciado — posso preparar o runbook.
- Descarte: o projeto de homologação pode ser deletado ao fim, sem efeito sobre produção.

## Pendências conhecidas

- Criação do projeto depende de você.
- Branch APF ainda não publicada.
- Connection string administrativa não disponível em Lovable Cloud.
