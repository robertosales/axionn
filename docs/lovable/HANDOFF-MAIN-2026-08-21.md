# Handoff Lovable — preparação para merge em `main`

## Regra de execução

Não executar Supabase CLI contra o projeto remoto. O Lovable deve confrontar o estado físico e o histórico antes de aplicar qualquer arquivo. Não reaplicar migrations já materializadas.

## Escopo desde `main`

- 35 migrations novas em `supabase/migrations`;
- 6 caminhos de Edge Functions alterados;
- frontend e tipos Supabase que dependem principalmente do domínio APF, cadastro organizacional e hardening.

Edge Functions alteradas:

- `admin-user-management`;
- `apf-dossier-semantic-suggestions`;
- `apf-generate`;
- `apf-jira-webhook`;
- `git-webhook-handler`;
- `organization-invitations`.

## Etapa 1 — Preflight obrigatório

Peça ao Lovable para:

1. listar as migrations reconhecidas no ambiente e confrontá-las com `supabase/migrations`;
2. verificar a existência dos objetos criados pelas 35 migrations novas;
3. classificar cada migration como `já aplicada`, `pendente` ou `divergente`;
4. conferir especialmente as cinco colisões registradas em `legacy-version-collisions.txt`;
5. não alterar arquivo, timestamp ou histórico durante o diagnóstico;
6. devolver relatório sem secrets ou dados pessoais.

Interromper se houver objeto divergente, dependência ausente ou dúvida sobre migration já aplicada.

## Etapa 2 — Aplicação

Após o relatório, aplicar somente migrations classificadas como pendentes, em ordem lexicográfica, usando o mecanismo do Lovable. Cada aplicação deve ser atômica quando o SQL permitir. Não aplicar em lote cego.

Depois das migrations, publicar somente as seis Edge Functions alteradas e configurar secrets pelo painel do Lovable. Não copiar secrets para o repositório ou logs.

## Etapa 3 — Pós-validação

Executar pelo Lovable:

- `supabase/audits/apf_dossier_homologation_readiness.sql`;
- testes SQL de tenancy, organização, APF, OKR e Qualidade aplicáveis ao estado final;
- criação/leitura/atualização autorizada e negação cross-tenant;
- smoke das seis Edge Functions;
- verificação de logs, correlation id e auditoria;
- RBAC em `/sala-agil/perfis` com perfis autorizados e negados.

## Etapa 4 — Evidência para retorno

Devolver:

- commit SHA do pacote;
- lista de migrations já aplicadas, aplicadas agora e não aplicadas;
- Edge Functions publicadas;
- resultados dos testes e smokes;
- erros com correlation id, sem secrets;
- decisão final `APROVADO` ou `REPROVADO`.

O merge em `main` só é liberado depois de `APROVADO`.
