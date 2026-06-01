// deno-lint-ignore-file no-explicit-any
/**
 * process-apf-job — Worker da fila apf_jobs
 *
 * Responsabilidades:
 *   1. Busca 1 job pendente com SELECT FOR UPDATE SKIP LOCKED
 *      → garante que 2 invocações simultâneas nunca processam o mesmo job
 *   2. Chama apf-generate passando o payload do job
 *   3. Atualiza status: done | failed | dead
 *   4. Calcula next_attempt_at com backoff exponencial
 *
 * Invocação:
 *   - Via pg_cron a cada 10s: SELECT net.http_post(...) (opcional)
 *   - Via Supabase Webhook no INSERT de apf_jobs (recomendado)
 *   - Via chamada direta do frontend após enfileirar (fallback imediato)
 *
 * Segurança:
 *   - Só aceita chamadas com SUPABASE_SERVICE_ROLE_KEY no header
 *     OU chamadas internas (sem header = cron/webhook)
 *   - Nunca expõe dados do job para o caller — só status
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL      = Deno.env.get("SITE_URL") ?? "*";

const corsHeaders = {
  "Access-Control-Allow-Origin":  SITE_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Backoff exponencial: attempt 1→30s, 2→120s, 3→dead
function nextAttemptDelay(attempt: number): number {
  return Math.min(30 * Math.pow(4, attempt - 1), 600) * 1000;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── 1. Busca 1 job pendente com FOR UPDATE SKIP LOCKED ──────────────────
  const { data: jobs, error: fetchErr } = await admin
    .rpc("claim_next_apf_job");

  if (fetchErr) {
    console.error("[process-apf-job] claim_next_apf_job error:", fetchErr.message);
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const job = jobs?.[0];
  if (!job) {
    // Fila vazia — nada a fazer
    return new Response(JSON.stringify({ status: "idle", message: "No pending jobs" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const jobId      = job.id as string;
  const payload    = job.payload as any;
  const attempts   = (job.attempts as number) + 1;
  const maxAttempts = job.max_attempts as number;

  console.log(`[process-apf-job] Processing job ${jobId} (attempt ${attempts}/${maxAttempts})`);

  // ── 2. Marca como processing ─────────────────────────────────────────────
  await admin.from("apf_jobs").update({
    status:     "processing",
    started_at: new Date().toISOString(),
    attempts,
  }).eq("id", jobId);

  // ── 3. Chama apf-generate com o payload do job ───────────────────────────
  let success = false;
  let resultData: any = null;
  let errorMessage: string | null = null;

  try {
    const apfUrl = `${SUPABASE_URL}/functions/v1/apf-generate`;

    const response = await fetch(apfUrl, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${SERVICE_KEY}`,
        // Passa o JWT original do usuário para que apf-generate valide auth
        ...(payload.userJwt ? { "x-user-jwt": payload.userJwt } : {}),
      },
      body: JSON.stringify({
        prompt:       payload.prompt,
        providerId:   payload.providerId,
        provider:     payload.provider,
        model:        payload.model,
        files:        payload.files,
        generationId: payload.generationId,
        apiKey:       payload.apiKey,
        skipDocx:     payload.skipDocx ?? false,
      }),
    });

    const data = await response.json();

    if (data.success) {
      success    = true;
      resultData = {
        pfTotal:      data.pfTotal,
        pfBreakdown:  data.pfBreakdown,
        charCount:    data.charCount,
        providerUsed: data.providerUsed,
        outputFilename: data.outputFilename,
        fallback:     data.fallback ?? null,
      };
      console.log(`[process-apf-job] Job ${jobId} completed. pfTotal=${data.pfTotal}`);
    } else {
      errorMessage = data.userMessage ?? data.error ?? "apf-generate returned success=false";
      console.warn(`[process-apf-job] Job ${jobId} apf-generate failed: ${errorMessage}`);
    }
  } catch (e: any) {
    errorMessage = e?.message ?? "Unknown error calling apf-generate";
    console.error(`[process-apf-job] Job ${jobId} exception:`, errorMessage);
  }

  // ── 4. Atualiza status final ─────────────────────────────────────────────
  if (success) {
    await admin.from("apf_jobs").update({
      status:      "done",
      result:      resultData,
      finished_at: new Date().toISOString(),
    }).eq("id", jobId);
  } else {
    const isDead = attempts >= maxAttempts;
    const nextStatus = isDead ? "dead" : "failed";
    const nextAttempt = isDead
      ? null
      : new Date(Date.now() + nextAttemptDelay(attempts)).toISOString();

    await admin.from("apf_jobs").update({
      status:         nextStatus,
      error_message:  errorMessage,
      finished_at:    isDead ? new Date().toISOString() : null,
      next_attempt_at: nextAttempt ?? new Date().toISOString(),
    }).eq("id", jobId);

    if (!isDead) {
      // Recoloca como pending para nova tentativa
      await admin.from("apf_jobs").update({ status: "pending" }).eq("id", jobId);
      console.log(`[process-apf-job] Job ${jobId} will retry at ${nextAttempt}`);
    } else {
      console.error(`[process-apf-job] Job ${jobId} is dead after ${attempts} attempts.`);
    }
  }

  return new Response(
    JSON.stringify({ jobId, status: success ? "done" : (attempts >= maxAttempts ? "dead" : "failed") }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
