# Backlog de Implementação — Módulo GitLab (Fase 4B → 4C)
> Documento técnico para o Lovable. Cada ação é independente e pode ser implementada em sequência.
> Estado de referência: branch `develop`, analisado em 12/07/2026.

---

## AÇÃO 1 — Integrar `HUGitActivitySection` no `HUEditDrawer`

**Arquivo:** `src/components/HUEditDrawer.tsx`
**Por quê:** O componente `HUGitActivitySection` foi criado mas nunca integrado à tela de edição da HU. Sem isso, o widget de atividade Git não aparece em nenhuma tela do sistema.

**O que fazer:**

1. Adicionar import no topo:
```tsx
import { HUGitActivitySection } from "@/components/gitlab/HUGitActivitySection";
```

2. Recuperar `organizationId` do contexto `useAuth`. A linha `const { currentTeamId } = useAuth();` já existe — adicionar na mesma desestruturação:
```tsx
const { currentTeamId, organizationId } = useAuth() as any;
```

3. No JSX, localizar o fechamento do `<div className="grid grid-cols-1 lg:grid-cols-[...]">` e inserir **imediatamente após**, ainda dentro do scroll container (`<div className="flex-1 overflow-y-auto">`):
```tsx
{huId && organizationId && (
  <div className="px-5 py-4 border-t border-slate-100">
    <HUGitActivitySection huId={huId} organizationId={organizationId} />
  </div>
)}
```

**Restrição:** Não alterar nenhuma outra parte do arquivo. O widget é somente leitura.

---

## AÇÃO 2 — Auto-registro do Webhook no GitLab ao salvar integração

**Arquivos:**
- `src/features/admin/pages/AdminGitlabIntegrationsPage.tsx`
- `src/features/admin/services/gitlabIntegrations.service.ts`
- Nova Edge Function: `supabase/functions/gitlab-webhook-register/index.ts`

**Por quê:** Hoje o campo "Webhook URL" é preenchido manualmente pelo usuário. O objetivo é: ao salvar uma integração com `access_token` e `repository_path` preenchidos, o Axionn chama a API do GitLab e registra o webhook automaticamente no repositório, sem que o dev precise abrir o GitLab para isso.

### 2.1 — Nova Edge Function `gitlab-webhook-register`

Criar `supabase/functions/gitlab-webhook-register/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const WEBHOOK_HANDLER_URL =
  'https://rgikyyazotqapaxijwui.supabase.co/functions/v1/git-webhook-handler';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { integrationId } = await req.json();
  if (!integrationId) {
    return new Response(JSON.stringify({ error: 'integrationId required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: integration, error: fetchError } = await supabase
    .from('git_integrations')
    .select('*')
    .eq('id', integrationId)
    .single();

  if (fetchError || !integration) {
    return new Response(JSON.stringify({ error: 'Integration not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { api_url, repository_path, access_token_encrypted, webhook_secret_encrypted, id } = integration;
  const apiBase = api_url ?? 'https://gitlab.com/api/v4';
  const encodedPath = encodeURIComponent(repository_path);

  // Verificar se já existe webhook do Axionn registrado neste repositório
  const listRes = await fetch(`${apiBase}/projects/${encodedPath}/hooks`, {
    headers: { 'PRIVATE-TOKEN': access_token_encrypted },
  });
  const existingHooks: any[] = listRes.ok ? await listRes.json() : [];
  const alreadyRegistered = existingHooks.some((h: any) =>
    h.url?.includes('git-webhook-handler')
  );

  if (alreadyRegistered) {
    return new Response(JSON.stringify({ ok: true, already_registered: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Registrar novo webhook no GitLab
  const webhookPayload = {
    url: WEBHOOK_HANDLER_URL,
    token: webhook_secret_encrypted ?? '',
    push_events: true,
    merge_requests_events: true,
    pipeline_events: true,
    job_events: true,
    deployment_events: true,
    note_events: true,
    tag_push_events: true,
    custom_headers: [
      { key: 'x-integration-id', value: id },
      { key: 'x-git-provider', value: 'gitlab' },
    ],
  };

  const createRes = await fetch(`${apiBase}/projects/${encodedPath}/hooks`, {
    method: 'POST',
    headers: {
      'PRIVATE-TOKEN': access_token_encrypted,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(webhookPayload),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text();
    await supabase.from('git_integrations').update({
      sync_status: 'error',
      sync_error: `GitLab API ${createRes.status}: ${errBody.slice(0, 200)}`,
    }).eq('id', integrationId);

    return new Response(JSON.stringify({
      error: 'Failed to register webhook on GitLab',
      gitlab_status: createRes.status,
      detail: errBody.slice(0, 200),
    }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const hook = await createRes.json();

  await supabase.from('git_integrations').update({
    webhook_id: String(hook.id),
    webhook_url: WEBHOOK_HANDLER_URL,
    sync_status: 'completed',
    sync_error: null,
    last_sync_at: new Date().toISOString(),
  }).eq('id', integrationId);

  return new Response(JSON.stringify({
    ok: true,
    webhook_id: hook.id,
    webhook_url: WEBHOOK_HANDLER_URL,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
```

