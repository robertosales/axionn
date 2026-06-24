import { supabase } from "@/integrations/supabase/client";
import type { ContractualItem, HuRow } from "../types/apfItem.types";
import type { ApfContext } from "../types/apfContext.types";
import type { CorrectionReason } from "../types/contractualApf.constants";
import type { ValidationItemState } from "../types/apfRuntime.types";
import { buildStoryText, calculatePfFs, effectiveFactor, effectiveFunction, effectivePfFs } from "../utils/contractualApf.helpers";

export async function validateContractualItems(args: {
  projectId: string;
  teamId: string;
  context: ApfContext;
  hu: HuRow;
  items: ValidationItemState[];
  reason: CorrectionReason | "";
  notes: string;
}): Promise<ContractualItem[]> {
  const getWeight = (sigla: string) => sigla === "N/A" ? 0
    : Number(args.context.function_types.find((item) => item.sigla === sigla)?.weight ?? 0);
  const getPct = (sigla: string) => sigla === "N/A" ? 0
    : Number(args.context.impact_factors.find((item) => item.sigla === sigla)?.contribution_pct ?? 0);
  const validated: ContractualItem[] = [];

  for (const item of args.items) {
    const weight = getWeight(item.selectedFunction);
    const pct = getPct(item.selectedFactor);
    const pfFs = calculatePfFs(weight, pct);
    const changed = item.selectedFunction !== effectiveFunction(item)
      || item.selectedFactor !== effectiveFactor(item)
      || pfFs !== effectivePfFs(item);
    if (changed && !args.reason) throw new Error("Informe o motivo da correção.");

    const { data, error } = await supabase.rpc("validate_apf_counting_item" as any, {
      p_item_id: item.id,
      p_function_sigla: item.selectedFunction,
      p_factor_sigla: item.selectedFactor,
      p_reason: changed ? args.reason : null,
      p_notes: args.notes || null,
    } as any);
    if (error) throw error;

    const next = {
      ...item,
      is_validated: true,
      corrected_function_sigla: changed ? item.selectedFunction : null,
      corrected_factor_sigla: changed ? item.selectedFactor : null,
      corrected_pf_bruto: changed ? Number((data as any)?.pf_bruto ?? weight) : null,
      corrected_pf_fs: changed ? Number((data as any)?.pf_fs ?? pfFs) : null,
    };
    validated.push(next);

    await supabase.functions.invoke("apf-validate", { body: {
      counting_item_id: item.id,
      session_id: args.hu._sessionId,
      project_id: args.projectId,
      team_id: args.teamId,
      baseline_item_id: item.baseline_item_id,
      hu_text: buildStoryText(args.hu),
      hu_title: args.hu.title,
      ai_functional_type: item.function_sigla,
      ai_factor_sigla: item.factor_sigla,
      ai_complexity: "Padrão",
      ai_pf_bruto: item.pf_bruto,
      ai_pf_fs: item.pf_fs,
      ai_confidence_score: item.match_confidence ?? item.confidence ?? null,
      ai_reasoning: item.justification,
      validated_functional_type: item.selectedFunction,
      validated_factor_sigla: item.selectedFactor,
      validated_complexity: "Padrão",
      validated_pf_bruto: weight,
      validated_pf_fs: pfFs,
      correction_reason_code: changed ? args.reason : undefined,
      correction_notes: args.notes || undefined,
    }});
  }
  return validated;
}
