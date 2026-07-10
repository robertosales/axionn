# Consolidação — Fase 0: baseline e gate de segurança

**Data:** 10/07/2026  
**Estado:** concluída localmente; gate remoto pendente  
**Regra:** nenhuma escrita foi executada no Lovable Cloud.

## Resultado

A fundação local foi inventariada e validada. A aplicação compila, a suíte unitária/contratual passa e os artefatos de tenancy estão presentes. A validação operacional remota não pode ser declarada concluída porque o repositório registra que o Lovable Cloud é produção, não há staging separado, não há credencial de banco no ambiente e o runbook proíbe a Supabase CLI contra esse backend.

## Evidências locais

- Build de produção: aprovado.
- Vitest: 18 arquivos, 127 testes, 0 falhas.
- Contratos locais de tenancy, entitlements e console organizacional: aprovados.
- Migrations SQL inspecionadas: 294.
- Nomes inválidos: 0.
- Edge Functions: 17.
- Workflows de CI, testes de banco, diagnósticos e validação de tenancy: presentes.
- Operações SQL de preflight, ativação, rollback e monitoramento: presentes.

## Histórico publicado com versões duplicadas

O preflight canônico de migrations identifica versões duplicadas:

| Versão | Arquivos |
|---|---|
| `20260709190000` | `20260709190000_axionn_briefing_retention_policy.sql`; `20260709190000_fix_is_platform_admin_grant_authenticated.sql` |
| `20260709230000` | `20260709230000_axionn_briefing_stabilization.sql`; `20260709230000_phase7_usage_reports.sql` |

### Decisão de preservação

O responsável confirmou que os quatro arquivos já foram publicados e que o sistema está funcionando. Eles passam a ser tratados como histórico materializado e não serão renomeados, reordenados, editados ou reaplicados.

Regra para evoluções futuras:

1. nunca corrigir retroativamente essas versões;
2. criar somente migrations incrementais com versão nova e única;
3. verificar a existência dos objetos antes de alterá-los;
4. preservar dados e comportamento em produção;
5. incluir pós-validação e rollback quando seguro;
6. entregar a ordem explícita para aplicação manual no Lovable.

## Estado remoto conhecido pelo repositório

Segundo `docs/saas-remote-rollout-status.md`:

- o backend remoto é Lovable Cloud de produção;
- não há projeto de staging separado;
- a fundação multitenant e o canário foram materializados;
- o último readiness registrado teve zero inconsistências;
- o estado final de `public.is_tenancy_enforced()` não está comprovado no documento;
- o resultado da Operação 10 (`post_enforcement_monitoring_ok`) permanece pendente;
- não se deve usar `supabase db push`, reset ou repair contra o Lovable Cloud.

Há documentação mais antiga que descreve staging via Supabase CLI. Para este rollout, o documento de status mais recente prevalece. Os workflows de staging não devem ser apontados ao projeto de produção.

## Gate remoto obrigatório

Antes de qualquer SQL novo, obter no SQL Editor do Lovable Cloud, em modo somente leitura:

```sql
select public.is_tenancy_enforced() as tenancy_enforcement_enabled;

select version, name
from supabase_migrations.schema_migrations
where version in ('20260709190000', '20260709230000')
order by version;
```

Também deve ser recuperada a última evidência já existente das Operações 6 a 10. Não repetir operações apenas para preencher documentação.

### Decisão por estado

- Se enforcement estiver `false`: não executar Operação 10 e não ativar sem nova autorização formal, backup, janela e rollback.
- Se enforcement estiver `true`: executar primeiro o monitoramento pós-ativação previsto no runbook, mantendo rollback pronto.
- Se o estado não puder ser comprovado: nenhuma mudança estrutural remota deve avançar.

## Bloqueios para encerrar o gate remoto

1. Resultado atual de `public.is_tenancy_enforced()`.
2. Histórico/equivalência das quatro migrations com versões duplicadas.
3. Evidência da Operação 10 ou confirmação de que o enforcement segue desligado.
4. Ambiente seguro de staging ou janela formal de produção para qualquer validação que escreva dados.

## Critério de saída da Fase 0

### Concluído

- baseline local;
- testes de frontend/domínio;
- build;
- inventário de artefatos;
- detecção de conflito de migrations;
- procedimento de decisão e rollback documentado.

### Pendente externo

- confirmar estado remoto de enforcement;
- resolver versões duplicadas com evidência remota;
- executar pgTAP contra banco seguro, não contra produção sem janela aprovada;
- registrar monitoramento pós-ativação quando aplicável.

## Próxima fase autorizável

A Fase 1 pode avançar apenas em mudanças locais e reversíveis: documentação, catálogo técnico, organização de rotas, redução de bundles, padronização de erros e expansão de testes. A criação ou alteração de migrations fica congelada até a resolução do gate acima.
