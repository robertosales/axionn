import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JOB_SECRET = Deno.env.get("OKR_JOB_SECRET") ?? "";
const DONE_STATUSES = new Set([
  "done",
  "concluido",
  "concluído",
  "closed",
  "encerrado",
  "pronto_para_publicacao",
]);

type QueueJob = {
  id: string;
  organization_id: string | null;
  key_result_id: string | null;
  metric_binding_id: string | null;
  correlation_id: string;
};

type Binding = {
  id: string;
  organization_id: string;
  key_result_id: string;
  metric_version_id: string;
  scope_type: string;
  scope_id: string | null;
  configuration: Record<string, unknown>;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });

function normalizeStatus(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("pt-BR");
}

function periodForObjective(objective: {
  start_date: string | null;
  end_date: string | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    start: objective.start_date ?? today,
    end: objective.end_date ?? today,
  };
}

async function collectMetric(
  admin: ReturnType<typeof createClient>,
  collector: string,
  teamId: string,
  start: string,
  end: string,
) {
  if (collector === "impediments_open") {
    const { data, error } = await admin
      .from("impediments")
      .select("id,resolved_at")
      .eq("team_id", teamId)
      .lte("reported_at", `${end}T23:59:59.999Z`);
    if (error) throw error;
    const rows = data ?? [];
    return {
      value: rows.filter((row) => !row.resolved_at).length,
      itemsConsidered: rows.length,
    };
  }

  const { data: sprints, error: sprintError } = await admin
    .from("sprints")
    .select("id")
    .eq("team_id", teamId)
    .lte("start_date", end)
    .gte("end_date", start);
  if (sprintError) throw sprintError;

  const sprintIds = (sprints ?? []).map((sprint) => sprint.id);
  if (sprintIds.length === 0) {
    return { value: 0, itemsConsidered: 0 };
  }

  const { data, error } = await admin
    .from("user_stories")
    .select("id,status,story_points")
    .eq("team_id", teamId)
    .in("sprint_id", sprintIds);
  if (error) throw error;

  const stories = data ?? [];
  const completed = stories.filter((story) => DONE_STATUSES.has(normalizeStatus(story.status)));
  if (collector === "velocity") {
    return {
      value: completed.reduce((sum, story) => sum + Number(story.story_points ?? 0), 0),
      itemsConsidered: stories.length,
    };
  }
  if (collector === "sprint_commitment") {
    return {
      value: stories.length === 0 ? 0 : (completed.length / stories.length) * 100,
      itemsConsidered: stories.length,
    };
  }
  if (collector === "throughput") {
    return { value: completed.length, itemsConsidered: stories.length };
  }
  throw new Error(`OKR_METRIC_COLLECTOR_NOT_SUPPORTED: ${collector}`);
}

