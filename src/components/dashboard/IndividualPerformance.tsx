import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle, Clock, AlertTriangle, Bug, Zap, Target,
  TrendingUp, User, Activity as ActivityIcon, ChevronRight,
  BarChart2, List, History, ArrowLeft,
} from "lucide-react";
import { ExportButton } from "./ExportButton";
import { getReportConfig } from "@/features/sustentacao/utils/reportConfig";
import { MetricCard } from "@/components/sala-agil/metrics/MetricCard";
import { AnalyticsSidebar } from "@/components/sala-agil/metrics/AnalyticsSidebar";
import { TimelineCard } from "@/components/sala-agil/metrics/TimelineCard";
import { ProductivityChart } from "@/components/sala-agil/metrics/ProductivityChart";
import { PerformanceHeader } from "@/components/sala-agil/metrics/PerformanceHeader";

// ─── Interfaces (inalteradas) ────────────────────────────────────────────────────────
interface MemberMetrics {
  id: string;
  name: string;
  role: string;
  tasksAssigned: number;
  tasksStarted: number;
  tasksCompleted: number;
  tasksNotStarted: number;
  hoursPlanned: number;
  hoursCompleted: number;
  hoursPending: number;
  efficiency: number;
  bugsAssigned: number;
  bugsResolved: number;
  storyPointsCompleted: number;
  avgTimePerActivity: number;
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

// ─── Helpers ────────────────────────────────────────────────────────────────────────
const MEMBER_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16", "#e11d48",
];

function getInitials(name: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length];
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

