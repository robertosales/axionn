import { useMemo, useState } from "react";
import { LayoutList, FileText } from "lucide-react";
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
import { Button } from "@/components/ui/button";

interface Props {
  sprints: { id: string; name: string; isActive?: boolean }[];
  developers: { id: string; name: string; role: string }[];
  rawData: { sprints: any[]; hus: any[]; activities: any[]; impediments: any[]; developers: any[] };
  teamName: string;
  currentUserName: string;
  onBack: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  aguardando_desenvolvimento: "Aguardando",
  em_desenvolvimento: "Em Dev.",
  em_code_review: "Code Review",
  em_teste: "Em Teste",
  bug: "Bug",
  pronto_para_publicacao: "Publicada",
};

const STATUS_COLORS: Record<string, string> = {
  backlog: "#64748b",
  aguardando_desenvolvimento: "#94a3b8",
  em_desenvolvimento: "#3b82f6",
  em_code_review: "#8b5cf6",
  em_teste: "#f59e0b",
  bug: "#ef4444",
  pronto_para_publicacao: "#22c55e",
};

// Normaliza status: qualquer valor backlog_* vira 'backlog'
function normalizeStatus(s: string): string {
  if (!s) return "backlog";
  if (s.startsWith("backlog")) return "backlog";
  return s;
}

function getStatusLabel(s: string): string {
  return STATUS_LABELS[normalizeStatus(s)] ?? s;
}

function getStatusColor(s: string): string {
  return STATUS_COLORS[normalizeStatus(s)] ?? "#94a3b8";
}

// ─── Gráfico pizza SVG puro
function buildPieSVG(data: { name: string; value: number; color: string }[]): string {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return '<p style="color:#94a3b8;font-size:11px">Sem dados</p>';
  const cx = 90; const cy = 90; const r = 80;
  let paths = ""; let startAngle = -Math.PI / 2;
  const legendItems: string[] = [];
  for (const slice of data) {
    const angle = (slice.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle); const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);   const y2 = cy + r * Math.sin(endAngle);
    const large = angle > Math.PI ? 1 : 0;
    const midA = startAngle + angle / 2;
    const lx = cx + r * 0.65 * Math.cos(midA); const ly = cy + r * 0.65 * Math.sin(midA);
    const pct = Math.round((slice.value / total) * 100);
    paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z" fill="${slice.color}" stroke="#fff" stroke-width="2"/>`;
    if (pct >= 5) paths += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="10" font-weight="700">${pct}%</text>`;
    legendItems.push(`<div style="display:flex;align-items:center;gap:6px;font-size:10px"><span style="width:10px;height:10px;border-radius:2px;background:${slice.color};flex-shrink:0"></span><span>${slice.name}: <strong>${slice.value}</strong></span></div>`);
    startAngle = endAngle;
  }
  return `<div style="display:flex;align-items:center;gap:24px"><svg width="180" height="180" viewBox="0 0 180 180">${paths}</svg><div style="display:flex;flex-direction:column;gap:6px">${legendItems.join("")}</div></div>`;
}

// ─── Gráfico barras horizontais SVG puro
function buildBarSVG(memberData: { name: string; done: number; inProg: number; pending: number; total: number }[]): string {
  if (memberData.length === 0) return '<p style="color:#94a3b8;font-size:11px">Sem dados</p>';
  const maxVal = Math.max(...memberData.map(d => d.total), 1);
  const barH = 18; const gap = 10; const labelW = 64; const chartW = 320;
  const svgH = memberData.length * (barH + gap) + 30;
  let bars = "";
  memberData.forEach((d, i) => {
    const y = 20 + i * (barH + gap);
    const doneW = (d.done / maxVal) * chartW;
    const progW = (d.inProg / maxVal) * chartW;
    const pendW = (d.pending / maxVal) * chartW;
    bars += `
      <text x="${labelW - 4}" y="${y + barH / 2 + 1}" text-anchor="end" font-size="10" fill="#475569" dominant-baseline="middle">${d.name}</text>
      <rect x="${labelW}" y="${y}" width="${doneW}" height="${barH}" fill="#22c55e"/>
      <rect x="${labelW + doneW}" y="${y}" width="${progW}" height="${barH}" fill="#3b82f6"/>
      <rect x="${labelW + doneW + progW}" y="${y}" width="${pendW}" height="${barH}" fill="#94a3b8"/>
      <text x="${labelW + doneW + progW + pendW + 4}" y="${y + barH / 2 + 1}" font-size="10" fill="#64748b" dominant-baseline="middle">${d.total}</text>`;
  });
  const legend = [
    { color: "#22c55e", label: "Concluídas" },
    { color: "#3b82f6", label: "Em Progresso" },
    { color: "#94a3b8", label: "Pendentes" },
  ].map(l => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:9px;margin-right:10px"><span style="width:10px;height:10px;background:${l.color};border-radius:2px"></span>${l.label}</span>`).join("");
  return `<svg width="${labelW + chartW + 40}" height="${svgH}" viewBox="0 0 ${labelW + chartW + 40} ${svgH}"><text x="${labelW + chartW / 2}" y="12" text-anchor="middle" font-size="10" fill="#94a3b8">HUs por membro</text>${bars}</svg><div style="margin-top:6px">${legend}</div>`;
}

