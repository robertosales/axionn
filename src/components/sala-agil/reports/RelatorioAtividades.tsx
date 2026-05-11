import { useMemo, useState } from "react";
import { User, CheckCircle, Clock, Zap, Bug, FileDown, Eye } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, LineChart, Line, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/personName";
import { formatMinutes } from "@/lib/duration";
import { toast } from "sonner";

interface Props {
  sprints:     { id: string; name: string; isActive?: boolean; start_date?: string; end_date?: string }[];
  developers:  { id: string; name: string; role: string }[];
  rawData: {
    sprints:      any[];
    hus:          any[];
    activities:   any[];
    impediments:  any[];
    developers:   any[];
  };
  teamName:        string;
  currentUserName: string;
  onBack:          () => void;
}

const MEMBER_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ef4444", "#06b6d4", "#ec4899", "#f97316",
];

const AGIL_PRIMARY: [number, number, number] = [22, 163, 74];
const AGIL_DARK:    [number, number, number] = [20, 83, 45];
const AGIL_LIGHT:   [number, number, number] = [220, 252, 231];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return MEMBER_COLORS[Math.abs(h) % MEMBER_COLORS.length];
}

function effStatus(e: number): "good" | "warning" | "danger" {
  return e >= 80 ? "good" : e >= 60 ? "warning" : "danger";
}

function fmtDate(d: string) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

