# Auditoria Técnica — Motor APF do Axionn

## 1. Resumo executivo

**CONFIRMADO:** o runtime contratual é baseline-first e resolve `projects.contract_id → apf_counting_models.id → baseline/sessão`; logo, o contrato participa da seleção do modelo e dos catálogos.  
**CONFIRMADO:** pesos, percentuais e PF Simples são calculados deterministicamente no banco, enquanto IA propõe processos/analogia e fator, sujeitos a precedência SQL e revisão humana.  
O principal gap é a ausência de versão publicável e snapshot imutável do TR/ruleset por execução; o modelo é uma linha mutável por contrato.  
Contagens persistidas não mudam apenas ao serem consultadas, mas reset/recontagem pode usar catálogo, precedentes e regras atuais e produzir outro resultado.  
Há dois módulos de contratos sobre a mesma tabela `contracts`, com serviços e relações parcialmente diferentes; não são dois domínios, mas duplicam escrita e auditoria.  
É tecnicamente viável parametrizar por contrato/TR, aproveitando o vínculo existente, desde que sejam adicionados perfil, versão, vigência, publicação e snapshot.  
O risco financeiro é **ALTO**, sobretudo em reprocessamento, alteração in-place de catálogo e ausência de PF faturável/aprovado/glosado formal.  
Recomenda-se preservar o motor atual como fallback, introduzir versões append-only e validar em shadow mode antes de torná-las oficiais.

## 2. Escopo e metodologia

Branches auditadas: `main` (`01246a20`) e `develop` (`361fb876`, branch de trabalho). A análise foi exclusivamente estática e somente leitura: `git diff main..develop`, `git show`, inventário com `rg --files`, buscas globais com `rg`, leitura das migrations, RPCs, triggers, policies, Edge Functions, hooks, services, types, componentes e documentação. Nenhuma conexão ao banco remoto foi realizada; por isso, o estado efetivamente aplicado em produção é **NÃO VERIFICADO**.

Foram rastreados, em ambos os sentidos, `contract_id`, `contractId`, `tr_id`, `term_reference`, `model_id`, tabelas APF, RPCs e consumidores. “CONFIRMADO” significa evidência em código versionado; “HIPÓTESE” identifica interpretação arquitetural; “NÃO VERIFICADO” indica ausência de prova no repositório ou no banco executado.

Comparação relevante entre branches:

| Arquivo | main | develop | Impacto |
| --- | --- | --- | --- |
| `supabase/functions/count-function-points/index.ts` | aceita URL configurada diretamente | valida host de saída por allowlist | Segurança SSRF; não altera fórmula APF |
| `src/features/apf/components/ApfGeneratorPage.tsx` | sem cabeçalho | cabeçalho “Medição & Evidências” | Apenas apresentação |
| `src/features/apf/components/ApfHuGenerateTab.tsx` | download em utilitário DOCX | download em utilitário dedicado | Sem impacto na contagem |
| `src/features/contracts/components/ContractsDashboard.tsx` | cards genéricos | classes visuais `metric-panel` | Sem impacto de domínio |
| Migrations APF até `20260703050000` | presentes | idênticas | Nenhuma divergência de regra encontrada |
| `20260731010055_...sql` | ausente | hardening de RLS APF | Impacto alto de isolamento/autorização em `develop` |
| `20260807100000_apf_automation_settings.sql` | ausente | automação por time | Runtime auxiliar recente; sem perfil de TR |

Não foram encontradas diferenças entre `main` e `develop` nas migrations contratuais obrigatórias, no hook `useContractualApfCounting` ou nos serviços de validação. As demais diferenças sob os diretórios analisados são predominantemente UI, exportação, automação e RBAC fora da fórmula central.

## 3. Mapa de arquivos analisados

