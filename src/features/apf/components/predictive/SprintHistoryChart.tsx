/**
 * SprintHistoryChart
 * -------------------
 * Gráfico de barras simples mostrando PF e SP por sprint histórica.
 * Implementado como CSS puro (sem biblioteca) para evitar dependência extra.
 * Inclui linha de tendência visual.
 */
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SprintHistoryPoint } from "../../services/predictive.service";

interface Props {
  history: SprintHistoryPoint[];
  prediction?: { slope: number; intercept: number } | null;
}

export function SprintHistoryChart({ history, prediction }: Props) {
  if (history.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 flex flex-col items-center gap-2 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            Nenhum histórico disponível. Complete ao menos 2 sprints com PF calculados.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxPf   = Math.max(...history.map((h) => h.totalPf), 1);
  const maxSp   = Math.max(...history.map((h) => h.totalSp), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Histórico de Sprints — SP vs PF
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Chart area */}
        <div className="relative overflow-x-auto">
          <div className="flex items-end gap-2 min-w-max pb-6 pt-2 px-1" style={{ minHeight: 160 }}>
            {history.map((h, i) => {
              const pfH  = Math.round((h.totalPf  / maxPf) * 140);
              const spH  = Math.round((h.totalSp  / maxSp) * 140);
              const trendPf = prediction
                ? Math.max(0, Math.round(((prediction.slope * h.totalSp + prediction.intercept) / maxPf) * 140))
                : null;
              return (
                <div key={h.sprintId} className="flex flex-col items-center gap-0.5 w-16">
                  <div className="flex items-end gap-1 h-36">
                    {/* PF bar */}
                    <div
                      className="w-5 rounded-t bg-primary/70 transition-all"
                      style={{ height: pfH }}
                      title={`PF: ${h.totalPf}`}
                    />
                    {/* SP bar */}
                    <div
                      className="w-5 rounded-t bg-muted-foreground/30 transition-all"
                      style={{ height: spH }}
                      title={`SP: ${h.totalSp}`}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground text-center truncate w-full px-0.5">
                    {h.sprintName.replace(/sprint\s*/i, "Σ")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-primary/70" /> PF total</span>
          <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-muted-foreground/30" /> SP total</span>
        </div>

        {/* Tabela resumo */}
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1 pr-3 font-medium">Sprint</th>
                <th className="text-right pr-3 font-medium">SP</th>
                <th className="text-right pr-3 font-medium">PF</th>
                <th className="text-right pr-3 font-medium">HUs</th>
                <th className="text-right font-medium">PF/SP</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.sprintId} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-1 pr-3 text-muted-foreground truncate max-w-[120px]">{h.sprintName}</td>
                  <td className="text-right pr-3 tabular-nums">{h.totalSp}</td>
                  <td className="text-right pr-3 tabular-nums font-semibold text-primary">{h.totalPf}</td>
                  <td className="text-right pr-3 tabular-nums">{h.huCount}</td>
                  <td className="text-right tabular-nums">{h.pfPerSp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
