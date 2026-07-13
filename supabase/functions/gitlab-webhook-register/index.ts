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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server configuration error" }, 500);
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { integrationId } = await req.json();
    if (!integrationId) return json({ error: "integrationId required" }, 400);

    const { data: integration, error: fetchError } = await supabase.from("git_integrations")
      .select("api_url, repository_path, access_token_encrypted, webhook_secret_encrypted, id")
      .eq("id", integrationId).eq("provider", "gitlab").single();
    if (fetchError || !integration) return json({ error: "Integration not found" }, 404);
    if (!integration.repository_path || !integration.access_token_encrypted) {
      return json({ error: "Repository path and access token are required" }, 422);
    }

    const apiBase = (integration.api_url ?? "https://gitlab.com/api/v4").replace(/\/$/, "");
    const hooksUrl = `${apiBase}/projects/${encodeURIComponent(integration.repository_path)}/hooks`;
    const tokenHeaders = { "PRIVATE-TOKEN": integration.access_token_encrypted };
    const listRes = await fetch(hooksUrl, { headers: tokenHeaders });
    if (!listRes.ok) return await fail(listRes, "Failed to list GitLab webhooks", integrationId, supabase);

    const hooks = await listRes.json() as Array<{ id?: number; url?: string }>;
    const existing = hooks.find((hook) => hook.url === WEBHOOK_HANDLER_URL);
    if (existing) {
      await supabase.from("git_integrations").update({
        webhook_id: existing.id ? String(existing.id) : null,
        webhook_url: WEBHOOK_HANDLER_URL, sync_status: "completed", sync_error: null,
        last_sync_at: new Date().toISOString(),
      }).eq("id", integrationId);
      return json({ ok: true, already_registered: true, webhook_id: existing.id });
    }

    const createRes = await fetch(hooksUrl, {
      method: "POST",
      headers: { ...tokenHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: WEBHOOK_HANDLER_URL,
        token: integration.webhook_secret_encrypted ?? "",
        push_events: true, merge_requests_events: true, pipeline_events: true,
        job_events: true, deployment_events: true, note_events: true, tag_push_events: true,
        custom_headers: [
          { key: "x-integration-id", value: integration.id },
          { key: "x-git-provider", value: "gitlab" },
        ],
      }),
    });
    if (!createRes.ok) return await fail(createRes, "Failed to register webhook on GitLab", integrationId, supabase);

    const hook = await createRes.json() as { id: number };
    await supabase.from("git_integrations").update({
      webhook_id: String(hook.id), webhook_url: WEBHOOK_HANDLER_URL,
      sync_status: "completed", sync_error: null, last_sync_at: new Date().toISOString(),
    }).eq("id", integrationId);
    return json({ ok: true, webhook_id: hook.id, webhook_url: WEBHOOK_HANDLER_URL });
  } catch (error) {
    console.error("[gitlab-webhook-register]", error);
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
