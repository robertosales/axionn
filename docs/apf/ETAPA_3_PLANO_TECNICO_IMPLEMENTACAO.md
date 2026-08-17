# ETAPA 3 — PLANO TÉCNICO DE IMPLEMENTAÇÃO DO APF POR CONTRATO/TR

> Status: PLANEJAMENTO — NENHUMA ALTERAÇÃO EXECUTADA
>
> Etapa de referência: ETAPA 2 — ARQUITETURA PROPOSTA PARA APF POR CONTRATO/TR
>
> Data: 2026-08-10

## Premissas, escopo e legenda de evidência

Este plano resulta de busca global e leitura do schema, migrations, Edge Functions e consumidores em `src`. Não houve introspecção de banco local/remoto; portanto, “existe” significa **presente no repositório**, não “implantado em produção”. Nenhuma migration da Etapa 2 existe/aplicou-se como parte deste trabalho.

- **CONFIRMADO:** evidência direta no repositório.
- **PARCIALMENTE CONFIRMADO:** parte existe, mas falta requisito essencial.
- **NÃO CONFIRMADO / NÃO ENCONTRADO:** busca global não localizou a estrutura.
- **INCOMPATÍVEL:** comportamento atual contraria a arquitetura-alvo.
- **PROPOSTO:** decisão deste plano, ainda não implementada.
- **PRECISA DE DECISÃO:** regra de negócio necessária para fechar implementação.

Princípio inegociável:

> **IA PROPÕE. BANCO CALCULA. SNAPSHOT CONGELA. SESSION REGISTRA. ITEM MATERIALIZA. AUDITORIA PROVA.**

## 1. Validação da Etapa 2

| Item | Decisão Etapa 2 | Evidência no código | Status | Impacto |
| --- | --- | --- | --- | --- |
| Perfil e versão formal de TR | `ApfProfile` + `ApfProfileVersion` | Busca global não encontrou `apf_profiles`, `apf_profile_versions` ou equivalentes temporais | NÃO ENCONTRADO NO REPOSITÓRIO | Schema aditivo é necessário |
| Ruleset versionado | Regras tipadas por versão | `apf_counting_rules`, `apf_function_types`, `apf_impact_factors` dependem de `model_id`; `apf_counting_models.contract_id` é único em `20260620_001...` | PARCIALMENTE CONFIRMADO | Há catálogo reutilizável, mas mutável e sem vigência |
| Pesos existentes devem ser reutilizados | Reusar `apf_function_type_weights` | Criada em `20260625000011_apf_project_baseline_catalog.sql`; `resolve_apf_item_weight` a consulta | CONFIRMADO | Migrar/capturar para versão, sem criar catálogo conceitualmente duplicado |
| Snapshot financeiro | Toda execução congela configuração | `apf_counting_sessions` guarda `model_id`/`baseline_id`; itens materializam valores, mas não existe `apf_execution_snapshots` nem hash completo | NÃO CONFIRMADO | Lacuna probatória crítica |
| Sessão e item são fontes do resultado | Resultado materializado | `apf_counting_sessions` e `apf_counting_items` existem; RPCs persistem peso, fator, percentual, `pf_bruto`/`pf_fs` e totais | CONFIRMADO | Estender, não substituir |
| Banco é autoridade financeira | Motor determinístico | `save_contractual_counting_items`, `resolve_apf_item_weight`, `resolve_apf_factor_decision` e materialização calculam no SQL | PARCIALMENTE CONFIRMADO | Algumas decisões ainda chegam de IA/TS e regras são atuais, não snapshot |
| IA apenas propõe/evidencia | IA não determina total oficial | `useContractualApfCounting` monta prompt, chama `apf-generate`, persiste análise e depois usa RPCs; prompt orienta cálculo no banco | PARCIALMENTE CONFIRMADO | Formalizar schema e rejeitar/ignorar campos financeiros recebidos |
| Prompt builder único | Snapshot alimenta um builder | Há `build_apf_prompt` em SQL e `buildStructuredProcessAnalysisPrompt` em TS; `count-function-points` tem prompt/few-shot próprio | INCOMPATÍVEL | Três fontes podem divergir |
| Legacy Ruleset v1 | Preservar legado | `useFunctionPointCounter` invoca `count-function-points`; `FunctionPointBaseline` usa `project_fp_baselines`; Edge Function grava `function_point_analyses` e `user_stories` | CONFIRMADO | Não remover; adaptar por compatibilidade e telemetria |
| RLS hierárquica | organização → contrato → execução | RLS inicial deriva acesso por modelo/projeto; `20260731010055...` adiciona `apf_can_access_model/session/baseline`; implantação não verificada | PARCIALMENTE CONFIRMADO | Validar migrations efetivas e cobrir novas entidades |
| RPCs tenant-aware | Contexto e transações no banco | `open_counting_session` é `SECURITY DEFINER`; há RPCs de análise/materialização e hardening de grants | PARCIALMENTE CONFIRMADO | Falta contexto versionado/snapshot e matriz uniforme de autorização |
| Contrato como raiz | Projeto resolve contrato | `projects.contract_id`, `apf_counting_models.contract_id` e resolução em RPCs | CONFIRMADO | Congelar `contract_id` na sessão/snapshot |
| Imutabilidade | Publicado/snapshot não altera | Modelos/catálogos atuais possuem updates e `updated_at`; não há versão publicada | INCOMPATÍVEL | Triggers/privileges/RPCs append-only necessários |
| Vigência explícita | Resolver por data de medição | Não há `effective_from/effective_until` no modelo atual | NÃO ENCONTRADO NO REPOSITÓRIO | Nunca usar `MAX(version)`/“mais recente” |
| Shadow Mode | Comparar sem escrita oficial | Não há `apf_shadow_runs`/`apf_shadow_items` | NÃO ENCONTRADO NO REPOSITÓRIO | Implementar após engine e snapshot |
| Feature flags | Rollout incremental | Há infraestrutura comercial `product_features`, entitlements e `assert_feature_access`, mas não foram encontradas flags APF solicitadas | PARCIALMENTE CONFIRMADO | Reusar resolvedor/catálogo; separar entitlement comercial de rollout operacional |
| Observabilidade | Métricas/auditoria | Existem eventos APF, logs Edge e Sentry no frontend; não há taxonomia de snapshot/shadow/fallback | PARCIALMENTE CONFIRMADO | Instrumentação é gate de piloto |
| Golden master | Congelar comportamento atual | Testes de helpers APF existem, mas suíte golden dos dois motores não foi encontrada | NÃO CONFIRMADO | É a primeira entrega, antes do schema |

### Consumidores confirmados pela busca global

