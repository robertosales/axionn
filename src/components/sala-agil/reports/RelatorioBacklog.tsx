import { useMemo, useState } from "react";
import { LayoutList } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  ReportLayout,
  ReportPageHeader,
  ReportKPISummary,
  ReportChart,
  ReportFilterBar,
  ReportDataTable,
  exportToCSV,
} from "@/shared/components/reports";
import { Badge } from "@/components/ui/badge";

interface Props {
  sprints: { id: string; name: string; isActive?: boolean }[];
  developers: { id: string; name: string; role: string }[];
  rawData: { sprints: any[]; hus: any[]; activities: any[]; impediments: any[]; developers: any[] };
  teamName: string;
  currentUserName: string;
  onBack: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  aguardando_desenvolvimento: "Aguardando",
  em_desenvolvimento: "Em Dev.",
  em_code_review: "Code Review",
  em_teste: "Em Teste",
  bug: "Bug",
  pronto_para_publicacao: "Publicada",
};

const STATUS_COLORS: Record<string, string> = {
  aguardando_desenvolvimento: "#94a3b8",
  em_desenvolvimento: "#3b82f6",
  em_code_review: "#8b5cf6",
  em_teste: "#f59e0b",
  bug: "#ef4444",
  pronto_para_publicacao: "#22c55e",
};

export function RelatorioBacklog({ sprints, developers, rawData, teamName, onBack }: Props) {
  const [filters, setFilters] = useState<Record<string, string>>({ sprintId: "all", memberId: "all" });

  const sprintOptions = [{ value: "all", label: "Todas" }, ...sprints.map((s) => ({ value: s.id, label: s.name }))];
  const memberOptions = [{ value: "all", label: "Todos" }, ...developers.map((d) => ({ value: d.id, label: d.name }))];

  const hus = useMemo(() => {
    let data = rawData.hus;
    if (filters.sprintId !== "all") data = data.filter((h: any) => h.sprint_id === filters.sprintId);
    return data;
  }, [rawData.hus, filters.sprintId]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    hus.forEach((h: any) => { counts[h.status] = (counts[h.status] || 0) + 1; });
    return Object.entries(counts).map(([key, value]) => ({
      name: STATUS_LABELS[key] ?? key, value, color: STATUS_COLORS[key] ?? "#94a3b8",
    })).sort((a, b) => b.value - a.value);
  }, [hus]);

  const memberData = useMemo(() => {
    return developers.map((dev) => {
      const devHuIds = new Set(rawData.activities.filter((a: any) => a.assignee_id === dev.id).map((a: any) => a.hu_id));
      const devHUs = hus.filter((h: any) => devHuIds.has(h.id));
      const done = devHUs.filter((h: any) => h.status === "pronto_para_publicacao").length;
      const inProg = devHUs.filter((h: any) => ["em_desenvolvimento", "em_code_review", "em_teste"].includes(h.status)).length;
      const pending = devHUs.length - done - inProg;
      return { name: dev.name.split(" ")[0], done, inProg, pending, total: devHUs.length };
    }).filter((d) => d.total > 0);
  }, [hus, developers, rawData.activities]);

  const total = hus.length;
  const done = hus.filter((h: any) => h.status === "pronto_para_publicacao").length;
  const inProgress = hus.filter((h: any) => ["em_desenvolvimento", "em_code_review", "em_teste"].includes(h.status)).length;
  const pending = total - done - inProgress;

  const kpis = [
    { label: "Total HUs", value: total, status: "neutral" as any },
    { label: "Concluídas", value: done, status: done > 0 ? "good" : "neutral" as any },
    { label: "Em Progresso", value: inProgress, status: inProgress > 0 ? "warning" : "neutral" as any },
    { label: "Pendentes", value: pending, status: pending > 0 ? "danger" : "good" as any },
  ];

  const tableData = hus.map((h: any) => {
    const acts = rawData.activities.filter((a: any) => a.hu_id === h.id);
    const sprint = rawData.sprints.find((s: any) => s.id === h.sprint_id);
    const dev = acts.length > 0
      ? developers.find((d) => d.id === acts[0].assignee_id)
      : null;
    return {
      code: h.code || "—", title: h.title, status: h.status, priority: h.priority || "—",
      sprint: sprint?.name || "—", member: dev?.name || "—",
      points: h.story_points || 0, endDate: h.end_date || "",
    };
  });

  function handleExport() {
    exportToCSV(
      tableData.map((r) => ({ Código: r.code, Título: r.title, Status: STATUS_LABELS[r.status] ?? r.status, Prioridade: r.priority, Sprint: r.sprint, Responsável: r.member, Pontos: r.points, "Data Fim": r.endDate })),
      `backlog_${teamName}`,
    );
  }

  return (
    <ReportLayout>
      <ReportPageHeader
        title="Backlog"
        description={`Time: ${teamName}`}
        icon={<LayoutList className="h-5 w-5" />}
        badge="Ágil"
        onBack={onBack}
        onExportCSV={handleExport}
      />

      <ReportFilterBar
        fields={[
          { key: "sprintId", label: "Sprint", type: "select", options: sprintOptions },
          { key: "memberId", label: "Membro", type: "select", options: memberOptions },
        ]}
        values={filters}
        onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onReset={() => setFilters({ sprintId: "all", memberId: "all" })}
      />

      <ReportKPISummary items={kpis} cols={4} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportChart title="HUs por Status" subtitle="Distribuição do backlog" height="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`} labelLine fontSize={11}>
                {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ReportChart>

        <ReportChart title="HUs por Membro" subtitle="Concluídas, em progresso e pendentes" height="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={memberData} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={64} />
              <Tooltip />
              <Bar dataKey="done" name="Concluídas" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
              <Bar dataKey="inProg" name="Em Progresso" stackId="a" fill="#3b82f6" />
              <Bar dataKey="pending" name="Pendentes" stackId="a" fill="#94a3b8" radius={[0, 4, 4, 0]} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChart>
      </div>

      <ReportDataTable
        title="Detalhamento do Backlog"
        badge={tableData.length}
        data={tableData}
        rowKey={(r) => r.code}
        columns={[
          { key: "code", header: "Código", width: "w-24" },
          { key: "title", header: "Título", sortable: true },
          { key: "status", header: "Status", align: "center",
            render: (v) => (
              <Badge className="text-[10px]" style={{ background: `${STATUS_COLORS[v]}20`, color: STATUS_COLORS[v] }}>
                {STATUS_LABELS[v] ?? v}
              </Badge>
            ) },
          { key: "priority", header: "Prioridade", align: "center" },
          { key: "sprint", header: "Sprint", sortable: true },
          { key: "member", header: "Responsável", sortable: true },
          { key: "points", header: "Pontos", align: "center", sortable: true },
          { key: "endDate", header: "Data Fim", align: "center", render: (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "—" },
        ]}
      />
    </ReportLayout>
  );
}
