import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JOB_SECRET = Deno.env.get("OKR_JOB_SECRET") ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
const done = new Set(["done", "concluido", "concluído", "closed", "encerrado", "pronto_para_publicacao"]);
const clamp = (value: number) => Math.min(100, Math.max(0, value));

async function checkOkrEntitlement(admin: any, orgId: string, featureKey: string): Promise<boolean> {
  const { data, error } = await admin.rpc("has_organization_entitlement", { p_org_id: orgId, p_feature_key: featureKey });
  if (error) {
    console.error(`[OKR] Erro ao verificar entitlement ${featureKey}:`, error);
    return false;
  }
  return data === true;
}

async function getOrgIdFromTeam(admin: any, teamId: string): Promise<string | null> {
  const { data, error } = await admin.from("teams").select("org_id").eq("id", teamId).maybeSingle();
  if (error || !data) return null;
  return data.org_id;
}

async function recalculateObjective(admin: any, objectiveId: string) {
  const [{ data: objective }, { data: krs }] = await Promise.all([admin.from("okr_objectives").select("*").eq("id", objectiveId).single(), admin.from("okr_key_results").select("calculated_progress,weight,lifecycle_status").eq("objective_id", objectiveId)]);
  const measured = (krs ?? []).filter((kr: any) => kr.lifecycle_status === "active" && kr.calculated_progress != null);
  const progressValue = measured.length ? measured.reduce((sum: number, kr: any) => sum + Number(kr.calculated_progress), 0) / measured.length : null;
  const start = objective.start_date ? new Date(objective.start_date).getTime() : new Date(`${objective.cycle.slice(3)}-${String((Number(objective.cycle[1]) - 1) * 3 + 1).padStart(2, "0")}-01`).getTime();
  const end = objective.end_date ? new Date(objective.end_date).getTime() : start + 90 * 86400000;
  const elapsed = clamp((Date.now() - start) / Math.max(1, end - start) * 100); const gap = progressValue == null ? null : progressValue - elapsed;
  const health = objective.lifecycle_status === "completed" ? "completed" : gap == null ? "no_data" : gap >= -10 ? "on_track" : gap >= -25 ? "attention" : "at_risk";
  const reason = gap == null ? "Não há Key Results medidos" : `${Math.round(elapsed)}% do ciclo transcorrido e ${Math.round(progressValue!)}% de progresso.`; const now = new Date().toISOString();
  await admin.from("okr_objectives").update({ calculated_progress: progressValue, calculated_health: health, health_reason: reason, measurement_status: progressValue == null ? "needs_configuration" : "measuring", last_calculated_at: now, updated_at: now }).eq("id", objectiveId);
  const key = `${objectiveId}:health:${health}`;
  if (health === "at_risk" || health === "attention") await admin.from("okr_alerts").upsert({ objective_id: objectiveId, alert_type: "health", severity: health === "at_risk" ? "critical" : "warning", message: reason, status: "open", deduplication_key: key, detected_at: now, metadata: { progress: progressValue, cycle_elapsed: elapsed } }, { onConflict: "deduplication_key" });
  else await admin.from("okr_alerts").update({ status: "resolved", resolved_at: now }).eq("objective_id", objectiveId).eq("alert_type", "health").eq("status", "open");
}

function progress(kr: any, value: number | null) {
  const baseline = kr.baseline_value;
  const target = kr.target_value ?? kr.target;
  if (baseline == null || value == null || target == null) return { raw: null, calculated: null };
  if (baseline === target) return { raw: value === target ? 100 : 0, calculated: value === target ? 100 : 0 };
  const raw = kr.direction === "decrease" ? (baseline - value) / (baseline - target) * 100 : (value - baseline) / (target - baseline) * 100;
  return { raw, calculated: clamp(raw) };
}