- Runtime contratual: `useContractualApfCounting` → `open_counting_session` → `buildStructuredProcessAnalysisPrompt` → `apf-generate` → RPCs de persistência/análise/materialização; consumido por `ApfFunctionPointTab`, `ApfAnalysisReviewDialog`, `ApfValidationDialog` e catálogo APF.
- Runtime de baseline contratual: `projectBaselineCounting.service.ts`, `useApfCatalog`, `useApfBaselineImport`, `ApfBaselineTab`, `PaginatedApfStoryList` e `ApfStoryList`.
- Runtime legado: `useFunctionPointCounter` → `count-function-points` → `function_point_analyses`/`user_stories`; `FunctionPointModal`, `FunctionPointSprintSummary`, `FunctionPointBadge` e `FunctionPointBaseline` o expõem; `learning.service.ts` também lê `function_point_analyses` validada.
- Contratos: `src/features/admin/hooks/useContracts.ts` prefere RPCs organizacionais e mantém fallback direto; `src/features/contracts/services/contracts.service.ts` faz CRUD direto, SLA e vínculos. `ContractForm`, `ContractDetail`, `ContractsDashboard`, `ContractWizardDialog`, contextos e hooks dependem dessas rotas.
- Builders: `build_apf_prompt` SQL, `buildStructuredProcessAnalysisPrompt` TS e prompt/few-shot interno de `count-function-points`.
- RPCs relacionadas confirmadas: `open_counting_session`, `save_contractual_counting_items`, `validate_apf_counting_item`, `resolve_apf_item_weight`, `resolve_apf_factor_decision`, `resolve_apf_process_analysis_v2`, `materialize_apf_process_analysis`, `reset_apf_story_counting`, `get_active_apf_context`.

## 2. Mapa de Impacto

```text
Banco → RPC → Edge Functions → Services → Hooks → Componentes → Fluxos de UX
```

| Camada | Arquivo | Elemento | Situação atual | Alteração futura | Risco | Dependências | Prioridade |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Banco | `20260620_001_multi_tenancy_apf_engine.sql` | modelos/catálogos/sessões/itens | Modelo mutável 1:1 por contrato | Perfis/versões/snapshot aditivos; manter legado | Alto | Golden, decisões financeiras | P0 |
| Banco | `20260625000011...` | `apf_function_type_weights` | Peso por modelo/tipo/complexidade | Reusar como origem do Legacy v1; copiar para catálogo versionado na publicação | Alto | canonicalização | P0 |
| Banco | `20260625000008...`, `...20...`, `20260702...` | engine/processos/cérebro | Cálculo e heurística divididos | Engine v2 recebe somente snapshot + proposta estrutural | Crítico | snapshot, golden | P0 |
| Banco | `20260619000001...`, `...19150000...` | `function_point_analyses` | Persistência legado | Preservar leitura/escrita no fallback; telemetria | Alto | adaptador legacy | P1 |
| RPC | `20260624000004...` | `open_counting_session` | Resolve modelo/baseline atual | Nova versão resolve contexto + snapshot atomicamente; overload antigo intacto | Crítico | RLS/versionamento | P0 |
| RPC | `20260702000030...` | `resolve_apf_process_analysis_v2` | Resolve catálogo corrente | V3 snapshot-aware; V2 fica no legado | Alto | engine v2 | P1 |
| Edge | `supabase/functions/apf-generate` | geração genérica | Recebe prompt e retorna conteúdo | Receber `snapshot_id`/policy ou prompt final, retornar proposta validável | Médio | builder único | P1 |
| Edge | `supabase/functions/count-function-points` | motor legado | Prompt, IA e persistência própria | Preservar; adicionar correlação/fallback e depois adaptador de snapshot legacy | Alto | golden/telemetria | P1 |
| Edge | `process-apf-job` | worker assíncrono | Processa fila APF | Propagar IDs/hash/versões sem calcular finanças | Médio | observabilidade | P2 |
| Service | `projectBaselineCounting.service.ts` | builder TS | Regras/prompt próprios | Tornar renderer único, sem constantes financeiras | Alto | prompt policy | P1 |
| Service | `contracts.service.ts` | CRUD de contratos | Escrita direta | Delegar gradualmente às RPCs tenant-aware administrativas | Alto | contrato compartilhado | P2 |
| Hook | `useContractualApfCounting.ts` | orquestração | Abre sessão, chama IA e materializa | Resolver contexto/snapshot, enviar proposta e ler breakdown | Alto | todas as RPCs v2 | P1 |
| Hook | `useFunctionPointCounter.ts` | legado | Invoca Edge e lê analyses | Manter; instrumentar; adaptar atrás de flag | Alto | Legacy v1 | P1 |
| Hook | dois `useContracts.ts` | contrato/admin | Autoridades distintas/fallback | API compartilhada e telemetria de fallback | Médio | RPC administrativa | P2 |
| Componente | `ApfFunctionPointTab.tsx` | contagem contratual | Fluxo atual de sessão/revisão | Badges versão/snapshot/engine/legacy/shadow e breakdown | Médio | hook v2 | P2 |
| Componente | `ApfBaselineTab.tsx` | baseline | Importação/seleção | Mostrar compatibilidade e hash da baseline | Médio | snapshot | P2 |
| Componente | dialogs APF | revisão/validação | Override e validação | Evidenciar proposta versus valor calculado; motivo obrigatório | Médio | engine v2 | P2 |
| Componente | `ContractForm/Detail` | gestão contratual | Sem perfil/TR APF | Área de perfil, versões, vigência e publicação | Médio | RPCs de versionamento | P2 |
| Componente | `FunctionPointBaseline.tsx` | baseline legado | CRUD `project_fp_baselines` | Preservar e rotular Legacy v1 | Baixo | flag | P2 |
| UX | Admin APF/contrato | governança | NÃO ENCONTRADO como tela de versões | Draft → review → approved → published → retired | Alto | autorização/negócio | P2 |

## 3. Arquitetura de Implementação

```text
Projeto → Contrato → Perfil APF → Versão publicada vigente do TR
       → resolve_apf_execution_context(measurement_reference_at)
       → ExecutionSnapshot imutável + hash
       → CountingSession
       → IA: Structured Proposal (sem autoridade financeira)
       → validação estrutural/humana
       → Database Deterministic Engine v2
       → CountingItems + calculation_breakdown
       → PF bruto → PF ajustado → PF faturável
```

| Papel | Fonte única | Regra |
| --- | --- | --- |
| Configuração editorial | `ApfProfileVersion`, ruleset e catálogos versionados | Editável apenas em draft; publicação congela |
| Execução | `apf_execution_snapshots` | Autossuficiente, canônico, hash SHA-256, append-only |
| Resultado | `apf_counting_sessions` + `apf_counting_items` | Materialização oficial; leitura não recalcula |
| Cálculo | Engine determinístico no PostgreSQL | Lê snapshot, rejeita inconsistência e ignora valores financeiros da IA |
| Proposta | IA | Classificação, evidência, candidatos e justificativa; nunca peso/percentual/total autoritativo |

Uma correção sempre segue `nova versão → novo snapshot → nova sessão`; versão/snapshot usados nunca são alterados, apagados, recalculados ou sobrescritos.

## 4. Ordem de Implementação

