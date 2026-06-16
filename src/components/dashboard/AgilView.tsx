// src/components/dashboard/AgilView.tsx
// Cenário B — visão exclusiva da Sala Ágil.
// Contém o conteúdo visual completo do dashboard original.
// SEM import cíclico — não importa DashboardHome.

import { useSprint }      from "@/contexts/SprintContext";
import { useAuth }        from "@/contexts/AuthContext";
import { Progress }       from "@/components/ui/progress";
import { Badge }          from "@/components/ui/badge";
import { Button }         from "@/components/ui/button";
import { cn }             from "@/lib/utils";
import {
  Zap, BookOpen, Bug, AlertTriangle, TrendingUp,
  Clock, CheckCircle2, Users, Target, Activity, UserPlus,
} from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getInitials, formatPersonName } from "@/lib/personName";

// ── Tipos de cor por card ───────────────────────────────────────────────
type CardAccent = "green" | "blue" | "red" | "amber" | "violet" | "cyan" | "indigo" | "emerald";

const ACCENT_TOP: Record<CardAccent, string> = {
  green:   "border-t-[3px] border-t-green-500",
  blue:    "border-t-[3px] border-t-blue-500",
  red:     "border-t-[3px] border-t-red-500",
  amber:   "border-t-[3px] border-t-amber-500",
  violet:  "border-t-[3px] border-t-violet-500",
  cyan:    "border-t-[3px] border-t-cyan-500",
  indigo:  "border-t-[3px] border-t-indigo-500",
  emerald: "border-t-[3px] border-t-emerald-500",
};

const ICON_CLASS: Record<CardAccent, string> = {
  green:   "bg-green-50   text-green-600   dark:bg-green-900/30   dark:text-green-400",
  blue:    "bg-blue-50    text-blue-600    dark:bg-blue-900/30    dark:text-blue-400",
  red:     "bg-red-50     text-red-600     dark:bg-red-900/30     dark:text-red-400",
  amber:   "bg-amber-50   text-amber-600   dark:bg-amber-900/30   dark:text-amber-500",
  violet:  "bg-violet-50  text-violet-600  dark:bg-violet-900/30  dark:text-violet-400",
  cyan:    "bg-cyan-50    text-cyan-600    dark:bg-cyan-900/30    dark:text-cyan-400",
  indigo:  "bg-indigo-50  text-indigo-600  dark:bg-indigo-900/30  dark:text-indigo-400",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
};

interface KpiCardProps {
  label: string;
  value: string | number | React.ReactNode;
  sub?: string;
  icon: React.ElementType;
  accent: CardAccent;
  progress?: number;
  progressColor?: string;
  statusBadge?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
}

function KpiCard({ label, value, sub, icon: Icon, accent, progress, progressColor, statusBadge, trend, trendLabel }: KpiCardProps) {
  return (
    <div className={cn(
      "bg-card rounded-xl border border-border shadow-sm overflow-hidden",
      "hover:-translate-y-0.5 hover:shadow-md transition-all duration-200",
      ACCENT_TOP[accent],
    )}>
      <div className="px-5 pt-4 pb-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
          <div className={cn("shrink-0 rounded-lg p-2", ICON_CLASS[accent])}><Icon className="h-4 w-4" /></div>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none text-foreground">{value}</p>
        {sub        && <p className="text-xs text-muted-foreground">{sub}</p>}
        {statusBadge && <div className="mt-0.5">{statusBadge}</div>}
        {trendLabel && (
          <p className={cn(
            "text-xs font-semibold",
            trend === "up"      && "text-green-600 dark:text-green-400",
            trend === "down"    && "text-red-500 dark:text-red-400",
            trend === "neutral" && "text-muted-foreground",
          )}>{trendLabel}</p>
        )}
        {progress !== undefined && <Progress value={progress} className={cn("h-1.5 mt-1", progressColor)} />}
      </div>
    </div>
  );
}

