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

export async function validateItemsAtomically(args: {
  context: ApfContext;
  items: ValidationItemState[];
  reason: CorrectionReason | "";
  notes: string;
}): Promise<ContractualItem[]> {
  const validated: ContractualItem[] = [];

  for (const item of args.items) {
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
    const changed = item.selectedFunction !== effectiveFunction(item)
      || item.selectedFactor !== effectiveFactor(item)
      || pfFs !== effectivePfFs(item);

    if (changed && !args.reason) {
      throw new Error("Informe o motivo da correção.");
    }

    const { data, error } = await supabase.rpc(
      "validate_apf_counting_item" as any,
      {
        p_item_id: item.id,
        p_function_sigla: item.selectedFunction,
        p_factor_sigla: item.selectedFactor,
        p_reason: changed ? args.reason : null,
        p_notes: args.notes || null,
      } as any,
    );
    if (error) throw error;

    validated.push({
      ...item,
      is_validated: true,
      corrected_function_sigla: changed ? item.selectedFunction : null,
      corrected_factor_sigla: changed ? item.selectedFactor : null,
      corrected_pf_bruto: changed
        ? Number((data as any)?.pf_bruto ?? weight)
        : null,
      corrected_pf_fs: changed
        ? Number((data as any)?.pf_fs ?? pfFs)
        : null,
    });
  }

  return validated;
}