| Fase | Objetivo e arquivos futuros | Migrations/RPCs/funções | Testes e dependências | Flag | Rollback e conclusão |
| --- | --- | --- | --- | --- | --- |
| 0 | Golden master dos runtimes atual/legado | Sem migration | Fixtures reais anonimizadas; independente | nenhuma | Só avança com baseline aprovado e reproduzível |
| 1 | Contratos de domínio/canonicalização | Migration de tipos/helpers, testes TS/SQL | Fase 0; hash determinístico cross-runtime | tudo off | Reverter código helper; nenhuma linha histórica tocada |
| 2 | Schema aditivo de perfil/versão/catálogos | Migrations M1–M3 | Constraints, vigência, no-overlap | `APF_PROFILE_VERSIONING` off | Desativar flag; tabelas vazias podem permanecer |
| 3 | RLS, grants, imutabilidade e auditoria | M4 | Cross-tenant, papéis, direct RPC | off | Revogar acesso novo; não apagar publicados |
| 4 | Publicação/versionamento | `publish_apf_profile_version` e transições | Concorrência, segregação, hash | profile em canário | Voltar flag; versão publicada permanece histórica |
| 5 | Resolver contexto e criar snapshot | M5/M6; `resolve_*`, `create_*` | Vigência, lacuna/sobreposição, idempotência | `APF_EXECUTION_SNAPSHOT` | Fallback Legacy v1; nunca alterar snapshot |
| 6 | Estender sessão/item aditivamente | M7 | Compatibilidade nullable e imutabilidade | snapshot | Desligar nova abertura; colunas ficam |
| 7 | Engine determinístico v2 | M8; `calculate/materialize_v2` | Peso, fator, arredondamento, dedupe, PF | `APF_DETERMINISTIC_ENGINE_V2` | Roteamento volta ao engine atual |
| 8 | Adaptador Legacy Ruleset v1 | M9/configuração lógica | Equivalência decimal e writes atuais | `APF_LEGACY_FALLBACK=true` | Manter runtime original |
| 9 | Shadow isolado | M10/M11 | Zero writes oficiais e classificação de delta | `APF_SHADOW_MODE` | Desligar worker; preservar evidência shadow |
| 10 | Prompt builder único/Edge | TS + Edge versionados | Contract/schema, hash e erro IA | engine/shadow | Voltar builder atual |
| 11 | Frontend/admin | hooks/components mapeados | Componentes, acessibilidade, estados | `APF_NEW_FRONTEND` | UI antiga permanece disponível |
| 12 | Migração gradual de consumidores | hooks APF e legado | E2E ambos motores + telemetria | por org/contrato | Reverter roteamento por contrato |
| 13 | Piloto e rollout | configuração de flags | SLO, RLS, golden/shadow gates | gradual | Kill switch por contrato/org |
| 14 | Strict snapshot | nova sessão exige snapshot | Cobertura 100% das novas sessões | `APF_STRICT_SNAPSHOT` | Desativar strict; histórico congelado |
| 15 | Depreciação | somente após zero uso comprovado | Telemetria ≥ janela acordada, migração e aceite | legacy continua disponível | Nenhum DROP nesta onda; plano separado |

## 5. Plano de Migrations

Todas estão com status **NÃO CRIADA**. O timestamp real deve ser monotônico e seguir `YYYYMMDDHHMMSS_descricao.sql` (o repositório contém nomes antigos irregulares, que não devem ser repetidos).

| ID / nome sugerido | Objetivo e dependências | Cria/altera | Índices, constraints, triggers, RLS/RPC | Compatibilidade, rollback, risco |
| --- | --- | --- | --- | --- |
| M1 `202608xx010000_apf_profile_versioning_foundation.sql` | Perfis/versões; golden aprovado | Cria `apf_profiles`, `apf_profile_versions` | uniques por contrato/código e perfil/versão; checks de estado/data | Aditiva; flag off; risco alto de regra de vigência |
| M2 `..._apf_versioned_ruleset_catalogs.sql` | Ruleset/catálogos por versão; M1 | Cria ruleset, tipos, pesos, fatores, manutenção, precedência | uniques naturais, FK restritiva, checks decimais/códigos | Sem copiar dados ainda; rollback lógico |
| M3 `..._apf_profile_version_lifecycle.sql` | Canonicalização, hash, intervalo sem sobreposição; M1/M2 | Altera versões | exclusion/validação transacional, trigger append-only após publicação | Não reverter versão usada; risco concorrência |
| M4 `..._apf_profile_security_audit.sql` | RLS/grants/audit; M1–M3 | Cria eventos de auditoria se não houver equivalente utilizável | policies por organização/contrato, triggers; revoke direct write | Rollback por revoke/flag; risco cross-tenant crítico |
| M5 `..._apf_execution_snapshots.sql` | Snapshot imutável; M1–M4 | Cria snapshots | unique de chave idempotente/hash; trigger deny update/delete; RLS | Conteúdo histórico nunca removido; risco storage/hash |
| M6 `..._apf_execution_context_rpcs.sql` | Contexto e snapshot atômicos; M5 | RPCs `resolve`/`create` | locks, grants authenticated/service_role controlados | Overloads atuais preservados; risco resolução incorreta |
| M7 `..._apf_session_snapshot_compat.sql` | Ligar sessão/item ao snapshot | Altera sessões/itens com colunas nullable | FKs, índices snapshot/version/contract; trigger consistência | Legado continua null/is_legacy; sem backfill destrutivo |
| M8 `..._apf_deterministic_engine_v2.sql` | Engine oficial snapshot-aware | RPCs/functions v2 | checks de breakdown, idempotency key e grants | Não substituir overloads v1; risco financeiro crítico |
| M9 `..._apf_legacy_ruleset_v1.sql` | Registrar configuração legacy canônica | Perfil/versão especial ou builder de snapshot legacy | unique por contrato/hash; sem mudar resultados | Fallback preservado; risco divergência de captura |
| M10 `..._apf_shadow_schema.sql` | Tabelas shadow isoladas | Cria `apf_shadow_runs/items` | FKs sem cascata para oficial, índices status/delta, RLS | Drop apenas se vazias; risco de dados volumosos |
| M11 `..._apf_shadow_execution_rpcs.sql` | Executar/comparar shadow | RPCs shadow | revoke direto; validação `is_official=false`; auditoria | Flag off interrompe; não promove linhas shadow |
| M12 `..._apf_rollout_feature_catalog.sql` | Registrar flags no mecanismo existente | Catálogo/entitlements/config de rollout | uniques existentes; resolver por org + override contrato | Defaults seguros; rollback por desabilitação |
| M13 `..._apf_observability_events.sql` | Eventos/métricas técnicas | Reusar auditoria ou criar eventos mínimos | índices por correlation/status/time; retenção | Sem payload sensível; risco baixo |
| M14 `..._apf_strict_snapshot_enforcement.sql` | Tornar snapshot obrigatório somente em novas sessões v2 | Constraints/trigger condicionado ao runtime v2 | validação sem tocar legado | Aplicar por último; rollback desligando strict |

## 6. Modelo de Dados Final

