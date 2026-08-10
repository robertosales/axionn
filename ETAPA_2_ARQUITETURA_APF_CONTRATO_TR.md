# ETAPA 2 — ARQUITETURA PROPOSTA PARA APF POR CONTRATO/TR

## 1. Validação da auditoria da Etapa 1

A arquitetura proposta continua coerente, com dois refinamentos: `apf_function_type_weights` já existe e deve ser reaproveitada para pesos por tipo/complexidade; e o motor legado possui consumidores ativos em `src/features/function-points`, portanto não pode ser removido sem migração e telemetria.

| ID | Arquivo | Função/componente | Linha aproximada | Status | Evidência |
| --- | --- | --- | ---: | --- | --- |
| E1 | `supabase/migrations/20260620_001_multi_tenancy_apf_engine.sql` | schema APF | 113–217 | CONFIRMADO | `apf_counting_models.contract_id` é único; tipos, fatores e regras dependem de `model_id` |
| E2 | mesmo arquivo | baselines/sessões/itens | 247–372 | CONFIRMADO | baseline e sessão referenciam modelo; itens persistem peso, percentual e PF FS |
| E3 | `supabase/migrations/20260625000011_apf_project_baseline_catalog.sql` | `apf_function_type_weights` | 46–60 | CONFIRMADO | peso por `model_id`, tipo e complexidade |
| E4 | `supabase/migrations/20260624000004_apf_counting_rpc.sql` | `open_counting_session` | 24–109 | CONFIRMADO | projeto resolve contrato, modelo ativo e baseline |
| E5 | mesmo arquivo | `build_apf_prompt(UUID)` | 126–235 | CONFIRMADO | prompt SQL lê regras, tipos e fatores pelo modelo da sessão |
| E6 | `src/features/apf/hooks/useContractualApfCounting.ts` | `countForHu` | 154–343 | CONFIRMADO | abre sessão, monta prompt TypeScript, chama IA, persiste e materializa |
| E7 | `src/features/apf/services/projectBaselineCounting.service.ts` | `buildStructuredProcessAnalysisPrompt` | 13 e 175+ | CONFIRMADO | versão `apf-process-separation-v1`; segunda fonte de regras |
| E8 | `supabase/migrations/20260702000026_apf_counting_brain_phase1.sql` | `resolve_apf_factor_decision` | 88–229 | CONFIRMADO | precedência oficial → humano → regex → default |
| E9 | `supabase/migrations/20260702000030_apf_counting_brain_phase2_factor_review.sql` | `resolve_apf_process_analysis_v2` | 316–522 | CONFIRMADO | resolve contrato/modelo/fator e registra override |
| E10 | `supabase/functions/count-function-points/index.ts` | Edge Function | 323–581 | CONFIRMADO | few-shot e persistência em `function_point_analyses` |
| E11 | `src/features/function-points/hooks/useFunctionPointCounter.ts` | hook legado | 14–80 | CONFIRMADO | consumidor ativo de `count-function-points` |
| E12 | `src/features/function-points/components/FunctionPointBaseline.tsx` | baseline legado | 66–134 | CONFIRMADO | consumidor ativo de `project_fp_baselines` |
| E13 | `src/features/admin/hooks/useContracts.ts` | CRUD tenant-aware | 117–405 | CONFIRMADO | prefere RPCs de organização, mantendo fallback direto |
| E14 | `src/features/contracts/services/contracts.service.ts` | CRUD operacional | 25–175 | CONFIRMADO | grava diretamente em `contracts`, SLA e relações |
| E15 | `supabase/migrations/20260731010055_9f791a1e-2685-49d6-a57e-4095c2564dd2.sql` | `apf_can_access_*` | 2–90 | CONFIRMADO em `develop` | RLS APF deriva acesso por contrato/projeto |
| E16 | banco implantado | schema efetivamente aplicado | n/a | NÃO VERIFICADO | não houve introspecção remota |

Conclusão revisada: existe parametrização contratual parcial, mas não uma versão formal e imutável do TR. A lacuna central permanece versionamento, vigência, snapshot e governança financeira.

## 2. Princípios arquiteturais

Prioridades: integridade financeira, integridade histórica, isolamento multi-tenant, auditabilidade, compatibilidade, determinismo, manutenibilidade e UX.

