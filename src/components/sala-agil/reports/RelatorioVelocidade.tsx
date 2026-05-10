import { useMemo, useState } from "react";
import { BarChart2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, ReferenceLine,
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

export function RelatorioVelocidade({ sprints, rawData, teamName, onBack }: Props) {
  const [filters, setFilters] = useState<Record<string, string>>({ sprintQtd: "5" });

  const sprintData = useMemo(() => {
    const sorted = [...rawData.sprints].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const qty = parseInt(filters.sprintQtd ?? "5") || 5;
    const sliced = sorted.slice(-qty);

    return sliced.map((sprint) => {
      const hus = rawData.hus.filter((h: any) => h.sprint_id === sprint.id);
      const huIds = new Set(hus.map((h: any) => h.id));
      const acts = rawData.activities.filter((a: any) => huIds.has(a.hu_id));

      const lastCol = sprint._lastCol ?? "pronto_para_publicacao";
      const completedHUs = hus.filter((h: any) => h.status === lastCol || h.status === "pronto_para_publicacao");
      const velocity = completedHUs.reduce((s: number, h: any) => s + (h.story_points || 0), 0);
      const commitment = hus.length > 0 ? Math.round((completedHUs.length / hus.length) * 100) : 0;

      const withDates = completedHUs.filter((h: any) => h.start_date && h.end_date);
      const cycleTime = withDates.length > 0
        ? Math.round((withDates.reduce((s: number, h: any) =>
            s + Math.max(0, (new Date(h.end_date).getTime() - new Date(h.start_date).getTime()) / 86400000), 0) / withDates.length) * 10) / 10
        : 0;

      const hoursPlanned = acts.reduce((s: number, a: any) => s + Number(a.hours), 0);
      const hoursDone = acts.filter((a: any) => a.is_closed).reduce((s: number, a: any) => s + Number(a.hours), 0);

      return { sprint: sprint.name, velocity, commitment, cycleTime, hoursPlanned, hoursDone, totalHUs: hus.length, completedHUs: completedHUs.length };
    });
  }, [rawData, filters.sprintQtd]);

  const avgVelocity = sprintData.length > 0 ? Math.round(sprintData.reduce((s, d) => s + d.velocity, 0) / sprintData.length) : 0;
  const avgCommitment = sprintData.length > 0 ? Math.round(sprintData.reduce((s, d) => s + d.commitment, 0) / sprintData.length) : 0;
  const totalDelivered = sprintData.reduce((s, d) => s + d.velocity, 0);
  const totalHUsDone = sprintData.reduce((s, d) => s + d.completedHUs, 0);

  const kpis = [
    { label: "Velocity Médio", value: `${avgVelocity} pts`, sub: `meta ≥ 20 pts`, icon: <BarChart2 className="h-4 w-4" />, status: avgVelocity >= 20 ? "good" : avgVelocity >= 12 ? "warning" : "danger" as any },
    { label: "Commitment", value: `${avgCommitment}%`, sub: "HUs entregues/planejadas", status: avgCommitment >= 80 ? "good" : avgCommitment >= 60 ? "warning" : "danger" as any },
    { label: "Total Entregue", value: `${totalDelivered} pts`, sub: `${sprintData.length} sprint(s)`, status: "neutral" as any },
    { label: "HUs Concluídas", value: totalHUsDone, sub: "no período", status: "neutral" as any },
  ];

  function handleExport() {
    exportToCSV(
      sprintData.map((d) => ({
        Sprint: d.sprint, Velocity: d.velocity, "Commitment %": d.commitment,
        "Cycle Time (d)": d.cycleTime, "HUs Total": d.totalHUs, "HUs Concluídas": d.completedHUs,
        "Horas Planejadas": d.hoursPlanned, "Horas Concluídas": d.hoursDone,
      })),
      `velocidade_${teamName}`,
    );
  }

  return (
    <ReportLayout>
      <ReportPageHeader
        title="Velocidade"
        description={`Time: ${teamName}`}
        icon={<BarChart2 className="h-5 w-5" />}
        badge="Ágil"
        onBack={onBack}
        onExportCSV={handleExport}
      />

      <ReportFilterBar
        fields={[
          { key: "sprintQtd", label: "Últimas N sprints", type: "select", options: [
            { value: "3", label: "3 sprints" }, { value: "5", label: "5 sprints" },
            { value: "8", label: "8 sprints" }, { value: "12", label: "12 sprints" },
          ]},
        ]}
        values={filters}
        onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onReset={() => setFilters({ sprintQtd: "5" })}
      />

      <ReportKPISummary items={kpis} cols={4} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportChart title="Velocity por Sprint" subtitle="Story Points entregues" height="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sprintData} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="sprint" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => [`${v} pts`, "Velocity"]} />
              <ReferenceLine y={20} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "Meta", fontSize: 10, fill: "#22c55e" }} />
              <Bar dataKey="velocity" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={56}>
                <LabelList dataKey="velocity" position="top" style={{ fontSize: 11, fontWeight: 600, fill: "hsl(var(--foreground))" }} formatter={(v: any) => `${v}p`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ReportChart>

        <ReportChart title="Commitment Accuracy" subtitle="% de HUs entregues no planejado" height="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sprintData} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="sprint" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: any) => [`${v}%`, "Commitment"]} />
              <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "Meta 80%", fontSize: 10, fill: "#22c55e" }} />
              <Bar dataKey="commitment" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={56}>
                <LabelList dataKey="commitment" position="top" style={{ fontSize: 11, fontWeight: 600, fill: "hsl(var(--foreground))" }} formatter={(v: any) => `${v}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ReportChart>
      </div>

      <ReportDataTable
        title="Detalhamento por Sprint"
        badge={sprintData.length}
        data={sprintData}
        rowKey={(r) => r.sprint}
        columns={[
          { key: "sprint", header: "Sprint", sortable: true },
          { key: "velocity", header: "Velocity (pts)", align: "center", sortable: true,
            render: (v) => <span className="font-bold text-blue-600">{v}</span> },
          { key: "commitment", header: "Commitment", align: "center", sortable: true,
            render: (v) => (
              <Badge className={`text-[10px] ${ v >= 80 ? "bg-emerald-500/15 text-emerald-600" : v >= 60 ? "bg-amber-400/15 text-amber-600" : "bg-red-500/15 text-red-600" }`}>
                {v}%
              </Badge>
            ) },
          { key: "cycleTime", header: "Cycle Time", align: "center", sortable: true, render: (v) => `${v}d` },
          { key: "completedHUs", header: "HUs Entregues", align: "center", sortable: true },
          { key: "totalHUs", header: "HUs Total", align: "center" },
          { key: "hoursDone", header: "Horas Concl.", align: "center", sortable: true, render: (v) => `${v}h` },
        ]}
      />
    </ReportLayout>
  );
}
