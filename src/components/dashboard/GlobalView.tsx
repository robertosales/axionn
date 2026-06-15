// src/components/dashboard/GlobalView.tsx
// Cenário A — Visão Global consolidada (apenas isAdminContrato).
// Exibe KPIs unificados de Sala Ágil + Sustentação lado a lado.
// Segue o padrão visual do DashboardHome: KpiCard, border-t accent, grid.

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Zap,
  CheckCircle2,
  AlertTriangle,
  InboxIcon,
  TrendingDown,
  Users,
  Activity,
} from "lucide-react";
import { useSprint } from "@/contexts/SprintContext";
import { useAuth } from "@/contexts/AuthContext";

// ── Tipos de cor ──────────────────────────────────────────────────────────────
type CardAccent = "green" | "blue" | "red" | "amber" | "violet" | "cyan" | "indigo";

const ACCENT_TOP: Record<CardAccent, string> = {
  green:  "border-t-[3px] border-t-green-500",
  blue:   "border-t-[3px] border-t-blue-500",
  red:    "border-t-[3px] border-t-red-500",
  amber:  "border-t-[3px] border-t-amber-500",
  violet: "border-t-[3px] border-t-violet-500",
  cyan:   "border-t-[3px] border-t-cyan-500",
  indigo: "border-t-[3px] border-t-indigo-500",
};

const ICON_CLASS: Record<CardAccent, string> = {
  green:  "bg-green-50  text-green-600  dark:bg-green-900/30  dark:text-green-400",
  blue:   "bg-blue-50   text-blue-600   dark:bg-blue-900/30   dark:text-blue-400",
  red:    "bg-red-50    text-red-600    dark:bg-red-900/30    dark:text-red-400",
  amber:  "bg-amber-50  text-amber-600  dark:bg-amber-900/30  dark:text-amber-500",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  cyan:   "bg-cyan-50   text-cyan-600   dark:bg-cyan-900/30   dark:text-cyan-400",
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
};

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: CardAccent;
  badge?: React.ReactNode;
}

function KpiCard({ label, value, sub, icon: Icon, accent, badge }: KpiCardProps) {
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
        {badge && <div className="mt-0.5">{badge}</div>}
      </div>
    </div>
  );
}

// ── Separador de seção ────────────────────────────────────────────────────────
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-2">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function GlobalView() {
  const { userStories, activities, developers, activeSprint, sprints, workflowColumns } =
    useSprint();
  const { teams } = useAuth();

  // ── Métricas Ágil ─────────────────────────────────────────────────────────
  const sprintHUs   = activeSprint
    ? userStories.filter((h) => h.sprintId === activeSprint.id)
    : userStories;
  const DONE_KEYS   = ["done","concluido","concluída","finalizado","finalizada","entregue"];
  const doneColKey  = workflowColumns.find((c) => DONE_KEYS.includes(c.key.toLowerCase()))?.key
                    ?? workflowColumns[workflowColumns.length - 1]?.key;
  const doneHUs     = sprintHUs.filter((h) => h.status === doneColKey);
  const openHUs     = sprintHUs.filter((h) => h.status !== doneColKey);
  const blockedHUs  = sprintHUs.filter((h) => h.impediments?.some((i: any) => !i.resolvedAt));
  const openActs    = activities.filter((a) => !a.isClosed);

  // ── Métricas de times ─────────────────────────────────────────────────────
  const agilTeams   = teams.filter((t) => t.module === "sala_agil");
  const sustTeams   = teams.filter((t) => t.module === "sustentacao");
  const totalTeams  = teams.length;

  // ── Métricas Sustentação (placeholders — substituir por useContratos) ─────
  const demandasAbertas = 0;
  const slaRisco        = 0;

  return (
    <div className="flex flex-col gap-5 px-4 sm:px-6 py-6 w-full overflow-x-hidden">

      {/* Header */}
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground">Visão Global</h2>
        <span className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          consolidado
        </span>
      </div>

      {/* KPIs consolidados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Times Ativos"
          value={totalTeams}
          sub={`${agilTeams.length} ágil · ${sustTeams.length} sustentação`}
          icon={Users}
          accent="indigo"
        />
        <KpiCard
          label="HUs Ativas (Ágil)"
          value={openHUs.length}
          sub={`${doneHUs.length} concluídas no sprint`}
          icon={Zap}
          accent="violet"
        />
        <KpiCard
          label="Demandas Abertas"
          value={demandasAbertas}
          sub="sustentação"
          icon={InboxIcon}
          accent="blue"
        />
        <KpiCard
          label="SLAs em Risco"
          value={slaRisco}
          sub={slaRisco > 0 ? "ação imediata" : "todos no prazo"}
          icon={slaRisco > 0 ? TrendingDown : CheckCircle2}
          accent={slaRisco > 0 ? "red" : "green"}
          badge={
            slaRisco === 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" />ok
              </span>
            ) : undefined
          }
        />
      </div>

      {/* Bloco Sala Ágil */}
      <SectionDivider label="Sala Ágil" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="HUs Concluídas"
          value={`${doneHUs.length}/${sprintHUs.length}`}
          sub="sprint ativo"
          icon={CheckCircle2}
          accent="green"
        />
        <KpiCard
          label="Em Andamento"
          value={openHUs.length}
          sub={`${openActs.length} atividades abertas`}
          icon={Activity}
          accent="blue"
        />
        <KpiCard
          label="Impedimentos"
          value={blockedHUs.length}
          sub={blockedHUs.length > 0 ? "HUs bloqueadas" : "sem bloqueios"}
          icon={AlertTriangle}
          accent="amber"
        />
        <KpiCard
          label="Sprints Totais"
          value={sprints.length}
          sub={`${developers.length} devs ativos`}
          icon={Users}
          accent="cyan"
        />
      </div>

      {/* Bloco Sustentação */}
      <SectionDivider label="Sustentação" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Demandas Abertas"
          value={demandasAbertas}
          sub="em atendimento"
          icon={InboxIcon}
          accent="blue"
        />
        <KpiCard
          label="Times Sustentação"
          value={sustTeams.length}
          sub="times ativos"
          icon={Users}
          accent="indigo"
        />
        <KpiCard
          label="SLA em Risco"
          value={slaRisco}
          sub={slaRisco > 0 ? "requer ação" : "todos ok"}
          icon={TrendingDown}
          accent={slaRisco > 0 ? "red" : "green"}
        />
        <KpiCard
          label="Bloqueadas"
          value={0}
          sub="aguardando"
          icon={AlertTriangle}
          accent="amber"
        />
      </div>
    </div>
  );
}
