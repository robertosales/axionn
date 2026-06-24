import type { ApfContext } from "../types/apfContext.types";
import type { HuRow } from "../types/apfItem.types";
import type { CorrectionReason } from "../types/contractualApf.constants";
import type { ValidationItemState } from "../types/apfRuntime.types";
import { validateItemsAtomically } from "./atomicValidation.service";

export async function validateContractualItems(args: {
  projectId: string;
  teamId: string;
  context: ApfContext;
  hu: HuRow;
  items: ValidationItemState[];
  reason: CorrectionReason | "";
  notes: string;
}) {
  return validateItemsAtomically({
    context: args.context,
    items: args.items,
    reason: args.reason,
    notes: args.notes,
  });
}
