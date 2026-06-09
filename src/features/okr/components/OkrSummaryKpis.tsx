// ─── OkrSummaryKpis ──────────────────────────────────────────────────────────
// Faixa de KPIs no topo da página OKR

import { TrendingUp, AlertTriangle, CheckCircle, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OkrObjective } from "../types";

interface Props {
  objectives: OkrObjective[];
}

export function OkrSummaryKpis({ objectives }: Props) {
  const total     = objectives.length;
  const onTrack   = objectives.filter((o) => o.status === "on_track").length;
  const atRisk    = objectives.filter((o) => o.status === "at_risk" || o.status === "off_track").length;
  const completed = objectives.filter((o) => o.status === "completed").length;
  const avgProg   = total > 0
    ? Math.round(objectives.reduce((s, o) => s + o.progress, 0) / total)
    : 0;

  const kpis = [
    {
      label:  "Objetivos",
      value:  total,
      sub:    "no ciclo",
      color:  "text-foreground",
      bg:     "bg-muted/50",
      icon:   <Target className="h-4 w-4 text-muted-foreground" />,
    },
    {
      label:  "No Prazo",
      value:  onTrack,
      sub:    "saudáveis",
      color:  "text-emerald-600",
      bg:     "bg-emerald-500/10",
      icon:   <TrendingUp className="h-4 w-4 text-emerald-600" />,
    },
    {
      label:  "Em Risco",
      value:  atRisk,
      sub:    "atenção necessária",
      color:  "text-amber-600",
      bg:     "bg-amber-400/10",
      icon:   <AlertTriangle className="h-4 w-4 text-amber-600" />,
    },
    {
      label:  "Concluídos",
      value:  completed,
      sub:    "finalizados",
      color:  "text-blue-600",
      bg:     "bg-blue-500/10",
      icon:   <CheckCircle className="h-4 w-4 text-blue-600" />,
    },
    {
      label:  "Progresso",
      value:  `${avgProg}%`,
      sub:    "média geral do ciclo",
      color:  "text-primary",
      bg:     "bg-primary/10",
      icon:   <Zap className="h-4 w-4 text-primary" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {kpis.map((k) => (
        <div
          key={k.label}
          className={cn("rounded-xl border bg-card p-4 flex flex-col gap-1 shadow-sm", k.bg)}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
              {k.label}
            </span>
            {k.icon}
          </div>
          <span className={cn("text-2xl font-bold", k.color)}>{k.value}</span>
          <span className="text-[11px] text-muted-foreground">{k.sub}</span>
        </div>
      ))}
    </div>
  );
}