| Arquivo | Papel | Branch | Relevância |
| --- | --- | --- | --- |
| `supabase/functions/count-function-points/index.ts` | Motor APF legado/paralelo por HU, few-shot e persistência em `function_point_analyses` | ambas; hardening em develop | Alta |
| `supabase/functions/apf-generate/index.ts` | Geração por IA usada pelo fluxo contratual | ambas | Alta |
| `src/features/apf/hooks/useContractualApfCounting.ts` | Orquestra sessão, análise, revisão, materialização e validação | ambas | Crítica |
| `src/features/apf/hooks/useApfCatalog.ts` | Carrega projeto, contexto, sessão, itens e análises | ambas | Crítica |
| `projectBaselineCounting.service.ts` | Monta prompt estruturado e persiste análise | ambas | Crítica |
| `contractualValidation.service.ts` | Fachada da validação atômica | ambas | Alta |
| `atomicValidation.service.ts` | Chama RPC de validação e normaliza retorno | ambas | Alta |
| `learning.service.ts` | Métricas do motor antigo por `function_point_analyses` | ambas | Média |
| `contractualApf.helpers.ts` | `PF FS = PF bruto × percentual / 100`; valores efetivos | ambas | Alta |
| `elementaryProcess.ts`, `factorReview.ts` | Decisões de processo e revisão no cliente | ambas | Alta |
| `ApfFunctionPointTab.tsx` | Entrada principal do runtime contratual | ambas | Alta |
| `ApfValidationDialog.tsx` | Override/justificativa humana | ambas | Alta |
| `ApfAnalysisReviewDialog.tsx` | Revisão de processos, baseline e fator | ambas | Alta |
| `ApfBaselineTab.tsx` | Importação/ativação da baseline | ambas | Alta |
| `ApfGeneratorPage.tsx`, `ApfStoryList.tsx`, `PaginatedApfStoryList.tsx` | Navegação e apresentação | ambas | Média |
| `ApfHuGenerateTab.tsx`, `ApfGenerateTab.tsx`, `ApfTemplatesTab.tsx`, `ApfPredictiveTab.tsx` | Geração documental/template/preditivo | ambas | Baixa para fórmula |
| `20260620_001_multi_tenancy_apf_engine.sql` | Schema base, catálogos e RLS | ambas | Crítica |
| `20260621001000_apf_seed_dpf_globalweb.sql` | Seed de tipos, fatores e regras | ambas | Crítica |
| `20260621004000_apf_prompt_builder.sql` | Builder legado por contrato | ambas | Alta histórica |
| `202606240000035_drop_legacy_build_apf_prompt.sql` | Remove overload legado | ambas | Alta |
| `20260624000003_apf_baseline_rpc.sql` | Importação e contexto ativo | ambas | Crítica |
| `20260624000004_apf_counting_rpc.sql` | Sessão, builder por sessão e persistência | ambas | Crítica |
| `20260624000006_apf_atomic_validation.sql` | Validação atômica e eventos | ambas | Crítica |
| `20260625000008_apf_elementary_process_engine.sql` | Processo elementar e deduplicação | ambas | Crítica |
| `20260625000012_apf_project_counting_runtime.sql` | Peso por complexidade e reset com snapshot | ambas | Alta |
| `20260625000015/17/20_*.sql` | Análise de processo, patches e catálogo PFS/TRN | ambas | Crítica |
| `20260628000025_apf_official_factor_precedence_patch.sql` | Precedência de fator oficial | ambas | Crítica |
| `20260702000026..30_*.sql` | “Counting brain”, histórico e override humano | ambas | Crítica |
| `20260703050000_apf_security_hardening.sql` | Grants e policies do cérebro | ambas | Alta |
| `20260731010055_*.sql` | Helpers e policies APF por organização | develop | Crítica |
| `docs/apf-contractual-flow.md` | Documento comparado com runtime | ambas | Auxiliar, não usado como prova isolada |
| `src/features/admin/hooks/useContracts.ts` | Administração tenant-aware de contratos | ambas | Crítica |
| `src/features/contracts/hooks/useContracts.ts` e `services/contracts.service.ts` | CRUD/SLA operacional direto | ambas | Crítica |
| `ContractContext.tsx`, `ContractWizardDialog.tsx`, `AdminContratosPage.tsx` | Seleção e edição administrativa | ambas | Alta |
| `ContractForm.tsx`, `ContractDetail.tsx`, `ContractsDashboard.tsx`, `SlaMatrixEditor.tsx` | UI operacional de contratos/SLA | ambas | Alta |
| `supabase/audits/20260704_07_organization_operational_console_preflight.sql` | Diagnóstico de coerência `projects/teams/contract_teams` | ambas | Alta |

Os caminhos de componentes solicitados existem sob `src/features/apf/components/`. A constante solicitada está em `src/features/apf/types/contractualApf.constants.ts`, não diretamente em `src/features/apf/contractualApf.constants.ts`.

## 4. Mapa completo do banco

| Tabela | Papel | PK | FK | Contract ID | RLS | Versionamento |
| --- | --- | --- | --- | --- | --- | --- |
| `contracts` | Contrato operacional | `id` | organização/empresa conforme migrations | direto | tenant/RBAC evolutivo | não é versão de TR |
| `projects` | Projeto que ancora a APF | `id` | `contract_id`, `team_id` | direto | por organização/time | não |
| `apf_counting_models` | Modelo/catálogo por contrato | `id` | `contract_id → contracts` | direto, `UNIQUE(contract_id)` | por acesso ao contrato | não; linha mutável |
| `apf_function_types` | Tipos e pesos | `id` | `model_id` | indireto | por modelo | não |
| `apf_function_type_weights` | Peso por tipo/complexidade | chave própria | `model_id` | indireto | via modelo | não |
| `apf_impact_factors` | Fatores e percentuais | `id` | `model_id` | indireto | por modelo | não |
| `apf_categories` | Categorias | `id` | `model_id` | indireto | por modelo | não |
| `apf_counting_rules` | Textos de regra do prompt | `id` | `model_id`, único | indireto | por modelo | não; `updated_at` apenas |
| `apf_output_templates` | Estrutura JSONB da evidência | `id` | `model_id`, único | indireto | por modelo | não |
| `apf_project_baselines` | Baseline por projeto/modelo | `id` | `project_id`, `model_id` | via projeto/modelo | por projeto | campo `version`; sem snapshot de ruleset |
| `apf_baseline_items` | EFs homologadas | `id` | `baseline_id` | indireto | via baseline | pertence à versão da baseline |
| `apf_counting_sessions` | Sessão por projeto/sprint | `id` | `project_id`, `baseline_id`, `model_id` | indireto | por projeto | referencia IDs, não snapshot |
| `apf_counting_items` | Resultado unitário, correção e processo | `id` | sessão, baseline item, story, processo | indireto | via sessão | valores persistidos; sem hash de regra |
| `apf_gray_zones` | Ambiguidades | `id` | sessão/item | indireto | via sessão | não |
| `apf_validation_events` | Evento humano/auditoria | `id` | projeto/story/item/baseline | via projeto | policies por time/projeto | evento append-only pretendido |
| `apf_elementary_processes` | Processos elementares materializados | `id` | sessão/projeto | via sessão/projeto | por projeto | não |
| `apf_recalculation_events` | Auditoria de reset | `id` | sessão/story/projeto/baseline | indireto | acesso por projeto | guarda `previous_snapshot` JSONB |
| `apf_process_analysis_runs` | Execução de análise IA | `id` | projeto/story/baseline | via projeto | leitura por time/admin | `prompt_version`, raw payload e decisões; sem ruleset completo |
| `apf_process_analysis_items` | Processos propostos | `id` | analysis run | indireto | via run/projeto | resultado persistido |
| `apf_process_analysis_analogs` | Análogos de baseline | `id` | analysis item | indireto | via run | resultado persistido |
| `apf_process_analysis_logical_files` | ALI/AIE candidatos | `id` | analysis item | indireto | via run | resultado persistido |
| `apf_process_analysis_absorbed_items` | Itens absorvidos | chave própria | analysis run | indireto | via run | não |
| `apf_process_analysis_non_countable_items` | Itens não contáveis | chave própria | analysis run | indireto | via run | não |
| `apf_process_analysis_pending_details` | Pendências | chave própria | analysis run | indireto | via run | não |
| `apf_process_learning_events` | Sugestão versus confirmação | `id` | projeto/story/run/model | indireto | leitura por time; escrita service role | histórico de decisão |
| `apf_metric_factor_history` | Medição oficial precedente | `id` | escopo lógico de sistema | não direto | **NÃO VERIFICADO** integralmente | histórico por linha/data |
| `function_point_analyses` | Motor legado por HU/few-shot | `id` | story/team/project conforme evolução | não direto | policies antigas amplas e depois por time | guarda validação, não ruleset |
| `project_fp_baselines` | Baseline simples do motor antigo | `id` | projeto | não direto | leitura autenticada/admin | **POSSIVELMENTE LEGADO** |
| `apf_automation_settings` | Autoaprovação por time | `id` | `team_id` | via time | por time | não |

