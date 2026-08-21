# Matriz de certificação P0 — Axionn

**Data do inventário:** 21/08/2026  
**Estado:** cobertura local inventariada; execução autenticada/remota pendente de ambiente isolado

Esta matriz diferencia presença de automação de certificação real. Um teste existente não torna a jornada aprovada sem dados, perfis e ambiente representativos.

| Domínio | Jornada P0 | Evidência automatizada existente | Estado de fechamento |
| --- | --- | --- | --- |
| Autenticação | login, callback, reset, MFA, logout | `Auth.test.ts`, `mfa.contract.test.ts`, `public-shell-smoke.spec.ts` | local coberto; smoke autenticado pendente |
| Organização/RBAC | contrato, projeto, time, membro, convite, papéis, limites | contratos de organization/RBAC, pgTAP 01–09/15/18/19, E2E RBAC e times | baseline local verde; E2E com credenciais e 3 repetições pendente |
| Sala Ágil | backlog, HU, sprint, Kanban, poker, retro, relatório | contratos de backlog/Kanban/poker, testes de relatórios | cobertura parcial; jornada integrada pendente |
| Sustentação | demanda, SLA, atividade, encerramento, indicadores | testes de utilitário e componentes; alertas SLA | cobertura parcial; E2E ausente |
| RDM | criação, checklist, go/no-go, aprovação, auditoria, encerramento | componentes e contratos de acesso compartilhados | E2E P0 ausente |
| APF | evidência, contagem, validação, dossiê, exportação, isolamento | ampla suíte de contratos/serviços, pgTAP 21, E2E de dossiê | forte cobertura local; homologação remota pendente |
| OKR | ciclo, objetivo, KR, check-in, fechamento, job | unidade, integração, contratos cumulativos e E2E OKR | forte cobertura local; E2E autenticado pendente |
| Qualidade | caso, suíte, plano, execução, achado, cobertura | unidade, integração, contratos e pgTAP 10/11 | forte cobertura local; E2E ausente |
| Backoffice | cliente, assinatura, financeiro, suporte, IA | contratos SaaS e serviços administrativos | cobertura parcial; E2E ausente |
| Integrações | health, segredo, retry, idempotência, degradação | `integrationHealthContract`, contratos GitLab, rate limiter e circuit breaker | contrato local coberto; provedores reais pendentes |

## Perfis obrigatórios

Cada jornada remota precisa ser executada com:

1. platform admin;
2. administrador da organização sem privilégio de plataforma;
3. gestor autorizado do módulo/time;
4. membro operacional;
5. usuário autenticado sem permissão;
6. usuário pertencente a outra organização para prova negativa de tenancy.

## Cenários obrigatórios por jornada

- caminho feliz com persistência confirmada após reload;
- permissão negada sem mutação parcial;
- falha recuperável com retry idempotente;
- isolamento cross-tenant;
- auditoria com ator, organização, ação, alvo e timestamp;
- logout/invalidação de sessão quando o papel mudar;
- dados de teste identificáveis e removíveis.

## Ordem recomendada de automação restante

1. RBAC e memberships — bloqueador de promoção;
2. autenticação/MFA — bloqueador de segurança;
3. Sala Ágil e Sustentação — maior superfície operacional;
4. RDM e Qualidade — governança e auditoria;
5. Backoffice — impacto comercial/financeiro;
6. integrações reais — executar apenas com secrets de homologação;

## Critério de conclusão

Uma linha muda para `aprovada` somente quando contém link para execução, ambiente, commit, perfil, resultado, artefato e responsável. Execução contra Lovable produção não pode ser usada para criar dados destrutivos de teste.
