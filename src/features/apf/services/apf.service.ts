// deno-lint-ignore-file
// Re-exporta tudo do serviço original + adiciona enqueueApfJob e triggerApfWorker
import { supabase } from "@/integrations/supabase/client";

export { fetchTemplates, fetchGenerations, createGeneration, invokeApfGeneration } from "./apf.service.original";
export type { ApfTemplate, ApfGeneration } from "./apf.service.original";

export interface EnqueueApfJobPayload {
  prompt:       string;
  providerId?:  string;
  provider?:    string;
  model?:       string;
  files?:       unknown[];
  generationId?: string;
  apiKey?:      string;
  skipDocx?:    boolean;
}

/**
 * Enfileira um job APF na tabela apf_jobs.
 * Retorna imediatamente (<100ms) com o job_id.
 * O processamento real acontece no worker process-apf-job.
 */
export async function enqueueApfJob(
  teamId:  string,
  payload: EnqueueApfJobPayload,
): Promise<{ jobId: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão inválida");

  const { data, error } = await supabase
    .from("apf_jobs" as any)
    .insert({
      team_id:    teamId,
      type:       "generate_apf",
      payload:    payload as any,
      created_by: user.id,
      generation_id: payload.generationId ?? null,
    } as any)
    .select("id")
    .single();

  if (error) throw error;
  return { jobId: (data as any).id as string };
}

/**
 * Dispara o worker imediatamente após enfileirar.
 * Fire-and-forget: se falhar, o job continua pendente para o cron/webhook.
 */
export async function triggerApfWorker(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-apf-job`;
    await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${session?.access_token ?? ""}`,
        "apikey":        import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
      },
    });
  } catch {
    // Fire-and-forget: falha silenciosa, job será processado pelo cron
  }
}
