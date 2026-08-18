# Homologação do Dossiê APF por Impacto

Este runbook fecha a diferença entre código entregue e operação comprovada. A proposta só pode ser marcada como homologada depois que todos os gates abaixo tiverem evidência anexada.

## 1. Banco de dados

Aplicar, em ordem cronológica, todas as migrations de `20260817120000_apf_evidence_dossiers_foundation.sql` até `20260818290000_apf_server_readiness_gate.sql`. Não executar apenas as migrations mais recentes: elas endurecem objetos criados nas etapas anteriores.

Depois, executar `supabase/diagnostics/apf_dossier_homologation_readiness.sql`. O resultado esperado é zero linhas com `status = 'missing'` e oito permissões APF registradas.

Executar a suíte transacional:

```powershell
psql $env:TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/database/21_apf_dossier_rbac_isolation.test.sql
```

Resultado esperado: seis testes pgTAP aprovados e `ROLLBACK`, sem resíduos de fixture.

## 2. Edge Functions

Implantar as funções que participam do fluxo:

```powershell
npx supabase functions deploy git-webhook-handler --no-verify-jwt
npx supabase functions deploy redmine-sync --no-verify-jwt
npx supabase functions deploy apf-jira-webhook --no-verify-jwt
npx supabase functions deploy apf-dossier-semantic-suggestions
```

Configurar `AI_PROVIDER_ALLOWED_HOSTS` quando o provedor OpenAI-compatible não estiver na allowlist padrão. Jira requer registro service-only em `apf_jira_webhook_integrations`, header `x-integration-id`, header `x-jira-webhook-secret` e campo configurado contendo o UUID da HU Axionn.

GitLab usa `x-gitlab-token`; GitHub usa `x-hub-signature-256` e `x-github-delivery`; Azure DevOps usa `x-azure-webhook-token` ou senha Basic, `x-vss-event` e `x-integration-id`.

## 3. Cenário funcional ponta a ponta

1. Criar três usuários distintos: criador, validador e homologador.
2. Criar dossiê ligado a organização, contrato, projeto, sprint, HU, baseline, modelo e sessão oficial.
3. Importar especificação DOCX ou PDF contendo objetivo, atores, regras, objetos, operações, fronteira, RNFs e critérios.
4. Importar pelo menos uma evidência autenticada de Git e uma de Jira ou Redmine; cadastrar uma evidência manual com justificativa.
5. Confirmar vínculos CA × evidência e garantir evidência verificada para toda decisão positiva.
6. Revisar DET/FTR/RET, matriz ALI/AIE e exceções; justificar qualquer override.
7. Confirmar que cada item contado possui evidência literal ou vínculo técnico e que o total da memória coincide com a sessão.
8. Validar com o usuário validador. Alterar o Markdown e comprovar que o hash adulterado é rejeitado.
9. Homologar a última versão com o usuário homologador; comprovar que criador e validador são rejeitados.
10. Exportar Markdown, DOCX e JSON; reexportar e comparar conteúdo/hash do snapshot.
11. Criar sucessor, homologá-lo e confirmar que o original virou `superseded` somente nesse momento.
12. Consolidar em lote, submeter, aprovar com pessoa distinta, registrar glosa/resolução e enviar ao faturamento.
13. Exportar ZIP/PDF e conferir manifesto, versões, hashes, decisões e conteúdo integral das 18 seções.

## 4. Segurança negativa

- Usuário de outra organização não visualiza dossiê, versões, lote ou integração Jira.
- Perfil sem `collect_evidence` não inclui nem importa evidência.
- Perfil sem `validate` não cria snapshot.
- Perfil sem `homologate` não homologa dossiê, aprova lote ou envia faturamento.
- Perfil sem `export` não baixa documento nem pacote.
- Dossiê homologado rejeita alteração in-place.
- Evidência direta sem `manual_evidence=true` e justificativa é rejeitada.

## 5. Evidências para aceite final

Guardar: saída completa do pgTAP; relatório dos testes Vitest/Playwright; IDs e logs das quatro Edge Functions; hashes das três reexportações; PDF/ZIP gerados; eventos `validated`, `homologated`, `exported` e `superseded`; decisões do lote; captura dos testes cross-tenant e registro de quem executou cada papel.

Sem essas evidências, o estado correto é **implementado, aguardando homologação operacional**, e não “concluído de ponta a ponta”.