- Toda contagem oficial referencia configuração imutável.
- Versão publicada nunca sofre `UPDATE` ou `DELETE`.
- IA somente propõe; regras tipadas calculam.
- Consulta nunca recalcula resultado financeiro.
- Recontagem cria nova execução/revisão e não substitui silenciosamente a anterior.
- Contrato sem perfil usa `Legacy Ruleset v1`.
- Banco é autoridade do cálculo e das transições de estado.
- Snapshot é a fonte da execução; catálogos mutáveis não são consultados após a abertura.
- Migração é aditiva e controlada por feature flag.

## 3. Modelo de domínio futuro

```text
Contract 1 ─── N ApfProfile
                   │
                   └── 1 ─── N ApfProfileVersion
                                  │
                                  ├── 1 Ruleset
                                  ├── N FunctionTypes
                                  ├── N FunctionTypeWeights
                                  ├── N Factors
                                  ├── 1 RoundingPolicy
                                  ├── N MaintenanceRules
                                  ├── 1 ElementaryProcessPolicy
                                  ├── N PrecedenceRules
                                  └── 1 PromptPolicy
                                            │
                                            ▼
                                  ExecutionSnapshot
                                            │
                                            ▼
                                    CountingSession
                                            │
                                            ▼
                                      CountingItems
```

| Entidade | Finalidade | Cardinalidade e campos centrais |
| --- | --- | --- |
| `ApfProfile` | Identidade lógica da configuração | N por contrato; UUID; contrato, modelo-base, nome, status e finalidade |
| `ApfProfileVersion` | Versão governada do TR | N por perfil; versão, estado, vigência, documento, hash e autoria |
| `Ruleset` | Configuração tipada | 1:1 com versão; regras financeiras e algorítmicas |
| Catálogos versionados | Tipos, pesos e fatores | N:1 com versão; independentes do catálogo mutável após publicação |
| `ExecutionSnapshot` | Configuração resolvida imutável | N:1 com versão; conteúdo canônico e hash |
| `CountingSession` | Execução oficial | N:1 snapshot; contexto congelado |
| `CountingItem` | Resultado unitário | N:1 sessão; operandos e valores efetivos |
| `ShadowRun` | Comparação não oficial | N:1 sessão oficial e versão candidata |

Um contrato pode possuir múltiplos perfis para modalidades distintas. Restrições propostas:

```text
UNIQUE(contract_id, profile_code)
UNIQUE(contract_id) WHERE is_default = true AND status = 'active'
```

A seleção inicial usa o perfil default. Perfil não default exige regra explícita de projeto/modalidade, evitando escolha manual arbitrária durante faturamento.

## 4. Modelo de dados proposto

Recomenda-se modelo híbrido:

- regras financeiras em colunas/tabelas tipadas;
- prompt, vocabulário e extensões não financeiras em JSONB validado;
- snapshot em JSONB canônico, pois é fotografia imutável, não autoridade editorial.

### `apf_profiles`

PK `id`; FKs `contract_id` e `base_model_id`; código, nome, descrição, status, finalidade, escopo e `is_default`; auditoria por autor e timestamps. A identidade pode evoluir, mas versões publicadas são independentes.

### `apf_profile_versions`

PK `id`; FK `profile_id`; versão, estado, vigência, referência/documento do TR, autoria, aprovação, publicação, retirada e hash. Versão única por perfil e nenhuma sobreposição de vigência publicada.

### Catálogos versionados

- `apf_profile_function_types`;
- `apf_profile_function_weights`;
- `apf_profile_factors`;
- `apf_profile_maintenance_rules`;
- `apf_profile_precedence_rules`.

Todos referenciam `profile_version_id`. Reutilizam a semântica atual, mas não dependem apenas de `model_id` mutável.

### `apf_profile_rulesets`

Uma linha por versão: schema/algoritmo, arredondamento, casas decimais, política de PF faturável, processo elementar, IA/revisão e `extension_rules JSONB`.

### `apf_execution_snapshots`

Contexto de contrato/projeto/perfil/versão/modelo/baseline; configuração resolvida; algoritmo/prompt; provider/model como proveniência; hash, autor e data. Não possui `updated_at`.

## 5. Versionamento de TR/Ruleset

```text
draft → in_review → approved → published → retired
```

“Rejected” deve ser evento/motivo de retorno a draft, não estado terminal. Versão retirada não é reativada; cria-se nova versão.

