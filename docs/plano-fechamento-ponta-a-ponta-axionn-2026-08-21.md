# Plano de fechamento ponta a ponta do Axionn

**Data:** 21/08/2026  
**Branch analisada:** `develop` @ `b2b40eb0`  
**Objetivo:** levar o Axionn de uma base funcional ampla para uma release promovível, operável e comprovada em produção, sem reabrir regras de negócio estáveis.

## 1. Diagnóstico executivo

O roadmap recebido é uma boa fotografia da frente UX/RBAC, mas não é suficiente como plano de fechamento do produto. Ele descreve bem as pendências UX-002 a UX-007 e identifica o timeout E2E de RBAC, porém deixa fora do caminho crítico gates de banco, ambiente, observabilidade, release, jornadas de negócio, decisão sobre trabalho paralelo e aceite operacional.

O estado local medido em 21/08/2026 é:

- `develop` está 115 commits à frente de `main` e sem commits atrás;
- worktree limpo e `git diff --check` aprovado;
- build de produção aprovado, com alerta de chunk do APF acima de 500 kB;
- lint CI aprovado com 0 erros e 1.709 warnings;
- suíte Vitest reprovada por 1 teste de contrato em `src/components/TeamMembersManager.contract.test.ts`;
- o E2E de RBAC tem timeout global alto e depende de credenciais/ambiente, portanto ainda precisa de reprodução instrumentada;
- existem 174 arquivos de teste/spec entre frontend, E2E e banco, mas isso não equivale a cobertura comprovada das jornadas críticas;
- há documentação conflitante: `docs/saas-remote-rollout-status.md` afirma que não existe staging Supabase separado e proíbe CLI contra o Lovable Cloud, enquanto `.github/workflows/staging-tenancy-validation.yml` pressupõe um projeto de staging e pode executar `supabase db push`;
- a branch remota `feature/apf-contrato-tr-etapa-3` continua separada e exige decisão de produto antes do congelamento de escopo.

Conclusão: o Axionn está em fase de estabilização e certificação, não de reconstrução. A estratégia correta é congelar o escopo, recuperar todos os gates, comprovar as jornadas essenciais e fazer rollout canário com rollback ensaiado.

## 2. Definição objetiva de “Axionn fechado”

O produto será considerado fechado para a release quando todos os critérios abaixo estiverem comprovados por evidência versionada:

1. escopo funcional da release aprovado e branch APF decidida;
2. unitários, contratos, integração, build, lint CI, E2E críticos e banco verdes;
3. RBAC completo sem timeout e sem acesso cross-tenant;
4. jornadas P0 dos módulos executadas com perfis representativos;
5. migrations reconciliadas com o ambiente alvo, sem operação destrutiva ou reaplicação indevida;
6. logs, alertas, Sentry, jobs agendados e runbooks operacionais validados;
7. vulnerabilidades críticas/altas zeradas ou formalmente aceitas com mitigação;
8. acessibilidade P1 do roadmap concluída;
9. canário aprovado, rollback testado e decisão go/no-go registrada;
10. `develop` promovida a `main`, tag criada e smoke pós-release aprovado.

## 3. Princípios de execução

- Mudanças de UX não alteram regra de negócio, payload, RLS, RBAC, cálculo ou schema.
- Migrations publicadas nunca são reescritas; correções são aditivas e reversíveis.
- Produção/Lovable Cloud nunca é usada como ambiente de teste destrutivo.
- Cada item fecha com código, teste, evidência, observabilidade e rollback proporcionais ao risco.
- Nenhuma migração ampla de componentes compartilhados acontece sem inventário de consumidores.
- ADRs que exigem decisão humana não bloqueiam a estabilização, salvo quando afetam consistência ou operação da release.

## 4. Plano de execução por fases

### Fase 0 — Governança e congelamento de escopo

**Objetivo:** definir exatamente o conteúdo da release e eliminar decisões implícitas.

Entregas:

- decidir incluir, adiar ou extrair `feature/apf-contrato-tr-etapa-3`;
- classificar backlog em P0 release, P1 pós-estabilização e P2/P3 pós-release;
- definir ambiente oficial de homologação e reconciliar a contradição Lovable Cloud versus workflow de staging;
- nomear responsáveis por produto, engenharia, banco, segurança e go-live;
- criar matriz de jornadas críticas e perfis de teste;
- congelar novas features até o Gate 2.

**Gate 0:** escopo assinado, ambiente alvo inequívoco, branch APF decidida e nenhuma feature nova entrando em `develop`.

### Fase 1 — Recuperação da baseline verde

**Objetivo:** restabelecer confiança na branch antes de ampliar alterações.

Ordem de implementação:

