import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const reconcileSecret = Deno.env.get("GITLAB_RECONCILE_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !reconcileSecret) return json({ error: "Server configuration error" }, 500);

  const authorization = req.headers.get("authorization");
  if (authorization !== `Bearer ${reconcileSecret}`) return json({ error: "Unauthorized scheduled invocation" }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: integrations, error } = await supabase
    .from("git_integrations")
    .select("id")
    .eq("provider", "gitlab")
    .eq("is_active", true)
    .eq("sync_issues_as_backlog", true)
    .not("team_id", "is", null)
    .not("repository_path", "is", null)
    .not("access_token_encrypted", "is", null);

  if (error) return json({ error: "Failed to list active GitLab integrations", detail: error.message }, 500);

  const results: Array<Record<string, unknown>> = [];
  const ids = (integrations ?? []).map((integration) => integration.id);

  // Small batches avoid saturating GitLab or the Edge runtime when many
  // organizations are reconciled at the same time.
  for (let index = 0; index < ids.length; index += 3) {
    const batch = ids.slice(index, index + 3);
    const batchResults = await Promise.all(batch.map(async (integrationId) => {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/gitlab-issues-sync`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ integrationId }),
        });
        const body = await response.json().catch(() => ({}));
        return { integrationId, ok: response.ok, status: response.status, ...body };
      } catch (syncError) {
        return {
          integrationId,
          ok: false,
          error: syncError instanceof Error ? syncError.message : "Unexpected reconciliation error",
        };
      }
    }));
    results.push(...batchResults);
  }

  const succeeded = results.filter((result) => result.ok).length;
  return json({
    ok: succeeded === results.length,
    integrations: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  }, succeeded === results.length ? 200 : 207);
});