| Operação | Papel existente reutilizado |
| --- | --- |
| Criar/editar draft | `admin_contrato`, organização `owner/admin` ou `admin` global |
| Enviar para revisão | mesmos editores |
| Aprovar | organização `owner/admin` ou `admin` global |
| Publicar/retirar | organização `owner/admin` ou `admin` global |
| Consultar publicada | membro autorizado do contrato/projeto |
| Executar contagem | membro autorizado do time/projeto |

Não se cria novo papel sem decisão de segregação. Transições ocorrem somente por RPC, com lock, validação, vigência e hash.

- Draft: pode ser editado.
- Publicada: qualquer correção cria versão seguinte.
- Emergencial: nova versão com vigência e aprovação excepcional auditada.
- Mudança de peso, fator ou arredondamento: sempre nova versão.

## 6. Matriz completa de parametrização

| Regra | Estado atual | Classificação futura | Granularidade | Justificativa |
| --- | --- | --- | --- | --- |
| Fator | catálogo + cérebro | CONFIGURÁVEL COM LIMITES | versão/TR | código e faixa válidos |
| Percentual | factors | CONFIGURÁVEL COM LIMITES | fator/versão | decimal tipado |
| Arredondamento | `round(...,2)` | CONFIGURÁVEL COM LIMITES | versão/etapa | enum permitido |
| Casas decimais | 2 hardcoded | CONFIGURÁVEL COM LIMITES | versão/etapa | intervalo validado |
| Pesos EI/EO/EQ/ILF/EIF | catálogo genérico | CONFIGURÁVEL COM LIMITES | versão/complexidade | tabelas tipadas |
| DET/FTR/RET | parcial | CONFIGURÁVEL COM LIMITES | tipo/versão | faixas tipadas |
| Manutenção | fatores + regex | CONFIGURÁVEL COM LIMITES | versão | critérios explícitos |
| Corretiva | COR + regex | CONFIGURÁVEL COM LIMITES | versão | fatores/critérios |
| Evolutiva | I/A + regex | CONFIGURÁVEL COM LIMITES | versão | sem texto livre financeiro |
| Retrabalho | inexistente | DECISÃO DE NEGÓCIO | versão | definição contratual |
| Glosa | inexistente | DECISÃO DE NEGÓCIO | contrato/medição | fluxo financeiro |
| Fator oficial | histórico prioritário | DECISÃO DE NEGÓCIO | versão/fonte | precedência com TR |
| Precedência IA/humano | híbrida | CONFIGURÁVEL COM LIMITES | versão | ordem de fontes permitidas |
| Fechamento | híbrido | CONFIGURÁVEL COM LIMITES | versão | invariantes centrais fixos |
| Processo auxiliar | SQL/TS | CONFIGURÁVEL COM LIMITES | versão | critérios tipados |
| Deduplicação | SQL | FIXA POR ALGORITMO | algoritmo | chave canônica |
| PF bruto | peso resolvido | FIXA POR ALGORITMO | item | cálculo determinístico |
| PF ajustado/PF FS | fórmula fixa | CONFIGURÁVEL COM LIMITES | versão | estratégia aprovada |
| PF faturável | inexistente | DECISÃO DE NEGÓCIO | item/sessão | aceite/glosa/limites |
| Hash | inexistente | NÃO DEVE SER CONFIGURÁVEL | plataforma | SHA-256 |
| Imutabilidade | parcial | NÃO DEVE SER CONFIGURÁVEL | plataforma | integridade histórica |
| Isolamento tenant | RLS | NÃO DEVE SER CONFIGURÁVEL | plataforma | segurança |

## 7. Motor determinístico x IA

```text
Requisito + baseline + snapshot
              │
              ▼
       IA produz proposta
              │
              ▼
 Validação estrutural e humana
              │
              ▼
 Motor determinístico no banco
              ├─ resolve tipo/peso
              ├─ resolve fator/percentual
              ├─ aplica precedência
              ├─ fecha/deduplica processos
              ├─ aplica arredondamento
              └─ calcula PF bruto, ajustado e faturável
```

- Edge Function: autentica provider e retorna proposta estruturada; não calcula PF oficial.
- Frontend/service: coleta decisão e exibe preview; não é fonte financeira.
- RPC: valida tenant, snapshot, transição e payload; materializa atomicamente.
- Banco: executa cálculo tipado e persiste resultado/auditoria.