Detalhes relevantes: `apf_project_baselines` possui status, versão, importador, timestamps, arquivo/origem e soft delete após patches; `apf_counting_sessions` guarda totais, analista, revisor, validação, documento e modelo de IA; `apf_counting_items` guarda classificação, peso, percentual, PF FS, justificativa, evidência, precedente, correções humanas e atributos de processo. JSONB aparece em templates, payloads brutos, source summary, decisões e snapshots de reset. Triggers mantêm `updated_at`, aplicam precedência de fator e registram aprendizado.

**NÃO VERIFICADO:** PKs/constraints finais de tabelas alteradas por migrations posteriores e schema remoto aplicado; a tabela acima representa o efeito cumulativo inferível do código versionado.

## 5. Fluxo ponta a ponta

| Etapa | Arquivo/função | Entrada | Saída | Regra/origem |
| --- | --- | --- | --- | --- |
| UI | `ApfFunctionPointTab` | time, projeto, sprint, ação “Analisar” | chamada do hook | baseline obrigatória |
| Catálogo | `useApfCatalog` | `teamId`, `projectId` | projeto, histórias, contexto | `projects.contract_id`; RPC `get_active_apf_context` |
| Sessão | `open_counting_session` | projeto/sprint/baseline | `session_id` | resolve contrato, modelo ativo e baseline compatível |
| Candidatos | `get_apf_project_process_candidates` | projeto/texto | precedentes de processos | baseline/histórico do projeto |
| Prompt | `buildStructuredProcessAnalysisPrompt` | HU, baseline, candidatos, eventos | texto estruturado | TypeScript + dados carregados; não é o RPC legado por contrato |
| IA | Edge Function `apf-generate` | prompt/provider | JSON de análise | IA identifica processos, análogos e arquivos; saída não é resultado financeiro final |
| Persistência da análise | RPC de persistência do service | projeto/story/baseline/raw/prompt version | `analysis_id` | valida escopo e armazena execução |
| Cérebro de fator | trigger `apply_apf_counting_brain_factor` → `resolve_apf_factor_decision` | fator proposto | fator sugerido/fonte/confiança/revisão | oficial → precedentes humanos → regex → default `I` |
| Revisão | `ApfAnalysisReviewDialog` | processos/fator sugeridos | decisões humanas | baseline requerida para item enviado; motivo obrigatório em override |
| Materialização | `materialize_apf_process_analysis` ou `resolve_apf_process_analysis_v2` | análise, sessão, decisões | itens de contagem | identidade/peso da baseline; fator do modelo; cálculo no banco |
| Validação | `ApfValidationDialog` → `validateContractualItems` → RPC atômica | correções/motivo/notas | itens validados e evento | humano prevalece, com justificativa |
| Totais | RPCs e helper de leitura | valores efetivos | PF bruto/PF FS por HU e sessão | soma com arredondamento SQL a 2 casas |
| Baseline/resultado | `apf_counting_sessions`, `apf_counting_items`, `user_stories` | itens finais | consulta posterior | valores persistidos; baseline referenciada por ID |

Fluxo paralelo **CONFIRMADO**: `count-function-points` recebe HU/contexto diretamente, busca few-shot em `function_point_analyses`, chama provider, calcula/aceita breakdown, atualiza `user_stories` e faz upsert em `function_point_analyses`. O hook contratual principal não invoca essa Edge Function. Isso explica duas camadas de APF coexistentes.

## 6. Mapa de regras de APF