// ─── Gerador do PDF
function exportBacklogPDF({
  tableData, statusData, memberData,
  total, done, inProgress, pending,
  teamName, currentUserName,
}: {
  tableData: any[];
  statusData: { name: string; value: number; color: string }[];
  memberData: { name: string; done: number; inProg: number; pending: number; total: number }[];
  total: number; done: number; inProgress: number; pending: number;
  teamName: string; currentUserName: string;
}) {
  const now = new Date();
  const emittedAt = now.toLocaleDateString("pt-BR") + " às " + now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const pieSVG = buildPieSVG(statusData);
  const barSVG = buildBarSVG(memberData);

  const rows = tableData.map((r, i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    const dotColor = getStatusColor(r.status);
    const label = getStatusLabel(r.status);
    const endDateFmt = r.endDate ? new Date(r.endDate + "T00:00:00").toLocaleDateString("pt-BR") : "—";
    return `<tr style="background:${bg};border-bottom:1px solid #e2e8f0">
      <td style="padding:6px 10px;font-family:monospace;font-size:10px;color:#64748b;white-space:nowrap">${r.code}</td>
      <td style="padding:6px 10px;font-size:10px">${r.title}</td>
      <td style="padding:6px 10px;text-align:center">
        <span style="display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:600;color:${dotColor}">
          <span style="width:7px;height:7px;border-radius:50%;background:${dotColor};display:inline-block"></span>${label}
        </span>
      </td>
      <td style="padding:6px 10px;text-align:center;font-size:10px">${r.priority}</td>
      <td style="padding:6px 10px;font-size:10px">${r.sprint}</td>
      <td style="padding:6px 10px;font-size:10px">${r.member}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10px;font-weight:700;color:#4f46e5">${r.points ?? 0}</td>
      <td style="padding:6px 10px;text-align:center;font-size:10px">${endDateFmt}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Backlog — ${teamName}</title>
  <style>* { box-sizing:border-box;margin:0;padding:0; } body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#1e293b;}
    .header{background:linear-gradient(135deg,#4f46e5 0%,#6366f1 100%);color:#fff;padding:18px 40px 16px;display:flex;justify-content:space-between;align-items:flex-start;}
    .org{font-size:16px;font-weight:700;} .report-title{font-size:11px;font-weight:600;margin-top:4px;opacity:.9;}
    .header-right{text-align:right;font-size:10px;opacity:.9;line-height:1.8;}
    .kpis{display:flex;gap:16px;padding:20px 40px 0;}
    .kpi{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;background:#f8fafc;}
    .kpi-label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;}
    .kpi-value{font-size:26px;font-weight:700;margin-top:4px;color:#1e293b;}
    .kpi.good .kpi-value{color:#16a34a;} .kpi.warn .kpi-value{color:#d97706;}
    .kpi.danger .kpi-value{color:#dc2626;} .kpi.purple .kpi-value{color:#4f46e5;}
    .charts{display:flex;gap:24px;padding:20px 40px 0;}
    .chart-box{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;background:#f8fafc;}
    .chart-title{font-size:11px;font-weight:700;color:#1e293b;margin-bottom:12px;}
    .section-title{padding:20px 40px 8px;font-size:12px;font-weight:700;color:#1e293b;border-bottom:2px solid #4f46e5;margin:0 40px;}
    .wrap{padding:12px 40px 32px;} table{width:100%;border-collapse:collapse;}
    thead tr{background:#4f46e5;color:#fff;}
    thead th{padding:8px 10px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;}
    .footer{border-top:1px solid #e2e8f0;padding:10px 40px;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between;}
    @media print{.header,thead tr,.kpi,.chart-box{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
  </style></head><body>
  <div class="header">
    <div><div class="org">Axion — Operações &amp; Fluxo Ágil</div><div class="report-title">📄 Backlog &nbsp;·&nbsp; Time: ${teamName}</div></div>
    <div class="header-right">Emitido em: ${emittedAt}<br/>Por: ${currentUserName}</div>
  </div>
  <div class="kpis">
    <div class="kpi purple"><div class="kpi-label">Total HUs</div><div class="kpi-value">${total}</div></div>
    <div class="kpi good"><div class="kpi-label">Concluídas</div><div class="kpi-value">${done}</div></div>
    <div class="kpi warn"><div class="kpi-label">Em Progresso</div><div class="kpi-value">${inProgress}</div></div>
    <div class="kpi ${pending > 0 ? "danger" : "good"}"><div class="kpi-label">Pendentes</div><div class="kpi-value">${pending}</div></div>
  </div>
  <div class="charts">
    <div class="chart-box"><div class="chart-title">📈 HUs por Status</div>${pieSVG}</div>
    <div class="chart-box"><div class="chart-title">👥 HUs por Membro</div>${barSVG}</div>
  </div>
  <div class="section-title">Detalhamento do Backlog &nbsp;<span style="font-size:10px;font-weight:400;color:#64748b">(${tableData.length} HUs)</span></div>
  <div class="wrap"><table>
    <thead><tr>
      <th style="width:80px">Código</th><th>Título</th><th style="width:96px">Status</th>
      <th style="width:72px">Prioridade</th><th style="width:100px">Sprint</th>
      <th style="width:120px">Responsável</th><th style="width:56px;text-align:center">Pontos</th>
      <th style="width:80px;text-align:center">Data Fim</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <div class="footer">
    <span>Axion · Sala Ágil · Relatório de Backlog · gerado automaticamente</span>
    <span>${tableData.length} HUs listadas</span>
  </div>
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
    finally { setTimeout(() => document.body.removeChild(iframe), 2000); }
  }, 600);
}

// ─── Componente principal
export function RelatorioBacklog({ sprints, developers, rawData, teamName, currentUserName, onBack }: Props) {
  const [filters, setFilters] = useState<Record<string, string>>({ sprintId: "all", memberId: "all" });

  const sprintOptions = [{ value: "all", label: "Todas" }, ...sprints.map((s) => ({ value: s.id, label: s.name }))];
  const memberOptions = [{ value: "all", label: "Todos" }, ...developers.map((d) => ({ value: d.id, label: d.name }))];

  const hus = useMemo(() => {
    let data = rawData.hus;
    if (filters.sprintId !== "all") data = data.filter((h: any) => h.sprint_id === filters.sprintId);
    return data;
  }, [rawData.hus, filters.sprintId]);

  // Usa status normalizado para agrupamento
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    hus.forEach((h: any) => {
      const norm = normalizeStatus(h.status);
      counts[norm] = (counts[norm] || 0) + 1;
    });
    return Object.entries(counts).map(([key, value]) => ({
      name: STATUS_LABELS[key] ?? key, value, color: STATUS_COLORS[key] ?? "#94a3b8",
    })).sort((a, b) => b.value - a.value);
  }, [hus]);

  const memberData = useMemo(() => {
    return developers.map((dev) => {
      const devHuIds = new Set(rawData.activities.filter((a: any) => a.assignee_id === dev.id).map((a: any) => a.hu_id));
      const devHUs = hus.filter((h: any) => devHuIds.has(h.id));
      const done = devHUs.filter((h: any) => normalizeStatus(h.status) === "pronto_para_publicacao").length;
      const inProg = devHUs.filter((h: any) => ["em_desenvolvimento", "em_code_review", "em_teste"].includes(normalizeStatus(h.status))).length;
      const pending = devHUs.length - done - inProg;
      return { name: dev.name.split(" ")[0], done, inProg, pending, total: devHUs.length };
    }).filter((d) => d.total > 0);
  }, [hus, developers, rawData.activities]);

  const total = hus.length;
  const done = hus.filter((h: any) => normalizeStatus(h.status) === "pronto_para_publicacao").length;
  const inProgress = hus.filter((h: any) => ["em_desenvolvimento", "em_code_review", "em_teste"].includes(normalizeStatus(h.status))).length;
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
    const dev = acts.length > 0 ? developers.find((d) => d.id === acts[0].assignee_id) : null;
    return {
      code: h.code || "—", title: h.title, status: h.status, priority: h.priority || "—",
      sprint: sprint?.name || "—", member: dev?.name || "—",
      points: h.story_points || 0, endDate: h.end_date || "",
    };
  });

  function handleExportCSV() {
    exportToCSV(
      tableData.map((r) => ({
        Código: r.code, Título: r.title,
        Status: getStatusLabel(r.status),
        Prioridade: r.priority, Sprint: r.sprint,
        Responsável: r.member, Pontos: r.points, "Data Fim": r.endDate,
      })),
      `backlog_${teamName}`,
    );
  }

  function handleExportPDF() {
    exportBacklogPDF({ tableData, statusData, memberData, total, done, inProgress, pending, teamName, currentUserName });
  }

  return (
    <ReportLayout>
      <ReportPageHeader
        title="Backlog"
        description={`Time: ${teamName}`}
        icon={<LayoutList className="h-5 w-5" />}
        badge="Ágil"
        onBack={onBack}
        onExportCSV={handleExportCSV}
        extraActions={
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Exportar PDF
          </Button>
        }
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
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                label={({ name, value }) => `${name}: ${value}`} labelLine fontSize={11}>
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
              <Bar dataKey="done" name="Concluídas" stackId="a" fill="#22c55e" />
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
          {
            key: "status", header: "Status", align: "center",
            render: (v) => {
              const color = getStatusColor(v);
              const label = getStatusLabel(v);
              return (
                <Badge className="text-[10px]" style={{ background: `${color}20`, color }}>
                  {label}
                </Badge>
              );
            },
          },
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
