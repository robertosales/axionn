# Consolidação — Fase 4B: Microsoft Teams e health operacional

**Data:** 11/07/2026  
**Estado:** código preparado; deploy e smoke test pendentes  
**SQL:** nenhum novo arquivo

## Baseline confirmado

O commit `05ba8c5e929be219019d364e2b30a1f4a8a9ea9b` (`fase 0 a 4a`) estava em `develop` e `origin/develop`, com worktree limpo antes deste lote.

A consulta de health Git ter retornado zero linhas não indica erro estrutural: a tabela e a consulta funcionam, mas nenhum webhook processado pelo handler atualizado havia criado evento até aquele momento.

## Melhorias realizadas

### Compatibilidade com o schema publicado

O Teams Bot consultava `teams_integrations.tenant_id`, coluna que não existe no schema publicado. A resolução agora usa `azure_tenant_id`, conforme a migration e os tipos gerados.

### Resolução tolerante

A consulta deixou de usar `.single()` diretamente. Agora ordena pela configuração atualizada mais recentemente, limita a uma integração e usa `.maybeSingle()`. Isso evita falha quando o tenant não possui integração e reduz o impacto de configurações múltiplas por projeto.

### Health operacional

Após uma mensagem Teams processada, o bot registra:

- `provider = 'teams'`;
- `check_type = 'webhook'`;
- status `healthy` ou `unhealthy`;
- latência;
- correlation ID;
- tipo de atividade e comando, sem payload ou credencial sensível.

Falha no health é best-effort e não interrompe a atividade. Falha no processamento da mensagem é registrada como `MESSAGE_PROCESSING_FAILED` e continua retornando ao tratamento de erro existente.

### Última atividade

Após processamento bem-sucedido, `teams_integrations.last_activity_at` é atualizado.

### Contrato de regressão

Foi criado `src/saas/integrationHealthContract.test.ts` para garantir que:

- clientes autenticados não escrevam health diretamente;
- a RPC comum não exponha colunas de credenciais;
- Git não volte a exigir `projects!inner`;
- Teams continue usando `azure_tenant_id`;
- ambos os conectores continuem emitindo health.

## Preservação

- Nenhuma migration foi criada ou alterada.
- Nenhum comando Teams foi removido ou renomeado.
- Nenhuma credencial é persistida no health.
- O mecanismo legado de token/envio não foi alterado neste lote.
- Atividades sem integração configurada continuam sendo ignoradas sem erro público.

## Publicação manual

Edge Function alterada:

```text
teams-bot
```

Publicação pelo fluxo autorizado:

```powershell
npx supabase functions deploy teams-bot
```

## Smoke test

1. Publicar `teams-bot`.
2. Enviar uma mensagem controlada ao bot em tenant com integração ativa.
3. Confirmar HTTP `200` e correlation ID nos logs.
4. Confirmar `last_activity_at` atualizado.
5. Executar:

```sql
select provider, integration_id, status, check_type, latency_ms,
       error_code, checked_at, correlation_id
from public.integration_health_events
where provider = 'teams'
order by checked_at desc
limit 20;
```

Resultado esperado após a mensagem: pelo menos uma linha `healthy`, ou uma linha `unhealthy` com código sanitizado que permita diagnóstico.

## Validação local

- lint da Edge Function: 0 erros; avisos históricos de tipagem permanecem;
- suíte Vitest: 19 arquivos e 133 testes aprovados;
- build de produção: aprovado;
- teste de contrato de integrações: 4 testes aprovados.

## Pendência estratégica

O envio real de mensagens ainda depende do mecanismo legado de token/secret. A consolidação de credenciais com Vault e validação de tokens Microsoft deve ocorrer em lote próprio antes de considerar o conector pronto para exposição corporativa ampla.