| Regra | Onde está | Implementação | Granularidade | Hardcoded? | Parametrizada? | Evidência/classificação |
| --- | --- | --- | --- | --- | --- | --- |
| Missão/princípio/hierarquia | `apf_counting_rules` | texto no prompt | modelo/contrato | seed textual | sim, por `model_id` | `build_apf_prompt`; **IA** |
| Precedência | `resolve_apf_factor_decision` | ordem oficial→humano→regex→default | projeto/story | sim | parcialmente | migration `...phase1.sql:125-217`; **DETERMINÍSTICA** |
| Consistência contratual | `apf_counting_rules` | instrução ao modelo | modelo | seed | sim | prompt; **IA** |
| Fechamento | rules + engine de processo | instrução e validação/materialização | processo | ambos | parcial | `rule_closure` + migrations 08/15/20; **HÍBRIDA** |
| Tipo/peso | `apf_function_types`, `apf_function_type_weights` | lookup SQL | modelo/complexidade | fallback TRN 4,60 | sim | `resolve_apf_item_weight`; **DETERMINÍSTICA** |
| Fator/% | `apf_impact_factors` | lookup SQL | modelo | seed e fallback | sim | save/materialize; **DETERMINÍSTICA** no cálculo, híbrida na escolha |
| Fator oficial | `apf_metric_factor_history` | lookup por HU/sistema | projeto/story | normalização hardcoded | dados históricos | migration `...precedence_patch.sql:37-128`; **DETERMINÍSTICA** |
| Regex de manutenção | counting brain | palavras-chave | story | sim | não | `...phase1.sql:182-207`; **DETERMINÍSTICA** |
| Default conservador | counting brain | fator `I`, revisão obrigatória | story | sim | não | linhas 208-216; **DETERMINÍSTICA** |
| Processo auxiliar/absorção | engine SQL + TS | flags, deduplicação, papel | processo | sim | parcial | migrations 08/15 e `elementaryProcess.ts`; **HÍBRIDA** |
| PF bruto | lookup de peso | peso do tipo/baseline | item | fallback | catálogo | banco, não IA; **DETERMINÍSTICA** |
| PF FS | `round(weight*pct/100,2)` | fórmula SQL | item | fórmula fixa | peso/% configuráveis | migrations 03/08; **DETERMINÍSTICA** |
| Arredondamento | `round(...,2)` | matemático PostgreSQL | item/totais | sim | não | várias RPCs; **DETERMINÍSTICA** |
| Override humano | validação e review v2 | correção + motivo/notas | item/run | fluxo fixo | valores humanos | migration 30 e serviço; **HÍBRIDA** |
| Baseline ativa | contexto/sessão | seleção por status/data | projeto/modelo | ordem fixa | baseline configurada | RPCs 03/04; **DETERMINÍSTICA** |
| Deduplicação | save/engine | chave normalizada/processo | sessão | sim | não | migration 08; **DETERMINÍSTICA** |
| Few-shot antigo | Edge Function | últimas análises validadas do time | time | prompt hardcoded | exemplos persistidos | `count-function-points:323-345`; **IA** |

As regras textuais `rule_precedence_override`, `rule_contractual_consistency` e `rule_closure` influenciam a interpretação da IA, mas não substituem as garantias determinísticas SQL. A escolha inicial de processos/análagos continua probabilística; pesos, percentuais, soma e validação de catálogo são do banco. Impacto financeiro inadequadamente delegado à IA é reduzido no fluxo contratual atual, mas a IA ainda influencia quantos processos chegam à revisão e qual fator propõe. Sem revisão obrigatória em todos os cenários, isso permanece risco financeiro.

## 7. Rastreamento de contract_id

`contract_id` nasce em `contracts.id`. Os dois módulos criam/alteram essa mesma tabela. O vínculo com projeto é persistido em `projects.contract_id` pelo módulo administrativo (`save_organization_contract_v3` ou fallback direto) e por services de projetos. `useApfCatalog` carrega o campo, mas o hook não o envia diretamente: `projectId` chega a `get_active_apf_context` e `open_counting_session`; as RPCs leem `projects.contract_id`, selecionam `apf_counting_models.contract_id` e retornam/persistem `model_id` e baseline. O fator review v2 repete `project → contract → model → factor` (`20260702000030...:341-372`).

Assim, **CONFIRMADO:** o contrato está relacionado estruturalmente ao projeto **e participa da seleção das regras de contagem**, via modelo. Ele deixa de aparecer como coluna direta em sessão/item; dali em diante fica implícito por `project_id` e `model_id`. Essa desnormalização incompleta dificulta auditoria histórica se o projeto mudar de contrato.

`contractId` é apenas forma camelCase de props/variáveis no frontend e é convertido em filtros/payloads `contract_id`. `model_id` nasce em `apf_counting_models`, é escolhido pelo contrato, persiste em baseline/sessão e governa tipos, pesos, fatores e regras. `tr_id`, `term_reference` e `termReference`: **INEXISTENTE** no motor APF auditado como entidade/vínculo funcional; ocorrências de “TR” são texto, sigla `TRN` ou documentação, não uma versão formal de Termo de Referência.

## 8. Diagnóstico atual

### 8.1 Hardcodes

Fórmula e arredondamento a duas casas; regex de fator; limiares de similaridade (0,25/0,35), mínimo de dois precedentes; default `I`; tipos PFS `TRN=4,60` e `ARQ=7,00` em fallbacks; regras de fechamento/auxiliares; formato do prompt TypeScript; enumerações de fatores aceitos em precedentes; status e ordem de seleção.

### 8.2 Parametrizações

