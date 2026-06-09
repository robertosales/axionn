import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle, Clock, AlertTriangle, Bug, Zap, Target,
  TrendingUp, User, Activity as ActivityIcon, ChevronRight,
  BarChart2, List, ArrowLeft,
} from "lucide-react";
import { MetricCard } from "@/components/sala-agil/metrics/MetricCard";
import { AnalyticsSidebar } from "@/components/sala-agil/metrics/AnalyticsSidebar";
import { TimelineCard } from "@/components/sala-agil/metrics/TimelineCard";
import { ProductivityChart } from "@/components/sala-agil/metrics/ProductivityChart";
import { PerformanceHeader } from "@/components/sala-agil/metrics/PerformanceHeader";
import { formatMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/personName";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface MemberMetrics {
  id: string;
  name: string;
  role: string;
  tasksAssigned: number;
  tasksStarted: number;
  tasksCompleted: number;
  tasksNotStarted: number;
  hoursPlanned: number;    // minutos
  hoursCompleted: number;  // minutos
  hoursPending: number;    // minutos
  efficiency: number;
  bugsAssigned: number;
  bugsResolved: number;
  storyPointsCompleted: number;
  avgTimePerActivity: number; // minutos
  wip: number;
  cycleTime: number;
  tasksByStatus: { name: string; value: number; color: string }[];
  activities?: any[];
}

interface Props {
  members: MemberMetrics[];
  sprintName: string;
  hoursPerMemberData: { name: string; concluido: number; pendente: number }[];
  progressBySprintData: { sprint: string; [member: string]: string | number }[];
  memberNames: string[];
  loading?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const MEMBER_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16", "#e11d48",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length];
}

function getEffColor(eff: number) {
  return eff >= 80 ? "#22c55e" : eff >= 60 ? "#f59e0b" : "#ef4444";
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function groupActivitiesByDate(activities: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  const sorted = [...activities].sort((a, b) =>
    (b.end_date ?? b.start_date ?? "").localeCompare(a.end_date ?? a.start_date ?? "")
  );
  for (const act of sorted) {
    const key = act.end_date ?? act.start_date ?? "sem-data";
    if (!groups[key]) groups[key] = [];
    groups[key].push(act);
  }
  return groups;
}

// ─── Avatar com ring de eficiência ───────────────────────────────────────────────

function MemberAvatar({ name, efficiency, size = 9 }: { name: string; efficiency: number; size?: number }) {
  const color = getAvatarColor(name);
  const effColor = getEffColor(efficiency);
  const initials = getInitials(name);
  const sizeClass = size === 9 ? "h-9 w-9 text-xs" : "h-8 w-8 text-[11px]";

  return (
    <UITooltip>
      <TooltipTrigger asChild>
        <div
          className={cn("relative flex items-center justify-center rounded-full text-white font-bold shrink-0", sizeClass)}
          style={{
            background: color,
            boxShadow: `0 0 0 2px ${effColor}`,
          }}
        >
          {initials}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {efficiency}% eficiência
      </TooltipContent>
    </UITooltip>
  );
}

// ─── EffBar ──────────────────────────────────────────────────────────────────────

function EffBar({ value }: { value: number }) {
  const color = getEffColor(value);
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(value, 100)}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums w-8 text-right" style={{ color }}>
        {value}%
      </span>
    </div>
  );
}

// ─── MemberRow ───────────────────────────────────────────────────────────────

