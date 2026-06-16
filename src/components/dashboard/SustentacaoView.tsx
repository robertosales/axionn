// src/components/dashboard/SustentacaoView.tsx
// Cenário C — visão exclusiva de Sustentação.
// KPIs alimentados por useSLADashboard; tabela por DemandasPorTimeSection.

import { cn } from "@/lib/utils";
import {
  InboxIcon,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Wrench,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DemandasPorTimeSection } from "@/features/contracts/DemandasPorTimeSection";
import { useSLADashboard } from "@/features/contracts/hooks/useSLADashboard";

// ── Tipos de acento ──────────────────────────────────────────────────────
type CardAccent = "green" | "blue" | "red" | "amber" | "violet";

const ACCENT_TOP: Record<CardAccent, string> = {
  green:  "border-t-[3px] border-t-green-500",
  blue:   "border-t-[3px] border-t-blue-500",
  red:    "border-t-[3px] border-t-red-500",
  amber:  "border-t-[3px] border-t-amber-500",
  violet: "border-t-[3px] border-t-violet-500",
};

const ICON_CLASS: Record<CardAccent, string> = {
  green:  "bg-green-50  text-green-600  dark:bg-green-900/30  dark:text-green-400",
  blue:   "bg-blue-50   text-blue-600   dark:bg-blue-900/30   dark:text-blue-400",
  red:    "bg-red-50    text-red-600    dark:bg-red-900/30    dark:text-red-400",
  amber:  "bg-amber-50  text-amber-600  dark:bg-amber-900/30  dark:text-amber-500",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
};

// ── Skeleton shimmer ───────────────────────────────────────────────────
function KpiSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="h-[3px] w-full bg-muted" />
      <div className="px-5 pt-4 pb-4 flex flex-col gap-3">
        <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
        <div className="h-7 w-1/3 rounded bg-muted animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: CardAccent;
  statusBadge?: React.ReactNode;
}

function KpiCard({ label, value, sub, icon: Icon, accent, statusBadge }: KpiCardProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl border border-border shadow-sm overflow-hidden",
        "hover:-translate-y-0.5 hover:shadow-md transition-all duration-200",
        ACCENT_TOP[accent],
      )}
    >
      <div className="px-5 pt-4 pb-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            {label}
          </p>
          <div className={cn("shrink-0 rounded-lg p-2", ICON_CLASS[accent])}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        {statusBadge && <div className="mt-0.5">{statusBadge}</div>}
      </div>
    </div>
  );
}

function OkBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400">
      <CheckCircle2 className="h-3 w-3" />ok
    </span>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export function SustentacaoView() {
  const { currentTeamId } = useAuth();

  // Dados reais via fn_sla_dashboard_batch
  const { summary, loading, error, refetch } = useSLADashboard({
    teamId:  currentTeamId ?? null,
    enabled: !!currentTeamId,
  });

  // Deriva contadores a partir do SLASummary
  const abertas    = summary.total - summary.concluido;
  const concluidas = summary.concluido;
  const slaRisco   = summary.em_risco + summary.violado;
  const bloqueadas = summary.violado; // violado = passou do prazo = bloqueado operacionalmente

  return (
    <div className="flex flex-col gap-5 px-4 sm:px-6 py-6 w-full overflow-x-hidden">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Sustentação</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Métricas e demandas do módulo de sustentação
          </p>
        </div>

        {/* Botao de refresh */}
        <button
          onClick={() => refetch()}
          disabled={loading}
          aria-label="Atualizar métricas de sustentação"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Atualizar
        </button>
      </div>

      {/* Erro de carregamento */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          <>
            <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              label="Demandas Abertas"
              value={abertas}
              sub="em atendimento"
              icon={InboxIcon}
              accent="blue"
            />
            <KpiCard
              label="Concluídas"
              value={concluidas}
              sub={`${summary.compliance_pct.toFixed(0)}% compliance`}
              icon={CheckCircle2}
              accent="green"
              statusBadge={concluidas > 0 ? <OkBadge /> : undefined}
            />
            <KpiCard
              label="SLA em Risco"
              value={slaRisco}
              sub={slaRisco > 0 ? `${summary.em_risco} em risco · ${summary.violado} violados` : "todos no prazo"}
              icon={TrendingDown}
              accent="red"
              statusBadge={slaRisco === 0 ? <OkBadge /> : undefined}
            />
            <KpiCard
              label="SLAs Violados"
              value={bloqueadas}
              sub={bloqueadas > 0 ? "passou do prazo" : "sem violações"}
              icon={bloqueadas > 0 ? Ban : AlertTriangle}
              accent="amber"
              statusBadge={bloqueadas === 0 ? <OkBadge /> : undefined}
            />
          </>
        )}
      </div>

      {/* Tabela de demandas por time */}
      {currentTeamId ? (
        <DemandasPorTimeSection teamId={currentTeamId} />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Wrench className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">Selecione um time de Sustentação</p>
          <p className="text-xs">O time precisa estar ativo para carregar as demandas.</p>
        </div>
      )}
    </div>
  );
}
