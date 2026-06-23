/**
 * DriftAlert
 * -----------
 * Banner de alerta exibido quando a acurácia caiu mais que o threshold
 * configurado em relação à semana anterior.
 * Não renderiza nada se não houver drift.
 */
import { AlertTriangle, TrendingDown, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { DriftStatus } from "../../services/automation.service";

interface Props {
  drift: DriftStatus | null;
  threshold: number;
}

export function DriftAlert({ drift, threshold }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!drift?.hasDrift || dismissed) return null;

  const delta   = drift.deltaPp ?? 0;
  const current = drift.currentAccuracy ?? 0;
  const prev    = drift.previousAccuracy ?? 0;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 px-4 py-3">
      <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
        <TrendingDown className="h-4 w-4 text-red-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          Alerta de Drift de Acurácia
        </p>
        <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">
          A acurácia caiu{" "}
          <strong>{Math.abs(delta).toFixed(1)} pp</strong>{" "}
          ({prev.toFixed(0)}% → {current.toFixed(0)}%) — queda acima do threshold de {threshold} pp.
        </p>
        <p className="text-xs text-red-500 dark:text-red-400 mt-1">
          Recomendação: revise os padrões rejeitados recentemente ou verifique se houve mudança no tipo de HUs processadas.
        </p>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 shrink-0 text-red-400 hover:text-red-600 hover:bg-red-100"
        onClick={() => setDismissed(true)}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
