import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type TeamKind = "sala-agil" | "sustentacao" | string;

interface TeamSummaryItem {
  teamId: string;
  teamName: string;
  module: TeamKind;
  // Sala Ágil
  husAtivas?: number;
  impedimentos?: number;
  backlog?: number;
  // Sustentação / RDM
  demandasAbertas?: number;
  slaEmRisco?: number;
  bloqueadas?: number;
  sprintAtivo?: string | null;
}

interface TeamSummaryCardsProps {
  teams: TeamSummaryItem[];
  loading: boolean;
  onTeamClick?: (teamId: string) => void;
}

const MODULE_COLORS: Record<string, { badge: string; dot: string }> = {
  "sala-agil":  { badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",  dot: "bg-blue-500" },
  sustentacao:  { badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",  dot: "bg-teal-500" },
  rdm:          { badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", dot: "bg-purple-500" },
};

function getModuleColor(module: string) {
  return MODULE_COLORS[module] ?? { badge: "bg-muted text-muted-foreground", dot: "bg-gray-400" };
}

function getModuleLabel(module: string) {
  if (module === "sala-agil")  return "Sala Ágil";
  if (module === "sustentacao") return "Sustentação";
  if (module === "rdm")        return "RDM";
  return module;
}

function TeamCard({ t, onClick }: { t: TeamSummaryItem; onClick?: () => void }) {
  const isSalaAgil = t.module === "sala-agil";
  const colors = getModuleColor(t.module);

  return (
    <div
      className="min-w-[220px] max-w-[260px] rounded-xl border bg-card shadow-sm p-4 flex flex-col gap-3 shrink-0 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      aria-label={`Ver detalhes do time ${t.teamName}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold leading-tight">{t.teamName}</p>
          {t.sprintAtivo && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{t.sprintAtivo}</p>
          )}
        </div>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${colors.badge}`}>
          {getModuleLabel(t.module)}
        </span>
      </div>

      {/* Metrics */}
      <div className="space-y-1.5">
        {isSalaAgil ? (
          <>
            <Metric label="HUs Ativas"  value={t.husAtivas  ?? 0} />
            <Metric label="Impedimentos" value={t.impedimentos ?? 0} danger={(t.impedimentos ?? 0) > 0} />
            <Metric label="Backlog"     value={t.backlog    ?? 0} />
          </>
        ) : (
          <>
            <Metric label="Demandas Abertas" value={t.demandasAbertas ?? 0} />
            <Metric label="SLA em Risco"     value={t.slaEmRisco     ?? 0} danger={(t.slaEmRisco ?? 0) > 0} />
            <Metric label="Bloqueadas"       value={t.bloqueadas     ?? 0} warn={(t.bloqueadas ?? 0) > 0} />
          </>
        )}
      </div>

      {/* Footer link */}
      <div className="flex items-center gap-1 text-[11px] font-medium mt-auto pt-1 border-t">
        <span className="text-primary">Ver detalhes</span>
        <ChevronRight className="h-3 w-3 text-primary" />
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
    ? "text-red-600 dark:text-red-400 font-semibold"
    : warn
    ? "text-orange-500 dark:text-orange-400 font-semibold"
    : "font-medium";

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

export function TeamSummaryCards({ teams, loading, onTeamClick }: TeamSummaryCardsProps) {
  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="min-w-[220px] max-w-[260px] rounded-xl border bg-card shadow-sm p-4 flex flex-col gap-3 shrink-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
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
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Nenhum time encontrado para os filtros selecionados.
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin snap-x snap-mandatory">
      {teams.map((t) => (
        <div key={t.teamId} className="snap-start">
          <TeamCard t={t} onClick={() => onTeamClick?.(t.teamId)} />
        </div>
      ))}
    </div>
  );
}