| Tabela | Finalidade; PK/FKs | Constraints/índices | RLS, imutabilidade e lifecycle |
| --- | --- | --- | --- |
| `apf_profiles` | Identidade lógica; PK UUID; FK contrato e `base_model_id` opcional | unique `(contract_id, code)`; um default ativo por escopo | Leitura do contrato; edição admin; soft-retire |
| `apf_profile_versions` | TR versionado; FK profile | unique `(profile_id, version_no)`; status; `effective_from < effective_until`; sem sobreposição publicada | Draft editável via RPC; published/retired append-only |
| `apf_profile_rulesets` | Política tipada 1:1 da versão | unique `profile_version_id`; checks de algoritmo/arredondamento/escala | Herda acesso da versão; congela na publicação |
| `apf_profile_function_types` | Tipos permitidos/versionados | unique versão+código; limites válidos | Cópia semântica do catálogo corrente; não duplicar runtime após snapshot |
| `apf_profile_function_weights` | Pesos por tipo/complexidade | unique versão+tipo+complexidade; peso ≥ 0 | Derivar inicialmente de `apf_function_type_weights`; imutável publicada |
| `apf_profile_factors` | Fator/percentual contratual | unique versão+código; percentual em faixa decidida | Sem autoridade da IA |
| `apf_profile_maintenance_rules` | Critérios tipados de manutenção | prioridade/intervalos não ambíguos | Regex apenas como evidência/classificação, não total livre |
| `apf_profile_precedence_rules` | Ordem de fontes aceitas | unique versão+ordem/fonte; fontes em enum | Precedência explícita e auditável |
| `apf_execution_snapshots` | Fotografia autossuficiente | PK; FKs contrato/projeto/perfil/versão/baseline; JSONB canônico e hash | índices contexto/hash; INSERT por RPC; UPDATE/DELETE negados |
| `apf_shadow_runs` | Comparação não oficial | PK; FK sessão oficial e snapshot candidato | status/delta/input hash; retenção; nunca vira oficial |
| `apf_shadow_items` | Delta por processo/item | PK; FK shadow run; chaves canônicas | unique run+key; somente namespace shadow |

Reutilizações obrigatórias: `apf_counting_sessions/items` continuam como resultado; `apf_function_type_weights` alimenta Legacy v1 e publicação inicial; `apf_impact_factors`, `apf_function_types` e `apf_counting_rules` são fontes de captura legacy, não prova futura. Não se propõe uma tabela genérica `rulesets` separada: `apf_profile_rulesets` cobre o conceito sem colisão.

## 7. Alterações em Estruturas Existentes

| Estrutura | Decisão | Alteração planejada e motivo |
| --- | --- | --- |
| `apf_counting_sessions` | ALTERAR/ADAPTAR | Adicionar nullable `contract_id`, `profile_id`, `profile_version_id`, `snapshot_id`, `ruleset_hash`, `measurement_reference_at`, `algorithm_version`, `is_legacy`, `correlation_id`; imutáveis após abertura v2 |
| `apf_counting_items` | ALTERAR/ADAPTAR | Preservar colunas; normalizar `effective_weight/factor/percentage`, PF bruto/ajustado/faturável, rounding e `calculation_breakdown`; item sempre aponta à sessão |
| `apf_counting_models` | MANTER/DEPRECIAR COMO PROVA | Continua catálogo/editor legacy; não usar como prova de execução v2; sem remoção até telemetria/migração |
| `apf_function_type_weights` | MANTER/REUTILIZAR | Fonte do motor atual e da captura Legacy v1; catálogo versionado recebe cópia na publicação |
| `project_fp_baselines` | MANTER LEGADO | Consumidor ativo `FunctionPointBaseline`; não confundir com `apf_project_baselines`; migrar apenas após equivalência/telemetria |
| `function_point_analyses` | MANTER LEGADO | Edge/hook/learning ativos; registrar correlação e origem quando adaptado, sem apagar histórico |

Não haverá remoção nesta implementação. Qualquer DROP futuro exige ausência de consumidores, migração, telemetria, equivalência, rollback e aprovação.

## 8. Plano de RPCs

| RPC | Assinatura proposta/retorno | Autorização, validações e transação | Locks/idempotência/erros/tabelas |
| --- | --- | --- | --- |
| `resolve_apf_execution_context` | `(p_project_id uuid, p_measurement_reference_at timestamptz, p_profile_code text default null) → jsonb tipado` | authenticated; membro projeto/contrato ou admin; valida org, contrato, versão published, vigência e baseline | Read-only; erro em lacuna/sobreposição; lê projects/contracts/profiles/versions |
| `create_apf_execution_snapshot` | `(p_context jsonb, p_idempotency_key text) → uuid/hash` | Mesma autorização; revalida contexto dentro da transação; canonicaliza no banco | advisory/row locks por contexto; unique idempotência; insere snapshot |
| `publish_apf_profile_version` | `(p_version_id uuid, p_expected_revision bigint, p_reason text) → uuid/hash/status` | owner/admin org ou global; `admin_contrato` somente se negócio autorizar; valida aprovação e catálogo completo | `FOR UPDATE` no perfil/versões; conflito `40001/23505`; versões/catálogos/audit |
| `transition_apf_profile_version` | `(id, from_status, to_status, reason) → status` | Matriz de papel/segregação; transições válidas | optimistic revision + lock; idempotente se já no destino compatível |
| `open_counting_session_v2` | `(project_id, reference_at, profile_code, idempotency_key, source_ref) → session/context/snapshot` | membro autorizado; chama resolver/criar snapshot e valida baseline | Uma transação; unique sessão aberta pela chave; não altera overload atual |
| `calculate_apf_counting_v2` | `(session_id, proposal jsonb, idempotency_key) → totals/breakdown` | acesso à sessão; schema estrito; rejeita snapshot/hash divergente | lock sessão; repetição retorna mesmo resultado; itens/sessão/audit |
| `finalize_apf_counting_session_v2` | `(session_id, expected_revision, decision, reason) → receipt` | papel de validação; todos os itens resolvidos | lock sessão; finalizada é imutável; erro de estado/conflito |
| `run_apf_shadow` | `(official_session_id, candidate_snapshot_id, idempotency_key) → shadow_run_id` | gestores/autorizados; não chama funções com side effects oficiais | transação isolada; unique run/input; apenas shadow tables |
| `get_apf_execution_receipt` | `(session_id) → jsonb` | mesmo acesso à sessão | Read-only; retorna IDs, hashes, algoritmo e breakdown, sem prompt integral |

RPCs atuais (`open_counting_session`, `resolve_apf_factor_decision`, `resolve_apf_process_analysis_v2`, materialização/reset) permanecem. Novas versões não devem substituir assinaturas até migração. Toda `SECURITY DEFINER`: `search_path = public, pg_temp`, objetos qualificados, `auth.uid()` interno, `REVOKE ALL FROM PUBLIC/anon`, grant mínimo, erros sem revelar tenant e nenhuma confiança em `organization_id` recebido.

## 9. Plano de Segurança e RLS

```text
organization → contract → profile → profile_version → snapshot → session → items
```

| Recurso | SELECT | INSERT | UPDATE | DELETE | RPC |
| --- | --- | --- | --- | --- | --- |
| Perfil | membro contrato; admin org/global | admin_contrato do contrato + admin/owner | mesmos, via RPC | não; retirar logicamente | tenant derivado do contrato |
| Versão draft/review | editores/revisores autorizados | via RPC | somente draft/review | draft sem uso, se aprovado pelo negócio; preferir arquivar | transitions auditadas |
| Versão published/retired | membros autorizados | publicação via RPC | negado | negado | append-only |
| Snapshot | por sessão/projeto/contrato | somente RPC | negado | negado | hash revalidado |
| Sessão/item | membro do projeto/time + contrato; admins | somente RPC v2 | transições/materialização por RPC | negado para oficial | checagem dupla projeto+contrato+org |
| Shadow | gestores e participantes definidos | somente RPC shadow | status técnico via RPC | retenção controlada | proíbe chamadas oficiais |

