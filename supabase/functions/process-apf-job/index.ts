/**
 * process-apf-job
 * Worker da fila apf_jobs. Chamado pelo trigger trg_apf_job_notify
 * via pg_net sempre que um job entra no estado 'pending'.
 *
 * Fluxo:
 *   1. Chama claim_next_apf_job() — SELECT FOR UPDATE SKIP LOCKED
 *   2. Atualiza job para 'processing'
 *   3. Executa a geração APF (reutiliza lógica do apf-generate)
 *   4. Salva resultado e marca 'done' ou 'failed'
 *   5. Se failed e attempts < max_attempts: reagenda com backoff exponencial
 *   6. Se esgotou tentativas: marca 'dead'
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ??
                    Deno.env.get('APP_SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
                         Deno.env.get('APP_SUPABASE_KEY') ?? ''

// ----------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------
interface ApfJob {
  id: string
  team_id: string
  generation_id: string | null
  type: string
  payload: Record<string, unknown>
  status: string
  attempts: number
  max_attempts: number
  error_message: string | null
}

interface ApfPayload {
  generation_id?: string
  team_id?: string
  [key: string]: unknown
}

// ----------------------------------------------------------------
// Handler principal
// ----------------------------------------------------------------
Deno.serve(async (req: Request) => {
  // Aceita POST do trigger pg_net ou chamadas manuais
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // ------------------------------------------------------------------
  // Auth guard: aceita apenas chamadas com o SERVICE_ROLE_KEY
  // (trigger interno pg_net) ou um JWT de admin/usuário autenticado.
  // Sem isso, qualquer um na internet podia disparar jobs pagos de IA.
  // ------------------------------------------------------------------
  const authHeader = req.headers.get('Authorization') ?? ''
  const token      = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (token !== SERVICE_ROLE_KEY) {
    // Não é o trigger interno — exige JWT válido de usuário autenticado
    const authClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user }, error: userErr } = await authClient.auth.getUser(token)
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // ------------------------------------------------------------------
  // 1. Claim: busca e bloqueia 1 job pending atomicamente
  // ------------------------------------------------------------------
  const { data: jobs, error: claimErr } = await admin
    .rpc('claim_next_apf_job')

  if (claimErr) {
    console.error('[process-apf-job] claim error:', claimErr.message)
    return new Response(JSON.stringify({ error: claimErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const job: ApfJob | undefined = Array.isArray(jobs) ? jobs[0] : jobs

  if (!job) {
    // Fila vazia — resposta normal
    return new Response(JSON.stringify({ status: 'empty' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  console.log(`[process-apf-job] processing job ${job.id} (attempt ${job.attempts + 1}/${job.max_attempts})`)

  // ------------------------------------------------------------------
  // 2. Marca como 'processing'
  // ------------------------------------------------------------------
  await admin
    .from('apf_jobs')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      attempts: job.attempts + 1,
    })
    .eq('id', job.id)

  // ------------------------------------------------------------------
  // 3. Executa geração APF
  // ------------------------------------------------------------------
  let result: Record<string, unknown> | null = null
  let errorMessage: string | null = null

  try {
    const payload = job.payload as ApfPayload

    // Chama a Edge Function apf-generate existente
    const genResp = await fetch(
      `${SUPABASE_URL}/functions/v1/apf-generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          ...payload,
          generation_id: payload.generation_id ?? job.generation_id,
          team_id: payload.team_id ?? job.team_id,
          _job_id: job.id,          // contexto para a função destino
        }),
      }
    )

    if (!genResp.ok) {
      const errBody = await genResp.text()
      throw new Error(`apf-generate retornou ${genResp.status}: ${errBody}`)
    }

    result = await genResp.json()
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[process-apf-job] error on job ${job.id}:`, errorMessage)
  }

  // ------------------------------------------------------------------
  // 4. Atualiza status final
  // ------------------------------------------------------------------
  const currentAttempts = job.attempts + 1
  const success = result !== null && errorMessage === null

  if (success) {
    await admin
      .from('apf_jobs')
      .update({
        status: 'done',
        result,
        finished_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', job.id)

    console.log(`[process-apf-job] job ${job.id} concluído com sucesso`)
  } else {
    const hasRetry = currentAttempts < job.max_attempts

    // Backoff exponencial: 2^attempts * 60 segundos
    const backoffSeconds = Math.pow(2, currentAttempts) * 60
    const nextAttempt = new Date(Date.now() + backoffSeconds * 1000).toISOString()

    await admin
      .from('apf_jobs')
      .update({
        status: hasRetry ? 'failed' : 'dead',
        error_message: errorMessage,
        finished_at: hasRetry ? null : new Date().toISOString(),
        next_attempt_at: hasRetry ? nextAttempt : null,
      })
      .eq('id', job.id)

    if (hasRetry) {
      console.warn(
        `[process-apf-job] job ${job.id} falhou (tentativa ${currentAttempts}/${job.max_attempts}). ` +
        `Retry em ${backoffSeconds}s`
      )
    } else {
      console.error(`[process-apf-job] job ${job.id} marcado como DEAD após ${currentAttempts} tentativas`)
    }
  }

  return new Response(
    JSON.stringify({
      job_id: job.id,
      status: success ? 'done' : (currentAttempts < job.max_attempts ? 'failed' : 'dead'),
      attempts: currentAttempts,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
})
