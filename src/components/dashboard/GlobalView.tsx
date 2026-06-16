// src/components/dashboard/GlobalView.tsx
// Cenário A — Visão Global consolidada (apenas isAdminContrato).
// KPIs Ágil: useSprint. KPIs Sustentação: useSLADashboard (sem teamId = todos os times).

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
  Ban,
  RefreshCw,
} from "lucide-react";
import { useSprint } from "@/contexts/SprintContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSLADashboard } from "@/features/contracts/hooks/useSLADashboard";
import { useContracts } from "@/features/contracts/hooks/useContracts";

// ── Tipos de acento ─────────────────────────────────────────────────────────────
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

function OkBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400">
      <CheckCircle2 className="h-3 w-3" />ok
    </span>
  );
}

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
  const { teams, moduleRoles } = useAuth();

  // Determina se o usuário tem acesso a sustentação para habilitar a query
  const hasSustentacao = moduleRoles.some((r) => r.module === "sustentacao");

  // ── Dados SLA (todos os times — sem filtro de team = consolidado) ───────────
  // Nota: fn_sla_dashboard_batch sem teamId retorna o consolidado do contrato.
  // Passamos o primeiro contractId disponível para não exigir teamId.
  const { contracts } = useContracts();
  const firstContractId = contracts[0]?.id ?? null;

  const {
    summary: slaSummary,
    loading: slaLoading,
    refetch: slaRefetch,
  } = useSLADashboard({
    contractId: firstContractId,
    enabled:    hasSustentacao && !!firstContractId,
  });

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
  const agilTeams  = teams.filter((t: any) => t.module === "sala_agil");
  const sustTeams  = teams.filter((t: any) => t.module === "sustentacao");

  // ── Métricas Sustentação (dados reais) ──────────────────────────────────
  const demandasAbertas = slaSummary.total - slaSummary.concluido;
  const slaRiscoTotal   = slaSummary.em_risco + slaSummary.violado;
  const compliance      = slaSummary.compliance_pct;

  return (
    <div className="flex flex-col gap-5 px-4 sm:px-6 py-6 w-full overflow-x-hidden">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Visão Global</h2>
          <span className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            consolidado
          </span>
        </div>
        {hasSustentacao && (
          <button
            onClick={() => slaRefetch()}
            disabled={slaLoading}
            aria-label="Atualizar dados de SLA"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", slaLoading && "animate-spin")} />
            Atualizar SLA
          </button>
        )}
      </div>

      {/* KPIs consolidados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Times Ativos"
          value={teams.length}
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
        {slaLoading ? <KpiSkeleton /> : (
          <KpiCard
            label="Demandas Abertas"
            value={demandasAbertas}
            sub="sustentação"
            icon={InboxIcon}
            accent="blue"
          />
        )}
        {slaLoading ? <KpiSkeleton /> : (
          <KpiCard
            label="SLAs em Risco"
            value={slaRiscoTotal}
            sub={slaRiscoTotal > 0 ? `${compliance.toFixed(0)}% compliance` : "todos no prazo"}
            icon={slaRiscoTotal > 0 ? TrendingDown : CheckCircle2}
            accent={slaRiscoTotal > 0 ? "red" : "green"}
            badge={slaRiscoTotal === 0 ? <OkBadge /> : undefined}
          />
        )}
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
          badge={blockedHUs.length === 0 ? <OkBadge /> : undefined}
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
      {slaLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Demandas Abertas"
            value={demandasAbertas}
            sub="em atendimento"
            icon={InboxIcon}
            accent="blue"
          />
          <KpiCard
            label="Concluídas"
            value={slaSummary.concluido}
            sub={`${compliance.toFixed(0)}% compliance`}
            icon={CheckCircle2}
            accent="green"
            badge={slaSummary.concluido > 0 ? <OkBadge /> : undefined}
          />
          <KpiCard
            label="Em Risco"
            value={slaSummary.em_risco}
            sub={slaSummary.em_risco > 0 ? "próximo do prazo" : "dentro do SLA"}
            icon={TrendingDown}
            accent={slaSummary.em_risco > 0 ? "amber" : "green"}
          />
          <KpiCard
            label="SLAs Violados"
            value={slaSummary.violado}
            sub={slaSummary.violado > 0 ? "passou do prazo" : "sem violações"}
            icon={slaSummary.violado > 0 ? Ban : CheckCircle2}
            accent={slaSummary.violado > 0 ? "red" : "green"}
            badge={slaSummary.violado === 0 ? <OkBadge /> : undefined}
          />
        </div>
      )}
    </div>
  );
}
