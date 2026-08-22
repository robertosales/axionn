# Release readiness — Axionn

**Release candidate:** ainda não emitido  
**Resultado atual:** NO-GO operacional — implementação local em fechamento, gates externos pendentes

## Evidências locais

- [x] baseline Vitest recuperada;
- [x] E2E RBAC instrumentado com diagnóstico sanitizado;
- [x] UX-002 e UX-003 concluídos;
- [x] UX-004, UX-006 e UX-007 implementados com testes e ADRs;
- [x] ADR de feedback global produzido sem migração prematura;
- [x] staging automatizado protegido contra identidade com produção;
- [x] release baseada em commit tagueado imutável e já promovido a `main`;
- [x] Sentry, interceptador global, correlation id e health de integrações presentes no código;
- [x] suíte completa, lint, build e audit do lote final registrados abaixo;
- [x] smoke público Playwright aprovado em Chromium;
- [ ] checks de banco bloqueados por runtime local ausente e versões históricas duplicadas.

## Decisões humanas pendentes

- [ ] Roberto aprova ou rejeita o ADR-006 de feedback global;
- [ ] Produto decide adiar ou rebasear `feature/apf-contrato-tr-etapa-3`;
- [ ] Operação provisiona staging Supabase separado ou aceita formalmente que os gates remotos permanecem bloqueados;
- [ ] responsáveis por Produto, Engenharia, Banco, Segurança e Go-live são nomeados;
- [ ] usuários representantes executam UAT;
- [ ] go/no-go é assinado após Gates 0–5.

### Recomendação técnica para APF etapa 3

Não fazer merge direto. O inventário de 21/08 mostra 108 commits somente em `develop`, 13 commits somente na branch, 19 arquivos alterados e quatro migrations de versionamento/perfil. Se o produto incluir a etapa, criar branch nova a partir de `develop`, reaplicar/revisar os 13 commits, executar replay de migrations em staging isolado e revalidar toda a suíte APF. Para a release corrente, a recomendação é adiar.

## Gates remotos

- [ ] `/sala-agil/perfis` executado três vezes sem timeout com os perfis da matriz;
- [ ] pgTAP e tenancy executados em banco local limpo e staging isolado;
- [ ] migrations reconciliadas sem `repair`, reset ou reaplicação no Lovable;
- [ ] jornadas da matriz P0 aprovadas;
- [ ] evento sintético confirmado no Sentry correto e sem PII;
- [ ] alertas de autenticação, 5xx, latência RPC, cron e integrações disparados e reconhecidos;
- [ ] backup/restore comprovado pelo operador;
- [ ] rollback de aplicação e de tenancy ensaiado;
- [ ] canário por organização observado na janela acordada.

### Bloqueador de migrations

O preflight encontrou 407 migrations, nomes válidos e cinco versões numéricas duplicadas:

- `20260709190000`: briefing retention policy / fix de grant de platform admin;
- `20260709230000`: briefing stabilization / phase 7 usage reports;
- `20260718090000`: commercial usage enforcement / OKR commercial catalog seed;
- `20260719090000`: OKR entitlement enforcement / quality management MVP;
- `20260721000000`: entitlement enforcement / quality permissions v1.

Não renomear esses arquivos sem confrontar o histórico e os objetos físicos do ambiente remoto. Migrations possivelmente publicadas são imutáveis. A resolução segura é inventariar o estado em staging isolado e, se necessário, criar migrations aditivas com versões novas.

## Runbook de promoção

1. congelar `develop` e resolver apenas P0/P1;
2. atualizar `package.json` e `package-lock.json` em commit próprio;
3. executar gates locais e CI no mesmo SHA;
4. promover esse SHA para `main` por PR protegido;
5. criar tag `vX.Y.Z` no commit de `main` — nunca antes;
6. confirmar que o workflow publica a release sem alterar branches;
7. habilitar canário reversível para organizações selecionadas;
8. observar Sentry, 5xx, RPC, jobs, integrações e suporte;
9. ampliar em ondas somente com métricas saudáveis;
10. registrar smoke final e encerrar a janela de rollback.

## Rollback

Aplicação: reimplantar o artefato/tag anterior, sem reescrever a tag atual.  
Tenancy: usar a operação versionada `supabase/operations/20260703_09_disable_tenancy_enforcement_rollback.sql` pelo fluxo manual autorizado do Lovable.  
Banco: migrations publicadas recebem forward-fix; não usar reset, repair ou `db push` em produção.  
Feature: desligar flags reversíveis e preservar dados para análise.  
Incidente: registrar início, impacto, correlation ids, decisão, ações e recuperação sem incluir secrets/PII.

## Registro dos gates finais

| Gate | Resultado | Evidência |
| --- | --- | --- |
| Vitest | aprovado | 149 arquivos / 633 testes |
| ESLint CI | aprovado | 0 erros / 1.709 warnings legados, abaixo do teto 1.723 |
| Build | aprovado com débito aceito provisoriamente | APF 506,43 kB; warning acima de 500 kB |
| Audit produção e completo | aprovado | 0 vulnerabilidades |
| YAML de workflows | aprovado | staging e release parseados; contrato Vitest aprovado |
| Smoke público | aprovado | Playwright Chromium: 3/3 |
| Migration preflight | reprovado | 407 arquivos; cinco versões duplicadas históricas |
| Supabase DB lint/pgTAP | bloqueado | banco local não está ativo; conexão recusada |
| E2E autenticado | bloqueado | `.env.e2e` válido e staging isolado ausentes |
