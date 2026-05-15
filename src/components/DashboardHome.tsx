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

// ── KPI Card ────────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconClass?: string;
  borderClass?: string;
  progress?: number;
  progressClass?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
}

function KpiCard({
  label, value, sub, icon: Icon, iconClass, borderClass,
  progress, progressClass, trend, trendLabel,
}: KpiCardProps) {
  return (
    <Card className={cn("relative overflow-hidden border-l-4", borderClass || "border-l-border")}>
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums leading-none truncate">{value}</p>
            {sub && <p className="mt-1.5 text-xs text-muted-foreground truncate">{sub}</p>}
            {trendLabel && (
              <p className={cn(
                "mt-1 text-xs font-semibold truncate",
                trend === "up"      && "text-green-600 dark:text-green-400",
                trend === "down"    && "text-red-500 dark:text-red-400",
                trend === "neutral" && "text-muted-foreground",
              )}>
                {trendLabel}
              </p>
            )}
          </div>
          <div className={cn("shrink-0 rounded-lg p-2", iconClass || "bg-primary/10 text-primary")}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        {progress !== undefined && (
          <div className="mt-3">
            <Progress value={progress} className={cn("h-2", progressClass)} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Sprint Progress Bar ───────────────────────────────────────────────────────────
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
    <Card className="col-span-full border-l-4 border-l-primary overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <Target className="h-4 w-4 text-primary shrink-0" />
          <CardTitle className="text-sm font-semibold truncate flex-1 min-w-0">
            {sprint.name}
          </CardTitle>
          <Badge variant={badgeVariant} className="text-xs shrink-0 whitespace-nowrap">
            {badgeLabel}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-x-4 gap-y-1 flex-wrap mt-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {format(start, "dd MMM", { locale: ptBR })} → {format(end, "dd MMM yyyy", { locale: ptBR })}
          </span>
          <span className="text-xs font-bold text-primary tabular-nums whitespace-nowrap">
            {pct}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="pb-4 pt-1">
        {sprint.goal && (
          <p className="text-xs text-muted-foreground mb-3 italic line-clamp-2">"{sprint.goal}"</p>
        )}
        <Progress value={pct} className="h-2.5" />
        <p className="mt-2 text-xs text-muted-foreground">
          {isClosed
            ? `Encerrada em ${sprint.closedAt ? format(parseISO(sprint.closedAt), "dd/MM/yyyy") : format(end, "dd/MM/yyyy")}`
            : `Dia ${elapsed} de ${total} — sprint ${pct >= 100 ? "no prazo final" : "em andamento"}`
          }
        </p>
      </CardContent>
    </Card>
  );
}

// ── Priority colors ───────────────────────────────────────────────────────────────
const PRIORITY_COLOR: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-400",
  medium:   "bg-yellow-400",
  low:      "bg-green-400",
};

// ── Detecta a coluna "concluído" de forma robusta ────────────────────────────────────
const DONE_KEYS = ["done", "concluido", "concluída", "finalizado", "finalizada", "entregue"];

function resolveDoneKey(columns: { key: string }[]): string | undefined {
  const byName = columns.find((c) => DONE_KEYS.includes(c.key.toLowerCase()));
  return byName?.key ?? columns[columns.length - 1]?.key;
}

// ── Main Component ──────────────────────────────────────────────────────────────────
export function DashboardHome() {
  const { userStories, activities, developers, activeSprint, sprints, workflowColumns } = useSprint();
  const { profile } = useAuth();

  const sprintHUs = activeSprint
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

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-border">
        <div className="min-w-0">
          <h1 className="text-lg font-bold flex items-center gap-2 truncate">
            <LayoutDashboard className="h-5 w-5 text-primary shrink-0" />
            <span className="truncate">{greeting()}, {firstName}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            {activeSprint
              ? `Sprint ativa: ${activeSprint.name}`
              : "Nenhuma sprint ativa — crie uma na aba Sprints"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <Calendar className="h-3.5 w-3.5" />
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </div>
      </div>

      {/* Sprint Progress */}
      {activeSprint && (
        <div className="grid grid-cols-1">
          <SprintProgressBar sprint={activeSprint as any} />
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="HUs Concluídas"
          value={`${doneHUs.length}/${sprintHUs.length}`}
          sub={`${donePoints} de ${totalPoints} pts`}
          icon={CheckCircle2}
          iconClass="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          borderClass="border-l-green-500"
          progress={completionPct}
          progressClass="[&>div]:bg-green-500"
          trend="up"
          trendLabel={`${completionPct}% concluído`}
        />
        <KpiCard
          label="Em Andamento"
          value={openHUs.length}
          sub={`${openActs.length} atividades abertas`}
          icon={Activity}
          iconClass="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          borderClass="border-l-blue-500"
          trend="neutral"
        />
        <KpiCard
          label="Bugs Abertos"
          value={bugHUs.length}
          sub={bugHUs.length > 0 ? "requer atenção" : "sem bugs ativos"}
          icon={Bug}
          iconClass={
            bugHUs.length > 0
              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              : "bg-muted text-muted-foreground"
          }
          borderClass={bugHUs.length > 0 ? "border-l-red-500" : "border-l-border"}
          trend={bugHUs.length > 0 ? "down" : "neutral"}
        />
        <KpiCard
          label="Impedimentos"
          value={blockedHUs.length}
          sub={blockedHUs.length > 0 ? "HUs bloqueadas" : "sem bloqueios"}
          icon={AlertTriangle}
          iconClass={
            blockedHUs.length > 0
              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500"
              : "bg-muted text-muted-foreground"
          }
          borderClass={blockedHUs.length > 0 ? "border-l-yellow-500" : "border-l-border"}
          trend={blockedHUs.length > 0 ? "down" : "neutral"}
        />
      </div>

      {/* HUs em Aberto + Equipe */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              HUs em Aberto
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentHUs.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-4 text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
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
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
                    >
                      {/* Indicador de prioridade */}
                      <span
                        className={cn("shrink-0 h-1.5 w-1.5 rounded-full", PRIORITY_COLOR[hu.priority] || "bg-muted")}
                      />

                      {/* Título + código */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-snug">{hu.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {hu.code}
                          {hu.storyPoints ? ` · ${hu.storyPoints}pts` : " · 0pts"}
                        </p>
                      </div>

                      {/* Badge de status — sem max-w, sem truncate, whitespace-nowrap */}
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
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Equipe ({developers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {developers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 px-5 gap-3 text-muted-foreground">
                <Users className="h-6 w-6" />
                <p className="text-xs text-center">Nenhum dev cadastrado neste time.</p>
                <Button variant="outline" size="sm" className="w-full text-xs"
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
                      <div className="shrink-0 h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                        {getInitials(dev.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{formatPersonName(dev.name)}</p>
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
          </CardContent>
        </Card>
      </div>

      {/* KPIs inferiores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total de Sprints"
          value={sprints.length}
          sub={`${sprints.filter((s) => s.isActive).length} ativa`}
          icon={Zap}
          iconClass="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
          borderClass="border-l-violet-400"
        />
        <KpiCard
          label="Horas Registradas"
          value={`${totalHours.toFixed(0)}h`}
          sub={`${activities.length} atividades total`}
          icon={Clock}
          iconClass="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400"
          borderClass="border-l-cyan-400"
        />
        <KpiCard
          label="Devs na Equipe"
          value={developers.length}
          sub="membros ativos"
          icon={Users}
          iconClass="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
          borderClass="border-l-indigo-400"
        />
        <KpiCard
          label="Velocity"
          value={`${donePoints}pts`}
          sub={`meta: ${totalPoints}pts`}
          icon={TrendingUp}
          iconClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          borderClass="border-l-emerald-500"
          progress={completionPct}
          progressClass="[&>div]:bg-emerald-500"
        />
      </div>
    </div>
  );
}