function fmtDatePDF(d: string) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function trunc(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** Decimal ou "H:mm" → minutos inteiros */
function toMin(val: number | string | null | undefined): number {
  if (val === null || val === undefined || val === "") return 0;
  const s = String(val);
  // formato "H:mm" ou "HH:mm"
  if (s.includes(":")) {
    const [h, m] = s.split(":").map(Number);
    return (isFinite(h) ? h : 0) * 60 + (isFinite(m) ? m : 0);
  }
  const n = Number(s);
  return isFinite(n) ? Math.round(n * 60) : 0;
}

/** Formata para "Xh Ymin" */
function fmtH(val: number | string | null | undefined): string {
  return formatMinutes(toMin(val));
}

/**
 * Retorna a data de lançamento da atividade.
 * Preferência: created_at → start_date → end_date → "".
 */
function lancamentoDate(act: any): string {
  return (act.created_at || act.start_date || act.end_date || "").slice(0, 10);
}

// ─── Estrutura para agrupamento HU → Data → Atividades
interface DayGroup {
  date: string;          // "YYYY-MM-DD"
  rows: any[];
  totalMin: number;
}
interface HuGroup {
  huCode:   string;
  huTitle:  string;
  days:     DayGroup[];
  totalMin: number;
}

function groupByHuDate(acts: any[]): HuGroup[] {
  // Map: huKey → Map: date → rows[]
  const huMap = new Map<string, { huCode: string; huTitle: string; dateMap: Map<string, any[]> }>();

  for (const row of acts) {
    const huKey   = row.hu !== "—" ? row.hu : "SEM-HU";
    const date    = lancamentoDate(row);

    if (!huMap.has(huKey)) {
      huMap.set(huKey, { huCode: row.hu, huTitle: row._huTitle || "", dateMap: new Map() });
    }
    const huEntry = huMap.get(huKey)!;
    if (!huEntry.dateMap.has(date)) huEntry.dateMap.set(date, []);
    huEntry.dateMap.get(date)!.push(row);
  }

  const result: HuGroup[] = [];
  for (const [, hu] of huMap) {
    const days: DayGroup[] = [];
    // Ordena datas
    const sortedDates = [...hu.dateMap.keys()].sort();
    for (const date of sortedDates) {
      const rows = hu.dateMap.get(date)!;
      const totalMin = rows.reduce((s: number, r: any) => s + toMin(r.horas), 0);
      days.push({ date, rows, totalMin });
    }
    const totalMin = days.reduce((s, d) => s + d.totalMin, 0);
    result.push({ huCode: hu.huCode, huTitle: hu.huTitle, days, totalMin });
  }
  return result;
}

// ─── Gera PDF agrupado por HU → Data
async function buildPDFBlob(
  memberMetrics: ReturnType<typeof buildMemberMetrics>,
  tableData: any[],
  teamName: string,
  currentUserName: string,
  sprintLabel: string,
  filters: Record<string, string>,
): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const now = new Date();
  const W   = doc.internal.pageSize.getWidth();
  const ML  = 12;
  const MR  = 12;
  const CW  = W - ML - MR;

  const DARK:     [number, number, number] = [15,  23,  42];
  const MUTED:    [number, number, number] = [100, 116, 139];
  const LIGHT_BG: [number, number, number] = [248, 250, 252];
  const BORDER:   [number, number, number] = [226, 232, 240];
  const ALT_ROW:  [number, number, number] = [248, 250, 252];
  const TOTAL_BG: [number, number, number] = [241, 245, 249];
  const HEAD_ROW: [number, number, number] = [30,  41,  59];
  const DAY_BG:   [number, number, number] = [236, 252, 243];   // verde suave para linha de data
  const HU_BG:    [number, number, number] = [220, 252, 231];   // verde médio para header HU
  const HU_TOTAL: [number, number, number] = [187, 247, 208];   // verde forte para total HU

  // Agrupa tableData por membro
  const memberMap = new Map<string, typeof tableData>();
  for (const row of tableData) {
    if (!memberMap.has(row._assigneeId)) memberMap.set(row._assigneeId, []);
    memberMap.get(row._assigneeId)!.push(row);
  }

  const targets = filters.memberId !== "all"
    ? memberMetrics.filter(m => m.id === filters.memberId)
    : memberMetrics;

  targets.forEach((member, idx) => {
    if (idx > 0) doc.addPage();

    // ── Cabeçalho
    doc.setFillColor(...AGIL_PRIMARY);
    doc.rect(0, 0, W, 26, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE ATIVIDADES & PRODUTIVIDADE INDIVIDUAL", ML, 10);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text("Módulo: Sala Ágil", ML, 16);
    doc.text(
      `Gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}  ·  Por: ${currentUserName}`,
      ML, 21,
    );

    let y = 31;

    // ── Card do membro
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(ML, y, CW, 18, 2, 2, "F");
    doc.setDrawColor(...BORDER);
    doc.roundedRect(ML, y, CW, 18, 2, 2, "S");
    doc.setFillColor(...AGIL_PRIMARY);
    doc.circle(ML + 8, y + 9, 5.5, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
    doc.text(getInitials(member.name), ML + 8, y + 11, { align: "center" });
    doc.setTextColor(...DARK); doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(member.name, ML + 17, y + 8);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
    doc.text(member.role, ML + 17, y + 14);
    doc.setFontSize(7.5);
    doc.text(
      `Sprint: ${sprintLabel}  ·  Time: ${teamName}`,
      ML + CW - 3, y + 11, { align: "right" },
    );
    y += 23;

    // ── KPIs
    doc.setTextColor(...DARK); doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("RESUMO DO MEMBRO", ML, y);
    y += 3;
    const kpiW = CW / 5;
    const kpis = [
      { label: "Atividades",   value: String(member.total),  bg: [219, 234, 254] as [number,number,number], txt: [30, 64, 175]  as [number,number,number] },
      { label: "Concluídas",   value: String(member.closed), bg: AGIL_LIGHT,                               txt: AGIL_DARK },
      { label: "Em Aberto",    value: String(member.open),   bg: [255, 237, 213] as [number,number,number], txt: [154, 52, 18]  as [number,number,number] },
      { label: "Eficiência",   value: `${member.eff}%`,      bg: [243, 232, 255] as [number,number,number], txt: [109, 40, 217] as [number,number,number] },
      { label: "Horas Concl.", value: fmtH(member.hoursC),   bg: [219, 234, 254] as [number,number,number], txt: AGIL_PRIMARY },
    ];
    kpis.forEach(({ label, value, bg, txt }, i) => {
      const x = ML + i * kpiW;
      doc.setFillColor(...bg); doc.roundedRect(x, y, kpiW - 1.5, 15, 1.5, 1.5, "F");
      doc.setTextColor(...MUTED); doc.setFontSize(6); doc.setFont("helvetica", "normal");
      doc.text(label.toUpperCase(), x + (kpiW - 1.5) / 2, y + 5, { align: "center" });
      doc.setTextColor(...txt); doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(value, x + (kpiW - 1.5) / 2, y + 13, { align: "center" });
    });
    y += 20;

    // ── Tabela agrupada HU → Data → Atividades
    const acts    = memberMap.get(member.id) ?? [];
    const huGroups = groupByHuDate(acts);
    const totalMin = acts.reduce((s: number, r: any) => s + toMin(r.horas), 0);

    const body: any[][] = [];

    for (const hu of huGroups) {
      // Cabeçalho da HU
      body.push([{
        content: hu.huCode !== "—"
          ? `${hu.huCode}${hu.huTitle ? "  —  " + hu.huTitle : ""}   |   Total HU: ${formatMinutes(hu.totalMin)}`
          : `SEM HU  —  Total: ${formatMinutes(hu.totalMin)}`,
        colSpan: 3,
        styles: {
          fillColor: HU_BG,
          textColor: AGIL_DARK,
          fontStyle: "bold",
          fontSize: 8.5,
        },
      }]);

      for (const day of hu.days) {
        // Linha de data (subtítulo do dia)
        body.push([{
          content: `${day.date ? fmtDatePDF(day.date) : "Sem data"}   —   Total do dia: ${formatMinutes(day.totalMin)}`,
          colSpan: 3,
          styles: {
            fillColor: DAY_BG,
            textColor: [30, 90, 55] as [number,number,number],
            fontStyle: "italic",
            fontSize: 7.5,
          },
        }]);

        // Atividades do dia
        for (const r of day.rows) {
          body.push([
            { content: r._code || "—", styles: { fontStyle: "normal", textColor: MUTED, fontSize: 7.5 } },
            { content: trunc(r.titulo, 110), styles: { fontStyle: "normal", fontSize: 8 } },
            {
              content: fmtH(r.horas),
              styles: { fontStyle: "bold", textColor: AGIL_PRIMARY, halign: "center", fontSize: 8 },
            },
          ]);
        }

        // Subtotal do dia
        body.push([
          { content: "", styles: { fillColor: TOTAL_BG } },
          {
            content: `Subtotal — ${day.date ? fmtDatePDF(day.date) : "Sem data"}`,
            styles: { fillColor: TOTAL_BG, textColor: MUTED, fontStyle: "bold", fontSize: 7.5 },
          },
          {
            content: formatMinutes(day.totalMin),
            styles: { fillColor: TOTAL_BG, textColor: AGIL_PRIMARY, fontStyle: "bold", halign: "center", fontSize: 8 },
          },
        ]);
      }

      // Total da HU (linha destacada ao final de cada HU)
      if (huGroups.length > 1 || hu.huCode !== "—") {
        body.push([
          { content: "", styles: { fillColor: HU_TOTAL } },
          {
            content: `TOTAL  ${hu.huCode !== "—" ? hu.huCode : "SEM HU"}`,
            styles: { fillColor: HU_TOTAL, textColor: AGIL_DARK, fontStyle: "bold", fontSize: 8 },
          },
          {
            content: formatMinutes(hu.totalMin),
            styles: { fillColor: HU_TOTAL, textColor: AGIL_DARK, fontStyle: "bold", halign: "center", fontSize: 9 },
          },
        ]);
      }
    }

    autoTable(doc, {
      head: [["Código", "Título da Atividade", "Duração"]],
      body,
      startY: y,
      styles:             { fontSize: 8, cellPadding: 2.5, lineColor: BORDER, lineWidth: 0.1 },
      headStyles:         { fillColor: HEAD_ROW, textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: ALT_ROW },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 195 },   // título ampliado — aproveita largura
        2: { cellWidth: 33, fontStyle: "bold", textColor: AGIL_PRIMARY, halign: "center" },
      },
      margin: { left: ML, right: MR },
      tableLineColor: BORDER,
      tableLineWidth: 0.15,
    });

    const finalY = (doc as any).lastAutoTable.finalY + 6;
    const pageH  = doc.internal.pageSize.getHeight();

    // Total geral
    const summaryY = Math.min(finalY, pageH - 20);
    doc.setFillColor(...AGIL_PRIMARY);
    doc.roundedRect(ML, summaryY, CW, 11, 2, 2, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text(
      `Total: ${formatMinutes(totalMin)} lançadas  ·  ${acts.length} atividades`,
      ML + 4, summaryY + 7.5,
    );
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(
      `Cycle Time médio: ${member.cycleTime > 0 ? member.cycleTime + "d" : "—"}`,
      ML + CW - 4, summaryY + 7.5, { align: "right" },
    );

    // Rodapé paginação
    const total = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
      doc.text(`Página ${i} de ${total}`, W - MR, pageH - 6, { align: "right" });
      doc.text("Documento gerado automaticamente pelo sistema — Sala Ágil", W / 2, pageH - 6, { align: "center" });
    }
  });

  return doc.output("blob");
}