Tipos/pesos, pesos por complexidade, fatores/percentuais, categorias, textos de regras, template, baseline e provider de IA são parametrizados. A granularidade efetiva é `model_id`, e o modelo é 1:1 com contrato.

### 8.3 Regras por modelo

`apf_function_types`, `apf_function_type_weights`, `apf_impact_factors`, `apf_categories`, `apf_counting_rules` e `apf_output_templates`.

### 8.4 Regras por projeto

Baseline ativa, itens homologados, precedentes validados, histórico oficial resolvido e memória de processos. Não existe tabela explícita de override de ruleset por projeto.

### 8.5 Regras por contrato

Existem indiretamente porque `apf_counting_models` é único por `contract_id`. Não há `TR`, vigência, publicação, aprovação, versão de ruleset ou snapshot contratual.

### 8.6 Duplicações

Dois módulos de contrato usam `contracts`: admin usa RPC tenant-aware e relações `contract_teams/projects/contract_slas`; contracts usa CRUD direto, `contract_slas`, `contract_room_teams` e `contract_audit_log`. Há também dois motores: contratual baseline-first e `count-function-points/function_point_analyses`. Há builder SQL legado e prompt estruturado em TypeScript.

### 8.7 Conflitos

O módulo admin pode arquivar e preservar integridade via RPC, enquanto o módulo contracts pode excluir diretamente. As relações de time usam `teams.contract_id`, `contract_teams` e `contract_room_teams`; o preflight confirma a necessidade de verificar divergências. Regras textuais no banco podem divergir do prompt TypeScript e das regras SQL hardcoded. O audit preflight chama atenção para `useCompanies`, `useContracts` e `projects.service`: a autoridade organizacional e os fallbacks legados coexistem.

### 8.8 Possível legado

`project_fp_baselines`, o fluxo `function_point_analyses`/`count-function-points`, o overload `build_apf_prompt(UUID,TEXT)` removido pela migration `202606240000035`, e fallbacks diretos dos hooks são **POSSIVELMENTE LEGADO**. Não foram classificados como mortos porque ainda há consumidores e/ou persistência ativa.

A fonte de verdade atual para a identidade contratual é `contracts.id`; para APF, deve continuar sendo o contrato associado a `projects.contract_id`, validado contra organização e congelado no snapshot da execução. O módulo administrativo tenant-aware é a autoridade arquitetural mais segura para mutações, pois usa RPCs de organização; o módulo operacional deve consumi-la, não criar outra identidade.

## 9. Evidências técnicas

Status: **CONFIRMADO**  
Arquivo: `supabase/migrations/20260620_001_multi_tenancy_apf_engine.sql`  
Função: schema APF  
Linha aproximada: 113-217  
Evidência: modelo possui `contract_id UNIQUE`; tipos, fatores e regras possuem `model_id`.  
Conclusão: já existe parametrização por contrato, mas sem versão formal de TR.

Status: **CONFIRMADO**  
Arquivo: `supabase/migrations/20260624000004_apf_counting_rpc.sql`  
Função: `open_counting_session`  
Linha aproximada: 24-76  
Evidência: lê contrato do projeto, seleciona modelo ativo e exige baseline do mesmo projeto/modelo.  
Conclusão: `contract_id` chega ao motor indiretamente.

Status: **CONFIRMADO**  
Arquivo: mesmo  
Função: `build_apf_prompt(UUID)`  
Linha aproximada: 160-230  
Evidência: lê regras/tipos/fatores pelo `session.model_id` e instrui que o banco calcule PF.  
Conclusão: prompt é parametrizado por modelo, cálculo é determinístico.

Status: **CONFIRMADO**  
Arquivo: `src/features/apf/hooks/useContractualApfCounting.ts`  
Função: `countForHu`  
Linha aproximada: 154-343  
Evidência: abre sessão, busca candidatos/eventos, monta prompt TS, chama `apf-generate`, persiste e materializa.  
Conclusão: o fluxo real não depende diretamente do builder SQL legado por contrato.

Status: **CONFIRMADO**  
Arquivo: `supabase/migrations/20260702000026_apf_counting_brain_phase1.sql`  
Função: `resolve_apf_factor_decision`  
Linha aproximada: 125-224  
Evidência: precedência oficial, precedentes, regex e default.  
Conclusão: escolha de fator é híbrida e parcialmente hardcoded.

Status: **CONFIRMADO**  
Arquivo: `supabase/migrations/20260628000025_apf_official_factor_precedence_patch.sql`  
Função: `get_apf_metric_history_for_story`  
Linha aproximada: 37-128  
Evidência: resolve referência da HU e sistema; só relaxa sistema se houver uma única chave.  
Conclusão: medição oficial tem prioridade, mas sua associação depende de heurística.

Status: **CONFIRMADO**  
Arquivo: `supabase/migrations/20260702000030_apf_counting_brain_phase2_factor_review.sql`  
Função: `resolve_apf_process_analysis_v2`  
Linha aproximada: 316-522  
Evidência: carrega contrato do projeto, catálogo do modelo, fator e motivo de override.  
Conclusão: revisão humana é auditável e contratualmente contextualizada.

Status: **CONFIRMADO**  
Arquivo: `src/features/admin/hooks/useContracts.ts`  
Função: `saveTenantContract`/fallback  
Linha aproximada: 295-405  
Evidência: usa RPC v3 sob autoridade organizacional; quando desabilitada, escreve tabelas diretamente.  
Conclusão: há duas autoridades operacionais possíveis.

