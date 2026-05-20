import { Badge } from "@/components/ui/badge";
import { CalendarDays, CheckCircle2, Clock4, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SprintHeaderProps {
  sprintName: string;
  sprintStart: string;
  sprintEnd: string;
  isActive?: boolean;
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function SprintHeader({
  sprintName,
  sprintStart,
  sprintEnd,
  isActive,
  lastUpdated,
  onRefresh,
  refreshing,
}: SprintHeaderProps) {
  const now = new Date();
  const start = sprintStart ? new Date(sprintStart) : null;
  const end = sprintEnd ? new Date(sprintEnd) : null;

  const totalDays = start && end ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000)) : 0;
  const elapsedDays = start ? Math.max(0, Math.ceil((now.getTime() - start.getTime()) / 86400000)) : 0;
  const remainingDays = end ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000)) : 0;
  const progressPct = totalDays > 0 ? Math.min(100, Math.round((elapsedDays / totalDays) * 100)) : 0;

  const fmt = (d: string) =>
    d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";

  const updatedLabel = lastUpdated
    ? (() => {
        const diffSec = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
        if (diffSec < 60) return `${diffSec}s atrás`;
        if (diffSec < 3600) return `${Math.floor(diffSec / 60)}min atrás`;
        return lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      })()
    : null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card px-5 py-4 space-y-3">
      {/* Linha principal */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarDays className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Sprint ativa</p>
            <h2 className="text-base font-bold text-foreground truncate">{sprintName || "Sem sprint selecionada"}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {sprintStart && sprintEnd && (
            <Badge variant="outline" className="text-xs font-mono gap-1 px-2.5 py-1">
              <Clock4 className="h-3 w-3" />
              {fmt(sprintStart)} → {fmt(sprintEnd)}
            </Badge>
          )}

          {isActive !== undefined && (
            <Badge
              className={cn(
                "text-xs gap-1 px-2.5 py-1",
                isActive
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-muted text-muted-foreground",
              )}
              variant="outline"
            >
              {isActive ? (
                <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ativa</>
              ) : (
                <><CheckCircle2 className="h-3 w-3" /> Encerrada</>
              )}
            </Badge>
          )}

          {updatedLabel && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
              {refreshing ? "Atualizando…" : `Atualizado ${updatedLabel}`}
            </button>
          )}
        </div>
      </div>

      {/* Barra de progresso temporal */}
      {totalDays > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{elapsedDays}d decorridos</span>
            <span
              className={cn(
                "font-medium",
                remainingDays === 0
                  ? "text-destructive"
                  : remainingDays <= 2
                    ? "text-[#eab308]"
                    : "text-foreground",
              )}
            >
              {remainingDays === 0 ? "Último dia!" : `${remainingDays}d restantes`}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                progressPct >= 90
                  ? "bg-destructive"
                  : progressPct >= 70
                    ? "bg-[#eab308]"
                    : "bg-primary",
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
