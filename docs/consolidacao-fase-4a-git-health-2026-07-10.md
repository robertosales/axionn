# Consolidação — Fase 4A: Git/GitLab e health operacional

**Data:** 10/07/2026  
**Estado:** código preparado; deploy e smoke test pendentes  
**SQL:** nenhum novo arquivo

## Objetivo

Conectar o `git-webhook-handler` à fundação comum de health instalada na Fase 3, preservando o processamento existente de commits, merge requests, pipelines, jobs, deployments e notas.

## Melhorias realizadas

### Integrações organizacionais

O handler fazia `inner join` obrigatório com `projects`, embora `git_integrations.project_id` aceite `null`. Agora a organização é obtida diretamente de `git_integrations.organization_id`, permitindo integrações no nível da organização sem exigir projeto.

### Integrações inativas

Uma integração com `is_active = false` agora é recusada com HTTP `409` e registra health `degraded`. Nenhum evento Git é persistido ou processado nesse caso.

### Health checks automáticos

O handler registra em `integration_health_events`:

- `healthy` após webhook persistido e processado;
- `unhealthy` para assinatura inválida;
- `unhealthy` para falha ao persistir evento;
- `unhealthy` para exceção inesperada;
- latência, correlation ID, tipo do evento e erro sanitizado.

A telemetria é best-effort: falha ao registrar health é enviada ao log, mas nunca interrompe um webhook que poderia ser processado normalmente.

### Headers

A lista CORS passou a declarar os headers já consumidos pelo handler, incluindo `x-integration-id`, `x-git-provider` e `x-hub-signature-256`.

## Preservação

- Nenhuma migration foi criada ou alterada neste lote.
- Nenhuma tabela existente foi alterada.
- O payload bruto e o fluxo de processamento continuam iguais.
- Nenhum secret é incluído nos eventos de health.
- O mecanismo de deploy/JWT do endpoint não foi alterado.

## Publicação manual

Edge Function alterada:

```text
git-webhook-handler
```

Publicar pelo fluxo autorizado do ambiente. Com Supabase CLI configurada para o projeto correto:

```powershell
npx supabase functions deploy git-webhook-handler
```

Não execute esse comando contra um projeto diferente do Lovable Cloud vinculado à aplicação.

## Smoke test

Depois do deploy:

1. enviar um webhook controlado de uma integração Git ativa;
2. confirmar resposta HTTP `200` e `correlation_id`;
3. confirmar o novo registro em `integration_health_events` com `provider = 'git'`;
4. confirmar que o evento original continua em `git_events`;
5. confirmar que integração inativa retorna `409`;
6. validar que nenhuma credencial aparece em `details` ou `error_message`.

Consulta de validação:

```sql
select provider, integration_id, status, check_type, latency_ms,
       error_code, checked_at, correlation_id
from public.integration_health_events
where provider = 'git'
order by checked_at desc
limit 20;
```

## Validação local

- ESLint da Edge Function: 0 erros; 28 avisos históricos de tipagem;
- Vitest: 129 testes aprovados;
- build de produção: aprovado.

## Risco conhecido para o próximo lote

O schema publicado armazena `webhook_secret_encrypted`, enquanto o handler legado consulta `webhook_secret`. A estratégia de criptografia/Vault precisa ser confirmada antes de alterar a validação de assinatura ou tornar o endpoint publicamente acessível sem JWT. Este lote não modifica esse comportamento para não invalidar secrets existentes.
