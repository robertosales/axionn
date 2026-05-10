import { useMemo, useState } from "react";
import { TrendingDown } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList,
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

export function RelatorioBurndown({ sprints, rawData, teamName, onBack }: Props) {
  const [filters, setFilters] = useState<Record<string, string>>({ sprintQtd: "5" });

  const burnData = useMemo(() => {
    const sorted = [...rawData.sprints].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const qty = parseInt(filters.sprintQtd ?? "5") || 5;
    return sorted.slice(-qty).map((sprint) => {
      const hus = rawData.hus.filter((h: any) => h.sprint_id === sprint.id);
      const done = hus.filter((h: any) => h.status === "pronto_para_publicacao");
      const totalPts = hus.reduce((s: number, h: any) => s + (h.story_points || 0), 0);
      const donePts = done.reduce((s: number, h: any) => s + (h.story_points || 0), 0);
      const remaining = totalPts - donePts;
      const progress = totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0;
      return { sprint: sprint.name, totalHUs: hus.length, doneHUs: done.length, totalPts, donePts, remaining, progress };
    });
  }, [rawData, filters.sprintQtd]);

  const avgProgress = burnData.length > 0 ? Math.round(burnData.reduce((s, d) => s + d.progress, 0) / burnData.length) : 0;
  const totalHUs = burnData.reduce((s, d) => s + d.totalHUs, 0);
  const doneHUs = burnData.reduce((s, d) => s + d.doneHUs, 0);
  const totalRemaining = burnData.reduce((s, d) => s + d.remaining, 0);

  const kpis = [
    { label: "HUs Total", value: totalHUs, status: "neutral" as any },
    { label: "HUs Concluídas", value: doneHUs, status: doneHUs >= totalHUs * 0.8 ? "good" : doneHUs >= totalHUs * 0.5 ? "warning" : "danger" as any },
    { label: "Pontos Restantes", value: `${totalRemaining} pts`, status: totalRemaining === 0 ? "good" : totalRemaining < 20 ? "warning" : "neutral" as any },
    { label: "Progresso Médio", value: `${avgProgress}%`, status: avgProgress >= 80 ? "good" : avgProgress >= 60 ? "warning" : "danger" as any },
  ];

  function handleExport() {
    exportToCSV(
      burnData.map((d) => ({ Sprint: d.sprint, "HUs Total": d.totalHUs, "HUs Concluídas": d.doneHUs, "Pts Total": d.totalPts, "Pts Concluídos": d.donePts, Restante: d.remaining, "Progresso %": d.progress })),
      `burndown_${teamName}`,
    );
  }

  return (
    <ReportLayout>
      <ReportPageHeader
        title="Burndown"
        description={`Time: ${teamName}`}
        icon={<TrendingDown className="h-5 w-5" />}
        badge="Ágil"
        onBack={onBack}
        onExportCSV={handleExport}
      />

      <ReportFilterBar
        fields={[{ key: "sprintQtd", label: "Últimas N sprints", type: "select", options: [
          { value: "3", label: "3 sprints" }, { value: "5", label: "5 sprints" },
          { value: "8", label: "8 sprints" }, { value: "12", label: "12 sprints" },
        ]}]}
        values={filters}
        onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onReset={() => setFilters({ sprintQtd: "5" })}
      />

      <ReportKPISummary items={kpis} cols={4} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportChart title="HUs Concluídas vs. Total" subtitle="Por sprint" height="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={burnData} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="sprint" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="totalHUs" name="Total" fill="#e2e8f0" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="doneHUs" name="Concluídas" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={40}>
                <LabelList dataKey="doneHUs" position="top" style={{ fontSize: 11, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ReportChart>

        <ReportChart title="Pontos Restantes" subtitle="Story Points ainda abertos por sprint" height="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={burnData} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="remainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="sprint" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => [`${v} pts`, "Restante"]} />
              <Area type="monotone" dataKey="remaining" stroke="#8b5cf6" strokeWidth={2} fill="url(#remainGrad)" name="Restante" />
            </AreaChart>
          </ResponsiveContainer>
        </ReportChart>
      </div>

      <ReportDataTable
        title="Detalhamento por Sprint"
        badge={burnData.length}
        data={burnData}
        rowKey={(r) => r.sprint}
        columns={[
          { key: "sprint", header: "Sprint", sortable: true },
          { key: "totalHUs", header: "HUs Total", align: "center", sortable: true },
          { key: "doneHUs", header: "Concluídas", align: "center", sortable: true,
            render: (v) => <span className="font-semibold text-emerald-600">{v}</span> },
          { key: "totalPts", header: "Pts Total", align: "center" },
          { key: "donePts", header: "Pts Concl.", align: "center", sortable: true },
          { key: "remaining", header: "Restante", align: "center", sortable: true,
            render: (v) => <span className={v > 0 ? "text-amber-600 font-semibold" : "text-emerald-600"}>{v} pts</span> },
          { key: "progress", header: "Progresso", align: "center", sortable: true,
            render: (v) => (
              <Badge className={`text-[10px] ${ v >= 80 ? "bg-emerald-500/15 text-emerald-600" : v >= 60 ? "bg-amber-400/15 text-amber-600" : "bg-red-500/15 text-red-600" }`}>
                {v}%
              </Badge>
            ) },
        ]}
      />
    </ReportLayout>
  );
}
