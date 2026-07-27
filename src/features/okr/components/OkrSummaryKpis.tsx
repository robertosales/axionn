import { TrendingUp, AlertTriangle, CheckCircle, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OkrObjective } from "../types";

interface Props { objectives: OkrObjective[]; activeFilter?: string; onFilterChange?: (filter: string) => void; }

export function OkrSummaryKpis({ objectives, activeFilter = "all", onFilterChange }: Props) {
  const measured = objectives.filter((objective) => objective.calculated_progress != null);
  const average = measured.length ? Math.round(measured.reduce((sum, objective) => sum + objective.calculated_progress!, 0) / measured.length) : null;
  const kpis = [
    { label: "Objetivos", value: objectives.length, sub: "no ciclo", filter: "all", color: "text-foreground", bg: "bg-muted/50", icon: <Target className="h-4 w-4" /> },
    { label: "No prazo", value: objectives.filter((objective) => (objective.calculated_health ?? objective.status) === "on_track").length, sub: "saudáveis", filter: "on_track", color: "text-emerald-600", bg: "bg-emerald-500/10", icon: <TrendingUp className="h-4 w-4" /> },
    { label: "Em risco", value: objectives.filter((objective) => ["attention", "at_risk", "off_track"].includes(objective.calculated_health ?? objective.status)).length, sub: "atenção necessária", filter: "at_risk", color: "text-amber-600", bg: "bg-amber-400/10", icon: <AlertTriangle className="h-4 w-4" /> },
    { label: "Concluídos", value: objectives.filter((objective) => objective.lifecycle_status === "completed" || objective.status === "completed").length, sub: "finalizados", filter: "completed", color: "text-blue-600", bg: "bg-blue-500/10", icon: <CheckCircle className="h-4 w-4" /> },
    { label: "Progresso", value: average == null ? "Sem dados" : `${average}%`, sub: "média dos objetivos medidos", filter: "measured", color: "text-primary", bg: "bg-primary/10", icon: <Zap className="h-4 w-4" /> },
  ];
  return <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">{kpis.map((kpi) => <button key={kpi.label} type="button" onClick={() => onFilterChange?.(kpi.filter)} className={cn("rounded-xl border bg-card p-4 flex flex-col gap-1 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md", kpi.bg, activeFilter === kpi.filter && "ring-2 ring-primary")}><div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{kpi.label}</span>{kpi.icon}</div><span className={cn("text-2xl font-bold", kpi.color)}>{kpi.value}</span><span className="text-[11px] text-muted-foreground">{kpi.sub}</span></button>)}</div>;
}
