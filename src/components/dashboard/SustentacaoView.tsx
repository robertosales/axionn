// src/components/dashboard/SustentacaoView.tsx
// Cenário C — visão exclusiva de Sustentação.
// Segue o mesmo padrão visual do DashboardHome (KpiCard, grid, border-t accent).
// Os dados vêm de DemandasPorTimeSection enquanto o hook useContratos
// ainda não está centralizado; substituir quando disponível.

import { cn } from "@/lib/utils";
import {
  InboxIcon,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Wrench,
  TrendingDown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DemandasPorTimeSection } from "@/features/contracts/DemandasPorTimeSection";

// ── Tipos de cor por card ─────────────────────────────────────────────────────
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

// ── KPI Card (inline — mantém consistência sem criar dep circular) ────────────
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

function GreenBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400">
      <CheckCircle2 className="h-3 w-3" />{text}
    </span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function SustentacaoView() {
  const { currentTeamId } = useAuth();

  // TODO: substituir pelos valores reais do hook useContratos quando disponível.
  // Por enquanto os KPIs são placeholders estruturais que seguem o contrato
  // visual do DashboardHome — serão alimentados na próxima iteração.
  const abertas    = 0;
  const concluidas = 0;
  const slaRisco   = 0;
  const bloqueadas = 0;

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
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
          sub="no período"
          icon={CheckCircle2}
          accent="green"
          statusBadge={concluidas === 0 ? undefined : <GreenBadge text="no prazo" />}
        />
        <KpiCard
          label="SLA em Risco"
          value={slaRisco}
          sub={slaRisco > 0 ? "requer ação imediata" : "todos no prazo"}
          icon={TrendingDown}
          accent="red"
          statusBadge={slaRisco === 0 ? <GreenBadge text="ok" /> : undefined}
        />
        <KpiCard
          label="Bloqueadas"
          value={bloqueadas}
          sub={bloqueadas > 0 ? "aguardando desbloqueio" : "sem bloqueios"}
          icon={bloqueadas > 0 ? Ban : AlertTriangle}
          accent="amber"
          statusBadge={bloqueadas === 0 ? <GreenBadge text="livre" /> : undefined}
        />
      </div>

      {/* Tabela de demandas por time — filtra apenas times de sustentação */}
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
