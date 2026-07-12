# GitLab Webhook Handler — Smoke Test

Roteiro para validar o endpoint `git-webhook-handler` após deploy.

```bash
FUNCTION_URL="https://SEU_PROJECT_REF.supabase.co/functions/v1/git-webhook-handler"
ACTIVE_INTEGRATION_ID="UUID_DA_INTEGRACAO_ATIVA"
INACTIVE_INTEGRATION_ID="UUID_DA_INTEGRACAO_INATIVA"
```

## Teste 1 — Integração inexistente (esperado: 404)
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$FUNCTION_URL" \
  -H "x-integration-id: 00000000-0000-0000-0000-000000000000" \
  -H "x-git-provider: gitlab" \
  -H "x-gitlab-event: Push Hook" \
  -H "Content-Type: application/json" \
  -d '{"object_kind":"push"}'
```

## Teste 2 — Integração inativa (esperado: 409)
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$FUNCTION_URL" \
  -H "x-integration-id: $INACTIVE_INTEGRATION_ID" \
  -H "x-git-provider: gitlab" \
  -H "x-gitlab-event: Push Hook" \
  -H "Content-Type: application/json" \
  -d '{"object_kind":"push"}'
```

## Teste 3 — Push válido (esperado: 200 + `event_id`)
```bash
curl -s -X POST "$FUNCTION_URL" \
  -H "x-integration-id: $ACTIVE_INTEGRATION_ID" \
  -H "x-git-provider: gitlab" \
  -H "x-gitlab-event: Push Hook" \
  -H "Content-Type: application/json" \
  -d '{
    "object_kind": "push",
    "ref": "refs/heads/feature/AXIONN-42-login",
    "after": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "project": { "id": 1001, "web_url": "https://gitlab.com/axionn/app" },
    "commits": [{
      "id": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      "message": "feat: AXIONN-42 implementar tela de login",
      "timestamp": "2026-07-12T20:00:00Z",
      "author": { "name": "Roberto Sales", "email": "roberto@axionn.com" }
    }]
  }'
```

## Teste 4 — Idempotência (repetir Teste 3 → `duplicate:true`)

Repita o comando do Teste 3 sem alterar payload. A resposta deve conter `"duplicate": true` e status 200.

## Teste 5 — Merge Request (esperado: 200)
```bash
curl -s -X POST "$FUNCTION_URL" \
  -H "x-integration-id: $ACTIVE_INTEGRATION_ID" \
  -H "x-git-provider: gitlab" \
  -H "x-gitlab-event: Merge Request Hook" \
  -H "Content-Type: application/json" \
  -d '{
    "object_kind": "merge_request",
    "object_attributes": {
      "id": 9999, "iid": 42,
      "title": "feat: AXIONN-42 login",
      "description": "Implementa tela de login. Closes AXIONN-42",
      "state": "opened", "action": "open",
      "source_branch": "feature/AXIONN-42-login",
      "target_branch": "develop",
      "web_url": "https://gitlab.com/axionn/app/-/merge_requests/42",
      "created_at": "2026-07-12T20:05:00Z",
      "updated_at": "2026-07-12T20:05:00Z"
    },
    "user": { "id": 1, "username": "roberto", "email": "roberto@axionn.com" }
  }'
```

## Verificação no banco
```sql
SELECT id, event_type, event_action, provider_event_id, processed, received_at
FROM git_events
ORDER BY received_at DESC
LIMIT 10;
```