1. corrigir a divergência entre `TeamMembersManager.tsx` e seu teste de contrato, verificando se houve regressão funcional ou teste excessivamente acoplado a whitespace;
2. rodar suíte Vitest completa e registrar quantidade final de arquivos/testes;
3. rodar `npm run lint:ci`, `npm run build` e `git diff --check`;
4. executar lint/replay de migrations e pgTAP em banco local ou staging isolado autorizado;
5. verificar os workflows obrigatórios e remover/ajustar qualquer gate incompatível com a política real de ambiente;
6. atualizar a baseline documentada com resultados reproduzíveis.

**Gate 1:** todos os checks locais e CI verdes, sem relaxar asserções de segurança nem aumentar o teto de warnings.

### Fase 2 — Bloqueadores RBAC, tenancy e identidade

**Objetivo:** comprovar o fluxo administrativo mais sensível do produto.

Implementação ponta a ponta:

- instrumentar `e2e/rbac-governance-smoke.spec.ts` por etapa, request, response, console e trace;
- separar tempo de autenticação, carregamento do workspace, RPCs de membros, auditoria, simulação e governança;
- reproduzir `/sala-agil/perfis` com platform admin, org admin, gestor autorizado e usuário sem permissão;
- corrigir a causa raiz sem criar fallback legado nem ampliar permissão;
- cobrir inclusão direta, convite, edição, inativação, reativação, vínculo/desvínculo de time e troca de módulo;
- validar invalidação de cache/sessão após mudança de papel;
- executar testes cross-tenant e de último administrador;
- registrar causa raiz e tempos antes/depois em `docs/`.

**Gate 2:** E2E RBAC repetido três vezes sem flake/timeout, contratos e pgTAP verdes, nenhuma mutação parcial e isolamento tenant comprovado.

### Fase 3 — Fechamento UX e acessibilidade P1

**Objetivo:** concluir o escopo objetivo e de baixo risco do roadmap.

Lotes:

1. **UX-003:** nomes acessíveis e teclado em `RdmList`, `ProjetosAdminPanel`, `DashboardFilters`, `KanbanFilterBar` e `SprintHistoryTable`;
2. **UX-002:** inventariar tabelas ordenáveis fora de `ReportDataTable` e aplicar botão focável + `aria-sort` sem alterar ordenação/paginação;
3. **UX-004:** ADR curto do contrato Loading/Empty/Filtered Empty/Error e piloto em Sala Ágil; expansão apenas após aprovação do piloto;
4. **UX-006:** contrato de PageHeader e uma página piloto operacional;
5. **UX-007:** contagem e limpeza de filtros no `ReportFilterBar`, preservando filtros reativos versus explícitos;
6. **UX-005:** produzir ADR de feedback global, sem migração em massa nesta release.

Para cada alteração: teste Testing Library, navegação por teclado, nome acessível contextual, contraste/foco e validação em 320, 375, 768 e desktop.

**Gate 3:** P1 sem violações conhecidas nas telas alteradas, suíte verde e aceite visual do piloto. P2/P3 não entram por oportunidade.

### Fase 4 — Certificação funcional das jornadas P0

**Objetivo:** provar que os módulos funcionam como sistema, não apenas como componentes isolados.

Jornadas mínimas:

| Domínio | Jornada P0 |
|---|---|
| Autenticação | login, callback, reset de senha, MFA e logout |
| Organização | empresa, contrato, projeto, time, membro e limites do plano |
| Sala Ágil | backlog/feature/HU, sprint, kanban, planning poker, retrospectiva e relatório |
| Sustentação | demanda, SLA, atividade, encerramento e indicadores sem alterar fórmulas |
| RDM | criação, checklist, go/no-go, aprovação, auditoria e encerramento |
| APF | evidências, contagem, validação, dossiê, exportação e isolamento de projeto |
| OKR | ciclo, objetivo, KR, check-in, fechamento e recálculo agendado |
| Qualidade | caso, suíte, plano, execução, achado e cobertura |
| Backoffice | cliente, assinatura, financeiro, suporte e provedores de IA |
| Integrações | health check, segredo, retry/idempotência e falha degradada |

Cada jornada deve cobrir caminho feliz, permissão negada, erro recuperável e isolamento entre organizações. Dados de teste devem ser identificáveis e removíveis sem afetar produção.

**Gate 4:** matriz P0 100% aprovada; defeitos P0/P1 zerados; P2 com aceite explícito e plano.

### Fase 5 — Dados, segurança e operação

**Objetivo:** tornar a release segura e operável.

Entregas:

