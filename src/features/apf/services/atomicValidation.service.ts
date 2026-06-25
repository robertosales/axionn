import { supabase } from "@/integrations/supabase/client";
import type { ContractualItem } from "../types/apfItem.types";
import type { ApfContext } from "../types/apfContext.types";
import type { CorrectionReason } from "../types/contractualApf.constants";
import type { ValidationItemState } from "../types/apfRuntime.types";
import {
  calculatePfFs,
  effectiveFactor,
  effectiveFunction,
  effectivePfFs,
} from "../utils/contractualApf.helpers";

interface ProcessResolution {
  counting_decision: "counted" | "absorbed" | "review_required" | "not_countable";
  process_role: "central" | "independent" | "auxiliary";
  process_is_complete: boolean;
  process_is_independent: boolean;
  separation_precedent_ref: string | null;
  absorbed_by_item_id: string | null;
  pf_bruto: number;
  contribution_pct: number;
  pf_fs: number;
}

export async function validateItemsAtomically(args: {
  context: ApfContext;
  items: ValidationItemState[];
  reason: CorrectionReason | "";
  notes: string;
}): Promise<ContractualItem[]> {
  const validated: ContractualItem[] = [];

  for (const item of args.items) {
    const processChanged = item.selectedProcessRole !== (item.process_role ?? "central")
      || item.selectedProcessComplete !== (item.process_is_complete ?? true)
      || item.selectedProcessIndependent !== (item.process_is_independent ?? true)
      || item.selectedProcessPrecedent !== (item.separation_precedent_ref ?? "")
      || item.counting_decision === "review_required";

    const weight = item.selectedFunction === "N/A"
      ? 0
      : Number(args.context.function_types.find(
        (type) => type.sigla === item.selectedFunction,
      )?.weight ?? 0);
    const pct = item.selectedFactor === "N/A"
      ? 0
      : Number(args.context.impact_factors.find(
        (factor) => factor.sigla === item.selectedFactor,
      )?.contribution_pct ?? 0);
    const pfFs = calculatePfFs(weight, pct);
    const metricChanged = item.selectedFunction !== effectiveFunction(item)
      || item.selectedFactor !== effectiveFactor(item)
      || pfFs !== effectivePfFs(item);

    if ((processChanged || metricChanged) && !args.reason) {
      throw new Error("Informe o motivo da correção.");
    }

    const { data: processData, error: processError } = await supabase.rpc(
      "resolve_apf_elementary_process_item" as any,
      {
        p_item_id: item.id,
        p_process_role: item.selectedProcessRole,
        p_is_complete: item.selectedProcessComplete,
        p_is_independent: item.selectedProcessIndependent,
        p_precedent_ref: item.selectedProcessPrecedent || null,
        p_reason: (processChanged ? args.notes || args.reason : null),
      } as any,
    );
    if (processError) throw processError;

    const process = processData as unknown as ProcessResolution;
    if (process.counting_decision === "review_required") {
      throw new Error(
        `${item.elementary_process_name ?? item.ef_description}: informe se o processo é completo e independente, ou marque-o como ação auxiliar.`,
      );
    }

    const countable = process.counting_decision === "counted";
    const validatedFunction = countable ? item.selectedFunction : "N/A";
    const validatedFactor = countable ? item.selectedFactor : "N/A";
    const finalWeight = countable ? weight : 0;
    const finalPfFs = countable ? pfFs : 0;
    const finalMetricChanged = validatedFunction !== effectiveFunction(item)
      || validatedFactor !== effectiveFactor(item)
      || finalPfFs !== effectivePfFs(item);

    const { data, error } = await supabase.rpc(
      "validate_apf_counting_item" as any,
      {
        p_item_id: item.id,
        p_function_sigla: validatedFunction,
        p_factor_sigla: validatedFactor,
        p_reason: (processChanged || finalMetricChanged) ? args.reason : null,
        p_notes: args.notes || null,
      } as any,
    );
    if (error) throw error;

    validated.push({
      ...item,
      process_role: process.process_role,
      process_is_complete: process.process_is_complete,
      process_is_independent: process.process_is_independent,
      separation_precedent_ref: process.separation_precedent_ref,
      counting_decision: process.counting_decision,
      absorbed_by_item_id: process.absorbed_by_item_id,
      is_validated: true,
      corrected_function_sigla: finalMetricChanged ? validatedFunction : null,
      corrected_factor_sigla: finalMetricChanged ? validatedFactor : null,
      corrected_pf_bruto: finalMetricChanged
        ? Number((data as any)?.pf_bruto ?? finalWeight)
        : null,
      corrected_pf_fs: finalMetricChanged
        ? Number((data as any)?.pf_fs ?? finalPfFs)
        : null,
    });
  }

  return validated;
}
