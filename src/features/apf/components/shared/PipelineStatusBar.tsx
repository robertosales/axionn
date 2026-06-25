/**
 * PipelineStatusBar
 * -----------------
 * Barra de status do pipeline HU → PF → Evidência.
 * Exibe o progresso visual de cada etapa com base nos IDs do AiPipelineContext.
 * Colocada entre o seletor de provedor e as abas na ApfGeneratorPage.
 */
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { useAiPipeline } from "../../contexts/AiPipelineContext";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  label: string;
  shortLabel: string;
  doneKey: "sprint" | "hu" | "pf";
}

const STEPS: Step[] = [
  { id: "sprint", label: "Sprint selecionada", shortLabel: "Sprint",     doneKey: "sprint" },
  { id: "hu",     label: "HU gerada",          shortLabel: "Gerar HU",   doneKey: "hu"     },
  { id: "pf",     label: "PF contado",         shortLabel: "Contar PF",  doneKey: "pf"     },
  { id: "ev",     label: "Evidência pronta",   shortLabel: "Evidência",  doneKey: "pf"     },
];

export function PipelineStatusBar() {
  const { activePipelineSprintId, lastHuGenerationId, lastPfAnalysisId } = useAiPipeline();

  const isDone = (key: Step["doneKey"]) => {
    if (key === "sprint") return !!activePipelineSprintId;
    if (key === "hu")     return !!lastHuGenerationId;
    if (key === "pf")     return !!lastPfAnalysisId;
    return false;
  };

  return (
    <div className="flex items-center gap-1 bg-muted/30 border border-border rounded-lg px-4 py-2 overflow-x-auto">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0 mr-2">
        Pipeline:
      </span>
      {STEPS.map((step, i) => (
        <>
          <div key={step.id} className="flex items-center gap-1.5 shrink-0">
            {isDone(step.doneKey) ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
            )}
            <span className={cn(
              "text-xs hidden sm:inline",
              isDone(step.doneKey) ? "text-emerald-600 font-medium" : "text-muted-foreground"
            )}>
              {step.label}
            </span>
            <span className={cn(
              "text-xs sm:hidden",
              isDone(step.doneKey) ? "text-emerald-600 font-medium" : "text-muted-foreground"
            )}>
              {step.shortLabel}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <ArrowRight key={`arrow-${i}`} className="h-3 w-3 text-muted-foreground/30 shrink-0" />
          )}
        </>
      ))}
    </div>
  );
}
