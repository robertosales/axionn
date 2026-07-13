# Consolidação — Fase 5A: Redmine e health de sincronização

**Data:** 11/07/2026  
**Estado:** código preparado; deploy e smoke test pendentes  
**SQL:** nenhum novo arquivo

## Objetivo

Integrar a sincronização Redmine ao registry de health da Fase 3, preservando tabelas, mappings e fluxo de criação/atualização já publicados.

## Melhorias realizadas

### Integração inativa

Uma integração Redmine com `is_active = false` agora retorna HTTP `409`, não processa payloads e registra health `degraded` com `INTEGRATION_INACTIVE`.

### Status operacional

Após sincronização, `redmine_integrations` passa a refletir:

- `last_sync_at`;
- `last_sync_status` como `success`, `partial` ou `failed`;
- `last_sync_items`;
- `last_sync_error` sanitizado.

### Health normalizado

O fluxo registra em `integration_health_events`:

- `healthy` quando não há falhas;
- `degraded` com `PARTIAL_SYNC` quando alguns itens falham;
- `unhealthy` com `SYNC_FAILED` em falha do fluxo;
- latência, correlation ID e contadores operacionais;
- `provider = 'redmine'` e `check_type = 'sync'`.

O registro é best-effort e não interrompe a sincronização.

### Headers

`x-integration-id`, já exigido pelo handler, foi incluído nos headers CORS permitidos.

### Contrato de regressão

O contrato compartilhado de integrações agora também confirma que Redmine:

- grava no health registry;
- usa provider e tipo de check corretos;
- diferencia sucesso, parcial e falha;
- mantém o resumo da integração em falhas.

## Preservação

- Nenhuma migration foi criada ou alterada.
- Nenhuma tabela, issue link ou mapping foi removido.
- Nenhuma direção de sincronização foi alterada.
- Nenhuma chave ou payload sensível é gravado no health.
- O processamento existente de issues e bulk sync foi preservado.

## Risco de credenciais não resolvido neste lote

O código legado ainda trata `api_key_encrypted` e `webhook_secret_encrypted` como valores utilizáveis diretamente. Isso é um placeholder, não uma estratégia criptográfica concluída. O endpoint não deve ser tornado público sem JWT até existir decriptação segura/Vault e validação fail-closed do webhook.

## Publicação manual

Edge Function alterada:

```text
redmine-sync
```

Publicar pelo fluxo autorizado:

```powershell
npx supabase functions deploy redmine-sync
```

## Smoke test

1. Publicar `redmine-sync`.
2. Executar uma sincronização controlada de integração ativa.
3. Confirmar resposta com correlation ID.
4. Confirmar `last_sync_at`, `last_sync_status` e `last_sync_items`.
5. Executar:

```sql
select provider, integration_id, status, check_type, latency_ms,
       error_code, error_message, checked_at, correlation_id
from public.integration_health_events
where provider = 'redmine'
order by checked_at desc
limit 20;
```

Resultado esperado: `healthy`, `degraded` com `PARTIAL_SYNC`, ou `unhealthy` com `SYNC_FAILED` e mensagem sanitizada.

## Próximo lote

Após deploy e smoke test, seguir para Oracle Database (Fase 5B), aplicando o mesmo padrão de health sem alterar jobs existentes.

## Validação local

- lint dos arquivos alterados: 0 erros; avisos históricos de tipagem permanecem;
- suíte completa: 20 arquivos e 138 testes aprovados;
- build de produção: aprovado;
- `git diff --check`: aprovado.