Status: **CONFIRMADO**  
Arquivo: `src/features/contracts/services/contracts.service.ts`  
Função: CRUD  
Linha aproximada: 25-138  
Evidência: CRUD direto na mesma `contracts`, SLA e audit log.  
Conclusão: os módulos representam o mesmo domínio e duplicam persistência.

Status: **CONFIRMADO**  
Arquivo: `supabase/migrations/20260731010055_9f791a1e-2685-49d6-a57e-4095c2564dd2.sql`  
Função: `apf_can_access_*` e policies  
Linha aproximada: 2-90  
Evidência: acesso deriva organização por contrato/projeto e substitui policies APF.  
Conclusão: `develop` corrige isolamento que não está em `main`.

Status: **NÃO VERIFICADO**  
Arquivo: banco remoto  
Função: migrations aplicadas  
Linha aproximada: n/a  
Evidência: não houve introspecção do ambiente implantado.  
Conclusão: não se pode afirmar que produção possui o hardening de `develop`.

## 10. Lacunas críticas

1. **CRÍTICO:** ausência de snapshot/hash/versionamento do ruleset e TR por contagem.
2. **ALTO:** catálogo/modelo 1:1 mutável por contrato; alteração in-place afeta recontagem.
3. **ALTO:** coexistência de dois motores e dois prompts, com resultados potencialmente divergentes.
4. **ALTO:** `main` não contém o hardening RLS APF presente em `develop`.
5. **ALTO:** duas trilhas de mutação de contrato e três representações de vínculo com times.
6. **ALTO:** ausência de estados financeiros explícitos (faturável, aprovado, glosado).
7. **MÉDIO:** `contract_id` não é copiado para sessão/item; mudança do projeto reduz rastreabilidade.
8. **MÉDIO:** regras regex/limiares/default não são parametrizadas por TR.
9. **MÉDIO:** prompt efetivo TypeScript pode divergir de `apf_counting_rules`.
10. **BAIXO:** documentação descreve caminhos históricos que não são o único runtime atual.

## 11. Riscos financeiros e históricos

Resposta objetiva: **uma contagem realizada hoje não muda apenas ao ser consultada**, pois `apf_counting_items` e totais persistem peso, percentual, PF bruto, PF FS e correções. Contudo, **pode mudar se for resetada, reanalisada, rematerializada ou recalculada amanhã**, pois a sessão aponta para `model_id` e baseline, mas não guarda snapshot das regras/catálogos; o modelo e seus filhos podem ser atualizados in-place, e o cérebro consulta precedentes atuais.

O histórico guarda: modelo por referência, baseline/version por referência, itens e valores, resultado/análise IA, raw payload em runs, `prompt_version`, modelo IA, resultado humano, override/motivo, eventos e um snapshot apenas no evento de reset. Não guarda de forma completa: versão do modelo/ruleset, conteúdo das regras usadas, prompt final integral garantido para toda rota, versão do contrato/TR, hash, vigência ou snapshot autossuficiente.

Riscos: alteração retroativa **CRÍTICO** em reprocessamento; faturamento **ALTO**; perda de explicabilidade **ALTO**; divergência IA/determinístico **ALTO**; arredondamento divergente de TR **MÉDIO**. Recomenda-se proibir update/delete de versões publicadas e nunca recalcular resultado oficial durante leitura.

## 12. Riscos de multi-tenancy e RLS

O schema inicial protege modelos por contratos da organização e itens por sessão/baseline, mas policies antigas dependem de subqueries e papéis globais. O hardening de `develop` cria `apf_can_access_model/session/baseline`, derivando a organização pelo contrato/projeto. Ainda assim:

- **ALTO:** se `projects.contract_id` e `projects.org_id` divergirem, a seleção pode usar contrato errado; o preflight procura exatamente relações órfãs/cross-org.
- **ALTO:** `SECURITY DEFINER` exige validação interna rigorosa; várias RPCs validam time/admin, mas a cobertura final no banco implantado é **NÃO VERIFICADO**.
- **ALTO:** módulo operacional com CRUD direto pode contornar invariantes das RPCs administrativas.
- **MÉDIO:** regras são editáveis por quem satisfaz policy `FOR ALL`; falta papel contratual específico de publicador/aprovador.
- **MÉDIO:** vínculos em `teams.contract_id`, `contract_teams`, `contract_room_teams` e `projects.contract_id` podem divergir.
- **MÉDIO:** contexto de precedentes é por projeto/time e não snapshot; configuração de outro tenant só deve ser impossível se todas as migrations/policies estiverem aplicadas.

O audit `20260704_07...preflight.sql` verifica `projects` com contratos ausentes, relações de contrato cross-org e coerência de teams; confirma que `useCompanies`, `useContracts` e `projects.service` estavam em transição para autoridade organizacional. Execução do preflight em ambiente real: **NÃO VERIFICADO**.

## 13. Matriz de parametrização

