# Consolidação — Fase 5B: Oracle Database e verdade operacional

**Data:** 11/07/2026  
**Estado:** código preparado; deploy e smoke test pendentes  
**SQL:** nenhum novo arquivo

## Diagnóstico

A Edge Function `oracle-sync` possui orquestração, transform e load, mas a extração Oracle ainda é um placeholder: `simulateOracleExtract()` retorna zero linhas. O fluxo anterior registrava a execução como sucesso, criando falso positivo operacional.

## Melhorias realizadas

### Placeholder não é mais reportado como saudável

Enquanto o driver/conector Oracle real não estiver implementado, a execução:

- mantém resposta compatível;
- registra job como `partial`;
- registra health `degraded`;
- usa `ORACLE_CONNECTOR_NOT_CONFIGURED`;
- informa `simulated = true` nos metadados operacionais.

Assim, dashboards e suporte não confundem uma simulação vazia com sincronização Oracle concluída.

### Health normalizado

O fluxo grava:

- `provider = 'oracle'`;
- `check_type = 'sync'`;
- status `healthy`, `degraded` ou `unhealthy`;
- latência e correlation ID;
- job, trigger e contadores;
- erros sanitizados e limitados.

### Integração/job inativos

Integração ou job inativo retorna HTTP `409` e health `degraded`, sem executar o pipeline.

### Tratamento de erro

O request body era consumido no fluxo principal e tentava ser lido novamente no `catch`, fazendo o handler perder `job_id`. Agora `jobId` e `triggerType` são preservados antes da execução.

Em falha:

- o job recebe `last_run_status = 'failed'`;
- duração e erro sanitizado são persistidos;
- o evento Oracle é registrado com o trigger original;
- o cliente recebe somente erro genérico e correlation ID.

### Contrato de regressão

O contrato compartilhado garante que o placeholder Oracle não volte a ser classificado como sucesso e que o body não seja relido no tratamento de erro.

## Preservação

- Nenhuma migration ou tabela foi alterada.
- Jobs, queries, mappings e watermarks foram preservados.
- Nenhuma senha Oracle é lida ou copiada para health.
- O pipeline de transformação e carga permanece disponível para o conector real futuro.

## Publicação manual

Edge Function alterada:

```text
oracle-sync
```

Publicar pelo fluxo autorizado:

```powershell
npx supabase functions deploy oracle-sync
```

## Smoke test

1. Publicar `oracle-sync`.
2. Acionar um job controlado ativo.
3. Enquanto o conector real não existir, esperar job `partial`.
4. Executar:

```sql
select provider, integration_id, status, check_type, latency_ms,
       error_code, error_message, details, checked_at, correlation_id
from public.integration_health_events
where provider = 'oracle'
order by checked_at desc
limit 20;
```

Resultado esperado no runtime atual:

```text
status = degraded
error_code = ORACLE_CONNECTOR_NOT_CONFIGURED
details.simulated = true
```

## Gate para considerar Oracle operacional

É necessário implementar e validar um executor real por API/proxy ou runtime com driver Oracle, usando secrets no Vault, TLS/wallet, timeout, pool, cancelamento, retry e limites de volume. Somente então `simulated` poderá ser removido e health `healthy` será legítimo.

## Próximo lote

Fase 5C — Oracle APEX, com validação de webhook, health e preservação dos eventos de uso existentes.

## Validação local

- lint dos arquivos alterados: 0 erros; avisos históricos de tipagem permanecem;
- suíte completa: 20 arquivos e 139 testes aprovados;
- build de produção: aprovado;
- `git diff --check`: aprovado.
