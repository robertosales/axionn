# Plano de ação arquitetural da `develop` — 2026-07-25

## Diagnóstico executivo

A `develop` está sincronizada com `origin/develop` e compila para produção. A análise
anterior está parcialmente desatualizada: já existem implementações para os pilares
3 a 7, portanto eles não devem ser tratados como backlog vazio. O trabalho agora é
transformar implementações heterogêneas em capacidades comprovadas por domínio.

Há quatro trilhas independentes:

1. **Rollout SaaS/tenancy:** depende de evidência do estado real no Lovable Cloud.
2. **Estabilização da `develop`:** a suíte possui quatro regressões de contrato.
3. **RBAC e gestão de usuários:** relatos de produção indicam falhas ao incluir,
   alterar e inativar usuários; esta trilha passa a ser bloqueadora para novos rollouts.
4. **Produto:** Quality Intelligence e OKR V2 avançaram, mas precisam de gates,
   testes de integração, critérios de aceite e rollout próprios.

## Fase A — Baseline confiável e contenção

Objetivo: recuperar uma base de integração verde antes de ampliar escopo.

- Corrigir as quatro regressões atuais de contrato sem relaxar invariantes de segurança.
- Subir PostgreSQL/Supabase local e executar `supabase db lint` e pgTAP.
- Inventariar migrations com timestamp duplicado e dependências entre domínios.
- Congelar novas features até build, lint focal e testes ficarem verdes.

Gate de saída:

- build de produção aprovado;
- Vitest 100% verde;
- lint sem erros;
- pgTAP e lint SQL executados em banco isolado;
- nenhuma alteração destrutiva no Lovable Cloud.

## Fase B — Fechamento operacional de tenancy e Console 2B

Objetivo: separar “código pronto” de “produção comprovada”.

- Consultar a evidência mais recente de `public.is_tenancy_enforced()`.
- Consolidar resultados das Operações 6, 7, 8, 9 e 10 sem reexecutar operações apenas
  para preencher documentação.
- Se enforcement estiver ativo, concluir monitoramento e smoke tenant-crossing.
- Se estiver inativo, exigir nova autorização formal antes da Operação 9.
- Validar o Console 2B com perfis platform admin, org admin, member e usuário externo.

Gate de saída:

- estado remoto inequívoco e registrado;
- `post_enforcement_monitoring_ok = true` quando aplicável;
- rollback ensaiado fora de produção;
- matriz de acesso do Console 2B aprovada.

## Fase B1 — Revisão completa de RBAC e gestão de usuários

Objetivo: restaurar e comprovar o fluxo ponta a ponta de inclusão, alteração,
inativação e reativação de usuários, garantindo consistência entre identidade,
vínculo organizacional, papéis, permissões e status da conta.

Esta fase é prioritária e bloqueia os rollouts das Fases C, D e E enquanto os
fluxos administrativos essenciais apresentarem falhas para usuários autorizados.

### Diagnóstico obrigatório

- Reproduzir os relatos com platform admin, org admin, gestor autorizado e usuário
  sem permissão, registrando request, resposta, código de erro e estado final.
- Mapear o fluxo completo da UI até o banco: formulário, hooks, RPC/Edge Function,
  grants, RLS, triggers, tabelas de perfil, memberships, roles e permissões.
- Inventariar as fontes de autoridade concorrentes, incluindo `profiles.is_active`,
  status no Supabase Auth, `user_roles`, memberships organizacionais, roles por
  módulo e permissões efetivas.
- Verificar divergências entre usuário ativo no Auth e inativo no perfil/RBAC,
  memberships órfãs, papéis duplicados, permissões sem papel e cache de sessão.
- Auditar diferenças de comportamento entre criação por convite, inclusão direta,
  alteração de perfil/papel, inativação, reativação e operações em lote.
- Validar se migrations, assinaturas de RPC, tipos gerados e frontend representam
  o mesmo contrato instalado no ambiente alvo.

### Correções e hardening

- Definir uma única operação transacional para cada mutação administrativa crítica.
- Garantir que somente atores autorizados possam incluir, alterar, inativar ou
  reativar usuários dentro da organização correta.
- Sincronizar `profiles.is_active`, RBAC e Supabase Auth com compensação/rollback
  quando uma etapa falhar, sem retornar sucesso parcial.
- Impedir autoelevação de privilégio, remoção do último administrador válido,
  alteração cross-tenant e gestão de usuário externo à organização.
- Invalidar ou atualizar imediatamente caches de permissões e sessão após mudanças.
- Padronizar erros funcionais na UI, eliminando falhas silenciosas e mensagens
  genéricas que escondam negação por RBAC, RLS ou inconsistência de dados.
- Registrar auditoria append-only com ator, organização, usuário afetado, estado
  anterior, estado posterior, correlação, origem e motivo.
- Produzir migrations aditivas, script de diagnóstico somente leitura, validação
  pós-migration e rollback não destrutivo.

### Cobertura obrigatória

- Testes unitários e de componentes para formulários, estados e mensagens de erro.
- Testes de contrato para assinaturas, grants e ausência de mutação direta crítica.
- pgTAP para RLS, permissões efetivas, isolamento cross-tenant e invariantes.
- Testes de integração para inclusão, edição, troca de papel, inativação, reativação
  e operação em lote.
- E2E por perfil cobrindo sucesso, acesso negado, falha parcial e atualização da UI.
- Smoke no canário com usuários controlados antes de ampliar o rollout.

