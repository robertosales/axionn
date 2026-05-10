import { useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
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

const CRIT_COLORS: Record<string, string> = {
  critica: "#ef4444", alta: "#f59e0b", media: "#3b82f6", baixa: "#22c55e",
};

export function RelatorioRetro({ sprints, rawData, teamName, onBack }: Props) {
  const [filters, setFilters] = useState<Record<string, string>>({ sprintId: "all", status: "all", criticality: "all" });

  const sprintOptions = [{ value: "all", label: "Todas" }, ...sprints.map((s) => ({ value: s.id, label: s.name }))];

  const impediments = useMemo(() => {
    let data = rawData.impediments;
    if (filters.sprintId !== "all") {
      const sprintHuIds = new Set(rawData.hus.filter((h: any) => h.sprint_id === filters.sprintId).map((h: any) => h.id));
      data = data.filter((i: any) => sprintHuIds.has(i.hu_id));
    }
    if (filters.status === "aberto") data = data.filter((i: any) => !i.resolved_at);
    if (filters.status === "resolvido") data = data.filter((i: any) => !!i.resolved_at);
    if (filters.criticality !== "all") data = data.filter((i: any) => i.criticality === filters.criticality);
    return data;
  }, [rawData, filters]);

  const total = impediments.length;
  const resolved = impediments.filter((i: any) => !!i.resolved_at).length;
  const open = total - resolved;
  const critical = impediments.filter((i: any) => ["critica", "alta"].includes(i.criticality)).length;

  const kpis = [
    { label: "Total", value: total, status: "neutral" as any },
    { label: "Resolvidos", value: resolved, status: resolved === total ? "good" : "warning" as any },
    { label: "Em Aberto", value: open, status: open === 0 ? "good" : open <= 2 ? "warning" : "danger" as any },
    { label: "Críticos/Altos", value: critical, status: critical === 0 ? "good" : critical <= 2 ? "warning" : "danger" as any },
  ];

  const critData = useMemo(() => {
    const counts: Record<string, number> = { critica: 0, alta: 0, media: 0, baixa: 0 };
    impediments.forEach((i: any) => { if (i.criticality in counts) counts[i.criticality]++; });
    return Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v, color: CRIT_COLORS[k] }));
  }, [impediments]);

  const sprintImpData = useMemo(() => {
    return sprints.map((s) => {
      const huIds = new Set(rawData.hus.filter((h: any) => h.sprint_id === s.id).map((h: any) => h.id));
      const imps = rawData.impediments.filter((i: any) => huIds.has(i.hu_id));
      return { sprint: s.name, total: imps.length, resolvidos: imps.filter((i: any) => i.resolved_at).length };
    }).filter((d) => d.total > 0).slice(-6);
  }, [rawData, sprints]);

  const tableData = impediments.map((i: any) => {
    const hu = rawData.hus.find((h: any) => h.id === i.hu_id);
    const sprint = hu ? rawData.sprints.find((s: any) => s.id === hu.sprint_id) : null;
    const dias = i.resolved_at
      ? Math.round((new Date(i.resolved_at).getTime() - new Date(i.reported_at).getTime()) / 86400000)
      : null;
    return {
      huCode: hu?.code || "?", reason: i.reason, type: i.type || "—",
      criticality: i.criticality, sprint: sprint?.name || "—",
      reportedAt: i.reported_at, resolvedAt: i.resolved_at, diasResolucao: dias,
    };
  });

  function handleExport() {
    exportToCSV(
      tableData.map((r) => ({ HU: r.huCode, Descrição: r.reason, Tipo: r.type, Criticidade: r.criticality, Sprint: r.sprint, Reportado: r.reportedAt ? new Date(r.reportedAt).toLocaleDateString("pt-BR") : "", Resolvido: r.resolvedAt ? new Date(r.resolvedAt).toLocaleDateString("pt-BR") : "Em aberto", "Dias p/ Resolução": r.diasResolucao ?? "—" })),
      `impedimentos_${teamName}`,
    );
  }

  return (
    <ReportLayout>
      <ReportPageHeader
        title="Impedimentos"
        description={`Time: ${teamName}`}
        icon={<ShieldAlert className="h-5 w-5" />}
        badge="Ágil"
        onBack={onBack}
        onExportCSV={handleExport}
      />

      <ReportFilterBar
        fields={[
          { key: "sprintId", label: "Sprint", type: "select", options: sprintOptions },
          { key: "status", label: "Status", type: "select", options: [
            { value: "all", label: "Todos" }, { value: "aberto", label: "Em Aberto" }, { value: "resolvido", label: "Resolvidos" },
          ]},
          { key: "criticality", label: "Criticidade", type: "select", options: [
            { value: "all", label: "Todas" }, { value: "critica", label: "Crítica" }, { value: "alta", label: "Alta" }, { value: "media", label: "Média" }, { value: "baixa", label: "Baixa" },
          ]},
        ]}
        values={filters}
        onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onReset={() => setFilters({ sprintId: "all", status: "all", criticality: "all" })}
      />

      <ReportKPISummary items={kpis} cols={4} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportChart title="Impedimentos por Criticidade" subtitle="Distribuição" height="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={critData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`} fontSize={11}>
                {critData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ReportChart>

        <ReportChart title="Impedimentos por Sprint" subtitle="Total vs. resolvidos" height="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sprintImpData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="sprint" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total" name="Total" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="resolvidos" name="Resolvidos" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </ReportChart>
      </div>

      <ReportDataTable
        title="Histórico de Impedimentos"
        badge={tableData.length}
        data={tableData}
        rowKey={(_, i) => i}
        columns={[
          { key: "huCode", header: "HU", width: "w-20" },
          { key: "reason", header: "Descrição", sortable: true },
          { key: "type", header: "Tipo", align: "center" },
          { key: "criticality", header: "Criticidade", align: "center",
            render: (v) => <Badge className="text-[10px]" style={{ background: `${CRIT_COLORS[v]}20`, color: CRIT_COLORS[v] }}>{v}</Badge> },
          { key: "sprint", header: "Sprint", sortable: true },
          { key: "reportedAt", header: "Reportado", align: "center", sortable: true,
            render: (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "—" },
          { key: "resolvedAt", header: "Resolvido", align: "center",
            render: (v) => v ? <span className="text-emerald-600">{new Date(v).toLocaleDateString("pt-BR")}</span> : <Badge className="text-[10px] bg-amber-400/15 text-amber-600">Em aberto</Badge> },
          { key: "diasResolucao", header: "Dias", align: "center", sortable: true,
            render: (v) => v !== null ? `${v}d` : "—" },
        ]}
      />
    </ReportLayout>
  );
}