Peso, percentual e totais enviados pela IA devem ser ignorados ou rejeitados.

## 8. Snapshot de execução

Necessários: `contract_id`, `project_id`, `profile_id`, `profile_version_id`, `model_id`, `baseline_id`, versão/hash da baseline, configuração resolvida, `algorithm_version`, `prompt_version`, `content_hash`, autor e data. Provider/model são proveniência recomendada, sem integrar o hash financeiro quando não mudarem a semântica.

```json
{
  "schema_version": 1,
  "algorithm": {},
  "function_types": [],
  "weights": [],
  "factors": [],
  "rounding": {},
  "maintenance": [],
  "elementary_process": {},
  "precedence": [],
  "prompt_policy": {},
  "billing": {}
}
```

### Hash

SHA-256 é apropriado. Canonicalização: UTF-8; chaves ordenadas; arrays ordenados por chave estável; números decimais normalizados; datas UTC; remoção de campos não semânticos; tratamento explícito de ausência versus null; serialização canônica versionada.

O hash cobre configuração resolvida, versão do algoritmo e identidade/hash da baseline. Não inclui timestamps, usuário, IDs aleatórios ou resultado humano. É calculado na publicação e no snapshot; o conteúdo torna-se imutável.

## 9. Resolução de contrato e versão

```text
project_id
→ validar organização/time
→ resolver contract_id
→ resolver perfil aplicável/default
→ selecionar versão published por measurement_reference_at
→ fallback Legacy Ruleset v1
→ resolver baseline compatível
→ gerar/reutilizar snapshot idempotente
→ abrir sessão congelando IDs
```

| Alternativa | Impacto técnico | Impacto financeiro/auditoria | Risco |
| --- | --- | --- | --- |
| A — abertura da execução | simples | estável, mas pode anteceder entrega | baixo técnico/médio contratual |
| B — realização da medição | exige data explícita | melhor aderência e auditabilidade | médio |
| C — aceite/faturamento | versão desconhecida na execução | pode alterar regra após o trabalho | alto |

Recomendação: B. Até decisão de negócio, fallback usa A e registra `reference_source='session_opened_at'`. Lacuna ou sobreposição de vigência bloqueia nova sessão; nunca selecionar “a mais recente” silenciosamente.

## 10. Alterações em apf_counting_sessions

| Campo | Novo runtime | Legado | Imutável | Origem |
| --- | --- | --- | --- | --- |
| `contract_id` | NOT NULL | nullable | sim | projeto validado |
| `profile_id` | NOT NULL | nullable | sim | contexto |
| `profile_version_id` | NOT NULL | nullable | sim | vigência |
| `snapshot_id` | NOT NULL | nullable | sim | RPC |
| `ruleset_hash` | NOT NULL | nullable | sim | snapshot |
| `measurement_reference_at` | NOT NULL | nullable | sim | entrada/default legado |
| `algorithm_version` | NOT NULL | nullable | sim | snapshot |
| `is_legacy` | false no novo runtime | true | sim após abertura | RPC/migration |

`contract_id` denormalizado protege contra mudança posterior do projeto e facilita RLS/auditoria. A abertura valida igualdade entre projeto e contrato. `ruleset_hash` é redundância deliberada para prova rápida; a autoridade é `snapshot_id`.

## 11. Alterações em apf_counting_items

Persistir `effective_weight`, `effective_percentage`, `effective_factor`, rounding mode/scale, PF bruto, PF FS/ajustado, PF faturável após decisão de negócio, `calculation_breakdown` e versão do algoritmo.

Não repetir snapshot, versão ou contrato no item: a sessão é vínculo obrigatório. Exceção futura seria warehouse/particionamento.

```json
{
  "function_type": "TRN",
  "complexity": "Padrão",
  "weight": "4.60",
  "factor": "A",
  "percentage": "60.00",
  "unrounded": "2.7600",
  "rounding": {"mode": "half_up", "scale": 2},
  "pf_adjusted": "2.76"
}
```

## 12. RLS e segurança

```text
organization → contract → profile → version → snapshot → session → items
```

- Publicadas: leitura por membro autorizado do contrato/projeto.
- Draft/review: organização `owner/admin`, `admin` global e `admin_contrato` limitado ao contrato, conforme aprovação.
- Snapshot: leitura via sessão/projeto; sem escrita direta.
- Sessão/item: time/projeto + contrato + organização.
- Shadow: gestores e participantes autorizados; nunca resultado oficial.
- Update/delete de publicados/snapshots: negados por RLS e trigger.

