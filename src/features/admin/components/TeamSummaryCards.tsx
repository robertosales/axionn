import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Shield,
  Zap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 6;

interface TeamRow {
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
}

interface TeamSummaryCardsProps {
  teams: TeamRow[];
  loading: boolean;
  onTeamClick?: (teamId: string) => void;
}

function MetricValue({ value, danger = false }: { value: number; danger?: boolean }) {
  if (danger && value > 0) {
    return (
      <Badge
        variant="destructive"
        className="h-6 min-w-7 justify-center rounded-full px-2 text-[10px] font-bold tabular-nums"
      >
        {value}
      </Badge>
    );
  }

  return (
    <span className="text-xs font-semibold tabular-nums text-foreground">
      {value}
    </span>
  );
}

export function TeamSummaryCards({
  teams,
  loading,
  onTeamClick,
}: TeamSummaryCardsProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(teams.length / PAGE_SIZE));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages - 1));
  }, [totalPages]);

  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, teams.length);
  const visible = teams.slice(start, end);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        {Array.from({ length: PAGE_SIZE }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 border-b border-border/50 px-5 py-3.5 last:border-0">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="ml-auto h-4 w-8" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 py-12 text-muted-foreground">
        <AlertTriangle className="h-6 w-6 opacity-30" />
        <p className="text-sm">Nenhum time encontrado para os filtros selecionados.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[minmax(280px,1fr)_72px_72px_92px_72px_36px] items-center gap-x-4 border-b border-border/60 bg-muted/30 px-5 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Time
            </span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              HUs
            </span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Imped.
            </span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Demandas
            </span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              SLA
            </span>
            <span className="sr-only">Detalhes</span>
          </div>

          <div className="divide-y divide-border/50">
            {visible.map((team) => {
              const isAgil = team.module === "sala-agil";

              return (
                <button
                  key={team.teamId}
                  type="button"
                  className="group grid w-full grid-cols-[minmax(280px,1fr)_72px_72px_92px_72px_36px] items-center gap-x-4 px-5 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => onTeamClick?.(team.teamId)}
                  title={`Ver detalhes de ${team.teamName}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        isAgil
                          ? "bg-teal-500/10 text-teal-600"
                          : "bg-blue-500/10 text-blue-600"
                      }`}
                    >
                      {isAgil ? <Zap className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
                        {team.teamName}
                      </p>
                      <p className={`mt-0.5 text-[10px] font-medium ${isAgil ? "text-teal-600" : "text-blue-600"}`}>
                        {isAgil ? "Sala Ágil" : "Sustentação"}
                      </p>
                    </div>
                  </div>

                  <span className="text-right">
                    {isAgil ? <MetricValue value={team.husAtivas} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </span>
                  <span className="text-right">
                    {isAgil ? (
                      <MetricValue value={team.impedimentos} danger={team.impedimentos > 0} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </span>
                  <span className="text-right">
                    {!isAgil ? <MetricValue value={team.demandasAbertas} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </span>
                  <span className="text-right">
                    {!isAgil ? (
                      <MetricValue value={team.slaEmRisco} danger={team.slaEmRisco > 0} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </span>
                  <span className="flex justify-end">
                    <ChevronRight className="h-4 w-4 text-muted-foreground/35 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 bg-muted/15 px-5 py-2.5">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {start + 1}–{end} de {teams.length} times
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-12 rounded-md border border-border/70 bg-background px-2 py-1 text-center text-[11px] text-muted-foreground tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((current) => current + 1)}
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
