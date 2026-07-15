import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const WEBHOOK_HANDLER_URL = "https://rgikyyazotqapaxijwui.supabase.co/functions/v1/git-webhook-handler";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let supabase: any = null;
  let integrationId: string | null = null;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server configuration error" }, 500);
    supabase = createClient(supabaseUrl, serviceRoleKey);
    ({ integrationId } = await req.json());
    if (!integrationId) return json({ error: "integrationId required" }, 400);

    const { data: integration, error: fetchError } = await supabase.from("git_integrations")
      .select("api_url, repository_path, access_token_encrypted, webhook_secret_encrypted, id")
      .eq("id", integrationId).eq("provider", "gitlab").single();
    if (fetchError || !integration) return json({ error: "Integration not found" }, 404);
    if (!integration.repository_path || !integration.access_token_encrypted) {
      return json({ error: "Repository path and access token are required" }, 422);
    }

    const webhookSecret = integration.webhook_secret_encrypted ?? crypto.randomUUID();
    const { error: syncingError } = await supabase.from("git_integrations").update({
      webhook_secret_encrypted: webhookSecret,
      sync_status: "syncing",
      sync_error: null,
    }).eq("id", integrationId);
    if (syncingError) return json({ error: "Failed to update integration status" }, 500);

    const apiBase = (integration.api_url ?? "https://gitlab.com/api/v4").replace(/\/$/, "");
    const hooksUrl = `${apiBase}/projects/${encodeURIComponent(integration.repository_path)}/hooks`;
    const tokenHeaders = { "PRIVATE-TOKEN": integration.access_token_encrypted };

    const listRes = await fetch(hooksUrl, { headers: tokenHeaders });
    if (!listRes.ok) return await fail(listRes, "Falha ao listar webhooks do GitLab", integrationId, supabase);

    const hooks = await listRes.json() as Array<{ id?: number; url?: string }>;
    const normalizedTarget = WEBHOOK_HANDLER_URL.replace(/\/+$/, "").toLowerCase();
    const findExisting = (list: Array<{ id?: number; url?: string }>) =>
      list.find((hook) => {
        const u = hook.url?.replace(/\/+$/, "").toLowerCase();
        return u && u === normalizedTarget && hook.id != null;
      });

    const webhookBody = {
      url: WEBHOOK_HANDLER_URL,
      token: webhookSecret,
      push_events: true,
      merge_requests_events: true,
      pipeline_events: true,
      job_events: true,
      deployment_events: true,
      note_events: true,
      tag_push_events: true,
      issues_events: true,
      custom_headers: [
        { key: "x-integration-id", value: integration.id },
        { key: "x-git-provider", value: "gitlab" },
      ],
    };

    const persistOk = (hookId: number) =>
      supabase.from("git_integrations").update({
        webhook_id: String(hookId),
        webhook_url: WEBHOOK_HANDLER_URL,
        sync_status: "completed",
        sync_error: null,
        last_sync_at: new Date().toISOString(),
      }).eq("id", integrationId);

    const upsertExisting = async (hookId: number): Promise<Response | null> => {
      const updateRes = await fetch(`${hooksUrl}/${hookId}`, {
        method: "PUT",
        headers: { ...tokenHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(webhookBody),
      });
      if (!updateRes.ok) return await fail(updateRes, "Falha ao atualizar webhook no GitLab", integrationId, supabase);
      const { error: updateError } = await persistOk(hookId);
      if (updateError) return json({ error: "Webhook atualizado, mas falha ao persistir status" }, 500);
      return json({ ok: true, already_registered: true, webhook_id: hookId });
    };

    const existing = findExisting(hooks);
    if (existing?.id != null) {
      const result = await upsertExisting(existing.id);
      if (result) return result;
    }

    const createRes = await fetch(hooksUrl, {
      method: "POST",
      headers: { ...tokenHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(webhookBody),
    });

    if (createRes.ok) {
      const hook = await createRes.json() as { id: number };
      const { error: updateError } = await persistOk(hook.id);
      if (updateError) return json({ error: "Webhook criado, mas falha ao persistir status" }, 500);
      return json({ ok: true, webhook_id: hook.id, webhook_url: WEBHOOK_HANDLER_URL });
    }

    // GitLab rejeita webhook duplicado (422). Re-listar e atualizar o existente como fallback.
    const createDetail = (await createRes.text()).slice(0, 400);
    if (createRes.status === 422 && /already been taken|duplicat/i.test(createDetail)) {
      const relistRes = await fetch(hooksUrl, { headers: tokenHeaders });
      if (relistRes.ok) {
        const dupe = findExisting(await relistRes.json() as Array<{ id?: number; url?: string }>);
        if (dupe?.id != null) {
          const result = await upsertExisting(dupe.id);
          if (result) return result;
        }
      }
    }

    await supabase.from("git_integrations").update({
      sync_status: "error",
      sync_error: `GitLab API ${createRes.status}: ${createDetail}`,
    }).eq("id", integrationId);
    return json({ error: "Falha ao registrar webhook no GitLab", gitlab_status: createRes.status, detail: createDetail }, 502);
  } catch (error) {
    console.error("[gitlab-webhook-register]", error);
    if (supabase && integrationId) {
      await supabase.from("git_integrations").update({
        sync_status: "error",
        sync_error: error instanceof Error ? error.message : "Unexpected webhook registration error",
      }).eq("id", integrationId);
    }
    return json({ error: "Internal server error" }, 500);
  }
});

async function fail(response: Response, message: string, integrationId: string, supabase: any) {
  const detail = (await response.text()).slice(0, 200);
  await supabase.from("git_integrations").update({
    sync_status: "error", sync_error: `GitLab API ${response.status}: ${detail}`,
  }).eq("id", integrationId);
  return json({ error: message, gitlab_status: response.status, detail }, 502);
}