// ─── Métricas por membro
function buildMemberMetrics(
  developers: Props["developers"],
  filteredActivities: any[],
) {
  return developers.map((dev) => {
    const acts       = filteredActivities.filter((a: any) => a.assignee_id === dev.id);
    const closed     = acts.filter((a: any) => a.is_closed);
    const hoursP     = acts.reduce((s: number, a: any) => s + Number(a.hours), 0);
    const hoursC     = closed.reduce((s: number, a: any) => s + Number(a.hours), 0);
    const bugs       = acts.filter((a: any) => a.activity_type === "bug");
    const bugsClosed = bugs.filter((a: any) => a.is_closed);
    const eff        = hoursP > 0 ? Math.round((hoursC / hoursP) * 100) : 0;
    const cycleTime  = (() => {
      const withDates = closed.filter((a: any) => a.start_date && (a.closed_at || a.end_date));
      if (!withDates.length) return 0;
      const total = withDates.reduce((s: number, a: any) => {
        const end = a.closed_at || a.end_date;
        return s + Math.max(0, (new Date(end).getTime() - new Date(a.start_date).getTime()) / 86400000);
      }, 0);
      return Math.round((total / withDates.length) * 10) / 10;
    })();
    return {
      id: dev.id, name: dev.name, role: dev.role,
      total: acts.length, closed: closed.length, open: acts.length - closed.length,
      hoursP, hoursC, hoursPending: hoursP - hoursC, eff,
      bugs: bugs.length, bugsClosed: bugsClosed.length, cycleTime,
      acts,
    };
  }).filter((m) => m.total > 0);
}

