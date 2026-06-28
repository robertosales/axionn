import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, Database, Loader2, RefreshCw, Sparkles,
} from "lucide-react";
import { LearningInsightsPanel } from "./learning/LearningInsightsPanel";
import { useLearningInsights } from "../hooks/useLearningInsights";
import { useContractualApfCounting } from "../hooks/useContractualApfCounting";
import { ApfAnalysisReviewDialog } from "./ApfAnalysisReviewDialog";
import { ApfStoryList } from "./ApfStoryList";
import { ApfValidationDialog } from "./ApfValidationDialog";

export function ApfFunctionPointTab() {
  const counting = useContractualApfCounting();
  const { insights, loading: insightsLoading, lastRefresh, refresh } = useLearningInsights();

  return (
    <div className="min-w-0 space-y-5">
      <LearningInsightsPanel
        insights={insights}
        loading={insightsLoading}
        lastRefresh={lastRefresh}
        onRefresh={refresh}
      />

      <Card className="min-w-0">
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Select value={counting.projectId} onValueChange={counting.setProjectId}>
              <SelectTrigger><SelectValue placeholder="Projeto" /></SelectTrigger>
              <SelectContent>
                {counting.projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={counting.selectedSprintId} onValueChange={counting.setSelectedSprintId}>
              <SelectTrigger><SelectValue placeholder="Sprint da medição" /></SelectTrigger>
              <SelectContent>
                {counting.sprints.map((sprint) => (
                  <SelectItem key={sprint.id} value={sprint.id}>{sprint.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {counting.context ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <Database className="h-4 w-4 shrink-0" />
              <strong>Baseline do projeto:</strong>
              <span className="min-w-0 break-words">
                {counting.context.baseline.version} — {counting.context.baseline.label
                  ?? counting.context.baseline.source_file_name ?? "sem descrição"}
              </span>
              <Badge variant="outline">{counting.context.baseline_item_count} itens</Badge>
              <Badge variant="outline">Reutilizada entre sprints</Badge>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{counting.contextError ?? "Importe e ative uma baseline para o projeto antes de contar."}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="HUs (gatilhos)" value={counting.stories.length} />
        <Kpi label="PF Bruto" value={counting.totals.pfBruto.toFixed(2)} />
        <Kpi label="PF Simples (PF FS)" value={counting.totals.pfFs.toFixed(2)} primary />
        <Kpi label="Validadas" value={counting.totals.validated} success />
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base">Análise de processos → contador APF</CardTitle>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
              Lista compacta sem rolagem horizontal. Abra os detalhes para consultar o cálculo,
              a origem do fator e todos os processos identificados.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={counting.loadStories}
              disabled={counting.loading}
              title="Atualizar HUs"
            >
              <RefreshCw className={`h-4 w-4 ${counting.loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              size="sm"
              onClick={counting.countAll}
              disabled={!counting.context || counting.countingAll || !counting.stories.length}
              className="gap-2"
            >
              {counting.countingAll
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Sparkles className="h-4 w-4" />}
              Analisar pendentes
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          <ApfStoryList counting={counting} />
        </CardContent>
      </Card>

      <ApfAnalysisReviewDialog counting={counting} />
      <ApfValidationDialog counting={counting} />
    </div>
  );
}

function Kpi({
  label,
  value,
  primary,
  success,
}: {
  label: string;
  value: string | number;
  primary?: boolean;
  success?: boolean;
}) {
  return (
    <Card className="min-w-0">
      <CardContent className="pt-4">
        <p className="truncate text-xs text-muted-foreground" title={label}>{label}</p>
        <p className={`truncate text-2xl font-bold ${primary ? "text-primary" : success ? "text-emerald-600" : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