function MemberRow({ member, onClick }: { member: MemberMetrics; onClick: () => void }) {
  const taskPct = member.tasksAssigned > 0
    ? Math.round((member.tasksCompleted / member.tasksAssigned) * 100)
    : 0;

  return (
    <tr
      className="border-b border-border/40 hover:bg-primary/4 cursor-pointer transition-colors group"
      onClick={onClick}
    >
      {/* Avatar + nome */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <MemberAvatar name={member.name} efficiency={member.efficiency} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{member.name}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{member.role}</p>
          </div>
        </div>
      </td>

      {/* Atividades com mini-barra */}
      <td className="px-4 py-3">
        <div className="space-y-1">
          <div className="flex justify-between text-xs tabular-nums">
            <span className="font-semibold">{member.tasksCompleted}</span>
            <span className="text-muted-foreground">/{member.tasksAssigned}</span>
          </div>
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${taskPct}%` }}
            />
          </div>
        </div>
      </td>

      {/* Horas */}
      <td className="px-4 py-3 text-sm tabular-nums">
        <span className="font-semibold">{formatMinutes(member.hoursCompleted)}</span>
        <span className="text-muted-foreground text-xs"> /{formatMinutes(member.hoursPlanned)}</span>
      </td>

      {/* Eficiência */}
      <td className="px-4 py-3"><EffBar value={member.efficiency} /></td>

      {/* SP */}
      <td className="px-4 py-3 text-center">
        <span className="text-sm font-semibold tabular-nums">{member.storyPointsCompleted}</span>
      </td>

      {/* Bugs */}
      <td className="px-4 py-3 text-center">
        {member.bugsAssigned > 0 ? (
          <Badge variant="outline" className="text-[10px] gap-1 border-red-300 text-red-600 dark:text-red-400">
            <Bug className="h-2.5 w-2.5" />{member.bugsResolved}/{member.bugsAssigned}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>

      {/* WIP */}
      <td className="px-4 py-3 text-center">
        {member.wip > 0 ? (
          <Badge variant="outline" className="text-[10px] bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]">
            {member.wip}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>

      {/* Chevron */}
      <td className="px-4 py-3 text-right">
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all ml-auto" />
      </td>
    </tr>
  );
}

// ─── MemberModal ──────────────────────────────────────────────────────────────

function MemberModal({
  member, sprintName, onClose,
}: {
  member: MemberMetrics;
  sprintName: string;
  onClose: () => void;
}) {
  const grouped = useMemo(() => groupActivitiesByDate(member.activities ?? []), [member.activities]);
  const effColor = getEffColor(member.efficiency);

  return (
    <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/60 shrink-0"
        style={{ background: `linear-gradient(135deg, hsl(var(--background)) 60%, ${getAvatarColor(member.name)}18)` }}
      >
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <MemberAvatar name={member.name} efficiency={member.efficiency} size={9} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{member.name}</p>
          <p className="text-[11px] text-muted-foreground capitalize">
            {member.role}{sprintName && <span> · {sprintName}</span>}
            <span className="ml-2 font-bold" style={{ color: effColor }}>{member.efficiency}% eficiência</span>
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard icon={CheckCircle} label="Concluídas" accent="green"
              value={member.tasksCompleted}
              sublabel={`de ${member.tasksAssigned} atribuídas`}
            />
            <MetricCard icon={Clock} label="Horas" accent="blue"
              value={formatMinutes(member.hoursCompleted)}
              sublabel={`de ${formatMinutes(member.hoursPlanned)} planejadas`}
            />
            <MetricCard icon={Zap} label="Eficiência"
              accent={member.efficiency >= 80 ? "green" : member.efficiency >= 60 ? "amber" : "red"}
              value={`${member.efficiency}%`}
              sublabel={member.efficiency >= 80 ? "Meta atingida" : "Abaixo da meta (80%)"}
            />
            <MetricCard icon={Target} label="Cycle Time" accent="violet"
              value={`${member.cycleTime}d`}
              sublabel="média por atividade"
            />
          </div>

          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="h-9 bg-muted/50 rounded-xl p-1">
              <TabsTrigger value="timeline" className="gap-1.5 text-xs rounded-lg">
                <List className="h-3.5 w-3.5" /> Timeline
              </TabsTrigger>
              <TabsTrigger value="charts" className="gap-1.5 text-xs rounded-lg">
                <BarChart2 className="h-3.5 w-3.5" /> Gráficos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-4 space-y-4">
              {Object.keys(grouped).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <List className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma atividade registrada</p>
                </div>
              ) : (
                Object.entries(grouped).map(([date, acts]) => (
                  <div key={date}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-1 mb-2">
                      {date === "sem-data" ? "Sem data definida" : formatDate(date)}
                    </p>
                    <div className="space-y-2">
                      {acts.map((a: any) => (
                        <TimelineCard key={a.id} activity={{ id: a.id, title: a.title, activityType: a.activity_type, isClosed: a.is_closed, startDate: a.start_date, endDate: a.end_date, hours: a.hours, huCode: a.hu_code, huTitle: a.hu_title }} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="charts" className="mt-4 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <ProductivityChart type="donut" title="Tarefas por Status" subtitle="Distribuição atual" data={member.tasksByStatus} valueKey="value" nameKey="name" />
                <ProductivityChart type="bar" title="Horas: Concluídas vs Pendentes"
                  data={[{ name: member.name.split(" ")[0], concluido: member.hoursCompleted, pendente: member.hoursPending }]}
                  dataKeys={[
                    { key: "concluido", name: "Concluído", color: "#22c55e" },
                    { key: "pendente", name: "Pendente", color: "#3b82f6" },
                  ]}
                />
              </div>
            </TabsContent>
          </Tabs>
        </main>
        <AnalyticsSidebar member={{ ...member, tasksCompleted: member.tasksCompleted }} onClose={onClose} />
      </div>
    </DialogContent>
  );
}

// ─── IndividualPerformance ────────────────────────────────────────────────────────

export function IndividualPerformance({
  members, sprintName, hoursPerMemberData, progressBySprintData, memberNames, loading,
}: Props) {
  const [selectedMember, setSelectedMember] = useState<MemberMetrics | null>(null);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-16 text-center">
        <User className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-sm font-medium text-muted-foreground">Nenhuma atividade encontrada</p>
        <p className="text-xs text-muted-foreground mt-1">Atribua atividades aos membros para visualizar métricas</p>
      </div>
    );
  }

  const totals = {
    tasksAssigned:  members.reduce((s, m) => s + m.tasksAssigned, 0),
    tasksCompleted: members.reduce((s, m) => s + m.tasksCompleted, 0),
    hoursPlanned:   members.reduce((s, m) => s + m.hoursPlanned, 0),
    hoursCompleted: members.reduce((s, m) => s + m.hoursCompleted, 0),
    efficiency: members.length > 0 ? Math.round(members.reduce((s, m) => s + m.efficiency, 0) / members.length) : 0,
    notStarted: members.reduce((s, m) => s + m.tasksNotStarted, 0),
  };

  const criticalMembers = members.filter((m) => m.hoursPlanned > 20 * 60 && m.efficiency === 0);
  const effColor = totals.efficiency >= 80 ? "green" : totals.efficiency >= 60 ? "amber" : "red";

  return (
    <TooltipProvider>
      <div className="space-y-5">
        <PerformanceHeader
          title="Desempenho Individual"
          sprintName={sprintName}
          kpis={[
            { label: "membros",     value: members.length },
            { label: "atividades",  value: totals.tasksAssigned },
          ]}
        />

        {/* KPI summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon={CheckCircle} label="Tarefas Concluídas" accent="green"
            value={totals.tasksCompleted} sublabel={`de ${totals.tasksAssigned} atribuídas`} />
          <MetricCard icon={ActivityIcon} label="Em Progresso" accent="blue"
            value={totals.tasksAssigned - totals.tasksCompleted - totals.notStarted} sublabel="atividades ativas" />
          <MetricCard icon={Clock} label="Não Iniciadas" accent="neutral"
            value={totals.notStarted} sublabel="aguardando início" />
          <MetricCard icon={TrendingUp} label="Eficiência Média" accent={effColor as any}
            value={`${totals.efficiency}%`}
            sublabel={totals.efficiency >= 80 ? "Meta de 80% atingida" : "Abaixo da meta (80%)"} />
        </div>

        {criticalMembers.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border-l-4 border-destructive px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span><strong>Alerta:</strong> {criticalMembers.map((m) => m.name).join(", ")} com mais de 20h planejadas e 0% eficiência.</span>
          </div>
        )}

        {/* Tabela de membros */}
        <div className="rounded-2xl border border-border/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border/60">
                {["Membro", "Atividades", "Horas", "Eficiência", "Story Pts", "Bugs", "WIP", ""].map((h) => (
                  <th key={h} className={cn(
                    "px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                    h === "Membro" ? "text-left" : h === "" ? "" : "text-center",
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {members.map((m) => (
                <MemberRow key={m.id} member={m} onClick={() => setSelectedMember(m)} />
              ))}
              {/* Linha de total */}
              <tr className="bg-muted/30 font-semibold">
                <td className="px-4 py-3 text-xs text-muted-foreground">Total / Média</td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1 text-sm tabular-nums">
                    <span>{totals.tasksCompleted}</span>
                    <span className="text-muted-foreground">/{totals.tasksAssigned}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-sm tabular-nums">
                  {formatMinutes(totals.hoursCompleted)}<span className="text-muted-foreground text-xs">/{formatMinutes(totals.hoursPlanned)}</span>
                </td>
                <td className="px-4 py-3"><EffBar value={totals.efficiency} /></td>
                <td className="px-4 py-3 text-center text-sm tabular-nums">{members.reduce((s, m) => s + m.storyPointsCompleted, 0)}</td>
                <td className="px-4 py-3 text-center text-sm tabular-nums">{members.reduce((s, m) => s + m.bugsResolved, 0)}/{members.reduce((s, m) => s + m.bugsAssigned, 0)}</td>
                <td className="px-4 py-3 text-center text-sm tabular-nums">{members.reduce((s, m) => s + m.wip, 0)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Gráficos */}
        <div className="grid md:grid-cols-2 gap-4">
          <ProductivityChart type="bar" title="Horas Concluídas vs Pendentes" subtitle="Por membro do time" data={hoursPerMemberData}
            dataKeys={[
              { key: "concluido", name: "Concluído", color: "#22c55e" },
              { key: "pendente",  name: "Pendente",  color: "#3b82f6" },
            ]}
          />
          <ProductivityChart type="donut" title="Tarefas por Status" subtitle="Distribuição do time"
            data={(() => {
              const agg: Record<string, { name: string; value: number; color: string }> = {};
              members.forEach((m) => m.tasksByStatus.forEach((s) => {
                if (!agg[s.name]) agg[s.name] = { ...s, value: 0 };
                agg[s.name].value += s.value;
              }));
              return Object.values(agg).filter((s) => s.value > 0);
            })()}
          />
        </div>

        {progressBySprintData.length > 1 && (
          <ProductivityChart type="line" title="Progresso Individual por Sprint" subtitle="Últimos sprints"
            data={progressBySprintData} nameKey="sprint"
            dataKeys={memberNames.map((name) => ({ key: name.split(" ")[0], name: name.split(" ")[0] }))}
          />
        )}

        <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
          {selectedMember && (
            <MemberModal
              member={selectedMember}
              sprintName={sprintName}
              onClose={() => setSelectedMember(null)}
            />
          )}
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
