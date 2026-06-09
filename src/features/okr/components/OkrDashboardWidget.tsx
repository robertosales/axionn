// ─── OkrDashboardWidget ───────────────────────────────────────────────────────
// Widget resumo do OKR para a home (DashboardHome).
// Uso: <OkrDashboardWidget objectives={objectives} onNavigate={() => navigate('/okr')} />

import { useNavigate }        from "react-router-dom";
import { Target, TrendingUp, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { Button }             from "@/components/ui/button";
import { cn }                 from "@/lib/utils";
import type { OkrObjective, OkrStatus } from "../types";
import { useOkr }             from "../hooks/useOkr";

// ── helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<OkrStatus, { label: string; color: string; icon: React.ElementType }> = {
  on_track:  { label: "No caminho",  color: "text-emerald-500", icon: TrendingUp     },
  at_risk:   { label: "Em risco",    color: "text-amber-500",   icon: AlertTriangle  },
  off_track: { label: "Atrasado",    color: "text-red-500",     icon: AlertTriangle  },
  completed: { label: "Concluído",   color: "text-blue-500",    icon: CheckCircle2   },
};

function ProgressBar({ value, status }: { value: number; status: OkrStatus }) {
  const colorMap: Record<OkrStatus, string> = {
    on_track:  "bg-emerald-500",
    at_risk:   "bg-amber-500",
    off_track: "bg-red-500",
    completed: "bg-blue-500",
  };
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-500", colorMap[status])}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

function ObjectiveRow({ obj }: { obj: OkrObjective }) {
  const cfg  = STATUS_CONFIG[obj.status];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className={cn("shrink-0", cfg.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-[13px] font-medium truncate">{obj.title}</p>
        <ProgressBar value={obj.progress} status={obj.status} />
      </div>
      <div className="shrink-0 text-right">
        <span className="text-[12px] font-bold tabular-nums">{obj.progress}%</span>
        <p className={cn("text-[10px] leading-none mt-0.5", cfg.color)}>{cfg.label}</p>
      </div>
    </div>
  );
}

// ── Widget principal ─────────────────────────────────────────────────────────
export function OkrDashboardWidget() {
  const navigate = useNavigate();
  const { objectives, filters } = useOkr();

  // KPIs rápidos
  const total     = objectives.length;
  const onTrack   = objectives.filter((o) => o.status === "on_track").length;
  const atRisk    = objectives.filter((o) => o.status === "at_risk" || o.status === "off_track").length;
  const completed = objectives.filter((o) => o.status === "completed").length;
  const avgProgress = total > 0
    ? Math.round(objectives.reduce((s, o) => s + o.progress, 0) / total)
    : 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-semibold">OKR — {filters.cycle}</p>
            <p className="text-[10px] text-muted-foreground">{total} objetivo{total !== 1 ? "s" : ""} ativos</p>
          </div>
        </div>
        <Button
          variant="ghost" size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/okr")}
        >
          Ver tudo <ChevronRight className="h-3 w-3" />
        </Button>
      </div>

      {/* KPI Pills */}
      <div className="grid grid-cols-3 divide-x border-b">
        {[
          { label: "No caminho", value: onTrack,   color: "text-emerald-500" },
          { label: "Em risco",   value: atRisk,    color: "text-amber-500"   },
          { label: "Concluídos", value: completed, color: "text-blue-500"    },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col items-center py-2.5">
            <span className={cn("text-xl font-bold tabular-nums", color)}>{value}</span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</span>
          </div>
        ))}
      </div>

      {/* Lista de objetivos (top 3) */}
      <div className="px-4">
        {objectives.slice(0, 3).map((obj) => (
          <ObjectiveRow key={obj.id} obj={obj} />
        ))}
        {objectives.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Nenhum objetivo para {filters.cycle}
          </div>
        )}
      </div>

      {/* Rodapé: progresso médio */}
      {total > 0 && (
        <div className="px-4 py-2.5 bg-muted/30 border-t flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Progresso médio do ciclo</span>
          <span className="text-[13px] font-bold tabular-nums">{avgProgress}%</span>
        </div>
      )}
    </div>
  );
}
