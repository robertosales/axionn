import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeEventTypeLike(raw: string | null): string {
  if (!raw) return "unknown";
  return raw.toLowerCase().replace(/ hook$/, "").replace(/\s+/g, "_").trim();
}

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

    const { data: integration, error: fetchError } = await supabase
      .from("git_integrations")
      .select("*")
      .eq("id", integrationId)
      .eq("provider", "gitlab")
      .single();
    if (fetchError || !integration) return json({ error: "Integration not found" }, 404);
    if (!integration.sync_issues_as_backlog) {
      return json({ error: "sync_issues_as_backlog is disabled for this integration" }, 422);
    }
    if (!integration.team_id) {
      return json({ error: "team_id is required to sync issues as backlog" }, 422);
    }
    if (!integration.repository_path || !integration.access_token_encrypted) {
      return json({ error: "Repository path and access token are required" }, 422);
    }

    const apiBase = (integration.api_url ?? "https://gitlab.com/api/v4").replace(/\/$/, "");
    const issuesUrl = `${apiBase}/projects/${encodeURIComponent(integration.repository_path)}/issues?state=opened&per_page=100`;
    const listRes = await fetch(issuesUrl, { headers: { "PRIVATE-TOKEN": integration.access_token_encrypted } });
    if (!listRes.ok) {
      const detail = (await listRes.text()).slice(0, 300);
      return json({ error: "Failed to list GitLab issues", gitlab_status: listRes.status, detail }, 502);
    }
    const issues = (await listRes.json()) as Array<Record<string, unknown>>;
    const correlationId = crypto.randomUUID();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const issue of issues) {
      const result = await upsertHuFromIssue(supabase, integration, issue, issues, correlationId);
      if (result === "created") created++;
      else if (result === "updated") updated++;
      else skipped++;
    }

    return json({ ok: true, total: issues.length, created, updated, skipped });
  } catch (error) {
    console.error("[gitlab-issues-sync]", error);
    return json({ error: "Internal server error" }, 500);
  }
});

async function upsertHuFromIssue(
  supabase: any,
  integration: any,
  issue: Record<string, unknown>,
  payloadLabels: Array<Record<string, unknown>>,
  correlationId: string,
): Promise<"created" | "updated" | "skipped"> {
  const issueId = issue.id;
  const iid = issue.iid;
  if (!issueId) return "skipped";

  const title = (issue.title as string) || "Sem título";
  const description = (issue.description as string) || "";
  const state = String(issue.state || "opened").toLowerCase();
  const status = state === "closed" ? "concluido" : "aguardando_desenvolvimento";

  // Resolve team via label map (if any).
  let teamId: string | null = integration.team_id ?? null;
  const labelMap: Record<string, string> = integration.issue_labels_team_map ?? {};
  for (const l of payloadLabels) {
    const labelTitle = typeof l === "string" ? l : (l.title as string);
    if (labelTitle && labelMap[labelTitle]) {
      teamId = labelMap[labelTitle];
      break;
    }
  }
  if (!teamId) return "skipped";

  const { data: existing } = await supabase
    .from("hu_git_links")
    .select("hu_id")
    .eq("git_entity_type", "issue")
    .eq("git_entity_id", String(issueId))
    .maybeSingle();

  if (existing?.hu_id) {
    await supabase
      .from("user_stories")
      .update({ title, description, status, updated_at: new Date().toISOString() })
      .eq("id", existing.hu_id);
    return "updated";
  }

  let code = `GL-${iid}`;
  const { data: codeDup } = await supabase
    .from("user_stories")
    .select("id")
    .eq("team_id", teamId)
    .eq("code", code)
    .maybeSingle();
  if (codeDup) code = `GL-${integration.repository_path}-${iid}`;

  const { data: hu, error: huError } = await supabase
    .from("user_stories")
    .insert({
      team_id: teamId,
      sprint_id: null,
      code,
      title,
      description,
      story_points: 0,
      priority: "media",
      status,
    })
    .select("id")
    .single();

  if (huError || !hu) {
    console.error("[gitlab-issues-sync] Failed to create HU", String(issueId), huError);
    return "skipped";
  }

  await supabase.from("hu_git_links").insert({
    organization_id: integration.organization_id,
    project_id: integration.project_id ?? null,
    hu_id: hu.id,
    git_entity_type: "issue",
    git_entity_id: String(issueId),
    git_entity_data: { iid, title, web_url: issue.url || issue.web_url || null },
    integration_id: integration.id,
    linked_at: new Date().toISOString(),
    correlation_id: correlationId,
  });
  return "created";
}
