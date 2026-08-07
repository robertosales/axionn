# Evidência formal de canário — OKR V2 e Quality Intelligence

Data-base: 2026-07-30
Estado: **gates de banco aprovados; aguardando canário funcional**

## Atualização operacional

- migration RBAC `20260730210000_organization_member_rbac_management.sql`:
  aplicada com sucesso no Lovable Cloud, conforme confirmação do operador;
- validação RBAC aprovada:
  `organization_member_rbac_validation_ok = true`;
- validação cumulativa Quality aprovada:
  `quality_intelligence_cumulative_validation_ok = true`, com 14/14 tabelas
  protegidas por RLS, 19 RPCs e 8 permissões;
- validação cumulativa OKR aprovada:
  `okr_v2_final_cumulative_validation_ok = true`, sem relações ou funções
  ausentes;
- não foram registrados neste documento segredos, tokens ou dados pessoais.

## Tentativa registrada em 2026-07-30

- `npm.cmd run test:e2e:okr`: runner e navegador iniciados corretamente;
- resultado: `1 skipped`;
- motivo: ausência de `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` e
  `E2E_ORGANIZATION_ID`;
- conexão remota indisponível: `SUPABASE_ACCESS_TOKEN`,
  `SUPABASE_DB_PASSWORD`, `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_PUBLISHABLE_KEY` não estão definidos.

Esse resultado comprova que a suíte é executável, mas não constitui aprovação do
canário funcional.

## Evidência local concluída

- E2E de fechamento completo em `e2e/okr-cycle-closure.spec.ts`;
- integração OKR para reviews, carry-forward, iniciativas e alertas;
- integração Quality para caso → plano → execução → evidência → conclusão;
- fluxo legado OKR read-only e sem cálculo de progresso no cliente;
- gates cumulativos SQL somente leitura.

## Gate remoto

Executar no Lovable SQL Editor, após as migrations finais:

1. `supabase/operations/20260730_05_okr_v2_final_cumulative_validation.sql`;
2. `supabase/operations/20260725_01_quality_intelligence_cumulative_validation.sql`;
3. `supabase/operations/20260730_04_organization_member_rbac_validation.sql`.

Todos os campos finais `*_validation_ok` devem retornar `true`.

| Cenário | Papel | Estado | Evidência exigida |
|---|---|---|---|
| OKR ciclo completo | admin | pendente | log, vídeo e correlation id |
| review/carry-forward | gestor | pendente | ids origem/destino |
| bloqueio de escrita legado | membro | pendente | rota e resposta |
| Quality caso → plano → run | gestor | pendente | ids e anexos |
| RBAC incluir/alterar/inativar | admin | pendente | audit log |
| tentativa cross-tenant | todos | pendente | erro `42501` |

Preencher `.env.e2e.example` e executar `npm.cmd run test:e2e:okr`.

Critério de aprovação: SQL e E2E verdes, ausência de P0/P1, auditoria íntegra e
aprovação nominal de produto, segurança e operação.
