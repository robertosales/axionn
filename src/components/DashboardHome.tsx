// src/components/DashboardHome.tsx
import { useSprint } from "@/contexts/SprintContext";
import { getInitials, formatPersonName } from "@/lib/personName";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Zap,
  BookOpen,
  Bug,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle2,
  Users,
  Calendar,
  Target,
  Activity,
  UserPlus,
} from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── KPI Card ──────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconClass?: string;
  accentClass?: string;
  progress?: number;
  progressClass?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
}

function KpiCard({
  label, value, sub, icon: Icon, iconClass, accentClass,
  progress, progressClass, trend, trendLabel,
}: KpiCardProps) {
  return (
    <div className={cn(
      "bg-card rounded-xl border border-border shadow-sm px-5 py-4 flex flex-col gap-3",
      "hover:shadow-md transition-shadow",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest truncate">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums leading-none truncate text-foreground">{value}</p>
          {sub && <p className="mt-1.5 text-xs text-muted-foreground truncate">{sub}</p>}
          {trendLabel && (
            <p className={cn(
              "mt-1 text-xs font-semibold truncate",
              trend === "up"      && "text-success",
              trend === "down"    && "text-destructive",
              trend === "neutral" && "text-muted-foreground",
            )}>
              {trendLabel}
            </p>
          )}
        </div>
        <div className={cn(
          "shrink-0 rounded-lg p-2.5",
          iconClass || "bg-primary/10 text-primary",
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {progress !== undefined && (
        <div>
          <Progress value={progress} className={cn("h-1.5", progressClass)} />
        </div>
      )}
      {accentClass && (
        <div className={cn("h-0.5 rounded-full -mx-5 -mb-4", accentClass)} />
      )}
    </div>
  );
}

// ── Sprint Progress Banner ─────────────────────────────────────────────────────
function SprintProgressBar({
  sprint,
}: {
  sprint: {
    name: string;
    goal?: string | null;
    startDate: string;
    endDate: string;
    isActive: boolean;
    closedAt?: string | null;
    delayDays?: number | null;
  };
}) {
  const today     = new Date();
  const start     = parseISO(sprint.startDate);
  const end       = parseISO(sprint.endDate);
  const total     = differenceInDays(end, start) || 1;
  const elapsed   = Math.max(0, Math.min(total, differenceInDays(today, start)));
  const pct       = Math.round((elapsed / total) * 100);
  const daysLeft  = Math.max(0, differenceInDays(end, today));

  const isClosed  = !sprint.isActive;
  const isOverdue = sprint.isActive && today > end;

  const badgeLabel = isClosed
    ? "Encerrada"
    : isOverdue
      ? `+${differenceInDays(today, end)}d atraso`
      : `${daysLeft}d restantes`;

  const badgeVariant: "destructive" | "secondary" | "outline" = isClosed
    ? "secondary"
    : isOverdue
      ? "destructive"
      : "secondary";

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm px-5 py-4 overflow-hidden">
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <Target className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold truncate flex-1 min-w-0 text-foreground">
          {sprint.name}
        </span>
        <Badge variant={badgeVariant} className="text-xs shrink-0 whitespace-nowrap">
          {badgeLabel}
        </Badge>
      </div>
      <div className="flex items-center justify-between gap-x-4 gap-y-1 flex-wrap mt-1.5">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {format(start, "dd MMM", { locale: ptBR })} → {format(end, "dd MMM yyyy", { locale: ptBR })}
        </span>
        <span className="text-xs font-bold text-primary tabular-nums whitespace-nowrap">
          {pct}%
        </span>
      </div>
      {sprint.goal && (
        <p className="text-xs text-muted-foreground mt-2 mb-2 italic line-clamp-2">"{sprint.goal}"</p>
      )}
      <Progress value={pct} className="h-2 mt-2" />
      <p className="mt-2 text-xs text-muted-foreground">
        {isClosed
          ? `Encerrada em ${sprint.closedAt ? format(parseISO(sprint.closedAt), "dd/MM/yyyy") : format(end, "dd/MM/yyyy")}`
          : `Dia ${elapsed} de ${total} — sprint ${pct >= 100 ? "no prazo final" : "em andamento"}`
        }
      </p>
    </div>
  );
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-400",
  medium:   "bg-yellow-400",
  low:      "bg-green-400",
};

const DONE_KEYS = ["done", "concluido", "concluída", "finalizado", "finalizada", "entregue"];

function resolveDoneKey(columns: { key: string }[]): string | undefined {
  const byName = columns.find((c) => DONE_KEYS.includes(c.key.toLowerCase()));
  return byName?.key ?? columns[columns.length - 1]?.key;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function DashboardHome() {
  const { userStories, activities, developers, activeSprint, sprints, workflowColumns } = useSprint();
  const { profile } = useAuth();

  const sprintHUs    = activeSprint
    ? userStories.filter((h) => h.sprintId === activeSprint.id)
    : userStories;

  const doneColKey   = resolveDoneKey(workflowColumns);
  const doneHUs      = sprintHUs.filter((h) => h.status === doneColKey);
  const openHUs      = [...sprintHUs.filter((h) => h.status !== doneColKey)].sort((a, b) => {
    const posA = workflowColumns.findIndex((c) => c.key === a.status);
    const posB = workflowColumns.findIndex((c) => c.key === b.status);
    return (posB === -1 ? -Infinity : posB) - (posA === -1 ? -Infinity : posA);
  });
  const bugHUs       = sprintHUs.filter((h) => h.status === "bug");
  const blockedHUs   = sprintHUs.filter((h) => h.impediments?.some((i: any) => !i.resolvedAt));
  const totalPoints  = sprintHUs.reduce((s, h) => s + (h.storyPoints || 0), 0);
  const donePoints   = doneHUs.reduce((s, h) => s + (h.storyPoints || 0), 0);
  const completionPct = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
  const openActs     = activities.filter((a) => !a.isClosed);
  const totalHours   = activities.reduce((s, a) => s + (a.hours || 0), 0);
  const recentHUs    = openHUs.slice(0, 5);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const displayName = profile?.display_name || profile?.full_name || profile?.email?.split("@")[0] || "Dev";
  const firstName   = displayName.split(" ")[0];

  return (
    <div className="flex flex-col gap-5 px-4 sm:px-6 py-6 w-full overflow-x-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">
            {greeting()}, <span className="text-primary">{firstName}</span> 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            {activeSprint
              ? `Sprint ativa: ${activeSprint.name}`
              : "Nenhuma sprint ativa — crie uma na aba Sprints"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </div>
      </div>

      {/* ── Sprint Progress ──────────────────────────────────────────────────── */}
      {activeSprint && (
        <SprintProgressBar sprint={activeSprint as any} />
      )}

      {/* ── KPI Grid principal ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="HUs Concluídas"
          value={`${doneHUs.length}/${sprintHUs.length}`}
          sub={`${donePoints} de ${totalPoints} pts`}
          icon={CheckCircle2}
          iconClass="bg-success/10 text-success"
          accentClass="bg-success"
          progress={completionPct}
          progressClass="[&>div]:bg-success"
          trend="up"
          trendLabel={`${completionPct}% concluído`}
        />
        <KpiCard
          label="Em Andamento"
          value={openHUs.length}
          sub={`${openActs.length} atividades abertas`}
          icon={Activity}
          iconClass="bg-primary/10 text-primary"
          accentClass="bg-primary"
          trend="neutral"
        />
        <KpiCard
          label="Bugs Abertos"
          value={bugHUs.length}
          sub={bugHUs.length > 0 ? "requer atenção" : "sem bugs ativos"}
          icon={Bug}
          iconClass={bugHUs.length > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}
          accentClass={bugHUs.length > 0 ? "bg-destructive" : "bg-muted"}
          trend={bugHUs.length > 0 ? "down" : "neutral"}
        />
        <KpiCard
          label="Impedimentos"
          value={blockedHUs.length}
          sub={blockedHUs.length > 0 ? "HUs bloqueadas" : "sem bloqueios"}
          icon={AlertTriangle}
          iconClass={blockedHUs.length > 0 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}
          accentClass={blockedHUs.length > 0 ? "bg-warning" : "bg-muted"}
          trend={blockedHUs.length > 0 ? "down" : "neutral"}
        />
      </div>

      {/* ── HUs em Aberto + Equipe ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* HUs em Aberto */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">HUs em Aberto</span>
            <span className="ml-auto text-xs text-muted-foreground">{openHUs.length} itens</span>
          </div>
          {recentHUs.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-6 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Tudo concluído!</p>
                <p className="text-xs">Todas as HUs do sprint estão finalizadas.</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentHUs.map((hu) => {
                const col = workflowColumns.find((c) => c.key === hu.status);
                return (
                  <li
                    key={hu.id}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-accent/30 transition-colors"
                  >
                    <span
                      className={cn("shrink-0 h-2 w-2 rounded-full", PRIORITY_COLOR[hu.priority] || "bg-muted")}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-snug text-foreground">{hu.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {hu.code}{hu.storyPoints ? ` · ${hu.storyPoints}pts` : " · 0pts"}
                      </p>
                    </div>
                    {col && (
                      <Badge
                        variant="outline"
                        className="text-[11px] px-2 py-0.5 shrink-0 whitespace-nowrap font-normal hidden sm:inline-flex"
                        style={{
                          borderColor: (col as any).hex || "#94a3b8",
                          color: (col as any).hex || "#94a3b8",
                          backgroundColor: `${(col as any).hex || "#94a3b8"}14`,
                        }}
                      >
                        {col.label}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Equipe */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Equipe</span>
            <span className="ml-auto text-xs text-muted-foreground">{developers.length} membros</span>
          </div>
          {developers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-5 gap-3 text-muted-foreground">
              <Users className="h-6 w-6" />
              <p className="text-xs text-center">Sem devs cadastrados</p>
              <p className="text-[11px] text-center">Adicione membros a este time.</p>
              <Button variant="outline" size="sm" className="w-full text-xs mt-1"
                onClick={() => { document.querySelector<HTMLElement>('[data-tab="members"]')?.click(); }}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Adicionar membro
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {developers.slice(0, 6).map((dev) => {
                const myActs = activities.filter((a) => a.assigneeId === dev.id && !a.isClosed).length;
                return (
                  <li key={dev.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="shrink-0 h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
                      {getInitials(dev.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-foreground">{formatPersonName(dev.name)}</p>
                      <p className="text-xs text-muted-foreground truncate">{dev.role}</p>
                    </div>
                    {myActs > 0 && (
                      <Badge variant="secondary" className="text-xs tabular-nums shrink-0">{myActs}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── KPIs inferiores ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total Sprints"
          value={sprints.length}
          sub="histórico"
          icon={Zap}
          iconClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          accentClass="bg-violet-400"
        />
        <KpiCard
          label="Horas Registradas"
          value={`${totalHours.toFixed(0)}h`}
          sub="total"
          icon={Clock}
          iconClass="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
          accentClass="bg-cyan-400"
        />
        <KpiCard
          label="Devs na Equipe"
          value={developers.length}
          sub="ativos"
          icon={Users}
          iconClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          accentClass="bg-indigo-400"
        />
        <KpiCard
          label="Velocity"
          value={`${donePoints}pts`}
          sub={`meta ${totalPoints}pts`}
          icon={TrendingUp}
          iconClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          accentClass="bg-emerald-400"
          progress={completionPct}
          progressClass="[&>div]:bg-emerald-500"
        />
      </div>
    </div>
  );
}