**Deploy:** `npx supabase functions deploy gitlab-webhook-register`

### 2.2 — Chamar a Edge Function após salvar integração no frontend

Em `AdminGitlabIntegrationsPage.tsx`, na função `submit()`, após o bloco `if (form.id)... else...`, adicionar a chamada de auto-registro **somente em criações novas** com token preenchido:

```typescript
if (!form.id && form.accessToken) {
  const created = await listGitlabIntegrations(currentOrganizationId);
  const newest = created.find(i => i.name === form.name);
  if (newest?.id) {
    try {
      await supabase.functions.invoke('gitlab-webhook-register', {
        body: { integrationId: newest.id },
      });
      toast.success('Webhook registrado automaticamente no GitLab ✓');
    } catch {
      toast.warning('Integração salva. Registre o webhook manualmente no GitLab se necessário.');
    }
  }
}
```

### 2.3 — Exibir status do webhook na listagem de integrações

Na listagem de itens, ao lado do badge Ativa/Inativa, adicionar indicador visual:

```tsx
{item.syncStatus === 'completed' && item.webhookId ? (
  <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1">
    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
    Webhook ativo
  </Badge>
) : item.syncStatus === 'error' ? (
  <Badge className="bg-rose-100 text-rose-700 border-0" title={item.syncError ?? ''}>
    Webhook com erro
  </Badge>
) : (
  <Badge className="bg-slate-100 text-slate-500 border-0">
    Webhook pendente
  </Badge>
)}
```

Garantir que `GitlabIntegration` em `gitlabIntegrations.service.ts` inclua os campos: `syncStatus`, `webhookId`, `syncError`.

---

## AÇÃO 3 — Botão "Re-registrar Webhook" na edição de integração

**Arquivo:** `AdminGitlabIntegrationsPage.tsx`

**Por quê:** Quando um webhook é removido manualmente no GitLab, ou quando o token é atualizado, o usuário precisa de um botão para re-registrar sem precisar excluir e recriar a integração.

No `DialogFooter` do modal de edição, adicionar botão secundário (visível apenas quando `form.id` existe):

```tsx
{form.id && form.accessToken && (
  <Button
    type="button"
    variant="outline"
    className="gap-2 mr-auto"
    disabled={saving || registering}
    onClick={async () => {
      setRegistering(true);
      try {
        await supabase.functions.invoke('gitlab-webhook-register', {
          body: { integrationId: form.id },
        });
        toast.success('Webhook re-registrado no GitLab com sucesso ✓');
        await load();
      } catch {
        toast.error('Falha ao re-registrar webhook. Verifique o token de acesso.');
      } finally {
        setRegistering(false);
      }
    }}
  >
    {registering
      ? <Loader2 className="h-4 w-4 animate-spin" />
      : <RefreshCw className="h-4 w-4" />
    }
    Re-registrar webhook
  </Button>
)}
```

