/**
 * VariableChip
 * Chip clicável que insere {{KEY}} no textarea do prompt.
 */
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateVariable } from "../../utils/templateVariables";

const CATEGORY_COLORS: Record<string, string> = {
  sprint: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  time:   "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
  data:   "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  ia:     "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
};

interface Props {
  variable: TemplateVariable;
  onClick: (key: string) => void;
}

export function VariableChip({ variable, onClick }: Props) {
  return (
    <button
      type="button"
      title={`${variable.description}\nEx: ${variable.example}`}
      onClick={() => onClick(variable.key)}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-mono font-semibold",
        "px-2 py-0.5 rounded-md border transition-colors cursor-pointer",
        CATEGORY_COLORS[variable.category]
      )}
    >
      <Plus className="h-2.5 w-2.5" />
      {`{{${variable.key}}}`}
    </button>
  );
}