function SprintProgressBar({ sprint }: {
  sprint: { name: string; goal?: string | null; startDate: string; endDate: string; isActive: boolean; closedAt?: string | null; };
}) {
  const today    = new Date();
  const start    = parseISO(sprint.startDate);
  const end      = parseISO(sprint.endDate);
  const total    = differenceInDays(end, start) || 1;
  const elapsed  = Math.max(0, Math.min(total, differenceInDays(today, start)));
  const pct      = Math.round((elapsed / total) * 100);
  const daysLeft = Math.max(0, differenceInDays(end, today));
  const isClosed  = !sprint.isActive;
  const isOverdue = sprint.isActive && today > end;
  const badgeLabel = isClosed ? "Encerrada" : isOverdue ? `+${differenceInDays(today, end)}d atraso` : `${daysLeft}d restantes`;

  return (
    <div className="bg-card rounded-xl border border-border border-t-[3px] border-t-primary shadow-sm px-5 py-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Target className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground flex-1 truncate">{sprint.name}</span>
        <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-xs shrink-0 whitespace-nowrap">{badgeLabel}</Badge>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-muted-foreground">{format(start, "dd MMM", { locale: ptBR })} → {format(end, "dd MMM yyyy", { locale: ptBR })}</span>
        <span className="text-xs font-bold text-primary tabular-nums">{pct}%</span>
      </div>
      {sprint.goal && <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2">"{sprint.goal}"</p>}
      <Progress value={pct} className="h-2 mt-2" />
      <p className="mt-1.5 text-xs text-muted-foreground">
        {isClosed
          ? `Encerrada em ${sprint.closedAt ? format(parseISO(sprint.closedAt), "dd/MM/yyyy") : format(end, "dd/MM/yyyy")}`
          : `Dia ${elapsed} de ${total} — sprint ${pct >= 100 ? "no prazo final" : "em andamento"}`}
      </p>
    </div>
  );
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: "bg-red-500", high: "bg-orange-400", medium: "bg-yellow-400", low: "bg-green-400",
};

const DONE_KEYS = ["done","concluido","conclufda","finalizado","finalizada","entregue"];
function resolveDoneKey(columns: { key: string }[]) {
  return columns.find((c) => DONE_KEYS.includes(c.key.toLowerCase()))?.key ?? columns[columns.length - 1]?.key;
}

function GreenBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400">
      <CheckCircle2 className="h-3 w-3" />{text}
    </span>
  );
}

