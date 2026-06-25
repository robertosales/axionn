/**
 * AnomalyAlertsList
 * ------------------
 * Lista de alertas de anomalia detectados pelo detector da Fase 5.
 */
import { AlertTriangle, ShieldAlert, TrendingDown, Cpu, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnomalyAlert } from "../../services/predictive.service";

const TYPE_ICONS = {
  hu_outlier:     Cpu,
  sprint_outlier: TrendingDown,
  ratio_drift:    AlertTriangle,
};

interface Props {
  alerts: AnomalyAlert[];
}

export function AnomalyAlertsList({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 px-4 py-3">
        <ShieldAlert className="h-4 w-4 text-emerald-600 shrink-0" />
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Nenhuma anomalia detectada no histórico atual. 👍
        </p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Alertas de Anomalia
          <Badge variant="outline" className="ml-auto text-[10px] border-amber-400 text-amber-600">
            {alerts.length} alerta{alerts.length !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((a, i) => {
          const Icon = TYPE_ICONS[a.type];
          return (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                a.severity === "critical"
                  ? "border-red-200 bg-red-50 dark:bg-red-900/10"
                  : "border-amber-200 bg-amber-50 dark:bg-amber-900/10"
              }`}
            >
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${
                a.severity === "critical" ? "text-red-500" : "text-amber-500"
              }`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold">{a.title}</p>
                  <Badge
                    variant="outline"
                    className={`text-[9px] h-4 px-1 ${
                      a.severity === "critical"
                        ? "border-red-400 text-red-600"
                        : "border-amber-400 text-amber-600"
                    }`}
                  >
                    {a.severity === "critical" ? "Crítico" : "Aviso"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{a.description}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