async function processJob(
  admin: ReturnType<typeof createClient>,
  workerId: string,
  job: QueueJob,
) {
  try {
    if (!job.organization_id || !job.key_result_id || !job.metric_binding_id) {
      // Legacy job (pre PR 7): no v2 metric binding to collect. Close it as a
      // no-op instead of failing, so it never reaches dead-letter and never
      // breaks the scheduled drain.
      const skipped = {
        keyResultId: job.key_result_id,
        skipped: true,
        reason: "OKR_QUEUE_LEGACY_JOB_WITHOUT_V2_BINDING",
      };
      const { error: skipError } = await admin.rpc("finish_okr_recalculation_job_v1", {
        p_job_id: job.id,
        p_worker_id: workerId,
        p_succeeded: true,
        p_result: skipped,
        p_error: null,
      });
      if (skipError) throw skipError;
      return { ok: true, ...skipped };
    }

    const { data: bindingData, error: bindingError } = await admin
      .from("okr_metric_bindings")
      .select("id,organization_id,key_result_id,metric_version_id,scope_type,scope_id,configuration")
      .eq("id", job.metric_binding_id)
      .single();
    if (bindingError) throw bindingError;
    const binding = bindingData as Binding;

    const { data: version, error: versionError } = await admin
      .from("okr_metric_versions")
      .select("id,version,formula_definition,metric_definition_id")
      .eq("id", binding.metric_version_id)
      .single();
    if (versionError) throw versionError;

    const { data: definition, error: definitionError } = await admin
      .from("okr_metric_definitions")
      .select("code")
      .eq("id", version.metric_definition_id)
      .single();
    if (definitionError) throw definitionError;

    const { data: kr, error: krError } = await admin
      .from("okr_key_results")
      .select("objective_id")
      .eq("id", job.key_result_id)
      .single();
    if (krError) throw krError;

    const { data: objective, error: objectiveError } = await admin
      .from("okr_objectives")
      .select("team_id,start_date,end_date")
      .eq("id", kr.objective_id)
      .single();
    if (objectiveError) throw objectiveError;

    const teamId = binding.scope_type === "team" ? binding.scope_id : objective.team_id;
    if (!teamId) throw new Error("OKR_METRIC_TEAM_SCOPE_REQUIRED");

    const collector = String(version.formula_definition?.collector ?? definition.code);
    const period = periodForObjective(objective);
    const measurement = await collectMetric(admin, collector, teamId, period.start, period.end);
    const idempotencyKey = [
      "automatic",
      binding.id,
      version.id,
      period.start,
      period.end,
      measurement.value,
      job.correlation_id,
    ].join(":");

    const { data: snapshotId, error: applyError } = await admin.rpc(
      "apply_okr_measurement_v2",
      {
        p_org_id: job.organization_id,
        p_key_result_id: job.key_result_id,
        p_metric_version_id: version.id,
        p_value: measurement.value,
        p_period_start: `${period.start}T00:00:00.000Z`,
        p_period_end: `${period.end}T23:59:59.999Z`,
        p_idempotency_key: idempotencyKey,
        p_metadata: {
          collector,
          scope_type: "team",
          scope_id: teamId,
          items_considered: measurement.itemsConsidered,
          correlation_id: job.correlation_id,
        },
      },
    );
    if (applyError) throw applyError;

    const result = {
      snapshotId,
      keyResultId: job.key_result_id,
      value: measurement.value,
      collector,
    };
    const { error: finishError } = await admin.rpc("finish_okr_recalculation_job_v1", {
      p_job_id: job.id,
      p_worker_id: workerId,
      p_succeeded: true,
      p_result: result,
      p_error: null,
    });
    if (finishError) throw finishError;
    return { ok: true, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const { error: finishError } = await admin.rpc("finish_okr_recalculation_job_v1", {
      p_job_id: job.id,
      p_worker_id: workerId,
      p_succeeded: false,
      p_result: {},
      p_error: message,
    });
    if (finishError) {
      console.error(JSON.stringify({
        event: "okr_queue_finish_failed",
        jobId: job.id,
        error: finishError.message,
      }));
    }
    return { ok: false, jobId: job.id, keyResultId: job.key_result_id, error: message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers":
          "authorization, apikey, content-type, x-okr-job-secret",
      },
    });
  }

  try {
    const admin = createClient(URL, SERVICE);
    const body = await req.json().catch(() => ({}));
    const isScheduled = Boolean(JOB_SECRET)
      && req.headers.get("x-okr-job-secret") === JOB_SECRET;

    let requestedJobId: string | null = null;
    if (!isScheduled) {
      const authorization = req.headers.get("authorization") ?? "";
      const userClient = createClient(URL, ANON, {
        global: { headers: { Authorization: authorization } },
      });
      const { data: auth } = await userClient.auth.getUser();
      if (!auth.user) return json({ error: "Não autenticado" }, 401);
      if (!body.keyResultId) return json({ error: "keyResultId obrigatório" }, 400);

      const { data: jobId, error } = await userClient.rpc("request_okr_measurement_v2", {
        p_key_result_id: body.keyResultId,
      });
      if (error) return json({ error: error.message }, 403);
      requestedJobId = String(jobId);
    } else {
      const { error } = await admin.rpc("enqueue_due_okr_metric_bindings_v1");
      if (error) throw error;
    }

    const requestedKeyResultId = isScheduled ? null : String(body.keyResultId);
    const workerId = `okr-recalculation:${crypto.randomUUID()}`;
    const claim = isScheduled
      ? await admin.rpc("claim_okr_recalculation_jobs_v1", {
          p_worker_id: workerId, p_limit: 100, p_lease_seconds: 120,
        })
      : await admin.rpc("claim_okr_recalculation_job_v2", {
          p_job_id: requestedJobId, p_worker_id: workerId, p_lease_seconds: 120,
        });
    const { data: jobs, error: claimError } = claim;
    if (claimError) throw claimError;

    const results = [];
    for (const job of (jobs ?? []) as QueueJob[]) {
      results.push(await processJob(admin, workerId, job));
    }
    if (requestedKeyResultId) {
      results.sort((left, right) =>
        Number(right.keyResultId === requestedKeyResultId)
        - Number(left.keyResultId === requestedKeyResultId)
      );
    }

    console.log(JSON.stringify({
      event: "okr_recalculation_completed",
      workerId,
      processed: results.length,
      failures: results.filter((result) => !result.ok).length,
    }));
    return json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ event: "okr_recalculation_failed", error: message }));
    return json({ error: message }, 500);
  }
});