Auditoria conceitual: policies iniciais `FOR ALL` em filhos APF são amplas e dependem de subqueries; hardening `apf_can_access_*` melhora derivação, mas seu estado implantado é **NÃO VERIFICADO**. Existem múltiplos vínculos (`projects.contract_id`, `teams.contract_id`, `contract_teams`, `contract_room_teams`) e CRUD direto de contrato; divergência pode criar caminho cross-tenant. Antes do deploy: inventário de policies/grants efetivos, matriz por papel (`owner/admin`, `admin_contrato`, membro de projeto e contrato), testes de IDOR e revisão de cada `SECURITY DEFINER`.

`admin_contrato` nunca recebe poder implícito sobre outro contrato da mesma organização. Membro de projeto sem vínculo contratual coerente deve falhar fechado. `service_role` fica restrito a workers identificados, com validação explícita do tenant no payload.

## 10. Plano do Motor Determinístico

**VALORES FINANCEIROS ENVIADOS PELA IA NÃO SÃO AUTORIDADE.** Campos `weight`, `percentage`, `factor_value`, `pf_*`, `total` vindos da IA serão rejeitados ou descartados antes do cálculo.

| Etapa | Entrada → regra → saída | Fonte/configuração/limites | Teste |
| --- | --- | --- | --- |
| Validação estrutural | proposal → schema estrito, IDs pertencem à sessão → proposta normalizada | Fixa por schema/algoritmo | campos extras, tipo inválido, tenant errado |
| Tipo | evidência/candidato → código permitido → function type | Snapshot; configurável em conjunto fechado | alias, desconhecido, TRN/IFPUG |
| Complexidade | DET/FTR/RET e tipo → matriz sem ambiguidade → classe | Snapshot; limites crescentes e completos | fronteiras e gaps |
| Peso | tipo+complexidade → lookup exato → decimal | Snapshot; configurável ≥0 e escala limitada | todas combinações/falta/duplicata |
| Fator | contexto/classificação/humano → precedência explícita → código | Snapshot; fontes/ordem configuráveis | cada precedência e empate |
| Percentual | fator → lookup exato → decimal | Snapshot; faixa de negócio; nunca IA | limites e fator ausente |
| Processo elementar | ações/evidências → regra de inclusão/auxiliar → processo | Snapshot + algoritmo fixo versionado | CRUD, consulta, auxiliar |
| Deduplicação | chave canônica → uma ocorrência efetiva → conjunto | Fixa por `algorithm_version`; canonicalização versionada | acentos, case, duplicatas cross-HU |
| PF bruto | peso efetivo → fórmula tipada → PF bruto | Fixa por algoritmo | precisão decimal |
| PF ajustado | bruto+percentual/política → fórmula → PF ajustado | Configurável com limites | 0/100, manutenção |
| Arredondamento | valor não arredondado → modo/escala na etapa definida → decimal | Snapshot; enum e escala limitada | half-up/even e negativos se permitidos |
| PF faturável | ajustado + aceite/glosa/teto → política → PF faturável | PRECISA DE DECISÃO; tipado | parcial, glosa, teto, reprocesso |
| Breakdown | operandos/fontes/versões → JSON schema → evidência | Fixa; sem dados pessoais | recomposição exata do total |

O engine usa `numeric`, nunca ponto flutuante. Soma e arredondamento seguem ordem explicitada no ruleset. Falta/duplicidade de configuração é erro, não default silencioso. Consultas nunca recalculam sessões finalizadas.

## 11. IA e Prompt Builder

Confirmados três builders/fontes: SQL `build_apf_prompt`, TS `buildStructuredProcessAnalysisPrompt` e o prompt/few-shot de `count-function-points`. A arquitetura futura é:

```text
Snapshot → Prompt Policy → renderer TS único versionado → prompt final/hash
→ IA → Structured Proposal → validação Zod/JSON Schema → engine no banco
```

Schema permitido da proposta: `schemaVersion`, `promptVersion`, `correlationId`, lista de processos com `clientKey`, `name`, `description`, `suggestedFunctionType`, `complexityInputs` (`det/ftr/ret` quando evidenciáveis), `suggestedFactorCode`, `evidence[]`, `confidence`, `assumptions[]` e `sourceRefs[]`. Campos financeiros são proibidos/ignorados e geram evento de segurança/qualidade.

Erros: JSON inválido, schema incompatível, timeout ou provider indisponível não materializam resultado; sessão fica em estado recuperável, tentativa é registrada e reenvio usa idempotência. Versionar renderer, schema, policy e provider/model. Hash do prompt usa conteúdo redigido/canônico; logs guardam hash, tamanhos, versões, latência, tokens, status e correlation ID — não prompt/TR/HU integrais. SQL atual vira adaptador Legacy v1 durante transição; Edge não contém constantes financeiras.

## 12. Compatibilidade com Legacy

- Detectar: sessão sem snapshot/perfil, chamada pelo `useFunctionPointCounter`/`count-function-points`, ou contexto resolvido explicitamente como `legacy-v1`; nunca inferir apenas por ausência acidental após strict mode.
- Resolver: capturar os catálogos/modelo vigentes em snapshot Legacy v1, preservando ordem, precisão, prompts e side effects atuais; até equivalência, rotear ao runtime original.
- Garantir equivalência: golden master byte/decimal por caso; tolerância financeira **zero** após mesma regra de arredondamento; divergência de texto não pode alterar total/processos.
- Registrar fallback: correlation ID, org/contrato/projeto, consumidor, motivo, versão e resultado; sem conteúdo sensível.
- Medir: chamadas, contratos ativos, taxa de erro, divergência e último uso por consumidor.
- Migrar: primeiro `useContractualApfCounting`; depois adapter do hook legado; `FunctionPointBaseline` e learning; cada um por flag.
- Descontinuar: somente após janela acordada com zero chamadas, dados migrados/leitura histórica preservada, golden/shadow aprovados, rollback testado e aprovação formal.

Preservar obrigatoriamente `function_point_analyses`, `project_fp_baselines`, `useFunctionPointCounter` e `count-function-points`. Não há DROP no roadmap desta etapa.

## 13. Shadow Mode

Entrada: input canônico/hash da sessão oficial + snapshot candidato. Execução: engine v2 em modo `shadow`, sem triggers/serviços oficiais. Armazenamento: `apf_shadow_runs/items`, incluindo processos, tipo, complexidade, peso, fator, percentual, arredondamento, PFs, deltas e erros. Comparação por chave canônica; classes `none`, `non_financial`, `minor`, `material`, `critical`, com limiares aprovados pelo negócio.

Isolamento obrigatório: role/RPC separada, transação que só possui grants nas tabelas shadow, nenhuma FK com cascade para oficial e testes de ausência de escrita. Métricas por versão/contrato/causa; retenção precisa de decisão (default técnico: 180 dias para detalhes e agregado sem conteúdo por prazo de auditoria). Promoção publica uma versão candidata e cria novos snapshots; nunca converte shadow em oficial.

> **Shadow ≠ Oficial.** Shadow não escreve sessões/itens oficiais, billing, stories, `project_fp_baselines`, `apf_project_baselines` ou `function_point_analyses`.

## 14. Plano de Frontend

