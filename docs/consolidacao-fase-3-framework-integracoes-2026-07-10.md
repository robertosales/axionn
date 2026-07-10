# Consolidação — Fase 3: framework comum de integrações

**Data:** 10/07/2026  
**Estado:** concluída e validada no Lovable  
**Modelo:** aditivo e compatível com conectores existentes

## Diagnóstico

Git, Teams, Redmine, Oracle e APEX já possuem tabelas e Edge Functions próprias. Essas estruturas permanecem como fonte de verdade e não foram alteradas. A lacuna encontrada era operacional: cada conector representa status, último uso e erro com nomes diferentes, sem um histórico comum de health checks.

## Melhoria criada

A migration `20260710200000_integration_registry_health_foundation.sql` adiciona:

### `integration_health_events`

Tabela append-only para health checks normalizados:

- organização e projeto;
- provedor e ID da integração original;
- tipo do check;
- estado `healthy`, `degraded`, `unhealthy` ou `unknown`;
- latência;
- erro sanitizado;
- correlation ID e metadados operacionais.

Clientes autenticados não podem inserir eventos. A escrita é reservada ao backend com `service_role`. Owners/admins da organização e `platform_admin` podem consultar via RLS.

### `get_integration_registry(p_org_id)`

RPC que consolida Git, Teams, Redmine, Oracle e APEX em um catálogo uniforme, sem expor tokens, senhas, secrets ou configurações sensíveis.

Retorna:

- provedor e integração;
- projeto e nome;
- status ativo;
- status operacional normalizado;
- última atividade;
- último health check, latência e erro.

A RPC exige usuário autenticado e restringe o acesso a owner/admin da organização ou `platform_admin`.

## Preservação

- Nenhuma tabela existente é alterada.
- Nenhuma credencial é copiada.
- Nenhuma Edge Function existente muda de comportamento.
- Nenhum evento anterior é reprocessado.
- Nenhum conector é ativado ou desativado.
- A migration falha antes de criar objetos se os pré-requisitos não existirem.

## Ordem manual no Lovable

### 1. Migration

Execute integralmente:

`supabase/migrations/20260710200000_integration_registry_health_foundation.sql`

Resultado final esperado:

```text
integration_registry_health_foundation_ok = true
```

### 2. Validação somente leitura

Depois, execute:

`supabase/audits/20260710_02_integration_registry_health_validation.sql`

Esperado no primeiro result set:

- `health_table_exists = true`;
- `registry_rpc_exists = true`;
- `authenticated_can_read_registry = true`;
- `authenticated_cannot_write_health = true`;
- `service_can_write_health = true`;
- `health_rls_enabled = true`.

O segundo result set apenas inventaria a quantidade de integrações por provedor.

## Rollback

Não execute rollback se a migration concluir e o sistema continuar saudável. Como os objetos são novos e não interferem nos conectores existentes, eles podem permanecer instalados mesmo antes de serem consumidos.

Caso a transação falhe antes do `commit`, o PostgreSQL desfaz toda a migration automaticamente. Qualquer remoção posterior dos objetos exige decisão explícita, pois eventos de health já podem ter sido gravados.

## Próximo lote

Após a validação, as Edge Functions poderão registrar health events gradualmente, uma por vez. O primeiro conector recomendado é Git/GitLab, seguido de Teams. Cada adaptação deve ter deploy e smoke test independentes.

## Confirmação operacional

O responsável confirmou em 10/07/2026 que a migration e a auditoria pós-aplicação foram executadas corretamente no Lovable.