Toda RPC `SECURITY DEFINER` deve: fixar `search_path = public, pg_temp`; qualificar objetos; negar anon; obter `auth.uid()` internamente; validar organização, vínculo, contrato, projeto/time, estado e vigência; bloquear linhas em publicação; não confiar em organization ID recebido; emitir erros sem revelar outro tenant.

Denormalização: sessão, analysis run e validation event recebem contrato preenchido pelo banco; counting item herda da sessão.

## 13. Módulos de contrato

Autoridade recomendada: RPCs tenant-aware do módulo administrativo (E13). Estratégia:

1. Criar camada compartilhada de acesso.
2. Fazer `contracts.service.ts` delegar mutações às mesmas RPCs.
3. Manter telas específicas.
4. Migrar criação, atualização, arquivo, SLA e vínculos por operação.
5. Instrumentar fallback direto.
6. Removê-lo somente após telemetria zero e testes.
7. Preservar `contract_audit_log` em visão de auditoria unificada.

O problema é autoridade de persistência, não a coexistência das experiências visuais.

## 14. Motores APF

| Aspecto | `count-function-points` | `useContractualApfCounting` |
| --- | --- | --- |
| Consumidor | `useFunctionPointCounter` | `ApfFunctionPointTab` |
| Base | HU + few-shot | baseline/processos |
| Persistência | `function_point_analyses`, stories | sessões, itens, runs, eventos |
| Regras | prompt da Edge Function | TypeScript + SQL + catálogos |
| Contrato/modelo | não é eixo central | resolve por projeto/contrato |
| Validação | análise antiga | revisão e validação atômica |

Não apagar o legado. Introduzir contrato de domínio comum; fazer ambos usarem motor determinístico por snapshot; adaptar legado para snapshot `legacy=true`; migrar telas gradualmente; deprecar apenas após ausência comprovada de chamadas; manter leitura histórica.

## 15. Prompt Builder

```text
Execution Snapshot → prompt policy → builder único → prompt final
```

- Snapshot contém regras/vocabulário.
- Builder contém somente renderização versionada.
- Edge Function recebe prompt final ou snapshot ID.
- SQL financeiro independe do prompt.
- Builder TypeScript torna-se adaptador comum.
- Builder SQL atual delega ao snapshot durante transição.

Registrar hash/versão do prompt e, conforme retenção, texto redigido. Elimina divergência entre regra no banco, TypeScript e SQL.

## 16. Shadow Mode

```text
entrada oficial ──► runtime atual ──► resultado oficial
       │
       └──────────► snapshot candidato ──► resultado shadow
```

`apf_shadow_runs`: sessão oficial, versão/snapshot candidatos, status, input hash, algoritmo/provider, resultados, deltas, timestamps, erro, criador e aprovações. `apf_shadow_items` compara item/processo.

Armazenar processos, fator, peso, percentual, arredondamento, PF bruto/FS/faturável, delta absoluto/percentual e classe `none`, `non_financial`, `minor`, `material` ou `critical`.

Proibições: nenhuma escrita em stories, sessão/item/baseline/faturamento oficiais; transação e tabelas separadas; sem triggers oficiais; `is_official=false`; promoção publica versão, nunca converte shadow em oficial.

## 17. Critérios de promoção

Técnicos: 100% golden; zero diferença no fallback; zero violação RLS; hashes consistentes; concorrência testada; cobertura das regras; rollback/observabilidade prontos; nenhuma divergência inexplicada.

Financeiros: zero divergência crítica; materiais revisadas; agregado/distribuição aprovados; arredondamento validado; trilha aceita.

Operacionais: piloto representativo; aceite formal; período mínimo de shadow; runbook e suporte; rollback ensaiado.

Segurança: testes cross-tenant, revisão de grants, introspecção do banco implantado e owner/search path verificados.

## 18. Plano de migrations

### Migration 1 — Perfis e versões

Objetivo: entidades aditivas. Dependências: contratos, modelos e usuários. RLS por contrato. Rollback somente enquanto vazias e runtime desligado.

### Migration 2 — Snapshot e auditoria

Objetivo: snapshot imutável e eventos. Índices por hash, versão, contrato e projeto. Não apagar snapshot utilizado.