| Tela/componente | Mudança planejada |
| --- | --- |
| `ContractForm` | Associar/criar perfil default apenas quando flag ativa; não editar versão publicada |
| `ContractDetail` | Painel de perfil, versão vigente, TR, vigência, status, hash e histórico |
| `ApfFunctionPointTab` | Recibo da execução: snapshot, algoritmo, legacy, breakdown, estados e link de auditoria |
| `ApfBaselineTab` | Compatibilidade baseline↔perfil/versão, hash e bloqueios antes da sessão |
| Review dialogs | Separar sugestão IA, resolução determinística e override humano; motivo obrigatório |
| Validation dialogs | Mostrar operandos, regras/fontes e diferença antes/depois sem permitir editar total |
| Admin screens | CRUD de draft, comparação, revisão, aprovação, publicação/retirada e simulação shadow |
| Legacy components | Badge “Legacy Ruleset v1”, sem perda de funções atuais |

UX de estados: `Draft` editável; `In Review` bloqueia edição comum e permite devolver com motivo; `Approved` aguarda publicação/vigência; `Published` é somente leitura e pode originar nova versão; `Retired` permanece consultável. Sempre exibir perfil, versão, referência do TR, vigência, hash abreviado copiável, snapshot, algoritmo e indicador legacy. Breakdown identifica override e shadow sem confundi-los com oficial. Acessibilidade, loading, erro de concorrência e confirmação de ação financeira entram nos testes.

## 15. Estratégia de Feature Flags

Reusar catálogo/resolvedores existentes (`product_features`, entitlements/version features e funções de acesso), adicionando uma camada de override operacional por contrato apenas se o mecanismo atual não suportar esse escopo. Entitlement comercial e rollout técnico devem ter precedência documentada: sem entitlement nunca habilita; override técnico pode apenas restringir durante piloto.

| Flag | Default | Escopo/rollout | Rollback |
| --- | --- | --- | --- |
| `APF_PROFILE_VERSIONING` | false | dev → staging → admins org → contratos piloto | Oculta edição; dados permanecem |
| `APF_EXECUTION_SNAPSHOT` | false | contrato após versão publicada | Volta a sessão antiga/legacy |
| `APF_DETERMINISTIC_ENGINE_V2` | false | shadow, depois piloto | Roteia engine v1 |
| `APF_SHADOW_MODE` | false | staging/piloto; amostra controlada | Para novas execuções shadow |
| `APF_LEGACY_FALLBACK` | true | global durante toda migração | Deve continuar true até gate formal |
| `APF_NEW_FRONTEND` | false | org/contrato/usuário piloto | UI atual |
| `APF_STRICT_SNAPSHOT` | false | último gate, novas sessões v2 | false; não descongela histórico |

Resolução: kill switch de ambiente → entitlement org → rollout org → override contrato → capacidade do cliente. Alterações de flags são auditadas. Nenhuma flag muda o engine de uma sessão já aberta.

## 16. Estratégia de Testes

- Unitários SQL/TS: pesos; fronteiras DET/FTR/RET; fator/percentual; precedência; modos/etapas de arredondamento; deduplicação; canonicalização/hash; schema IA; vigência.
- Integração: resolução de contexto; publicação; snapshot idempotente; sessão/materialização; baseline; recontagem cria nova sessão; versão antiga permanece; falhas atômicas.
- Segurança: cross-tenant, cross-contract, cross-project, `admin_contrato`, membro sem contrato, RPC direta, anon, service role, `SECURITY DEFINER/search_path`, enumeração de UUID.
- Regressão: Legacy Ruleset v1 para `count-function-points` e runtime contratual atual, incluindo writes esperados.
- Shadow: zero escrita nas seis famílias oficiais e repetição idempotente.
- Concorrência: publicação simultânea, intervalos sobrepostos, snapshot simultâneo e dupla abertura/materialização.
- Frontend/E2E: estados, permissões, flags, recibo, override, acessibilidade e rollback de rota.
- Performance: resolver/snapshot p95, engine por N itens, índices/RLS, tamanho JSONB e fila shadow.

Gates: cobertura de todas as regras financeiras; tolerância zero em valores Legacy; zero escape de tenant; testes DB transacionais na CI; Vitest/Playwright para consumidores; restore/rollback ensaiado em staging.

## 17. Golden Master

Capturar fixtures anonimizadas e imutáveis com input, modelo/catálogos atuais, baseline, prompt version/hash, proposta IA gravada (não depender de nova chamada), processos, pesos, fatores, percentuais, valores antes/depois de arredondar, totals e side effects. Cobrir: casos normais; fronteiras; catálogo ausente/duplicado; manutenção corretiva/evolutiva; dedupe e auxiliares; override; reanálise/reset; IA inválida/timeout; ambos os legados; IFPUG e TRN encontrados no runtime.

Equivalência objetiva: mesmo conjunto/chave de processos, mesmo tipo/fator/percentual/peso, mesmos decimais e totais, mesmo estado final e side effects autorizados. Para financeiro, tolerância zero após normalização decimal. Mudança intencional exige fixture nova, justificativa, aprovação técnica e de negócio, nunca atualização silenciosa do esperado.

## 18. Observabilidade

Eventos/métricas: `context_resolved`, `snapshot_created/reused/hash_mismatch`, `session_opened/finalized`, `engine_v1/v2`, `legacy_fallback`, `prompt_schema_error`, `shadow_delta_class`, `rls_denied`, `publish_conflict`, latência, volume, tokens, retries e taxas por versão/contrato. Propagar `correlation_id` frontend → RPC → Edge → worker → audit.

Logs estruturados incluem IDs técnicos, versões, hash, duração, status e código de erro. Não registrar segredos, tokens, PII desnecessária, prompt integral, TR completo ou HU completa. Sentry recebe mensagem sanitizada e tags; audit events são append-only e têm retenção definida. Alertas: hash mismatch (crítico), cross-tenant/denied anômalo, divergência material/critical, fallback crescente e snapshot reuse anormal.

## 19. Estratégia de Rollback

- Código: reimplantar versão anterior; contratos com sessão aberta continuam no engine/snapshot fixado.
- Migration: preferir forward-fix; rollback físico somente para objetos vazios/não usados. Nunca apagar versão/snapshot usado.
- Flag: kill switch global/org/contrato; afeta apenas novas operações.
- Contrato: retirar versão para novas medições e reativar fallback/versão anterior apenas se vigência permitir; não reassociar sessões.
- Versão: publicar nova versão corretiva; não editar/despublicar histórico probatório.
- Engine: roteamento de novas sessões volta a v1; sessões v2 continuam reproduzíveis pelo `algorithm_version`.

> **NUNCA DESCONGELAR HISTÓRICO.** Rollback não recalcula, sobrescreve nem muda snapshots/resultados já usados.

## 20. Estratégia de Deploy

```text
local → CI → staging → shadow → piloto → produção → rollout gradual → strict snapshot
```

Gates: local (unit/golden); CI (lint/build/Vitest/DB/security); staging (migrations em clone, RLS, concorrência, rollback); shadow (zero escrita e deltas classificados); piloto (contratos aprovados, suporte/runbook/SLO); produção (backup/preflight, flags off); gradual (1%→10%→25%→50%→100% por contrato, observação entre ondas); strict (100% das novas sessões elegíveis com snapshot e fallback residual justificado). Falha em qualquer gate bloqueia promoção e aciona flag/forward-fix conforme runbook.

## 21. Dependências