| Regra | Onde está hoje | Arquivo/tabela | Hardcoded? | Granularidade | Impacta resultado? | Evidência |
| --- | --- | --- | --- | --- | --- | --- |
| Modelo APF | banco | `apf_counting_models` | não | contrato | sim | `UNIQUE(contract_id)` |
| Fator | banco + cérebro | factors/SQL | parcial | modelo + projeto/story | sim | lookup + precedência |
| Precedência | SQL | counting brain | sim | global/projeto | sim | ordem fixa |
| Arredondamento | SQL | RPCs | sim, 2 casas | global | sim | `round(...,2)` |
| Processo elementar | IA + SQL + humano | runs/processes | parcial | projeto/baseline | sim | materialização |
| EI | catálogo | function types | não, se cadastrado | modelo | sim | suporte genérico |
| EO | catálogo | function types | não, se cadastrado | modelo | sim | suporte genérico |
| EQ | catálogo | function types | não, se cadastrado | modelo | sim | suporte genérico |
| ILF | catálogo | function types | não, se cadastrado | modelo | sim | suporte genérico |
| EIF | catálogo | function types | não, se cadastrado | modelo | sim | suporte genérico |
| Manutenção | factors + regex | seed/brain | parcial | modelo/global | sim | COR/A/E/PMD etc. |
| Retrabalho | não formalizado | — | — | — | não direto | **INEXISTENTE** |
| Glosa | não formalizado | — | — | — | não | **INEXISTENTE** |
| IA x humano | runs/events | review/validation | fluxo fixo | item/run | sim | override auditado |
| PF bruto | item | SQL/catalog | fórmula fixa | item | sim | peso resolvido |
| PF ajustado | representado como PF FS | `pf_fs` | fórmula fixa | item | sim | peso × fator |
| PF faturável | não formalizado | — | — | — | deveria | **INEXISTENTE** |
| Baseline | banco | baseline/items | não | projeto/modelo | sim | status/version |
| Regras de prompt | banco e TS | rules/service | parcial | modelo/global | sim indiretamente | fontes duplas |
| Fator oficial | histórico | metric history | heurística fixa | sistema/HU | sim | prioridade máxima |
| Complexidade DET/FTR/RET | peso genérico | type weights/baseline | parcial | modelo | sim | não há matriz IFPUG completa comprovada |

Cobertura de itens específicos de TR: GUF/VAF/fator de ajuste **PARCIALMENTE EXISTENTE** (fatores percentuais, sem entidade GUF/VAF); arredondamento configurável **INEXISTENTE**; manutenção **EXISTENTE/PARCIAL**; EI/EO/EQ/ILF/EIF **PARCIALMENTE EXISTENTE** via catálogo genérico; DET/FTR/RET e limites **PARCIALMENTE EXISTENTE/NÃO VERIFICADO**; precedência/override/auditoria **EXISTENTE**; PF aprovado/glosado/faturável **INEXISTENTE**.

## 14. Arquitetura atual

```text
contracts
  └─ projects.contract_id
       ├─ apf_counting_models (1 linha mutável por contrato)
       │    ├─ tipos/pesos
       │    ├─ fatores
       │    └─ regras textuais
       ├─ apf_project_baselines (versionadas por projeto)
       └─ apf_counting_sessions
            ├─ IA: prompt TS → apf-generate → analysis runs
            ├─ SQL: precedência + materialização + cálculo
            ├─ humano: revisão/validação/override
            └─ apf_counting_items + eventos
```

O Axionn possui uma arquitetura intermediária: **Contrato → Modelo APF mutável → regras/catálogos + baseline de projeto → contagem**. Não possui ainda **Contrato → TR versionado → perfil/ruleset publicado → snapshot → contagem**.

## 15. Arquitetura futura recomendada

```text
Contrato
  └─ Perfil APF
       └─ Versão de TR/ruleset (draft → approved → published → retired)
            ├─ herda Modelo Global versionado
            ├─ overrides contratuais versionados
            ├─ vigência e aprovação
            └─ hash canônico
                 └─ Snapshot de execução imutável
                      ├─ contagem oficial
                      └─ shadow run comparativo
```

Resolver a versão pela data de referência da medição, não pela data da consulta. O fallback deve produzir um snapshot do “modelo atual legado” quando não houver perfil, mantendo exatamente o resultado vigente.

## 16. Proposta de modelagem

Sem SQL, recomenda-se:

- `apf_profiles`: identidade do perfil ligado ao contrato, com fallback/modelo-base.
- `apf_profile_versions`: número, status, vigência, TR externo, autor, aprovador, datas e hash.
- `apf_rulesets`: documento canônico da versão; preferir colunas tipadas para regras financeiras e JSONB apenas para extensões.
- filhos versionados de tipos, pesos, fatores, arredondamento, manutenção e processo elementar.
- `apf_execution_snapshots`: cópia canônica imutável da configuração resolvida, contrato, projeto, versão, prompt version, provider/model e hash.
- `apf_counting_sessions.profile_version_id` e `snapshot_id`, além de `contract_id` denormalizado e validado.
- `apf_shadow_runs`: liga sessão oficial, versão candidata, deltas e aprovação sem substituir valores oficiais.

Relacionamentos publicados devem ser append-only. Uma versão de perfil pode atender muitas sessões; cada sessão oficial aponta exatamente para um snapshot. O snapshot não depende de joins mutáveis para reconstruir o resultado.

## 17. Estratégia de versionamento

Estados: `draft`, `in_review`, `approved`, `published`, `retired`. Somente uma versão publicada pode vigorar por intervalo contratual sem sobreposição. Publicação congela conteúdo, gera hash canônico e registra autor/aprovador. TR v2 cria nova linha; nunca atualiza v1. Contagens selecionam a versão por `effective_at` e continuam ligadas à v1. Correção emergencial exige nova versão, mesmo que semanticamente “patch”.

## 18. Estratégia de snapshot

No início da sessão, resolver modelo global + overrides + versão vigente; serializar ordenadamente todos os valores que influenciam o resultado; incluir regras determinísticas, tabelas de peso/fator, arredondamento, prompt efetivo, versões de código/algoritmo e baseline; calcular SHA-256; persistir snapshot imutável antes da IA. Toda materialização/reabertura deve ler o snapshot, não catálogos correntes. Resultado humano e eventos são anexos auditáveis, sem reescrever o snapshot original.

