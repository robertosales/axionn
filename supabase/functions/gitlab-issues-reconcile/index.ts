import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseUserStoryContent } from "../_shared/user-story-content.ts";

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server configuration error" }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const startedAt = new Date().toISOString();
  const results: Array<Record<string, unknown>> = [];
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  try {
    const { data: integrations, error: intError } = await supabase
      .from("git_integrations")
      .select("*")
      .eq("provider", "gitlab")
      .eq("is_active", true)
      .eq("sync_issues_as_backlog", true);

    if (intError) {
      console.error("[gitlab-issues-reconcile] Failed to list integrations", intError);
      return json({ error: "Failed to list integrations", detail: intError.message }, 500);
    }

    for (const integration of integrations ?? []) {
      if (!integration.team_id || !integration.repository_path || !integration.access_token_encrypted) {
        results.push({ integration_id: integration.id, skipped_reason: "missing_config" });
        continue;
      }

      const correlationId = crypto.randomUUID();
      let created = 0;
      let updated = 0;
      let skipped = 0;
      let failed = 0;

      try {
        const apiBase = (integration.api_url ?? "https://gitlab.com/api/v4").replace(/\/$/, "");
        const projectPath = encodeURIComponent(integration.repository_path);

        // 1) Open issues → upsert
        const openIssues = await fetchAllIssues(apiBase, projectPath, integration.access_token_encrypted, "opened");
        for (const issue of openIssues) {
          try {
            const labels = Array.isArray(issue.labels) ? issue.labels : [];
            const result = await upsertHuFromIssue(supabase, integration, issue, labels, correlationId, false);
            if (result === "created") created++;
            else if (result === "updated") updated++;
            else skipped++;
          } catch (e) {
            failed++;
            console.error("[reconcile] open issue error", integration.id, issue.id, e);
          }
        }

        // 2) Closed issues → update-only (never create). Prevents importing old closed issues.
        const closedIssues = await fetchAllIssues(apiBase, projectPath, integration.access_token_encrypted, "closed");
        for (const issue of closedIssues) {
          try {
            const labels = Array.isArray(issue.labels) ? issue.labels : [];
            const result = await upsertHuFromIssue(supabase, integration, issue, labels, correlationId, true);
            if (result === "updated") updated++;
            else skipped++;
          } catch (e) {
            failed++;
            console.error("[reconcile] closed issue error", integration.id, issue.id, e);
          }
        }

        results.push({
          integration_id: integration.id,
          repository_path: integration.repository_path,
          open_count: openIssues.length,
          closed_count: closedIssues.length,
          created,
          updated,
          skipped,
          failed,
        });
      } catch (e) {
        failed++;
        console.error("[reconcile] integration failed", integration.id, e);
        results.push({
          integration_id: integration.id,
          error: e instanceof Error ? e.message : String(e),
          failed,
        });
      }

      totalCreated += created;
      totalUpdated += updated;
      totalSkipped += skipped;
      totalFailed += failed;
    }

    return json({
      ok: true,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      integrations: results.length,
      created: totalCreated,
      updated: totalUpdated,
      skipped: totalSkipped,
      failed: totalFailed,
      results,
    });
  } catch (error) {
    console.error("[gitlab-issues-reconcile]", error);
    return json({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
});

async function fetchAllIssues(
  apiBase: string,
  projectPath: string,
  token: string,
  state: "opened" | "closed",
): Promise<Array<Record<string, unknown>>> {
  const all: Array<Record<string, unknown>> = [];
  const perPage = 100;
  const maxPages = state === "closed" ? 5 : 20; // cap closed to avoid huge historical fetches
  for (let page = 1; page <= maxPages; page++) {
    const url = `${apiBase}/projects/${projectPath}/issues?state=${state}&per_page=${perPage}&page=${page}&order_by=updated_at&sort=desc`;
    const res = await fetch(url, { headers: { "PRIVATE-TOKEN": token } });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`GitLab list ${state} ${res.status}: ${detail}`);
    }
    const batch = (await res.json()) as Array<Record<string, unknown>>;
    all.push(...batch);
    if (batch.length < perPage) break;
  }
  return all;
}

async function upsertHuFromIssue(
  supabase: any,
  integration: any,
  issue: Record<string, unknown>,
  payloadLabels: Array<string | Record<string, unknown>>,
  correlationId: string,
  updateOnly: boolean,
): Promise<"created" | "updated" | "skipped"> {
  const issueId = issue.id;
  const iid = issue.iid;
  if (!issueId) return "skipped";

  const title = (issue.title as string) || "Sem título";
  const parsedContent = parseUserStoryContent(issue.description);
  const state = String(issue.state || "opened").toLowerCase();
  const status = state === "closed" ? "concluido" : "aguardando_desenvolvimento";

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
      .update({
        title,
        description: parsedContent.content,
        acceptance_criteria: parsedContent.acceptanceCriteria,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.hu_id);
    return "updated";
  }

  if (updateOnly) return "skipped";

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
      description: parsedContent.content,
      acceptance_criteria: parsedContent.acceptanceCriteria,
      story_points: 0,
      priority: "media",
      status,
    })
    .select("id")
    .single();

  if (huError || !hu) {
    console.error("[reconcile] Failed to create HU", String(issueId), huError);
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