// ─── MemberRow ───────────────────────────────────────────────────────────────────────
function MemberRow({
  member,
  index,
  onClick,
}: {
  member: MemberMetrics;
  index: number;
  onClick: () => void;
}) {
  const avatarColor = getAvatarColor(member.name);
  const initials = getInitials(member.name);
  const effColor =
    member.efficiency >= 80 ? "#22c55e" : member.efficiency >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <tr
      className="border-b border-border/50 hover:bg-muted/40 cursor-pointer transition-colors group"
      onClick={onClick}
    >
      {/* Avatar + nome */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center h-8 w-8 rounded-full text-white text-xs font-bold shrink-0"
            style={{ background: avatarColor }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
            <p className="text-[11px] text-muted-foreground truncate capitalize">{member.role}</p>
          </div>
        </div>
      </td>
      {/* Atividades */}
      <td className="px-4 py-3 text-center">
        <span className="text-sm tabular-nums">
          <span className="font-semibold">{member.tasksCompleted}</span>
          <span className="text-muted-foreground">/{member.tasksAssigned}</span>
        </span>
      </td>
      {/* Horas */}
      <td className="px-4 py-3 text-center">
        <span className="text-sm tabular-nums">
          <span className="font-semibold">{member.hoursCompleted}h</span>
          <span className="text-muted-foreground">/{member.hoursPlanned}h</span>
        </span>
      </td>
      {/* Eficiência */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[72px]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(member.efficiency, 100)}%`, background: effColor }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums" style={{ color: effColor }}>
            {member.efficiency}%
          </span>
        </div>
      </td>
      {/* SP */}
      <td className="px-4 py-3 text-center">
        <span className="text-sm tabular-nums">{member.storyPointsCompleted}</span>
      </td>
      {/* Bugs */}
      <td className="px-4 py-3 text-center">
        {member.bugsAssigned > 0 ? (
          <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-600 border-red-200">
            {member.bugsResolved}/{member.bugsAssigned}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>
      {/* WIP */}
      <td className="px-4 py-3 text-center">
        <span className="text-sm tabular-nums">{member.wip || "—"}</span>
      </td>
      {/* Chevron */}
      <td className="px-4 py-3 text-right">
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors ml-auto" />
      </td>
    </tr>
  );
}

// ─── MemberModal (fullscreen) ─────────────────────────────────────────────────────────
function MemberModal({
  member,
  sprintName,
  onClose,
  exportData,
}: {
  member: MemberMetrics;
  sprintName: string;
  onClose: () => void;
  exportData: () => any;
}) {
  const avatarColor = getAvatarColor(member.name);
  const initials = getInitials(member.name);
  const grouped = useMemo(() => groupActivitiesByDate(member.activities ?? []), [member.activities]);

  const hoursBarData = [
    { name: "Concluído", value: member.hoursCompleted },
    { name: "Pendente", value: member.hoursPending },
  ];

  return (
    <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
      {/* Modal header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/60 bg-gradient-to-r from-background to-muted/20 shrink-0">
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div
          className="flex items-center justify-center h-9 w-9 rounded-full text-white text-xs font-bold shrink-0"
          style={{ background: avatarColor }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{member.name}</p>
          <p className="text-[11px] text-muted-foreground capitalize">
            {member.role}
            {sprintName && <span> · {sprintName}</span>}
            <span className="ml-2 font-semibold"
              style={{ color: member.efficiency >= 80 ? "#22c55e" : member.efficiency >= 60 ? "#f59e0b" : "#ef4444" }}
            >
              {member.efficiency}% eficiência
            </span>
          </p>
        </div>
        <ExportButton getData={exportData} />
      </div>

      {/* Body: main + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main */}
        <main className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              icon={CheckCircle} label="Concluídas" accent="green"
              value={member.tasksCompleted}
              sublabel={`de ${member.tasksAssigned} atribuídas`}
            />
            <MetricCard
              icon={Clock} label="Horas" accent="blue"
              value={`${member.hoursCompleted}h`}
              sublabel={`de ${member.hoursPlanned}h planejadas`}
            />
            <MetricCard
              icon={Zap} label="Eficiência"
              accent={member.efficiency >= 80 ? "green" : member.efficiency >= 60 ? "amber" : "red"}
              value={`${member.efficiency}%`}
              sublabel={member.efficiency >= 80 ? "Meta atingida" : "Abaixo da meta (80%)"}
            />
            <MetricCard
              icon={Target} label="Cycle Time" accent="violet"
              value={`${member.cycleTime}d`}
              sublabel="média por atividade"
            />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="h-9 bg-muted/50 rounded-xl p-1">
              <TabsTrigger value="timeline" className="gap-1.5 text-xs rounded-lg">
                <List className="h-3.5 w-3.5" /> Timeline
              </TabsTrigger>
              <TabsTrigger value="charts" className="gap-1.5 text-xs rounded-lg">
                <BarChart2 className="h-3.5 w-3.5" /> Gráficos
              </TabsTrigger>
            </TabsList>

            {/* Timeline */}
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
                        <TimelineCard
                          key={a.id}
                          activity={{
                            id: a.id,
                            title: a.title,
                            activityType: a.activity_type,
                            isClosed: a.is_closed,
                            startDate: a.start_date,
                            endDate: a.end_date,
                            hours: a.hours,
                            huCode: a.hu_code,
                            huTitle: a.hu_title,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Charts */}
            <TabsContent value="charts" className="mt-4 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <ProductivityChart
                  type="donut"
                  title="Tarefas por Status"
                  subtitle="Distribuição atual"
                  data={member.tasksByStatus}
                  valueKey="value"
                  nameKey="name"
                />
                <ProductivityChart
                  type="bar"
                  title="Horas: Concluídas vs Pendentes"
                  data={[
                    { name: member.name.split(" ")[0], concluido: member.hoursCompleted, pendente: member.hoursPending },
                  ]}
                  dataKeys={[
                    { key: "concluido", name: "Concluído", color: "#22c55e" },
                    { key: "pendente", name: "Pendente", color: "#3b82f6" },
                  ]}
                />
              </div>
            </TabsContent>
          </Tabs>
        </main>

        {/* Sidebar */}
        <AnalyticsSidebar
          member={{
            ...member,
            tasksCompleted: member.tasksCompleted,
          }}
          onClose={onClose}
        />
      </div>
    </DialogContent>
  );
}

// ─── IndividualPerformance (main export) ─────────────────────────────────────────────────
export function IndividualPerformance({
  members,
  sprintName,
  hoursPerMemberData,
  progressBySprintData,
  memberNames,
  loading,
}: Props) {
  const [selectedMember, setSelectedMember] = useState<MemberMetrics | null>(null);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <User className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-sm font-medium text-muted-foreground">Nenhuma atividade encontrada</p>
        <p className="text-xs text-muted-foreground mt-1">Atribua atividades aos membros para visualizar métricas</p>
      </div>
    );
  }

  const reportCfg = getReportConfig("agil_desempenho_individual");

  const getExportData = () => ({
    title: reportCfg.tituloExportacao,
    headers: ["Usuário", "Título", "Descrição", "Data Início", "Data Fim", "Horas Trabalhadas"],
    rows: members.flatMap((m) =>
      (m.activities || []).map((a: any) => [m.name, a.title, a.description || "", a.start_date, a.end_date, a.hours])
    ),
  });

  const getMemberExportData = (m: MemberMetrics) => ({
    title: `${reportCfg.tituloExportacao} - ${m.name}`,
    headers: ["Usuário", "Título", "Descrição", "Data Início", "Data Fim", "Horas Trabalhadas"],
    rows: (m.activities || []).map((a: any) => [m.name, a.title, a.description || "", a.start_date, a.end_date, a.hours]),
  });

  // Totais
  const totals = {
    tasksAssigned: members.reduce((s, m) => s + m.tasksAssigned, 0),
    tasksCompleted: members.reduce((s, m) => s + m.tasksCompleted, 0),
    hoursPlanned: members.reduce((s, m) => s + m.hoursPlanned, 0),
    hoursCompleted: members.reduce((s, m) => s + m.hoursCompleted, 0),
    efficiency: members.length > 0 ? Math.round(members.reduce((s, m) => s + m.efficiency, 0) / members.length) : 0,
    notStarted: members.reduce((s, m) => s + m.tasksNotStarted, 0),
  };

  const criticalMembers = members.filter((m) => m.hoursPlanned > 20 && m.efficiency === 0);
  const effColor = totals.efficiency >= 80 ? "green" : totals.efficiency >= 60 ? "amber" : "red";

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* Header da seção */}
        <PerformanceHeader
          title="Desempenho Individual"
          sprintName={sprintName}
          kpis={[
            { label: "membros", value: members.length },
            { label: "atividades", value: totals.tasksAssigned },
          ]}
          actions={<ExportButton getData={getExportData} />}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon={CheckCircle} label="Tarefas Concluídas" accent="green"
            value={totals.tasksCompleted}
            sublabel={`de ${totals.tasksAssigned} atribuídas`}
          />
          <MetricCard icon={ActivityIcon} label="Em Progresso" accent="blue"
            value={totals.tasksAssigned - totals.tasksCompleted - totals.notStarted}
            sublabel="atividades ativas"
          />
          <MetricCard icon={Clock} label="Não Iniciadas" accent="neutral"
            value={totals.notStarted}
            sublabel="aguardando início"
          />
          <MetricCard
            icon={TrendingUp} label="Eficiência Média" accent={effColor as any}
            value={`${totals.efficiency}%`}
            sublabel={totals.efficiency >= 80 ? "Meta de 80% atingida" : "Abaixo da meta (80%)"}
          />
        </div>

        {/* Alerta crítico */}
        {criticalMembers.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border-l-4 border-destructive px-4 py-2.5 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>Alerta:</strong>{" "}
              {criticalMembers.map((m) => m.name).join(", ")}{" "}
              com mais de 20h planejadas e 0% eficiência.
            </span>
          </div>
        )}

        {/* Tabela de membros */}
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border/60">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Membro</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Atividades</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Horas</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Eficiência</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Story Pts</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Bugs</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">WIP</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {members.map((m, i) => (
                <MemberRow key={m.id} member={m} index={i} onClick={() => setSelectedMember(m)} />
              ))}
              {/* Total row */}
              <tr className="bg-muted/30">
                <td className="px-4 py-3 text-xs font-semibold text-muted-foreground" colSpan={1}>Total / Média</td>
                <td className="px-4 py-3 text-center text-sm font-semibold tabular-nums">
                  {totals.tasksCompleted}/{totals.tasksAssigned}
                </td>
                <td className="px-4 py-3 text-center text-sm font-semibold tabular-nums">
                  {totals.hoursCompleted}h/{totals.hoursPlanned}h
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-bold tabular-nums"
                    style={{ color: totals.efficiency >= 80 ? "#22c55e" : totals.efficiency >= 60 ? "#f59e0b" : "#ef4444" }}
                  >
                    {totals.efficiency}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-sm tabular-nums">
                  {members.reduce((s, m) => s + m.storyPointsCompleted, 0)}
                </td>
                <td className="px-4 py-3 text-center text-sm tabular-nums">
                  {members.reduce((s, m) => s + m.bugsResolved, 0)}/{members.reduce((s, m) => s + m.bugsAssigned, 0)}
                </td>
                <td className="px-4 py-3 text-center text-sm tabular-nums">
                  {members.reduce((s, m) => s + m.wip, 0)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4">
          <ProductivityChart
            type="bar"
            title="Horas Concluídas vs Pendentes"
            subtitle="Por membro do time"
            data={hoursPerMemberData}
            dataKeys={[
              { key: "concluido", name: "Concluído", color: "#22c55e" },
              { key: "pendente", name: "Pendente", color: "#3b82f6" },
            ]}
          />
          <ProductivityChart
            type="donut"
            title="Tarefas por Status"
            subtitle="Distribuição do time"
            data={(() => {
              const agg: Record<string, { name: string; value: number; color: string }> = {};
              members.forEach((m) =>
                m.tasksByStatus.forEach((s) => {
                  if (!agg[s.name]) agg[s.name] = { ...s, value: 0 };
                  agg[s.name].value += s.value;
                })
              );
              return Object.values(agg).filter((s) => s.value > 0);
            })()}
          />
        </div>

        {progressBySprintData.length > 1 && (
          <ProductivityChart
            type="line"
            title="Progresso Individual por Sprint"
            subtitle="Últimos sprints"
            data={progressBySprintData}
            nameKey="sprint"
            dataKeys={memberNames.map((name, i) => ({
              key: name.split(" ")[0],
              name: name.split(" ")[0],
            }))}
          />
        )}

        {/* Modal fullscreen do membro */}
        <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
          {selectedMember && (
            <MemberModal
              member={selectedMember}
              sprintName={sprintName}
              onClose={() => setSelectedMember(null)}
              exportData={() => getMemberExportData(selectedMember)}
            />
          )}
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
