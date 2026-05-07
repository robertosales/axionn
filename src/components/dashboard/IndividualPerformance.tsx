import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
  CheckCircle, Clock, AlertTriangle, Bug, Zap, Target,
  TrendingUp, User, Activity as ActivityIcon, Download, Info,
} from "lucide-react";
import { ExportButton } from "./ExportButton";
import { Skeleton } from "@/components/ui/skeleton";
import { getReportConfig } from "@/features/sustentacao/utils/reportConfig";

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

const STATUS_PIE_COLORS: Record<string, string> = {
  "Concluída": "#22c55e",
  "Em Progresso": "#3b82f6",
  "Não Iniciada": "#94a3b8",
  "Bloqueada": "#ef4444",
  "Impedida": "#eab308",
};

const MEMBER_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16", "#e11d48",
];

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length];
}

export function IndividualPerformance({ members, sprintName, hoursPerMemberData, progressBySprintData, memberNames, loading }: Props) {
  const [selectedMember, setSelectedMember] = useState<MemberMetrics | null>(null);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma atividade encontrada</p>
          <p className="text-sm mt-1">Atribua atividades aos membros do time para visualizar métricas</p>
        </CardContent>
      </Card>
    );
  }

  const reportCfg = getReportConfig('agil_desempenho_individual');

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

  const totals = {
    tasksAssigned: members.reduce((s, m) => s + m.tasksAssigned, 0),
    tasksCompleted: members.reduce((s, m) => s + m.tasksCompleted, 0),
    hoursPlanned: members.reduce((s, m) => s + m.hoursPlanned, 0),
    hoursCompleted: members.reduce((s, m) => s + m.hoursCompleted, 0),
    efficiency: members.length > 0 ? Math.round(members.reduce((s, m) => s + m.efficiency, 0) / members.length) : 0,
    bugsAssigned: members.reduce((s, m) => s + m.bugsAssigned, 0),
    storyPoints: members.reduce((s, m) => s + m.storyPointsCompleted, 0),
  };

  const allStatusData: Record<string, number> = {};
  members.forEach((m) => m.tasksByStatus.forEach((s) => { allStatusData[s.name] = (allStatusData[s.name] || 0) + s.value; }));
  const statusPieData = Object.entries(allStatusData).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value, color: STATUS_PIE_COLORS[name] || "#94a3b8" }));

  const radarMetrics = ["Tarefas", "Horas", "Eficiência", "SP", "Bugs Res."];
  const radarData = radarMetrics.map((metric) => {
    const entry: any = { metric };
    members.forEach((m) => {
      const key = m.name.split(" ")[0];
      switch (metric) {
        case "Tarefas": entry[key] = m.tasksCompleted; break;
        case "Horas": entry[key] = m.hoursCompleted; break;
        case "Eficiência": entry[key] = m.efficiency; break;
        case "SP": entry[key] = m.storyPointsCompleted; break;
        case "Bugs Res.": entry[key] = m.bugsResolved; break;
      }
    });
    return entry;
  });

  // Critical alerts
  const criticalMembers = members.filter(m => m.hoursPlanned > 20 && m.efficiency === 0);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Desempenho Individual
          </h3>
          <ExportButton getData={getExportData} />
        </div>

        {/* 🔹 KPI Cards — no border, subtle shadow, semantic icon+color */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard icon={CheckCircle} label="Concluído" value={totals.tasksCompleted} accent="#22c55e" />
          <SummaryCard icon={ActivityIcon} label="Em Progresso" value={totals.tasksAssigned - totals.tasksCompleted} accent="#3b82f6" />
          <SummaryCard icon={Clock} label="Não Iniciado" value={members.reduce((s, m) => s + m.tasksNotStarted, 0)} accent="#94a3b8" />
          <SummaryCard icon={TrendingUp} label="Eficiência Média" value={`${totals.efficiency}%`} accent={totals.efficiency >= 80 ? "#22c55e" : totals.efficiency >= 40 ? "#eab308" : "#ef4444"} />
        </div>

        {/* 🔹 Critical Alert */}
        {criticalMembers.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border-l-4 border-destructive px-4 py-2.5 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span><strong>Alerta:</strong> {criticalMembers.map(m => m.name).join(", ")} com mais de 20h planejadas e 0% eficiência.</span>
          </div>
        )}

        {/* 🔹 Charts */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Horas Concluídas vs Pendentes</CardTitle></CardHeader>
            <CardContent>
              {hoursPerMemberData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={hoursPerMemberData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="concluido" fill="#22c55e" name="Concluído" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="pendente" fill="#3b82f6" name="Pendente" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Tarefas por Status</CardTitle></CardHeader>
            <CardContent>
              {statusPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} paddingAngle={2}>
                      {statusPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip /><Legend wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {progressBySprintData.length > 0 && (
            <Card className="border-0 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Progresso Individual por Sprint</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={progressBySprintData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip /><Legend wrapperStyle={{ fontSize: "11px" }} />
                    {memberNames.map((name, i) => (
                      <Line key={name} type="monotone" dataKey={name} stroke={MEMBER_COLORS[i % MEMBER_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {members.length > 0 && members.length <= 8 && (
            <Card className="border-0 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Perfil de Produtividade</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid /><PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} /><PolarRadiusAxis tick={{ fontSize: 9 }} />
                    {members.map((m, i) => (
                      <Radar key={m.id} name={m.name.split(" ")[0]} dataKey={m.name.split(" ")[0]}
                        stroke={MEMBER_COLORS[i % MEMBER_COLORS.length]} fill={MEMBER_COLORS[i % MEMBER_COLORS.length]}
                        fillOpacity={0.1} strokeWidth={2} />
                    ))}
                    <Tooltip /><Legend wrapperStyle={{ fontSize: "11px" }} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 🔹 Simplified Table — Desktop */}
        <Card className="border-0 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hidden md:block">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Detalhamento por Membro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <HeaderCell label="Membro" tip="Nome do membro do time" align="left" />
                    <HeaderCell label="Atividades" tip="Total de atividades atribuídas" />
                    <HeaderCell label="Horas" tip="Horas concluídas / planejadas" />
                    <HeaderCell label="Eficiência" tip="Percentual de horas concluídas vs planejadas" />
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => {
                    const isCritical = m.hoursPlanned > 20 && m.efficiency === 0;
                    return (
                      <tr
                        key={m.id}
                        onClick={() => setSelectedMember(m)}
                        className={`border-b last:border-0 cursor-pointer transition-colors hover:bg-primary/5 ${
                          idx % 2 !== 0 ? "bg-muted/40 dark:bg-muted/10" : ""
                        } ${isCritical ? "border-l-4 border-l-destructive" : ""}`}
                      >
                        <td className="py-3 font-semibold">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{ backgroundColor: getAvatarColor(m.name) }}>
                              {getInitials(m.name)}
                            </div>
                            <div>
                              <span className="block">{m.name}</span>
                              <span className="text-[10px] text-muted-foreground font-normal">{m.role}</span>
                            </div>
                            {isCritical && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                          </div>
                        </td>
                        <td className="text-center py-3 font-medium">{m.tasksAssigned}</td>
                        <td className="text-center py-3">
                          <span style={{ color: "#22c55e" }}>{m.hoursCompleted}h</span>
                          <span className="text-muted-foreground"> / {m.hoursPlanned}h</span>
                        </td>
                        <td className="text-center py-3"><EfficiencyBar value={m.efficiency} /></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold bg-muted/20">
                    <td className="py-3">Total / Média</td>
                    <td className="text-center py-3">{totals.tasksAssigned}</td>
                    <td className="text-center py-3">
                      <span style={{ color: "#22c55e" }}>{totals.hoursCompleted}h</span>
                      <span className="text-muted-foreground"> / {totals.hoursPlanned}h</span>
                    </td>
                    <td className="text-center py-3"><EfficiencyBar value={totals.efficiency} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 🔹 Mobile: cards por membro */}
        <div className="md:hidden space-y-3">
          {members.map((m) => {
            const isCritical = m.hoursPlanned > 20 && m.efficiency === 0;
            return (
              <Card key={m.id}
                onClick={() => setSelectedMember(m)}
                className={`border-0 shadow-[0_2px_8px_rgba(0,0,0,0.06)] cursor-pointer hover:shadow-md transition-shadow ${isCritical ? "border-l-4 border-l-destructive" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: getAvatarColor(m.name) }}>
                      {getInitials(m.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.role}</p>
                    </div>
                    {isCritical && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div><p className="text-muted-foreground">Atividades</p><p className="font-bold text-base">{m.tasksAssigned}</p></div>
                    <div><p className="text-muted-foreground">Horas</p><p className="font-bold text-base">{m.hoursCompleted}/{m.hoursPlanned}h</p></div>
                    <div><p className="text-muted-foreground">Eficiência</p><EfficiencyBar value={m.efficiency} /></div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 🔹 Drill-down Modal */}
        <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {selectedMember && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: getAvatarColor(selectedMember.name) }}>
                      {getInitials(selectedMember.name)}
                    </div>
                    <div>
                      <DialogTitle className="text-lg">{selectedMember.name}</DialogTitle>
                      <p className="text-sm text-muted-foreground">{selectedMember.role}</p>
                    </div>
                  </div>
                </DialogHeader>

                {/* Modal KPI summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                  <MiniKPI label="Atribuídas" value={selectedMember.tasksAssigned} />
                  <MiniKPI label="Concluídas" value={selectedMember.tasksCompleted} color="#22c55e" />
                  <MiniKPI label="WIP" value={selectedMember.wip} color={selectedMember.wip > 2 ? "#eab308" : undefined} />
                  <MiniKPI label="Cycle Time" value={`${selectedMember.cycleTime}d`} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <MiniKPI label="Horas Plan." value={`${selectedMember.hoursPlanned}h`} />
                  <MiniKPI label="Horas Conc." value={`${selectedMember.hoursCompleted}h`} color="#22c55e" />
                  <MiniKPI label="Bugs" value={`${selectedMember.bugsResolved}/${selectedMember.bugsAssigned}`} color="#ef4444" />
                  <MiniKPI label="Eficiência" value={`${selectedMember.efficiency}%`} color={selectedMember.efficiency >= 80 ? "#22c55e" : selectedMember.efficiency >= 40 ? "#eab308" : "#ef4444"} />
                </div>

                {/* Activity list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Atividades</h4>
                    <ExportButton getData={() => getMemberExportData(selectedMember)} />
                  </div>
                  {(selectedMember.activities && selectedMember.activities.length > 0) ? (
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                      {selectedMember.activities.map((a: any) => (
                        <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{a.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {a.start_date} → {a.end_date} · {a.hours}h
                              {a.activity_type === "bug" && <Badge className="ml-1.5 text-[9px] bg-destructive/15 text-destructive">Bug</Badge>}
                            </p>
                          </div>
                          {a.is_closed ? (
                            <CheckCircle className="h-4 w-4 shrink-0" style={{ color: "#22c55e" }} />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade encontrada</p>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// === Sub-components ===

function SummaryCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-border/40">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent}15` }}>
          <Icon className="h-5 w-5" style={{ color: accent }} />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
          <p className="text-2xl font-bold leading-tight" style={{ minHeight: "32px" }}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function MiniKPI({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center rounded-lg bg-muted/30 border border-border/40 p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold" style={color ? { color } : undefined}>{value}</p>
    </div>
  );
}

function HeaderCell({ label, tip, align = "center" }: { label: string; tip: string; align?: string }) {
  return (
    <th className={`${align === "left" ? "text-left" : "text-center"} py-2 font-medium`}>
      <UITooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help inline-flex items-center gap-1">
            {label} <Info className="h-3 w-3 text-muted-foreground/50" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] text-xs">{tip}</TooltipContent>
      </UITooltip>
    </th>
  );
}

function EfficiencyBar({ value }: { value: number }) {
  const color = value >= 80 ? "#22c55e" : value >= 40 ? "#eab308" : "#ef4444";
  return (
    <div className="flex items-center gap-1.5 justify-center">
      <div className="w-14 h-2.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold" style={{ color }}>{value}%</span>
    </div>
  );
}

function EmptyChart() {
  return <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Sem dados para exibir</div>;
}