### Migration 3 — Compatibilidade de sessões/itens

Objetivo: colunas nullable e breakdown. Rollback lógico: aplicação ignora colunas.

### Migration 4 — Shadow

Objetivo: execução comparativa isolada. Rollback por feature flag, preservando dados.

### Migration 5 — Imutabilidade e obrigatoriedade

Objetivo: triggers e obrigatoriedade para novas sessões. Rollback de constraint/flag, sem descongelar histórico.

### SQL PROPOSTO — NÃO EXECUTAR

```sql
create table public.apf_profiles (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id),
  base_model_id uuid references public.apf_counting_models(id),
  profile_code text not null,
  name text not null,
  description text,
  status text not null check (status in ('active','inactive')),
  is_default boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, profile_code)
);

create unique index apf_profiles_one_default
  on public.apf_profiles(contract_id)
  where is_default and status = 'active';

create table public.apf_profile_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.apf_profiles(id),
  version text not null,
  status text not null check (
    status in ('draft','in_review','approved','published','retired')
  ),
  effective_from timestamptz,
  effective_until timestamptz,
  tr_reference text not null,
  tr_document_ref text,
  content_hash text,
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  published_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  unique(profile_id, version),
  check (effective_until is null or effective_until > effective_from)
);

create table public.apf_profile_rulesets (
  profile_version_id uuid primary key
    references public.apf_profile_versions(id),
  schema_version integer not null,
  algorithm_version text not null,
  rounding_mode text not null,
  rounding_scale smallint not null check (rounding_scale between 0 and 6),
  extension_rules jsonb not null default '{}'::jsonb
);

create table public.apf_execution_snapshots (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id),
  project_id uuid not null references public.projects(id),
  profile_id uuid not null references public.apf_profiles(id),
  profile_version_id uuid not null references public.apf_profile_versions(id),
  model_id uuid references public.apf_counting_models(id),
  baseline_id uuid references public.apf_project_baselines(id),
  measurement_reference_at timestamptz not null,
  resolved_configuration jsonb not null,
  algorithm_version text not null,
  prompt_version text not null,
  content_hash text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(project_id, profile_version_id, baseline_id, content_hash)
);

alter table public.apf_counting_sessions
  add column contract_id uuid references public.contracts(id),
  add column profile_id uuid references public.apf_profiles(id),
  add column profile_version_id uuid references public.apf_profile_versions(id),
  add column snapshot_id uuid references public.apf_execution_snapshots(id),
  add column ruleset_hash text,
  add column measurement_reference_at timestamptz,
  add column algorithm_version text,
  add column is_legacy boolean not null default true;

alter table public.apf_counting_items
  add column effective_weight numeric(12,4),
  add column effective_percentage numeric(9,4),
  add column effective_factor text,
  add column rounding_mode text,
  add column rounding_scale smallint,
  add column pf_faturavel numeric(12,4),
  add column calculation_breakdown jsonb;
```

Exclusion constraint de vigência, imutabilidade, policies e grants devem ser migrations separadas e testáveis.

## 19. Plano de backend/RPC

### `resolve_apf_execution_context`

- Objetivo: resolver contrato, perfil, versão, baseline e fallback.
- Entrada: projeto, data de referência, perfil opcional.
- Saída: contexto e origem.
- Permissão: membro autorizado.
- Validações: organização, contrato, time, vigência e baseline.
- Transação: leitura consistente.
- Erros: contexto inacessível/ambíguo/inválido.
- Idempotência: sim.

### `create_apf_execution_snapshot`

- Objetivo: congelar configuração.
- Entrada: contexto resolvido.
- Saída: snapshot ID/hash.
- Permissão: runtime autorizado.
- Validações: publicada ou fallback aprovado.
- Transação: canonicalização, hash e insert.
- Idempotência: chave/hash; reutiliza equivalente.

### `publish_apf_profile_version`

- Objetivo: publicar atomicamente.
- Entrada: versão, vigência e motivo.
- Saída: estado/hash/evento.
- Permissão: owner/admin autorizado.
- Validações: conteúdo, estado, sobreposição e aprovação.
- Transação: lock no perfil.
- Idempotência: mesma publicação retorna estado; divergente falha.

### `open_counting_session`

Manter assinatura antiga por adaptador. Nova assinatura recebe data de referência/perfil opcional, resolve snapshot na mesma transação e congela contexto. Assinatura antiga usa Legacy Ruleset. Materialização/validação passam a usar snapshot da sessão.