// ── Componente principal ────────────────────────────────────────────────
export function AgilView() {
  const { userStories, activities, developers, activeSprint, sprints, workflowColumns } = useSprint();
  const { profile } = useAuth();

  const sprintHUs     = activeSprint ? userStories.filter((h) => h.sprintId === activeSprint.id) : userStories;
  const doneColKey    = resolveDoneKey(workflowColumns);
  const doneHUs       = sprintHUs.filter((h) => h.status === doneColKey);
  const openHUs       = [...sprintHUs.filter((h) => h.status !== doneColKey)].sort((a, b) => {
    const posA = workflowColumns.findIndex((c) => c.key === a.status);
    const posB = workflowColumns.findIndex((c) => c.key === b.status);
    return (posB === -1 ? -Infinity : posB) - (posA === -1 ? -Infinity : posA);
  });
  const bugHUs        = sprintHUs.filter((h) => h.status === "bug");
  const blockedHUs    = sprintHUs.filter((h) => h.impediments?.some((i: any) => !i.resolvedAt));
  const totalPoints   = sprintHUs.reduce((s, h) => s + (h.storyPoints || 0), 0);
  const donePoints    = doneHUs.reduce((s, h) => s + (h.storyPoints || 0), 0);
  const completionPct = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
  const openActs      = activities.filter((a) => !a.isClosed);
  const totalHours    = activities.reduce((s, a) => s + (a.hours || 0), 0);
  const recentHUs     = openHUs.slice(0, 5);

  const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };
  const displayName = profile?.display_name || profile?.full_name || profile?.email?.split("@")[0] || "Dev";
  const firstName   = displayName.split(" ")[0];

  return (
    <div className="flex flex-col gap-5 px-4 sm:px-6 py-6 w-full overflow-x-hidden">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">
            {greeting()}, <span className="text-primary">{firstName}</span> 👋
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {activeSprint && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                <Zap className="h-3 w-3" />{activeSprint.name}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </span>
          </div>
        </div>
      </div>

      {/* Sprint Progress */}
      {activeSprint && <SprintProgressBar sprint={activeSprint as any} />}

      {/* KPI Grid principal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="HUs Conclufdasdas"
          value={<span>{doneHUs.length}<span className="text-base font-normal text-muted-foreground">/{sprintHUs.length}</span></span>}
          sub={`${donePoints} de ${totalPoints} story points`}
          icon={CheckCircle2} accent="green"
          progress={completionPct} progressColor="[&>div]:bg-green-500"
          trendLabel={`${completionPct}% conclufdo`} trend="up"
        />
        <KpiCard label="Em Andamento" value={openHUs.length} sub={`${openActs.length} atividades abertas`} icon={Activity} accent="blue" />
        <KpiCard
          label="Bugs Abertos" value={bugHUs.length}
          sub={bugHUs.length > 0 ? "requer atenção" : "sem bugs ativos"}
          icon={Bug} accent="red"
          statusBadge={bugHUs.length === 0 ? <GreenBadge text="limpo" /> : undefined}
        />
        <KpiCard
          label="Impedimentos" value={blockedHUs.length}
          sub={blockedHUs.length > 0 ? "HUs bloqueadas" : "sem bloqueios"}
          icon={AlertTriangle} accent="amber"
          statusBadge={blockedHUs.length === 0 ? <GreenBadge text="livre" /> : undefined}
        />
      </div>

      {/* HUs em Aberto + Equipe */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">HUs em Aberto</span>
            <span className="ml-auto text-xs text-muted-foreground">{openHUs.length} itens</span>
          </div>
          {recentHUs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">Tudo conclufdo!</p>
              <p className="text-xs">Todas as HUs do sprint estão finalizadas.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentHUs.map((hu) => {
                const col = workflowColumns.find((c) => c.key === hu.status);
                return (
                  <li key={hu.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40 transition-colors">
                    <span className={cn("shrink-0 h-2 w-2 rounded-full", PRIORITY_COLOR[hu.priority] || "bg-muted")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-foreground">{hu.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{hu.code}{hu.storyPoints ? ` · ${hu.storyPoints}pts` : " · 0pts"}</p>
                    </div>
                    {col && (
                      <Badge variant="outline" className="text-[11px] px-2 py-0.5 shrink-0 whitespace-nowrap font-normal hidden sm:inline-flex"
                        style={{ borderColor: (col as any).hex || "#94a3b8", color: (col as any).hex || "#94a3b8", backgroundColor: `${(col as any).hex || "#94a3b8"}14` }}
                      >{col.label}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Equipe</span>
            <span className="ml-auto text-xs text-muted-foreground">{developers.length} membros</span>
          </div>
          {developers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-5 gap-2 text-muted-foreground">
              <Users className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">Sem devs cadastrados</p>
              <p className="text-xs text-center">Adicione membros a este time.</p>
              <Button variant="outline" size="sm" className="w-full text-xs mt-2"
                onClick={() => document.querySelector<HTMLElement>('[data-tab="members"]')?.click()}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />Adicionar membro
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
                    {myActs > 0 && <Badge variant="secondary" className="text-xs tabular-nums shrink-0">{myActs}</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* KPIs inferiores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Sprints" value={sprints.length} sub="histórico" icon={Zap} accent="violet" />
        <KpiCard label="Horas Registradas" value={`${totalHours.toFixed(0)}h`} sub={`${activities.length} atividades`} icon={Clock} accent="cyan" />
        <KpiCard label="Devs na Equipe" value={developers.length} sub="membros ativos" icon={Users} accent="indigo" />
        <KpiCard
          label="Velocity" value={`${donePoints}pts`} sub="média últimas sprints"
          icon={TrendingUp} accent="emerald"
          progress={completionPct} progressColor="[&>div]:bg-emerald-500"
        />
      </div>
    </div>
  );
}
