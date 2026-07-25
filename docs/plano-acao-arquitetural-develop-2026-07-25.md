# Plano de ação arquitetural da `develop` — 2026-07-25

## Diagnóstico executivo

A `develop` está sincronizada com `origin/develop` e compila para produção. A análise
anterior está parcialmente desatualizada: já existem implementações para os pilares
3 a 7, portanto eles não devem ser tratados como backlog vazio. O trabalho agora é
transformar implementações heterogêneas em capacidades comprovadas por domínio.

Há três trilhas independentes:

1. **Rollout SaaS/tenancy:** depende de evidência do estado real no Lovable Cloud.
2. **Estabilização da `develop`:** a suíte possui quatro regressões de contrato.
3. **Produto:** Quality Intelligence e OKR V2 avançaram, mas precisam de gates,
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

`A → B`, com `C` avançando localmente em paralelo apenas quando não depender do banco
remoto. Depois: `D → E`. A próxima feature de IA não deve furar os gates de baseline,
tenancy e comercialização.

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
a Operação 10. A Fase C avançou no gate comercial e no guard de rota fail-closed,
mas ainda requer filtragem da navegação, testes de integração e rollout cumulativo
do domínio Quality.