## 20. Plano de frontend

- `ContractForm`/`ContractDetail`: seção Configuração APF.
- Exibir perfil default, modelo base, versão, estado, vigência, TR e hash.
- Edição de draft separada do contrato e da versão publicada.
- Lista, clonagem e comparação de versões.
- Fluxo review/approve/publish.
- `ApfFunctionPointTab`: perfil, TR, vigência, snapshot e legacy.
- `ApfBaselineTab`: compatibilidade baseline-versão.
- Review/validation dialogs: fonte do fator, regra, breakdown e override.

```text
Perfil APF: GlobalWeb DPF
TR: 2026.02 — Publicado
Vigência: 01/08/2026
Snapshot: 7a4b…c129
Algoritmo: apf-deterministic-v2
```

Shadow aparece em tela separada, marcado “NÃO OFICIAL”.

## 21. Compatibilidade retroativa

```text
is_legacy = true
snapshot_id = null
profile_version_id = null
```

- Não fazer backfill especulativo.
- Não recalcular valores.
- Legacy Ruleset v1 vale para execuções futuras compatíveis, não como falsa prova de antigas.
- Sessões/baselines/itens antigos seguem legíveis.
- `function_point_analyses` e `project_fp_baselines` permanecem acessíveis.
- Recontagem antiga cria nova execução com snapshot.
- Backfill de contrato somente quando inequivocamente derivável, com relatório de exceções.

## 22. Estratégia de testes

Unitários: pesos, DET/FTR/RET, fatores, percentuais, arredondamento, manutenção, precedência, fechamento, auxiliares, deduplicação, canonicalização e hash.

Integração: resolução completa, fallback, limites de vigência, publicação concorrente, snapshot, materialização, validação, mudança de catálogo e recontagem.

Segurança: cross-org/contract/project, membro sem permissão, `admin_contrato` alheio, RPC direta, owner/search path e IDs manipulados.

Regressão:

```text
Contrato sem perfil:
Legacy Ruleset v1 + mesma entrada = resultado atual
```

Histórico:

```text
Snapshot S1 → contagem A
Editar catálogo corrente
Consultar A → mesmos valores e breakdown
```

Versionamento:

```text
TR v1 → A
TR v2 → B
A permanece invariável
```

Shadow: nenhuma escrita oficial, delta correto e falha isolada.

## 23. Observabilidade

Métricas:

- `apf.count.started/completed/failed`;
- `apf.snapshot.created/reused/hash_mismatch`;
- `apf.profile.published/retired`;
- `apf.shadow.executed/divergence/failed`;
- `apf.validation.override`;
- `apf.legacy.fallback_used`;
- `apf.context.resolution_failed`;
- `apf.rls.denied`.

Dimensões seguras: IDs pseudonimizados, algoritmo, estado, origem legacy/profile, classe de delta e código de erro. Nunca logar texto integral de TR/HU/prompt, segredos ou dados pessoais. Auditoria restrita usa hashes, IDs e correlation ID.

## 24. Matriz de riscos

| Risco | Probabilidade | Impacto | Severidade | Mitigação |
| --- | --- | --- | --- | --- |
| Alteração retroativa | alta hoje | crítico | CRÍTICO | snapshot/imutabilidade |
| Divergência financeira | média | crítico | CRÍTICO | golden/shadow/breakdown |
| RLS incompleta | média | crítico | CRÍTICO | policies/testes |
| Cross-tenant | baixa/média | crítico | CRÍTICO | validação hierárquica |
| Dupla autoridade | alta | alto | ALTO | RPC compartilhada |
| IA influenciar total | média | alto | ALTO | motor determinístico |
| Arredondamento | média | alto | ALTO | policy tipada/testes |
| Publicação concorrente | média | alto | ALTO | lock/exclusion constraint |
| Mudança de contrato | média | alto | ALTO | contrato congelado |
| Rollback | média | alto | ALTO | migrations aditivas/flags |
| Migração histórica | média | alto | ALTO | não recalcular |
| Shadow escrever oficial | baixa | crítico | ALTO | isolamento técnico |
| Legado desconhecido | alta | médio/alto | ALTO | telemetria |
| Hash não canônico | média | médio | MÉDIO | canonicalização versionada |
| Perfil errado | média | alto | ALTO | default único/escopo |
| Retenção de prompt | média | médio | MÉDIO | retenção/redação |