export function RelatorioAtividades({ sprints, developers, rawData, teamName, currentUserName, onBack }: Props) {
  const [filters, setFilters] = useState<Record<string, string>>({
    sprintId: "all", memberId: "all", type: "all", status: "all",
  });

  const [exportingPDF, setExportingPDF] = useState(false);
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const [previewBlob,  setPreviewBlob]  = useState<Blob | null>(null);
  const [previewNome,  setPreviewNome]  = useState<string>("");

  const sprintOptions = [
    { value: "all", label: "Todas" },
    ...sprints.map((s) => ({ value: s.id, label: s.name })),
  ];
  const memberOptions = [
    { value: "all", label: "Todos" },
    ...developers.map((d) => ({ value: d.id, label: d.name })),
  ];
  const typeOptions = [
    { value: "all",         label: "Todos"    },
    { value: "task",        label: "Tarefa"   },
    { value: "bug",         label: "Bug"      },
    { value: "improvement", label: "Melhoria" },
    { value: "feature",     label: "Feature"  },
  ];
  const statusOptions = [
    { value: "all",  label: "Todos"     },
    { value: "done", label: "Concluída" },
    { value: "open", label: "Em aberto" },
  ];

  const filteredActivities = useMemo(() => {
    let acts = rawData.activities;
    if (filters.sprintId !== "all") {
      const huIds = new Set(
        rawData.hus.filter((h: any) => h.sprint_id === filters.sprintId).map((h: any) => h.id),
      );
      acts = acts.filter((a: any) => huIds.has(a.hu_id));
    }
    if (filters.memberId !== "all") acts = acts.filter((a: any) => a.assignee_id === filters.memberId);
    if (filters.type     !== "all") acts = acts.filter((a: any) => a.activity_type === filters.type);
    if (filters.status === "done")  acts = acts.filter((a: any) =>  a.is_closed);
    if (filters.status === "open")  acts = acts.filter((a: any) => !a.is_closed);
    return acts;
  }, [rawData, filters]);

  const memberMetrics = useMemo(
    () => buildMemberMetrics(developers, filteredActivities),
    [filteredActivities, developers],
  );

  const totalActs   = filteredActivities.length;
  const totalClosed = filteredActivities.filter((a: any) => a.is_closed).length;
  const totalMinP   = filteredActivities.reduce((s: number, a: any) => s + toMin(a.hours), 0);
  const totalMinC   = filteredActivities.filter((a: any) => a.is_closed)
                        .reduce((s: number, a: any) => s + toMin(a.hours), 0);
  const avgEff      = memberMetrics.length > 0
    ? Math.round(memberMetrics.reduce((s, m) => s + m.eff, 0) / memberMetrics.length)
    : 0;

  const kpis = [
    {
      label:  "Atividades",
      value:  totalActs,
      sub:    `${totalClosed} concluídas`,
      icon:   <CheckCircle className="h-4 w-4" />,
      status: totalClosed > 0 ? "good" : "neutral" as any,
    },
    {
      label:  "Horas Concluídas",
      value:  formatMinutes(totalMinC),
      sub:    `de ${formatMinutes(totalMinP)} planejadas`,
      icon:   <Clock className="h-4 w-4" />,
      status: (totalMinP > 0 && totalMinC / totalMinP >= 0.7) ? "good" : "warning" as any,
    },
    {
      label:  "Eficiência Média",
      value:  `${avgEff}%`,
      sub:    "meta ≥ 80%",
      icon:   <Zap className="h-4 w-4" />,
      status: effStatus(avgEff),
    },
    {
      label:  "Membros Ativos",
      value:  memberMetrics.length,
      sub:    `de ${developers.length} no time`,
      icon:   <User className="h-4 w-4" />,
      status: "neutral" as any,
    },
  ];

  const hoursBarData = memberMetrics.map((m) => ({
    name:         m.name.split(" ")[0],
    "Concluídas": parseFloat(m.hoursC.toFixed(4)),
    Pendentes:    parseFloat(m.hoursPending.toFixed(4)),
    _labelC:      fmtH(m.hoursC),
    _labelP:      fmtH(m.hoursPending),
  }));

  const throughputData = useMemo(() => {
    return [...rawData.sprints]
      .sort((a: any, b: any) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))
      .slice(-6)
      .map((sprint: any) => {
        const huIds = new Set(rawData.hus.filter((h: any) => h.sprint_id === sprint.id).map((h: any) => h.id));
        const entry: any = { sprint: sprint.name };
        developers.forEach((dev) => {
          entry[dev.name.split(" ")[0]] = rawData.activities.filter(
            (a: any) => huIds.has(a.hu_id) && a.assignee_id === dev.id && a.is_closed,
          ).length;
        });
        return entry;
      });
  }, [rawData, developers]);

  const radarData = memberMetrics.slice(0, 6).map((m) => ({
    membro:            m.name.split(" ")[0],
    Eficiência:        m.eff,
    "Concluídas":      Math.min(100, Math.round((m.closed / Math.max(m.total, 1)) * 100)),
    "Bugs Resolvidos": m.bugs > 0 ? Math.round((m.bugsClosed / m.bugs) * 100) : 100,
  }));

  // Tabela de atividades para tela (mantém Início/Fim; remove repetição de HU por linha)
  const tableData = useMemo(() => {
    return filteredActivities.map((a: any) => {
      const dev    = developers.find((d) => d.id === a.assignee_id);
      const hu     = rawData.hus.find((h: any) => h.id === a.hu_id);
      const sprint = hu ? rawData.sprints.find((s: any) => s.id === hu.sprint_id) : null;
      return {
        membro:       dev?.name       || "—",
        titulo:       a.title,
        sprint:       sprint?.name    || "—",
        hu:           hu?.code        || "—",
        horas:        a.hours,                   // string "H:mm" ou decimal
        lancamento:   lancamentoDate(a),
        inicio:       a.start_date    || "",
        fim:          a.end_date      || "",
        status:       a.is_closed,
        _code:        a.code          || "",
        _huTitle:     hu?.title       || "",
        _role:        dev?.role       || "",
        _assigneeId:  a.assignee_id,
        _sprintName:  sprint?.name    || "",
      };
    });
  }, [filteredActivities, developers, rawData]);

  function handleExportCSV() {
    exportToCSV(
      tableData.map((r) => ({
        Membro:                r.membro,
        Código:                r._code,
        "Título da Atividade": r.titulo,
        Sprint:                r.sprint,
        HU:                    r.hu,
        "Data Lançamento":     r.lancamento ? fmtDate(r.lancamento) : "",
        Duração:               fmtH(r.horas),
        Status:                r.status ? "Concluída" : "Em aberto",
      })),
      `atividades_${teamName}`,
    );
  }

  async function handleExportPDF() {
    if (memberMetrics.length === 0) { toast.error("Nenhum dado para gerar o relatório."); return; }
    setExportingPDF(true);
    try {
      const selectedSprint = filters.sprintId !== "all"
        ? rawData.sprints.find((s: any) => s.id === filters.sprintId)
        : null;
      const blob = await buildPDFBlob(
        memberMetrics, tableData, teamName, currentUserName,
        selectedSprint?.name ?? "Todas as Sprints", filters,
      );
      const url = URL.createObjectURL(blob);
      setPreviewBlob(blob);
      setPreviewUrl(url);
      setPreviewNome(teamName);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar pré-visualização do relatório.");
    } finally {
      setExportingPDF(false);
    }
  }

  function handleDownloadFromPreview() {
    if (!previewBlob) return;
    const selectedSprint = filters.sprintId !== "all"
      ? rawData.sprints.find((s: any) => s.id === filters.sprintId)
      : null;
    const sprintLabel = (selectedSprint?.name ?? "todas-sprints").replace(/\s+/g, "-");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(previewBlob);
    a.download = `atividades_${teamName}_${sprintLabel}.pdf`.replace(/\s+/g, "-");
    a.click();
    toast.success("Relatório exportado com sucesso!");
  }

  function handleClosePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
  }

  const exportActions = (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-1.5 h-8">
        <FileDown className="h-3.5 w-3.5" /> CSV
      </Button>
      <Button
        size="sm" variant="outline" onClick={handleExportPDF} disabled={exportingPDF}
        className="gap-1.5 h-8 border-primary text-primary hover:bg-primary/5"
      >
        {exportingPDF
          ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
          : <Eye className="h-3.5 w-3.5" />}
        {exportingPDF ? "Gerando…" : "Visualizar PDF"}
      </Button>
    </div>
  );

  return (
    <>
      {/* Modal de preview */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) handleClosePreview(); }}>
        <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Pré-visualização — Atividades · {previewNome}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title="Preview do relatório PDF — Sala Ágil"
              />
            )}
          </div>
          <DialogFooter className="px-6 py-3 border-t flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleClosePreview}>Fechar</Button>
            <Button size="sm" className="gap-1.5" onClick={handleDownloadFromPreview}>
              <FileDown className="h-3.5 w-3.5" /> Baixar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Layout do relatório */}
      <ReportLayout>
        <ReportPageHeader
          title="Atividades & Produtividade Individual"
          description={`Time: ${teamName} · ${totalActs} atividades no período`}
          icon={<User className="h-5 w-5" />}
          badge="Ágil"
          onBack={onBack}
          extraActions={exportActions}
        />

        <ReportFilterBar
          fields={[
            { key: "sprintId", label: "Sprint",  type: "select", options: sprintOptions },
            { key: "memberId", label: "Membro",  type: "select", options: memberOptions },
            { key: "type",     label: "Tipo",    type: "select", options: typeOptions   },
            { key: "status",   label: "Status",  type: "select", options: statusOptions },
          ]}
          values={filters}
          onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
          onReset={() => setFilters({ sprintId: "all", memberId: "all", type: "all", status: "all" })}
        />

        <ReportKPISummary items={kpis} cols={4} />

        <div className="grid gap-4 lg:grid-cols-2">
          <ReportChart title="Horas por Membro" subtitle="Concluídas vs. pendentes" height="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hoursBarData} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtH(v)} />
                <Tooltip formatter={(v: any) => fmtH(Number(v))} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Concluídas" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  <LabelList dataKey="_labelC" position="top" style={{ fontSize: 10, fontWeight: 600 }} />
                </Bar>
                <Bar dataKey="Pendentes" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </ReportChart>

          <ReportChart title="Throughput por Sprint" subtitle="Atividades concluídas por membro" height="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={throughputData} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                {developers.map((dev, i) => (
                  <Line
                    key={dev.id} type="monotone" dataKey={dev.name.split(" ")[0]}
                    stroke={MEMBER_COLORS[i % MEMBER_COLORS.length]} strokeWidth={2} dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ReportChart>
        </div>

        {radarData.length > 1 && (
          <ReportChart title="Comparação de Produtividade" subtitle="Eficiência, conclusões e bugs (%)" height="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="membro" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} tickCount={4} />
                <Radar name="Eficiência"      dataKey="Eficiência"      stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                <Radar name="Concluídas"      dataKey="Concluídas"      stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
                <Radar name="Bugs Resolvidos" dataKey="Bugs Resolvidos" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </ReportChart>
        )}

        <ReportDataTable
          title="Produtividade por Membro"
          badge={memberMetrics.length}
          data={memberMetrics}
          rowKey={(r) => r.id}
          columns={[
            { key: "name", header: "Membro",
              render: (v, row) => (
                <div className="flex items-center gap-2">
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                    style={{ background: avatarColor(v) }}
                  >{getInitials(v)}</div>
                  <div>
                    <p className="text-sm font-medium">{v}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{row.role}</p>
                  </div>
                </div>
              ) },
            { key: "total",  header: "Atividades",  align: "center", sortable: true },
            { key: "closed", header: "Concluídas",  align: "center", sortable: true,
              render: (v) => <span className="font-semibold text-emerald-600">{v}</span> },
            { key: "hoursC", header: "Horas Concl.", align: "center", sortable: true,
              render: (v, row) => `${fmtH(v)} / ${fmtH(row.hoursP)}` },
            { key: "eff",    header: "Eficiência",  align: "center", sortable: true,
              render: (v) => (
                <Badge className={cn("text-[10px]",
                  v >= 80 ? "bg-emerald-500/15 text-emerald-600" :
                  v >= 60 ? "bg-amber-400/15 text-amber-600" :
                            "bg-red-500/15 text-red-600")}>{v}%</Badge>
              ) },
            { key: "bugs",   header: "Bugs", align: "center",
              render: (v, row) => v > 0 ? (
                <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-600">
                  <Bug className="h-2.5 w-2.5 mr-0.5" />{row.bugsClosed}/{v}
                </Badge>
              ) : <span className="text-muted-foreground text-xs">—</span> },
            { key: "cycleTime", header: "Cycle Time", align: "center", sortable: true,
              render: (v) => v > 0 ? `${v}d` : "—" },
          ]}
        />

        {/* Tabela detalhada agrupada por HU na tela */}
        <ReportDataTable
          title="Detalhamento por HU & Data"
          badge={tableData.length}
          data={tableData}
          rowKey={(_, i) => i}
          columns={[
            { key: "_code",      header: "Código",
              render: (v) => <span className="font-mono text-xs text-muted-foreground">{v || "—"}</span> },
            { key: "membro",     header: "Membro",              sortable: true },
            { key: "hu",         header: "HU", align: "center",
              render: (v) => v !== "—" ? <span className="font-mono text-xs">{v}</span> : "—" },
            { key: "lancamento", header: "Lançamento", align: "center",
              render: (v) => v ? fmtDate(v) : "—" },
            { key: "titulo",     header: "Título da Atividade", sortable: true },
            { key: "horas",      header: "Duração", align: "center", sortable: true,
              render: (v) => <span className="font-semibold text-primary">{fmtH(v)}</span> },
            { key: "status",     header: "Status", align: "center",
              render: (v) => v
                ? <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600">Concluída</Badge>
                : <Badge className="text-[10px] bg-amber-400/15 text-amber-600">Em aberto</Badge> },
          ]}
        />
      </ReportLayout>
    </>
  );
}