| Componente | Depende de | Bloqueia | Ordem |
| --- | --- | --- | ---: |
| Golden master | inventário/fixtures | todo o restante | 1 |
| Canonicalização/hash | golden | publicação/snapshot | 2 |
| Schema perfil/versão | decisões mínimas | RLS/publicação | 3 |
| RLS/grants | schema | RPCs/piloto | 4 |
| Publicação | schema/hash/RLS | contexto | 5 |
| Context resolver | versão/vigência | snapshot/sessão | 6 |
| Snapshot | resolver/hash | engine/shadow | 7 |
| Engine v2 | snapshot/catálogos | shadow/frontend | 8 |
| Legacy adapter | golden/snapshot | migração consumidores | 9 |
| Shadow | engine/isolamento | piloto | 10 |
| Prompt único | snapshot/schema IA | frontend/migração | 11 |
| Frontend | RPCs/flags | piloto | 12 |
| Observabilidade | eventos/correlação | rollout | 13 |
| Piloto/rollout | todos os gates | strict/depreciação | 14 |

## 22. Riscos de Implementação

| Risco | Prob./impacto | Mitigação/Gate |
| --- | --- | --- |
| Migration conflita com schema implantado desconhecido | M/Crítico | introspecção/preflight e clone antes de criar SQL |
| Sobreposição de vigência em concorrência | M/Crítico | constraint + lock + teste simultâneo |
| RLS permite IDOR/cross-tenant | M/Crítico | deny-by-default, matriz e testes diretos |
| `SECURITY DEFINER` confia em tenant recebido | M/Crítico | derivar por `auth.uid`/FK; revoke/grant mínimo |
| Snapshot não é canônico entre TS/SQL | M/Alto | uma especificação + vetores cross-runtime |
| Engine v2 muda centavos/processos legacy | Alto/Crítico | golden, shadow e tolerância zero |
| Catálogo de pesos duplicado diverge | M/Alto | captura na publicação; uma fonte por snapshot |
| Histórico é rematerializado com regra nova | M/Crítico | trigger imutável e engine por snapshot/version |
| IA injeta valores financeiros | M/Crítico | schema allowlist e cálculo independente |
| Shadow dispara side effects oficiais | Baixo/Crítico | role/tabelas separadas e teste zero-write |
| Dois módulos de contratos divergem | Alto/Alto | serviço compartilhado e migração instrumentada |
| Flags trocam engine durante sessão | M/Alto | decisão congelada na abertura |
| Rollback tenta remover dados usados | Baixo/Crítico | forward-fix e regra nunca descongelar |
| JSONB/hash/storage degradam performance | M/Médio | benchmarks, índices seletivos, retenção shadow |
| Observabilidade vaza TR/HU/PII | M/Alto | sanitização/allowlist e revisão de logs |
| `count-function-points` permanece invisível | Alto/Alto | telemetria por consumidor e badge legacy |
| PF faturável sem definição | Alto/Crítico | bloquear fase financeira, não inventar default |

## 23. Decisões de Negócio Bloqueadoras

| Decisão | Impacto | Fase afetada | Bloqueia? | Default técnico |
| --- | --- | --- | --- | --- |
| Data de referência da medição | Seleção de vigência | contexto/snapshot | Sim para produção | `session_opened_at` apenas no Legacy v1, claramente registrado |
| Fórmula/estado de PF faturável, glosa e aprovação parcial | Total financeiro oficial | engine/finalização | Sim | Não calcular PF faturável; expor ajustado até decisão |
| Modos, escala e etapa de arredondamento permitidos | Centavos/PF | ruleset/engine | Sim | Preservar `round(...,2)` somente no Legacy v1 |
| Segregação de quem aprova/publica | Governança do TR | lifecycle/RLS | Sim | owner/admin org publica; admin_contrato edita draft |
| Precedência do histórico oficial versus TR vigente | Fator aplicado | engine | Sim | Snapshot/TR prevalece; histórico é evidência, não override automático |
| Reabertura/recontagem de validada | Integridade histórica | sessão | Sim | Nova sessão/revisão; nunca sobrescrever |
| Limiares e retenção shadow | Gate de promoção/custo | shadow/rollout | Não para schema; sim para promoção | classes propostas; detalhes 180 dias |

## 24. Backlog Técnico