Adicionar estado `const [registering, setRegistering] = useState(false);` no componente.
Adicionar import `RefreshCw` do `lucide-react`.

---

## AÇÃO 4 — Campo Webhook URL somente leitura no formulário

**Arquivo:** `AdminGitlabIntegrationsPage.tsx`

**Por quê:** O campo "Webhook URL" editável hoje confunde o usuário. Após a Ação 2, a URL é sempre a da Edge Function. O campo deve virar somente leitura, preenchido automaticamente, com botão de copiar.

Substituir o campo `gl-webhook` atual por:

```tsx
<div className="space-y-2 sm:col-span-2">
  <Label>Webhook URL (gerado automaticamente)</Label>
  <div className="flex gap-2">
    <Input
      readOnly
      value="https://rgikyyazotqapaxijwui.supabase.co/functions/v1/git-webhook-handler"
      className="text-xs font-mono bg-slate-50 text-slate-600 cursor-default"
    />
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => {
        navigator.clipboard.writeText(
          'https://rgikyyazotqapaxijwui.supabase.co/functions/v1/git-webhook-handler'
        );
        toast.success('URL copiada');
      }}
    >
      <Copy className="h-4 w-4" />
    </Button>
  </div>
  <p className="text-xs text-slate-500">
    Esta URL é registrada automaticamente no GitLab ao salvar com token de acesso preenchido.
    Headers de identificação (x-integration-id, x-git-provider) são injetados automaticamente.
  </p>
</div>
```

Adicionar import `Copy` do `lucide-react`.
Remover `webhookUrl` do `FormState` e do objeto `EMPTY` — não é mais editável pelo usuário.

---

## AÇÃO 5 — Atualizar `docs/gitlab-feature-summary.md`

Substituir o conteúdo do arquivo para refletir o estado real após todas as implementações:

- Marcar como concluído: bug HTTP 500, idempotência, headers, deploy da Edge Function
- Marcar como concluído: `GitlabEventsPanel`, `HUGitActivitySection`, `useHUGitActivity`
- Adicionar seção "Fase 4C — Auto-registro de Webhook" descrevendo as Ações 2, 3 e 4
- Atualizar "Próximos passos" para: testes E2E com repositório real, métricas DORA (Fase 5)

---

## Ordem de execução obrigatória

| # | Ação | Dependência |
|---|------|-------------|
| 1 | Integrar `HUGitActivitySection` no `HUEditDrawer` | Nenhuma |
| 2.1 | Criar Edge Function `gitlab-webhook-register` | Nenhuma |
| 2.2 | Chamar auto-registro no `submit()` | 2.1 deve estar deployada |
| 2.3 | Badge de status na listagem | 2.2 |
| 3 | Botão "Re-registrar webhook" | 2.1 |
| 4 | Campo Webhook URL somente leitura | 2.2 |
| 5 | Atualizar documentação | Todas acima |

---

## Restrições de arquitetura (não negociáveis)

- **A Edge Function `git-webhook-handler` NÃO é alterada** nesta fase
- **Fluxo é estritamente unidirecional**: GitLab → Axionn. A `gitlab-webhook-register` apenas configura infraestrutura, não sincroniza dados
- **Em caso de falha no auto-registro**, o fluxo de salvar a integração **não é bloqueado** — apenas um `toast.warning` é exibido. O usuário usa o botão "Re-registrar" depois
- **`custom_headers` no webhook GitLab** (`x-integration-id`, `x-git-provider`) são essenciais para que o handler identifique a integração sem depender de query string
- Todos os novos componentes seguem o padrão visual existente: shadcn/ui + Tailwind + React Query