- reconciliar migrations locais versus ambiente alvo usando apenas o fluxo autorizado;
- validar RLS, grants, `security definer`, search path, storage e Edge Functions;
- executar auditoria de dependências e secret scanning;
- revisar rate limits, idempotência, retries e proteção dos jobs GitLab/OKR;
- comprovar Sentry no frontend e logging estruturado/correlação nas Edge Functions;
- definir alertas para autenticação, 5xx, latência RPC, filas, cron e integrações;
- validar backup, restauração e rollback de aplicação/migration;
- publicar runbooks de incidente, indisponibilidade de Supabase, falha de integração e reversão de release;
- tratar o chunk APF de 506 kB como P1 de performance ou aceitar formalmente para a release com métrica de carregamento.

**Gate 5:** zero vulnerabilidade crítica/alta sem aceite, restore/rollback ensaiado, alertas testados e checklist operacional aprovado.

### Fase 6 — Homologação, canário e promoção

**Objetivo:** promover com risco controlado.

Sequência:

1. criar release candidate imutável a partir de `develop`;
2. executar regressão completa no ambiente de homologação definido na Fase 0;
3. realizar UAT com usuários representantes de cada perfil e módulo contratado;
4. habilitar canário por organização/feature flag, sem migração irreversível;
5. observar erros, latência, jobs e tickets pelo período acordado;
6. registrar reunião go/no-go com evidências dos Gates 0–5;
7. promover `develop` para `main`, criar tag SemVer e release notes;
8. executar smoke pós-release e manter janela de rollback;
9. encerrar o congelamento somente após estabilidade confirmada.

**Gate 6:** smoke de produção aprovado, métricas dentro do limite, nenhum P0/P1 e release/rollback documentados.

## 5. Backlog priorizado de implementação

| Ordem | ID | Entrega | Dependência | Evidência de conclusão |
|---:|---|---|---|---|
| 1 | AXN-000 | Corrigir baseline Vitest | nenhuma | suíte completa verde |
| 2 | AXN-001 | Diagnosticar e corrigir timeout RBAC | credenciais/ambiente E2E | trace + 3 execuções verdes |
| 3 | AXN-002 | Resolver contrato de ambiente staging/Lovable | decisão operacional | ADR/runbook + CI coerente |
| 4 | AXN-003 | Decidir branch APF etapa 3 | produto | merge, extração ou adiamento registrado |
| 5 | UX-003 | Acessibilidade icon-only/teclado | Gate 1 | testes por componente |
| 6 | UX-002 | Ordenação acessível | inventário | testes `aria-sort` |
| 7 | AXN-004 | Matriz E2E P0 multi-módulo | Gates 1–2 | relatório de execução |
| 8 | UX-004 | Contrato de estados + piloto | inventário | ADR + teste + aceite |
| 9 | UX-006/007 | Headers e filtros piloto | Gate 3 parcial | DOM/snapshot + aceite |
| 10 | AXN-005 | Banco, segurança e observabilidade | ambiente definido | evidências do Gate 5 |
| 11 | UX-005 | ADR de toast | decisão humana | ADR aprovado |
| 12 | AXN-006 | RC, UAT, canário e promoção | Gates 0–5 | checklist go-live |

## 6. Cadência e estratégia de branches

- Um PR por item ou lote coeso; evitar PR transversal por módulo inteiro.
- Branches curtas a partir de `develop`, rebase/merge frequente e nenhuma correção incidental.
- Commits devem indicar arquivos, comportamento preservado e validações executadas.
- Após Gate 4, criar release candidate e aceitar apenas correções P0/P1.
- Toda alteração de banco inclui preflight, aplicação, pós-validação e rollback.

Estimativa de referência para uma equipe pequena com acesso aos ambientes:

- Fases 0–1: 2 a 4 dias úteis;
- Fase 2: 3 a 6 dias;
- Fase 3: 4 a 7 dias;
- Fase 4: 5 a 10 dias;
- Fase 5: 3 a 6 dias;
- Fase 6: 2 a 5 dias mais janela de observação.

Faixa total: 3 a 6 semanas, condicionada à disponibilidade de credenciais, usuários de UAT e ambiente isolado. A estimativa deve ser recalibrada após os Gates 0 e 2.

## 7. Próxima sequência concreta

1. corrigir hoje o teste/implementação de `TeamMembersManager` e recuperar a suíte verde;
2. abrir investigação instrumentada do E2E RBAC;
3. decidir formalmente ambiente de homologação e branch APF;
4. executar UX-003 e UX-002 em PRs pequenos enquanto RBAC é validado;
5. montar a matriz P0 e automatizar as jornadas que ainda não têm cobertura;
6. completar segurança/operação, emitir RC e iniciar UAT/canário.

Essa sequência transforma o roadmap original em um programa de fechamento: estabilização, certificação funcional, preparação operacional e promoção controlada.