## 19. Impactos no frontend

Adicionar seleção/visualização de perfil e versão vigente, badges de fallback, vigência e hash; editor de draft separado da publicação; comparação de versões; motivo/aprovação; indicação clara de contagem oficial versus shadow; exibição do snapshot usado. Unificar os dois módulos de contratos em uma API/hook comum, preservando telas específicas. Impedir edição de versão publicada e alertar quando projeto não tem contrato coerente.

## 20. Impactos no backend

Centralizar resolução de contexto em uma RPC transacional; tornar prompt builder e materialização consumidores do snapshot; remover duplicação gradual entre prompt TS e SQL; expor algoritmo versionado; validar contrato/organização/projeto em toda RPC `SECURITY DEFINER`; separar claramente motor legado e contratual; tornar recontagem uma nova execução, nunca mutação silenciosa da oficial.

## 21. Impactos no banco

Novas entidades de perfil/versão/snapshot/shadow e FKs nas sessões; constraints de vigência e imutabilidade; índices por contrato/status/vigência/hash; RLS derivada de `organization_id`; papéis de editor, aprovador e publicador; triggers de auditoria; compatibilidade com sessões antigas nullable. Não se recomenda substituir imediatamente tabelas atuais: elas podem ser materialização/fallback durante migração.

## 22. Estratégia de migração

1. Inventariar e congelar semanticamente o comportamento atual com golden tests.
2. Criar “Legacy Current v1” por contrato a partir dos catálogos existentes, sem mudar runtime.
3. Gerar snapshots apenas observacionais e comparar hashes/outputs.
4. Executar shadow mode: regra atual oficial + versão candidata, armazenando delta de processos, fator, PF bruto e PF FS.
5. Corrigir divergências e obter aceite financeiro/PO.
6. Ativar por contrato/canário; contratos sem perfil seguem fallback atual.
7. Tornar snapshot obrigatório para novas sessões.
8. Aposentar gradualmente o motor paralelo após provar consumidores e equivalência.

Shadow mode é **tecnicamente viável**: reutilizar HU, baseline e entradas, materializar em namespace/tabelas de shadow, bloquear atualização de `user_stories` e totais oficiais e produzir relatório de delta. Nunca usar triggers que escrevam na sessão oficial.

## 23. Estratégia de testes

- Golden master das contagens atuais por contrato, baseline e HU.
- Unitários para precedência, regex, peso, percentual e todos os modos de arredondamento futuros.
- Contrato A/TR v1 versus A/TR v2, provando imutabilidade de v1.
- Contrato A versus B com dados idênticos, provando isolamento e regras distintas.
- Fallback sem perfil, exigindo igualdade byte/decimal com o runtime atual.
- Reprocessamento após mudança de catálogo, exigindo leitura do snapshot antigo.
- Concorrência de publicação e abertura de sessão.
- RLS cross-org/cross-contract para todas as tabelas e RPCs `SECURITY DEFINER`.
- Overrides humanos com motivo, autoria e trilha completa.
- Shadow sem escrita em `user_stories`, itens/totais oficiais ou faturamento.
- Migração de sessões antigas, soft delete, restore e mudança de projeto/contrato.
- Comparação dos dois motores até sua consolidação.

## 24. Perguntas de negócio pendentes

1. Qual data define a versão vigente: abertura da OS, início da sprint, aceite ou faturamento?
2. Quem pode editar, aprovar e publicar um TR/ruleset? Há segregação de funções?
3. PF FS é sinônimo contratual de PF ajustado/faturável em todos os contratos?
4. Quais modos e escalas de arredondamento são permitidos e em qual etapa?
5. Como representar glosa, aprovação parcial, retrabalho, garantia e refaturamento?
6. Um projeto pode mudar de contrato? O que ocorre com sessões abertas?
7. Precedente humano é limitado ao contrato, projeto, sistema ou organização?
8. Histórico oficial sempre prevalece sobre TR novo, ou possui vigência própria?
9. Quais deltas de shadow exigem aprovação manual antes do rollout?
10. Por quanto tempo prompts, respostas IA e evidências devem ser retidos?
11. O modelo PFS/TRN é obrigatório ou contratos podem usar IFPUG EI/EO/EQ/ILF/EIF completo?
12. Contagens validadas podem ser reabertas? Se sim, como versionar o resultado financeiro?

## 25. Veredito final

```text
VIABILIDADE: ALTA, aproveitando contract_id/model_id existentes
COMPLEXIDADE: ALTA
RISCO FINANCEIRO: ALTO
RISCO DE REGRESSÃO: ALTO sem golden/shadow; MÉDIO após rollout versionado
IMPACTO BANCO: ALTO
IMPACTO BACKEND: ALTO
IMPACTO FRONTEND: MÉDIO
```

O gap central não é ausência total de parametrização contratual: ela já existe em catálogos por modelo. O gap é governança temporal e probatória — TR explícito, versão imutável, vigência, publicação, hash e snapshot da execução — somado à duplicação de motores/prompts e módulos de contrato. A evolução recomendada preserva o comportamento atual como fallback, encapsula-o numa versão legada e só promove regras novas após shadow mode e aceite financeiro.

```text
STATUS DA EXECUÇÃO:

AUDITORIA CONCLUÍDA.
NENHUM ARQUIVO DO SISTEMA FOI ALTERADO.
```