async function measure(admin: any, kr: any, trigger: string, actor: string | null) {
  const { data: objective } = await admin.from("okr_objectives").select("*").eq("id", kr.objective_id).single();
  if (!objective?.team_id) throw new Error("Objetivo sem time");
  const year = Number(objective.cycle.slice(3)); const quarter = Number(objective.cycle[1]);
  const start = objective.start_date ?? new Date(Date.UTC(year, (quarter - 1) * 3, 1)).toISOString().slice(0, 10);
  const end = objective.end_date ?? new Date(Date.UTC(year, quarter * 3, 0)).toISOString().slice(0, 10);
  const { data: sprints } = await admin.from("sprints").select("id").eq("team_id", objective.team_id).lte("start_date", end).gte("end_date", start);
  const sprintIds = (sprints ?? []).map((row: any) => row.id);
  const storiesResult = sprintIds.length ? await admin.from("user_stories").select("id,status,story_points").eq("team_id", objective.team_id).in("sprint_id", sprintIds) : { data: [] };
  const impedimentsResult = await admin.from("impediments").select("id,resolved_at").eq("team_id", objective.team_id).lte("reported_at", `${end}T23:59:59.999Z`);
  const stories = storiesResult.data ?? []; const completed = stories.filter((story: any) => done.has(String(story.status ?? "").trim().toLocaleLowerCase("pt-BR")));
  const impediments = impedimentsResult.data ?? []; let value: number | null = null; let formula = ""; let count = 0;
  if (kr.metric_code === "velocity") { value = stories.length ? completed.reduce((sum: number, story: any) => sum + Number(story.story_points ?? 0), 0) : null; formula = "Soma dos story points concluídos"; count = stories.length; }
  else if (kr.metric_code === "sprint_commitment") { value = stories.length ? completed.length / stories.length * 100 : null; formula = "HUs concluídas / HUs planejadas × 100"; count = stories.length; }
  else if (kr.metric_code === "throughput") { value = completed.length; formula = "Contagem de HUs concluídas"; count = stories.length; }
  else if (kr.metric_code === "impediments_open") { value = impediments.filter((item: any) => !item.resolved_at).length; formula = "Contagem de impedimentos sem resolução"; count = impediments.length; }
  else throw new Error(`Métrica ${kr.metric_code ?? "não configurada"} não suportada`);
  const calculated = progress(kr, value); const now = new Date().toISOString(); const quality = value == null ? "no_data" : "reliable";
  const health = calculated.calculated == null ? "no_data" : calculated.calculated >= 100 ? "completed" : calculated.calculated >= 70 ? "on_track" : "at_risk";
  await admin.from("okr_key_results").update({ current: value ?? kr.current, current_value: value, raw_progress: calculated.raw, calculated_progress: calculated.calculated, calculated_health: health, measurement_quality: quality, last_measured_at: now, updated_at: now }).eq("id", kr.id);
  await admin.from("okr_key_result_snapshots").upsert({ key_result_id: kr.id, measured_value: value, raw_progress: calculated.raw, calculated_progress: calculated.calculated, health, measurement_quality: quality, source: kr.metric_code, formula_version: "1.0", measured_at: now, period_start: start, period_end: end, scope_type: "team", scope_id: objective.team_id, items_considered: count, calculation_metadata: { formula, sprint_ids: sprintIds }, triggered_by_type: trigger, triggered_by_id: actor, idempotency_key: `${trigger}:${kr.id}:${start}:${end}:1.0:${value ?? "no-data"}` }, { onConflict: "idempotency_key", ignoreDuplicates: true });
  await recalculateObjective(admin, kr.objective_id);
  return { keyResultId: kr.id, value, quality };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-okr-job-secret" } });
  try {
    const admin = createClient(URL, SERVICE); const body = await req.json().catch(() => ({}));
    const isJob = JOB_SECRET && req.headers.get("x-okr-job-secret") === JOB_SECRET;
    let actor: string | null = null;
    if (!isJob) {
      const authorization = req.headers.get("authorization") ?? "";
      const userClient = createClient(URL, ANON, { global: { headers: { Authorization: authorization } } });
      const { data: auth } = await userClient.auth.getUser(); if (!auth.user) return json({ error: "Não autenticado" }, 401); actor = auth.user.id;
      const { data: allowed } = await userClient.from("okr_key_results").select("id").eq("id", body.keyResultId).maybeSingle(); if (!allowed) return json({ error: "Acesso negado" }, 403);
    }
    let keyResults: any[] = []; let queuedJobIds: string[] = [];
    if (body.keyResultId) { const { data } = await admin.from("okr_key_results").select("*").eq("id", body.keyResultId).in("update_type", ["automatic", "hybrid"]); keyResults = data ?? []; }
    else if (isJob && body.mode === "queue") {
      const { data: jobs } = await admin.from("okr_recalculation_queue").select("id,objective_id").eq("status", "pending").lte("available_at", new Date().toISOString()).limit(100);
      queuedJobIds = (jobs ?? []).map((job: any) => job.id);
      const objectiveIds = [...new Set((jobs ?? []).map((job: any) => job.objective_id))];
      if (jobs?.length) await admin.from("okr_recalculation_queue").update({ status: "processing", locked_at: new Date().toISOString() }).in("id", jobs.map((job: any) => job.id));
      if (objectiveIds.length) { const { data } = await admin.from("okr_key_results").select("*").in("objective_id", objectiveIds).in("update_type", ["automatic", "hybrid"]); keyResults = data ?? []; }
    }
    else if (isJob) { const { data } = await admin.from("okr_key_results").select("*,okr_objectives!inner(lifecycle_status)").in("update_type", ["automatic", "hybrid"]).eq("okr_objectives.lifecycle_status", "active").limit(500); keyResults = data ?? []; }
    else return json({ error: "keyResultId obrigatório" }, 400);
    const results = [];
    for (const kr of keyResults) {
      try {
        // Verificar entitlement para métricas automáticas
        const { data: objective } = await admin.from("okr_objectives").select("team_id").eq("id", kr.objective_id).single();
        if (objective?.team_id) {
          const orgId = await getOrgIdFromTeam(admin, objective.team_id);
          if (orgId) {
            const hasEntitlement = await checkOkrEntitlement(admin, orgId, "okr.automatic_metrics");
            if (!hasEntitlement) {
              results.push({ ok: false, keyResultId: kr.id, error: "Entitlement negado: okr.automatic_metrics não incluído no plano atual" });
              continue;
            }
          }
        }
        results.push({ ok: true, ...(await measure(admin, kr, isJob ? "scheduled" : "on_demand", actor)) });
      } catch (error) { results.push({ ok: false, keyResultId: kr.id, error: error instanceof Error ? error.message : String(error) }); }
    }
    if (queuedJobIds.length) { const failures = results.filter((item) => !item.ok); await admin.from("okr_recalculation_queue").update(failures.length ? { status: "pending", attempts: 1, available_at: new Date(Date.now() + 300000).toISOString(), last_error: failures.map((item) => item.error).join("; ") } : { status: "completed", processed_at: new Date().toISOString(), last_error: null }).in("id", queuedJobIds); }
    console.log(JSON.stringify({ event: "okr_recalculation_completed", processed: results.length, failures: results.filter((item) => !item.ok).length }));
    return json({ results });
  } catch (error) { console.error(JSON.stringify({ event: "okr_recalculation_failed", error: error instanceof Error ? error.message : String(error) })); return json({ error: error instanceof Error ? error.message : String(error) }, 500); }
});