Gate de saída:

- incluir, alterar, inativar e reativar funcionam ponta a ponta para atores autorizados;
- atores não autorizados recebem negação explícita e não provocam alteração parcial;
- Auth, perfil, membership, papéis e permissões permanecem consistentes;
- isolamento entre organizações comprovado por pgTAP e E2E;
- último administrador protegido e autoelevação bloqueada;
- operações em lote informam sucesso/falha por usuário e são idempotentes;
- auditoria permite reconstruir todas as alterações administrativas;
- matriz de acesso aprovada por papel e tenant;
- canário aprovado sem relatos P0/P1 de gestão de usuários.

## Fase C — Quality Intelligence MVP comercialmente seguro

Objetivo: concluir o fluxo casos → planos → execução sem bypass comercial.

- Corrigir o gate para usar `quality.cases.view` e entitlements efetivos.
- Impedir consulta de entitlement cross-tenant.
- Aplicar guards de rota e navegação orientados por entitlement/permissão.
- Cobrir erros, loading e empty states nas páginas.
- Adicionar testes de contrato, hooks/componentes e pgTAP de isolamento.
- Produzir preflight/rollout cumulativo para todas as migrations Quality, não apenas PR 1.

Gate de saída:

- flag global + entitlement tenant + RBAC atuando em conjunto;
- CRUD e execução manual validados ponta a ponta;
- isolamento cross-tenant comprovado;
- rollout canário com rollback não destrutivo.

## Fase D — OKR V2 estabilizado

Objetivo: provar o novo modelo antes de aposentar fluxos legados.

- Mapear coexistência entre OKR legado e V2.
- Testar CRUD de objetivos/KRs, concorrência, cálculos e fechamento de ciclo.
- Validar entitlement e RLS para todos os writes.
- Definir migração/compatibilidade de dados e telemetria de adoção.

Gate de saída:

- contratos V2 verdes;
- nenhuma escrita direta que contorne RPC transacional;
- estratégia explícita para legado;
- smoke por papel e tenant concluído.

## Fase E — Certificação dos pilares 1–7

Objetivo: classificar cada pilar como fundação, MVP ou produção, em vez de “feito/não feito”.

Para Git, DORA, risco de sprint, Teams, Copilot, integrações corporativas e relatórios:

- inventariar schema, Edge Functions, UI, secrets, observabilidade e testes;
- executar smoke com dependências reais em ambiente autorizado;
- medir idempotência, retries, rate limits, DLQ e correlação;
- registrar SLO, runbook, rollback e ownership;
- priorizar produto somente após certificação técnica.

Gate de saída por pilar:

- fluxo ponta a ponta demonstrável;
- segurança e tenant boundary testados;
- operação observável;
- documentação e rollback aprovados.

## Ordem recomendada

`A → B → B1`. As Fases C, D e E só avançam para rollout depois da aprovação do gate
de RBAC; trabalho local sem dependência remota pode continuar em paralelo. Depois:
`C → D → E`. A próxima feature de IA não deve furar os gates de baseline, tenancy,
RBAC e comercialização.

## Atualização das prioridades OKR/Quality — 2026-07-30

- suíte E2E do fechamento completo do ciclo OKR implementada;
- integração de reviews, carry-forward, iniciativas e alertas implementada;
- fluxo legado tornado read-only e cálculos concorrentes removidos do cliente;
- Fase C coberta pelo teste caso → plano → execução → evidência;
- gate cumulativo final do OKR e dossiê formal do canário criados;
- Fase E classificada individualmente: Git, Teams e integrações em MVP; DORA,
  risco de sprint, Copilot e relatórios em Fundação.

A promoção para Produção permanece condicionada à execução do canário e dos gates
SQL em ambiente remoto autorizado.

## Evidências desta rodada

Estado em 2026-07-25:

- build de produção aprovado com 5.212 módulos transformados;
- suíte Vitest aprovada: 46 arquivos e 235 testes;
- lint focalizado sem erros;
- contratos de plataforma tornados independentes de line ending e de contagens
  acidentais de configuração;
- gate comercial do Quality endurecido com entitlement efetivo, capacidade granular
  e autorização tenant-scoped;
- lint SQL e pgTAP ainda dependem de uma instância PostgreSQL/Supabase local.

A parte local da Fase A está concluída. A Fase B foi concluída em 2026-07-25 com
preflight, ativação e monitoramento aprovados; o enforcement permaneceu ativo após
a Operação 10. A Fase C avançou no gate comercial, guard de rota fail-closed,
navegação orientada por acesso efetivo e validação cumulativa somente leitura.
Ainda requer executar o gate cumulativo no Lovable Cloud, validar o canário por
papel e concluir os testes de integração do fluxo casos → planos → execução.

Atualização em 2026-07-30: a implementação local da Fase B1 corrigiu os caminhos
de inclusão, edição, ativação e inativação após o cutover. Foi criada uma RPC
tenant-scoped transacional e auditada, o fluxo de inclusão foi direcionado para
convites organizacionais e o fallback passou a falhar fechado. A suíte Vitest
ficou verde com 66 arquivos e 319 testes, o build de produção foi aprovado e o
lint focal não apresentou erros. Permanecem pendentes a aplicação da migration,
a validação SQL/pgTAP em banco isolado e o canário por papel e tenant.
