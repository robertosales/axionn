import { supabase } from "@/integrations/supabase/client";
import type { OkrCheckInInput } from "../types";

export async function recordManualOkrMeasurement(args: {
  organizationId: string;
  keyResultId: string;
  input: OkrCheckInInput;
}) {
  const { error } = await supabase.rpc("record_okr_check_in_v2", {
    p_org_id: args.organizationId,
    p_key_result_id: args.keyResultId,
    p_payload: {
      value: args.input.value,
      summary: args.input.summary,
      confidence: args.input.confidence,
      risks: args.input.risks ?? null,
      next_steps: args.input.nextSteps ?? null,
      evidence_url: args.input.evidenceUrl ?? null,
    },
  });
  if (error) throw error;
}

export async function measureAutomaticKeyResult(keyResultId: string, triggeredById: string) {
  // A medição automática é executada no backend, onde contexto e RLS são
  // validados. O parâmetro é mantido por compatibilidade com os chamadores.
  void triggeredById;
  const { data, error } = await supabase.functions.invoke("okr-recalculation", { body: { keyResultId } });
  if (error) throw error;
  const result = data?.results?.[0];
  if (!result?.ok) throw new Error(result?.error ?? "Não foi possível recalcular o Key Result.");
  return result;
}
