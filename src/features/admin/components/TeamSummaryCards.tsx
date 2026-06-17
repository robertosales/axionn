import { useState } from "react";
import { Shield, Zap, AlertTriangle, ChevronRight, ChevronLeft } from "lucide-react";
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

function MetricPill({
  value,
  danger = false,
}: {
  value: number;
  danger?: boolean;
}) {
  if (danger && value > 0)
    return (
      <Badge
        variant="destructive"
        className="text-[10px] h-5 px-1.5 font-semibold tabular-nums"
      >
        {value}
      </Badge>
    );
  return (
    <span className="text-[11px] tabular-nums text-foreground font-medium">
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

  const totalPages = Math.ceil(teams.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, teams.length);
  const visible = teams.slice(start, end);

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card shadow-sm divide-y divide-border/40">
        {Array.from({ length: PAGE_SIZE }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16 ml-auto" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2 bg-muted/5 rounded-xl border border-dashed">
        <AlertTriangle className="h-6 w-6 opacity-20" />
        <p className="text-xs">
          Nenhum time encontrado para os filtros selecionados.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">

      {/* Cabeçalho da tabela */}
      <div className="grid grid-cols-[1fr_48px_48px_72px_48px_32px] gap-x-3 px-4 py-2 border-b border-border/40 bg-muted/20">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Time
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
          HUs
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
          Imped.
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
          Demandas
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
          SLA
        </span>
        {/* Coluna indicadora de drill-down */}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right sr-only">
          Detalhe
        </span>
      </div>

      {/* Linhas */}
      <div className="divide-y divide-border/40">
        {visible.map((t) => {
          const isAgil = t.module === "sala-agil";
          return (
            <button
              key={t.teamId}
              className="w-full grid grid-cols-[1fr_48px_48px_72px_48px_32px] gap-x-3 px-4 py-3 items-center hover:bg-muted/30 active:bg-muted/50 transition-colors text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => onTeamClick?.(t.teamId)}
              title={`Ver detalhes de ${t.teamName}`}
            >
              {/* Nome + módulo */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="shrink-0 p-1.5 rounded-md bg-muted/50 text-muted-foreground group-hover:bg-muted transition-colors">
                  {isAgil ? (
                    <Zap className="h-3.5 w-3.5" />
                  ) : (
                    <Shield className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate group-hover:text-primary transition-colors">
                    {t.teamName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isAgil ? "Sala Ágil" : "Sustentação"}
                  </p>
                </div>
              </div>

              {/* HUs ativas */}
              <span className="text-right">
                {isAgil ? (
                  <MetricPill value={t.husAtivas} />
                ) : (
                  <span className="text-[11px] text-muted-foreground">—</span>
                )}
              </span>

              {/* Impedimentos */}
              <span className="text-right">
                {isAgil ? (
                  <MetricPill value={t.impedimentos} danger={t.impedimentos > 0} />
                ) : (
                  <span className="text-[11px] text-muted-foreground">—</span>
                )}
              </span>

              {/* Demandas abertas */}
              <span className="text-right">
                {!isAgil ? (
                  <MetricPill value={t.demandasAbertas} />
                ) : (
                  <span className="text-[11px] text-muted-foreground">—</span>
                )}
              </span>

              {/* SLA em risco */}
              <span className="text-right">
                {!isAgil ? (
                  <MetricPill value={t.slaEmRisco} danger={t.slaEmRisco > 0} />
                ) : (
                  <span className="text-[11px] text-muted-foreground">—</span>
                )}
              </span>

              {/* Seta de drill-down — sinaliza que a linha é clicavel */}
              <span className="flex justify-end">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer de paginação — exibido apenas quando há mais de uma página */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/40 bg-muted/10">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {start + 1}–{end} de {teams.length} times
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[11px] text-muted-foreground tabular-nums px-1">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Próxima página"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
