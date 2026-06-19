/**
 * ApfPredictiveTab
 * -----------------
 * Aba principal do APF Preditivo (Fase 5).
 * Composição:
 *  1. PredictionWidget    — estimativa SP → PF com IC 80%
 *  2. SprintHistoryChart  — gráfico histórico SP vs PF
 *  3. AnomalyAlertsList   — alertas de desvio e outliers
 *  4. ComplexityTable     — índice de complexidade da sprint ativa
 */
import { RefreshCw, BrainCircuit, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePredictiveReport } from "../hooks/usePredictiveReport";
import { PredictionWidget }   from "./predictive/PredictionWidget";
import { SprintHistoryChart } from "./predictive/SprintHistoryChart";
import { AnomalyAlertsList }  from "./predictive/AnomalyAlertsList";
import { ComplexityTable }    from "./predictive/ComplexityTable";
import { useAiPipeline } from "../contexts/AiPipelineContext";

export function ApfPredictiveTab() {
  const { report, prediction, loading, inputSp, setInputSp, reload } = usePredictiveReport();
  const { activePipelineSprintId } = useAiPipeline();

  if (loading && !report) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Carregando histórico preditivo...</p>
      </div>
    );
  }

  const sampleSize = report?.sprintHistory.length ?? 0;
  const anomalyCount = report?.anomalies.length ?? 0;

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-primary" />
            APF Preditivo
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Estimativas pré-sprint, índice de complexidade e detecção de anomalias.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {anomalyCount > 0 && (
            <Badge variant="outline" className="border-amber-400 text-amber-600 gap-1">
              ⚠️ {anomalyCount} anomalia{anomalyCount !== 1 ? "s" : ""}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={reload} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* 1. Estimativa preditiva */}
      <PredictionWidget
        prediction={prediction}
        inputSp={inputSp}
        onInputSpChange={setInputSp}
        sampleSize={sampleSize}
      />

      {/* 2. Gráfico histórico */}
      <SprintHistoryChart
        history={report?.sprintHistory ?? []}
        prediction={prediction}
      />

      {/* 3. Anomalias */}
      <AnomalyAlertsList alerts={report?.anomalies ?? []} />

      {/* 4. Complexidade por HU */}
      {activePipelineSprintId && (
        <ComplexityTable complexities={report?.complexities ?? []} />
      )}
    </div>
  );
}
