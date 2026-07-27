import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const jobSecret = Deno.env.get("COMMERCIAL_USAGE_JOB_SECRET") ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (request) => {
  if (!jobSecret || request.headers.get("x-commercial-usage-secret") !== jobSecret) return json({ error: "unauthorized" }, 401);
  const admin = createClient(url, serviceKey); const started = Date.now();
  try {
    const { data: organizations, error } = await admin.from("organizations").select("id").limit(5000);
    if (error) throw error;
    const now = new Date(); const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const results: Array<{ organizationId: string; ok: boolean; error?: string }> = [];
    for (const organization of organizations ?? []) {
      try {
        const [{ count: users }, { count: projects }, { count: contracts }, licenses] = await Promise.all([
          admin.from("organization_members").select("id", { count: "exact", head: true }).eq("org_id", organization.id).eq("is_active", true),
          admin.from("projects").select("id", { count: "exact", head: true }).eq("org_id", organization.id).neq("status", "archived"),
          admin.from("contracts").select("id", { count: "exact", head: true }).eq("org_id", organization.id),
          admin.from("licenses").select("pf_used_month,ai_calls_used,companies!inner(org_id)").eq("companies.org_id", organization.id),
        ]);
        const dimensions = [
          ["users.max", users ?? 0, "organization_members"], ["projects.max", projects ?? 0, "projects"], ["contracts.max", contracts ?? 0, "contracts"],
          ["apf.countings.monthly", (licenses.data ?? []).reduce((sum, item) => sum + Number(item.pf_used_month ?? 0), 0), "licenses"],
          ["ai.calls.monthly", (licenses.data ?? []).reduce((sum, item) => sum + Number(item.ai_calls_used ?? 0), 0), "licenses"],
        ] as const;
        for (const [code, used, source] of dimensions) {
          const { error: recordError } = await admin.rpc("record_organization_usage_v1", { p_org_id: organization.id, p_usage_code: code, p_used_value: used, p_period_start: periodStart.toISOString(), p_period_end: periodEnd.toISOString(), p_source: source, p_idempotency_key: `${organization.id}:${code}:${periodStart.toISOString().slice(0, 7)}`, p_metadata: { job: "commercial-usage-refresh" } });
          if (recordError) throw recordError;
        }
        results.push({ organizationId: organization.id, ok: true });
      } catch (cause) { results.push({ organizationId: organization.id, ok: false, error: cause instanceof Error ? cause.message : String(cause) }); }
    }
    console.log(JSON.stringify({ event: "commercial_usage_refresh_completed", organizations: results.length, failures: results.filter((item) => !item.ok).length, durationMs: Date.now() - started }));
    return json({ processed: results.length, successes: results.filter((item) => item.ok).length, failures: results.filter((item) => !item.ok) });
  } catch (cause) {
    console.error(JSON.stringify({ event: "commercial_usage_refresh_failed", error: cause instanceof Error ? cause.message : String(cause), durationMs: Date.now() - started }));
    return json({ error: cause instanceof Error ? cause.message : String(cause) }, 500);
  }
});
