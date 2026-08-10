# ETAPA 3 — AUDITORIA INICIAL DO REPOSITÓRIO

> Data: 2026-08-10
>
> Escopo: APF-ET3-001
>
> Estado implantado: NÃO VERIFICADO

## Ambiente e limitações

- Branch de trabalho: `feature/apf-contrato-tr-etapa-3`, criada de `develop` após `fetch` e `pull --ff-only`.
- Base observada após sincronização: `0c87dfe6` (`etapa 3`).
- Supabase CLI: **NÃO ENCONTRADO**.
- Variáveis de conexão Supabase/PostgreSQL: **NÃO ENCONTRADAS** no processo (somente nomes foram procurados; nenhum segredo foi exibido).
- Banco local/remoto, migrations efetivamente aplicadas, grants e policies efetivas: **NÃO VERIFICADO**.
- `docs/apf/ETAPA_2_*`: **NÃO ENCONTRADO**; o documento de referência está na raiz como `ETAPA_2_ARQUITETURA_APF_CONTRATO_TR.md` e foi utilizado.

## Inventário confirmado no repositório

| Categoria | Estrutura/elemento | Evidência e estado |
| --- | --- | --- |
| Modelo | `apf_counting_models` | Criada em `20260620_001...`; `contract_id` e catálogos filhos; mutável |
| Catálogo | `apf_function_types`, `apf_impact_factors`, `apf_counting_rules` | Filhos de `model_id`; usados pelo prompt/engine atual |
| Pesos | `apf_function_type_weights` | Criada em `20260625000011...`; consultada por `resolve_apf_item_weight` |
| Baseline atual | `apf_project_baselines`, `apf_baseline_items` | Projeto/modelo, versões e itens; consumidores APF atuais |
| Resultado atual | `apf_counting_sessions`, `apf_counting_items` | Sessões/itens com totais e valores materializados; sem snapshot completo |
| Legado | `project_fp_baselines`, `function_point_analyses` | Criadas em migrations de 2026-06-19; consumidores ativos |
| Processo | `apf_elementary_processes`, analysis runs/items/events | Engine/revisão/cérebro adicionados por migrations de 2026-06-25/07-02 |
| RPC | `open_counting_session` | `SECURITY DEFINER`; resolve projeto→contrato→modelo/baseline atuais |
| RPC | `save_contractual_counting_items` | Materializa itens e totais; calcula no banco atual |
| RPC | `resolve_apf_item_weight` | Precedência de peso por baseline/catálogo/tipo |
| RPC | `resolve_apf_factor_decision` | Precedência oficial/humana/regex/default no código atual |
| RPC | `resolve_apf_process_analysis_v2` | Contextualiza análise, fator e override |
| RPC | `materialize_apf_process_analysis` | Materializa análise validada |
| RPC | `reset_apf_story_counting` | Pode resetar/recontar; risco histórico para arquitetura futura |
| RPC | `get_active_apf_context` | Consumida por `useApfCatalog` |
| RLS | policies APF iniciais | Várias policies `FOR ALL` derivadas por modelo/projeto |
| RLS hardening | `apf_can_access_model/session/baseline` | Migration `20260731010055...`; efetiva no remoto NÃO VERIFICADA |
| Edge | `apf-generate` | JWT verificado em `config.toml`; geração genérica/contratual |
| Edge | `count-function-points` | Runtime Legacy, prompt/few-shot, recalcula total e persiste |
| Edge | `process-apf-job` | Worker/fila APF; usa `claim_next_apf_job` |
| Hook | `useContractualApfCounting` | Abre sessão, congela proposta durante execução, chama Edge/RPCs |
| Hook | `useFunctionPointCounter` | Invoca `count-function-points`; lê/escreve `function_point_analyses` |
| Service | `projectBaselineCounting.service.ts` | Builder `apf-process-separation-v1`, normalização/análise |
| Service | `contracts.service.ts` | CRUD direto de contrato/SLA/vínculos; autoridade duplicada com admin |
| Frontend | `ApfFunctionPointTab`, dialogs, baseline tabs | Consumidores do runtime contratual atual |
| Frontend legado | `FunctionPointModal/Summary/Badge/Baseline` | Consumidores do hook/tabelas Legacy |

## Chamadas diretas e fronteiras de segurança

- `useContractualApfCounting` acessa diretamente providers, runs, baseline items e validation events, além das RPCs.
- `useApfCatalog` acessa sessões, itens, analysis runs e `user_stories` diretamente.
- `FunctionPointBaseline` faz CRUD direto em `project_fp_baselines` e lê `function_point_analyses`.
- `contracts.service.ts` faz mutações diretas em `contracts`, `contract_slas` e `contract_room_teams`.
- `src/features/admin/hooks/useContracts.ts` prefere RPCs organizacionais, mas possui fallbacks diretos.
- Funções APF `SECURITY DEFINER` aparecem em várias gerações de migrations; algumas usam `SET search_path = public`, enquanto a meta da Etapa 3 exige `public, pg_temp`. A definição efetiva precisa de introspecção antes de hardening.
- Grants foram corrigidos incrementalmente (`20260625000019...`, `20260703050000...`), mas a composição final no ambiente permanece **NÃO VERIFICADA**.

## Diferenças contra a arquitetura aprovada

| Requisito | Classificação | Consequência |
| --- | --- | --- |
| Perfis/versões/ruleset formal | NÃO ENCONTRADO | M1/M2 necessários após gate |
| Vigência por data de medição | NÃO ENCONTRADO | DEC-001 bloqueia resolver |
| Snapshot autossuficiente/hash | NÃO ENCONTRADO | M5/M6 necessários |
| Sessão ligada ao snapshot | NÃO ENCONTRADO | M7 aditiva necessária |
| Engine somente por snapshot | INCOMPATÍVEL | Engine atual consulta catálogo mutável |
| IA sem autoridade financeira | PARCIALMENTE CONFIRMADO | Legacy recalcula total; contrato precisa schema allowlist explícito |
| Prompt único | INCOMPATÍVEL | SQL, TS e Edge Legacy coexistem |
| Legacy preservado | CONFIRMADO | Consumidores ativos impedem remoção |
| Shadow isolado | NÃO ENCONTRADO | Só após engine v2 |
| Feature flags APF | NÃO ENCONTRADO | Infra comercial existe e deve ser reutilizada |
| Golden Master | IMPLEMENTADO NESTE GATE | Fixtures offline ainda precisam aceite implantado/financeiro |

## Conclusão do APF-ET3-001

O inventário do **repositório** está concluído. O critério “diff repositório × ambientes aprovado” permanece **PARCIAL/BLOQUEADO**, porque não há mecanismo/credencial de introspecção disponível. Nenhuma afirmação sobre produção foi inferida a partir das migrations.
