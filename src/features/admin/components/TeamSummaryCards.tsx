import { Shield, Zap, ChevronRight, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface TeamCardProps {
  t: {
    teamId: string;
    teamName: string;
    module: string;
    husAtivas: number;
    impedimentos: number;
    backlog: number;
    demandasAbertas: number;
    slaEmRisco: number;
    bloqueadas: number;
    sprintAtivo: string | null;
  };
  onClick?: () => void;
}

interface TeamSummaryCardsProps {
  teams: TeamCardProps["t"][];
  loading: boolean;
  onTeamClick?: (teamId: string) => void;
}

function TeamCard({ t, onClick }: TeamCardProps) {
  const isAgil = t.module === "sala-agil";

  return (
    <div
      onClick={onClick}
      className="min-w-[240px] max-w-[280px] rounded-xl bg-card p-5 shadow-sm border border-border/50 hover:border-primary/50 transition-all cursor-pointer group shrink-0"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isAgil ? "bg-primary/10 text-primary" : "bg-blue-50 text-blue-600 dark:bg-blue-950/40"}`}>
            {isAgil ? <Zap className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate group-hover:text-primary transition-colors">{t.teamName}</h3>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              {isAgil ? "Sala Ágil" : "Sustentação"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {isAgil ? (
          <>
            <Metric label="HUs Ativas" value={t.husAtivas} />
            <Metric label="Impedimentos" value={t.impedimentos} danger={t.impedimentos > 0} />
            <Metric label="Backlog" value={t.backlog} />
          </>
        ) : (
          <>
            <Metric label="Demandas Abertas" value={t.demandasAbertas} />
            <Metric label="SLA em Risco" value={t.slaEmRisco} danger={t.slaEmRisco > 0} />
            <Metric label="Bloqueadas" value={t.bloqueadas} warn={t.bloqueadas > 0} />
          </>
        )}
      </div>

      <div className="pt-3 border-t border-border/50 flex items-center justify-between">
        <span className="text-[10px] text-primary font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
          Ver detalhes
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  danger = false,
  warn = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
  warn?: boolean;
}) {
  const valueClass = danger
    ? "text-destructive font-bold"
    : warn
    ? "text-orange-500 font-bold"
    : "font-semibold text-foreground";

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-xs tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

export function TeamSummaryCards({ teams, loading, onTeamClick }: TeamSummaryCardsProps) {
  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="min-w-[240px] rounded-xl bg-card p-5 shadow-sm border border-border/50 shrink-0 space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3 bg-muted/5 rounded-xl border border-dashed">
        <AlertTriangle className="h-8 w-8 opacity-20" />
        <p className="text-sm">Nenhum time encontrado para os filtros selecionados.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
      {teams.map((t) => (
        <div key={t.teamId} className="snap-start">
          <TeamCard t={t} onClick={() => onTeamClick?.(t.teamId)} />
        </div>
      ))}
    </div>
  );
}