## 25. Decisões de negócio pendentes

1. Qual data determina vigência?
2. Um contrato pode ter múltiplos perfis simultâneos?
3. Quem aprova/publica e há segregação?
4. PF FS equivale a PF ajustado/faturável?
5. Como funcionam glosa, aprovação parcial e refaturamento?
6. Quais arredondamentos são permitidos?
7. Como retrabalho e garantia afetam faturamento?
8. Contagem validada pode ser reaberta?
9. TR ou medição oficial prevalece?
10. Como tratar mudança de contrato do projeto?
11. Qual amostra/período mínimo de shadow?
12. Qual retenção de prompts, respostas e TRs?

## 26. Roadmap de implementação

| Fase | Objetivo | Risco | Rollback | Critério de sucesso |
| --- | --- | --- | --- | --- |
| 0 | Golden master | baixo | remover testes | runtime coberto |
| 1 | Entidades novas | médio | flag off | zero impacto |
| 2 | Legacy Ruleset v1 | médio | fallback atual | equivalência total |
| 3 | Snapshot | alto | modo observacional | hashes estáveis |
| 4 | Shadow | médio | flag off | zero escrita oficial |
| 5 | Piloto | alto | perfil → legacy | aceite técnico/financeiro |
| 6 | Rollout | alto | rollback por contrato | SLO/deltas aceitos |
| 7 | Snapshot obrigatório | alto | bloquear novos perfis | 100% novas sessões |
| 8 | Descontinuação | médio | manter leitura | telemetria zero |

Ordem futura: migrations de domínio; segurança; RPCs; adaptador de sessão; motor determinístico; prompt comum; shadow; frontend; adaptador legado; remoção posterior com evidência.

## 27. Checklist de implementação

- [ ] Golden master atual.
- [ ] Confirmar schema remoto.
- [ ] Aprovar decisões de negócio.
- [ ] Definir JSON canônico/hash.
- [ ] Criar perfis, versões e ruleset tipado.
- [ ] Implementar estados por RPC.
- [ ] Impedir update/delete publicado.
- [ ] Criar snapshot idempotente.
- [ ] Alterar sessão retrocompativelmente.
- [ ] Persistir breakdown.
- [ ] Centralizar cálculo no banco.
- [ ] Rejeitar valores financeiros da IA.
- [ ] Unificar prompt.
- [ ] Criar Legacy Ruleset v1.
- [ ] Provar igualdade.
- [ ] Implementar RLS hierárquica.
- [ ] Auditar `SECURITY DEFINER`.
- [ ] Unificar mutações de contrato.
- [ ] Instrumentar ambos os motores.
- [ ] Implementar shadow isolado.
- [ ] Formalizar promoção.
- [ ] Executar piloto.
- [ ] Validar rollback.
- [ ] Tornar snapshot obrigatório só para novas sessões.
- [ ] Preservar histórico sem recontagem.
- [ ] Documentar runbook e prova financeira.

## 28. Veredito técnico

```text
ARQUITETURA: APROVADA COM AJUSTES
MODELO RECOMENDADO: PERFIL + VERSÃO + RULESET HÍBRIDO + SNAPSHOT
FONTE DO CÁLCULO: MOTOR DETERMINÍSTICO NO BANCO
PAPEL DA IA: PROPOSTA E EVIDÊNCIA
COMPATIBILIDADE: LEGACY RULESET V1 + FEATURE FLAG
MIGRAÇÃO: ADITIVA, INCREMENTAL E POR CONTRATO
SHADOW MODE: OBRIGATÓRIO ANTES DA PROMOÇÃO
RISCO RESIDUAL: ALTO ATÉ GOLDEN/SHADOW; MÉDIO APÓS CONTROLES
```

A solução deve reutilizar entidades atuais como fallback, mas não manter `apf_counting_models` mutável como prova contratual. Depois de criado o snapshot, nenhuma consulta a catálogo corrente pode alterar a interpretação financeira.

```text
STATUS:

ETAPA 2 — ANÁLISE E ARQUITETURA CONCLUÍDA
NENHUMA MIGRATION EXECUTADA
NENHUM DADO ALTERADO
SOMENTE ESTE DOCUMENTO MARKDOWN FOI CRIADO NESTA ETAPA
```