| ID | Tarefa | Tipo | Dependência | Risco | Prioridade | Critério de aceite |
| --- | --- | --- | --- | --- | --- | --- |
| APF-ET3-001 | Inventariar schema/policies/grants implantados | DATABASE | — | Alto | P0 | diff repo×ambientes aprovado |
| APF-ET3-002 | Montar fixtures golden dos dois runtimes | TEST | 001 | Crítico | P0 | cobertura de casos críticos |
| APF-ET3-003 | Registrar outputs/side effects golden | TEST | 002 | Crítico | P0 | reprodução determinística |
| APF-ET3-004 | Especificar canonicalização/hash v1 | BACKEND | 002 | Alto | P0 | vetores TS/SQL iguais |
| APF-ET3-005 | Fechar decisões financeiras bloqueadoras | DATABASE | 002 | Crítico | P0 | aceite negócio/auditoria |
| APF-ET3-006 | Criar migration foundation perfil/versão | MIGRATION | 004,005 | Alto | P0 | aditiva, checks aprovados |
| APF-ET3-007 | Criar migration ruleset/catálogos | MIGRATION | 006 | Alto | P0 | sem duplicidade conceitual |
| APF-ET3-008 | Implementar lifecycle/imutabilidade | DATABASE | 006,007 | Crítico | P0 | published não altera/apaga |
| APF-ET3-009 | Implementar RLS de perfis/versões | SECURITY | 006 | Crítico | P0 | matriz cross-tenant verde |
| APF-ET3-010 | Auditar/harden `SECURITY DEFINER` APF | SECURITY | 001 | Crítico | P0 | revoke/search_path/tenant validados |
| APF-ET3-011 | Implementar RPC de transição | RPC | 008,009 | Alto | P0 | estados/roles auditados |
| APF-ET3-012 | Implementar RPC de publicação | RPC | 004,011 | Crítico | P0 | lock/hash/vigência atômicos |
| APF-ET3-013 | Criar schema de snapshots | MIGRATION | 012 | Crítico | P0 | append-only e RLS |
| APF-ET3-014 | Implementar resolver de contexto | RPC | 012 | Crítico | P0 | erro em gap/overlap |
| APF-ET3-015 | Implementar criação idempotente de snapshot | RPC | 013,014 | Crítico | P0 | mesmo contexto→mesmo hash |
| APF-ET3-016 | Estender sessões/itens com compatibilidade | MIGRATION | 013 | Alto | P0 | legado continua funcional |
| APF-ET3-017 | Implementar `open_counting_session_v2` | RPC | 014–016 | Crítico | P0 | operação atômica/tenant-aware |
| APF-ET3-018 | Formalizar schema de proposta IA | AI | 004 | Alto | P1 | allowlist sem financeiro |
| APF-ET3-019 | Implementar renderer de prompt único | AI | 013,018 | Alto | P1 | versão/hash rastreáveis |
| APF-ET3-020 | Adaptar `apf-generate` ao contrato estruturado | AI | 018,019 | Alto | P1 | falha não materializa |
| APF-ET3-021 | Especificar engine v2 por etapa | DATABASE | 005,013 | Crítico | P0 | fórmulas aprovadas |
| APF-ET3-022 | Implementar engine v2 snapshot-aware | DATABASE | 021 | Crítico | P0 | suíte financeira verde |
| APF-ET3-023 | Implementar breakdown/recibo | RPC | 022 | Alto | P1 | total recomponível |
| APF-ET3-024 | Capturar Legacy Ruleset v1 | MIGRATION | 003,015 | Crítico | P0 | equivalência zero-delta |
| APF-ET3-025 | Instrumentar fallback legado | OBSERVABILITY | 024 | Médio | P1 | métricas por consumidor |
| APF-ET3-026 | Preservar/testar `count-function-points` | TEST | 002,025 | Crítico | P0 | nenhum contrato quebrado |
| APF-ET3-027 | Preservar/testar baselines legadas | TEST | 002 | Alto | P1 | CRUD/leitura equivalentes |
| APF-ET3-028 | Criar schema shadow | MIGRATION | 013,022 | Alto | P1 | namespace e RLS isolados |
| APF-ET3-029 | Implementar execução/comparador shadow | RPC | 028 | Crítico | P1 | zero escrita oficial |
| APF-ET3-030 | Definir métricas/alertas APF | OBSERVABILITY | 023,025,029 | Médio | P1 | dashboards e alertas testados |
| APF-ET3-031 | Propagar correlation ID ponta a ponta | OBSERVABILITY | 020,023 | Médio | P1 | rastreio completo sem PII |
| APF-ET3-032 | Registrar flags no mecanismo existente | ROLLOUT | 001 | Alto | P1 | defaults seguros/override contrato |
| APF-ET3-033 | Adaptar `useContractualApfCounting` | FRONTEND | 017,020,023 | Alto | P1 | fluxo v2 atrás de flag |
| APF-ET3-034 | Atualizar tabs/dialogs APF | FRONTEND | 023,033 | Médio | P2 | versão/hash/breakdown visíveis |
| APF-ET3-035 | Criar administração de perfil/versão | FRONTEND | 011,012 | Alto | P2 | lifecycle/roles completos |
| APF-ET3-036 | Unificar autoridade dos serviços de contrato | BACKEND | 010 | Alto | P2 | fallback direto telemetrizado |
| APF-ET3-037 | Adaptar hook legado sem remover API | FRONTEND | 024–026 | Alto | P2 | flag reversível/equivalente |
| APF-ET3-038 | Implementar testes de concorrência | TEST | 012,015,017 | Crítico | P0 | sem dupla publicação/sessão |
| APF-ET3-039 | Implementar suíte RLS/IDOR | SECURITY | 009,010,028 | Crítico | P0 | zero escape tenant |
| APF-ET3-040 | Benchmark de snapshot/engine/RLS | TEST | 022,039 | Médio | P1 | SLO aprovado |
| APF-ET3-041 | Executar staging + shadow e classificar deltas | ROLLOUT | 029–032,038–040 | Crítico | P0 | gates atendidos |
| APF-ET3-042 | Executar piloto por contratos | ROLLOUT | 034,035,041 | Crítico | P0 | aceite financeiro/operacional |
| APF-ET3-043 | Rollout gradual com kill switches | ROLLOUT | 042 | Crítico | P0 | SLO/deltas dentro do limite |
| APF-ET3-044 | Ativar strict snapshot para novas sessões | MIGRATION | 043 | Crítico | P0 | 100% elegíveis snapshotados |
| APF-ET3-045 | Produzir plano separado de depreciação | MIGRATION | 044 + janela zero uso | Alto | P2 | migração/telemetria/rollback aprovados |

Quantidade: **45 itens**.

## 25. Roadmap Técnico

| Fase | Entrada → saída | Dependências/gate | Rollback |
| --- | --- | --- | --- |
| Etapa 3 | auditoria → plano aprovado | este documento | n/a |
| Golden Master | runtimes atuais → fixtures/outputs | cobertura e aceite | corrigir fixture, não runtime |
| Schema | modelo aprovado → tabelas aditivas | migrations em clone | flags off/forward-fix |
| RLS | hierarquia → policies/grants | zero cross-tenant | revoke acesso novo |
| RPC | schema seguro → lifecycle/contexto | concorrência e idempotência | overload antigo |
| Snapshot | versão vigente → hash imutável | canonicalização igual | fallback legacy |
| Engine | snapshot → breakdown oficial | golden financeiro | engine v1 para novas sessões |
| Legacy | comportamento atual → Legacy v1 mensurável | zero delta | runtime original |
| Shadow | candidato → deltas isolados | zero writes oficiais | flag off |
| Frontend | APIs estáveis → UX governada | E2E/roles/a11y | UI antiga |
| Piloto | shadow aprovado → contratos canário | aceite/SLO/runbook | rollback por contrato |
| Rollout | piloto → adoção gradual | gates por onda | kill switch |
| Strict Snapshot | cobertura total → obrigatoriedade | fallback residual aprovado | strict off |
| Depreciação | zero uso → plano futuro | seis provas de compatibilidade | manter legado |

## 26. Definition of Done

- [ ] Golden Master aprovado e 100% dos casos críticos reproduzidos.
- [ ] Decisões financeiras bloqueadoras aprovadas e versionadas.
- [ ] Versões publicadas e snapshots são imutáveis; hash é determinístico.
- [ ] Vigência usa `measurement_reference_at`, `effective_from/until` e status; gap/overlap falha.
- [ ] RLS, RPC direta, `SECURITY DEFINER` e cross-tenant/contract/project validados.
- [ ] IA não possui autoridade sobre peso, fator, percentual ou total.
- [ ] Engine produz breakdown recomposto e usa decimal/arredondamento aprovado.
- [ ] Legacy Ruleset v1 é equivalente, mensurável e reversível.
- [ ] `function_point_analyses`, `project_fp_baselines`, `useFunctionPointCounter` e `count-function-points` permanecem funcionais.
- [ ] Shadow possui zero escrita oficial; divergências foram classificadas/aprovadas.
- [ ] Concorrência de publicação, snapshot e abertura foi testada.
- [ ] Frontend expõe perfil, versão, TR, vigência, hash, snapshot, algoritmo, legacy, breakdown, override e shadow conforme permissão.
- [ ] Flags têm defaults seguros, escopo org/contrato e kill switches testados.
- [ ] Observabilidade está ativa, correlacionada e sem conteúdo sensível.
- [ ] Performance/SLO e retenção foram aprovados.
- [ ] Rollback de código, flag, contrato, versão e engine foi ensaiado sem alterar histórico.
- [ ] Staging, shadow, piloto e rollout atenderam todos os gates.
- [ ] Strict snapshot cobre todas as novas sessões elegíveis.
- [ ] Auditoria técnica, financeira e de segurança aprovou o recibo de execução.

## STATUS

ETAPA 3 — PLANO TÉCNICO DE IMPLEMENTAÇÃO CONCLUÍDO

ALTERAÇÕES DE BANCO: NENHUMA  
MIGRATIONS EXECUTADAS: NENHUMA  
MIGRATIONS CRIADAS: NENHUMA  
CÓDIGO DE PRODUÇÃO ALTERADO: NÃO  
DADOS ALTERADOS: NÃO

ARQUIVO GERADO:

docs/apf/ETAPA_3_PLANO_TECNICO_IMPLEMENTACAO.md
