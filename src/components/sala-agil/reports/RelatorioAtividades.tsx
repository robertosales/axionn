import { useMemo, useState, useEffect } from "react";
import { User, CheckCircle, Clock, Zap, Bug, FileDown, Eye, CalendarDays, Inbox } from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  sprints:     { id: string; name: string; isActive?: boolean; start_date?: string; end_date?: string }[];
  developers:  { id: string; name: string; role: string; user_id?: string | null }[];
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
  if (!d) return "---";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function isoToBR(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function toMin(val: number | string | null | undefined): number {
  if (val === null || val === undefined || val === "") return 0;
  const s = String(val);
  if (s.includes(":")) {
    const [h, m] = s.split(":").map(Number);
    return (isFinite(h) ? h : 0) * 60 + (isFinite(m) ? m : 0);
  }
  const n = Number(s);
  return isFinite(n) ? Math.round(n * 60) : 0;
}

function fmtH(val: number | string | null | undefined): string {
  return formatMinutes(toMin(val));
}

// Prioridade: start_date > end_date > created_at
function lancamentoDate(act: any): string {
  return (act.start_date || act.end_date || act.created_at || "").slice(0, 10);
}

interface DateGroup {
  date:     string;
  rows:     any[];
  totalMin: number;
}

function groupByDataInicio(acts: any[]): DateGroup[] {
  const dateMap = new Map<string, any[]>();
  for (const row of acts) {
    const date = (row.lancamento || "").slice(0, 10);
    if (!dateMap.has(date)) dateMap.set(date, []);
    dateMap.get(date)!.push(row);
  }
  return [...dateMap.keys()].sort().map((date) => {
    const rows     = dateMap.get(date)!;
    const totalMin = rows.reduce((s: number, r: any) => s + toMin(r.horas), 0);
    return { date, rows, totalMin };
  });
}

const PDF = {
  DARK:         [15,  23,  42]  as [number,number,number],
  MUTED:        [100, 116, 139] as [number,number,number],
  LIGHT_BG:     [248, 250, 252] as [number,number,number],
  BORDER:       [226, 232, 240] as [number,number,number],
  HEAD_ROW:     [30,  41,  59]  as [number,number,number],
  DAY_DATE_BG:  [236, 253, 245] as [number,number,number],
  DAY_DATE_TXT: [21,  128, 61]  as [number,number,number],
  DONE_TXT:     [6,   95,  70]  as [number,number,number],
  OPEN_TXT:     [146, 64,  14]  as [number,number,number],
  DONE_BG:      [209, 250, 229] as [number,number,number],
  OPEN_BG:      [254, 243, 199] as [number,number,number],
};

const COL = { DATE: 30, ACTIVITY: 147, STATUS: 38, HOURS: 38 };

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
  const ML  = 22;
  const MR  = 22;
  const CW  = W - ML - MR;

  const periodoLabel = (filters.dateFrom && filters.dateTo)
    ? `${isoToBR(filters.dateFrom)} ate ${isoToBR(filters.dateTo)}`
    : "";

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

    doc.setFillColor(...AGIL_PRIMARY);
    doc.rect(0, 0, W, 26, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("RELATORIO DE ATIVIDADES & PRODUTIVIDADE INDIVIDUAL", ML, 10);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text("Modulo: Sala Agil", ML, 16);
    doc.text(
      `Gerado em: ${now.toLocaleDateString("pt-BR")} as ${now.toLocaleTimeString("pt-BR")}  -  Por: ${currentUserName}`,
      ML, 21,
    );

    let y = 31;

    const cardH = periodoLabel ? 24 : 18;
    doc.setFillColor(...PDF.LIGHT_BG);
    doc.roundedRect(ML, y, CW, cardH, 2, 2, "F");
    doc.setDrawColor(...PDF.BORDER);
    doc.roundedRect(ML, y, CW, cardH, 2, 2, "S");
    doc.setFillColor(...AGIL_PRIMARY);
    doc.circle(ML + 8, y + cardH / 2, 5.5, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
    doc.text(getInitials(member.name), ML + 8, y + cardH / 2 + 2, { align: "center" });
    doc.setTextColor(...PDF.DARK); doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(member.name, ML + 17, y + 8);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...PDF.MUTED);
    doc.text(member.role, ML + 17, y + 14);
    if (periodoLabel) {
      doc.setFontSize(7.5); doc.setTextColor(...PDF.DARK); doc.setFont("helvetica", "normal");
      doc.text(`Periodo: ${periodoLabel}`, ML + 17, y + 21);
    }
    doc.setFontSize(7.5); doc.setTextColor(...PDF.MUTED);
    doc.text(
      `Sprint: ${sprintLabel}  -  Time: ${teamName}`,
      ML + CW - 3, y + cardH / 2 + 2, { align: "right" },
    );
    y += cardH + 5;

    doc.setTextColor(...PDF.DARK); doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("RESUMO DO ANALISTA", ML, y);
    y += 3;
    const kpiW = CW / 5;
    const acts = memberMap.get(member.id) ?? [];
    const totalMin = acts.reduce((s: number, r: any) => s + toMin(r.horas), 0);
    const kpis = [
      { label: "Atividades",   value: String(member.total),  bg: [219,234,254] as [number,number,number], txt: [30,64,175]  as [number,number,number] },
      { label: "Concluidas",   value: String(member.closed), bg: AGIL_LIGHT,                              txt: AGIL_DARK },
      { label: "Em Aberto",    value: String(member.open),   bg: [255,237,213] as [number,number,number], txt: [154,52,18]  as [number,number,number] },
      { label: "Eficiencia",   value: `${member.eff}%`,      bg: [243,232,255] as [number,number,number], txt: [109,40,217] as [number,number,number] },
      { label: "Horas Concl.", value: fmtH(member.hoursC),   bg: [219,234,254] as [number,number,number], txt: AGIL_PRIMARY },
    ];
    kpis.forEach(({ label, value, bg, txt }, i) => {
      const x = ML + i * kpiW;
      doc.setFillColor(...bg); doc.roundedRect(x, y, kpiW - 1.5, 15, 1.5, 1.5, "F");
      doc.setTextColor(...PDF.MUTED); doc.setFontSize(6); doc.setFont("helvetica", "normal");
      doc.text(label.toUpperCase(), x + (kpiW - 1.5) / 2, y + 5, { align: "center" });
      doc.setTextColor(...txt); doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(value, x + (kpiW - 1.5) / 2, y + 13, { align: "center" });
    });
    y += 20;

    const dateGroups = groupByDataInicio(acts);
    const body: any[][] = [];

    for (const group of dateGroups) {
      const dateFmt = group.date ? fmtDatePDF(group.date) : "Sem data";

      body.push([
        {
          content: dateFmt,
          styles: {
            fillColor: PDF.DAY_DATE_BG,
            textColor: PDF.DAY_DATE_TXT,
            fontStyle: "bold",
            fontSize: 8.5,
            halign: "center",
            cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
            valign: "middle",
          },
        },
        {
          content: "",
          styles: {
            fillColor: PDF.DAY_DATE_BG,
            cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
          },
        },
        {
          content: "",
          styles: {
            fillColor: PDF.DAY_DATE_BG,
            cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
          },
        },
        {
          content: formatMinutes(group.totalMin),
          styles: {
            fillColor: PDF.DAY_DATE_BG,
            textColor: AGIL_PRIMARY,
            fontStyle: "bold",
            fontSize: 9,
            halign: "right",
            cellPadding: { top: 3.5, bottom: 3.5, left: 2, right: 4 },
            valign: "middle",
          },
        },
      ]);

      group.rows.forEach((r: any, ri: number) => {
        const isDone    = !!r.status;
        const statusTxt = isDone ? "Concluida" : "Em aberto";
        const rowBg     = ri % 2 === 0
          ? [255, 255, 255] as [number,number,number]
          : PDF.LIGHT_BG;

        body.push([
          {
            content: "",
            styles: {
              fillColor: rowBg,
              cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
            },
          },
          {
            content: r.titulo,
            styles: {
              fontStyle: "normal",
              fontSize: 8,
              fillColor: rowBg,
              cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 3 },
            },
          },
          {
            content: statusTxt,
            styles: {
              fontStyle: "normal",
              fontSize: 7.5,
              textColor: isDone ? PDF.DONE_TXT : PDF.OPEN_TXT,
              fillColor: isDone ? PDF.DONE_BG  : PDF.OPEN_BG,
              halign: "center",
              cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
            },
          },
          {
            content: fmtH(r.horas),
            styles: {
              fontStyle: "bold",
              fontSize: 8.5,
              textColor: AGIL_PRIMARY,
              fillColor: rowBg,
              halign: "right",
              cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 4 },
            },
          },
        ]);
      });
    }

    autoTable(doc, {
      head: [[
        { content: "DATA INICIO",          styles: { halign: "center" } },
        { content: "DESCRICAO ATIVIDADE",  styles: { halign: "left"   } },
        { content: "STATUS",               styles: { halign: "center" } },
        { content: "HORAS",                styles: { halign: "right"  } },
      ]],
      body,
      startY: y,
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        lineColor: PDF.BORDER,
        lineWidth: 0.15,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: PDF.HEAD_ROW,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8,
        cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      },
      columnStyles: {
        0: { cellWidth: COL.DATE,     halign: "center" },
        1: { cellWidth: COL.ACTIVITY, halign: "left"   },
        2: { cellWidth: COL.STATUS,   halign: "center" },
        3: { cellWidth: COL.HOURS,    halign: "right", fontStyle: "bold", textColor: AGIL_PRIMARY },
      },
      margin: { left: ML, right: MR },
      tableLineColor: PDF.BORDER,
      tableLineWidth: 0.15,
      rowPageBreak: "avoid",
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    const pageH  = doc.internal.pageSize.getHeight();
    const summaryY = Math.min(finalY, pageH - 22);
    doc.setFillColor(...AGIL_PRIMARY);
    doc.roundedRect(ML, summaryY, CW, 14, 2, 2, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text(
      `TOTAL GERAL DE HORAS: ${formatMinutes(totalMin)}`,
      ML + 4, summaryY + 6,
    );
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(
      `TOTAL DE ATIVIDADES: ${acts.length}`,
      ML + 4, summaryY + 12,
    );
    doc.text(
      `Cycle Time medio: ${member.cycleTime > 0 ? member.cycleTime + "d" : "---"}`,
      ML + CW - 4, summaryY + 9, { align: "right" },
    );

    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...PDF.MUTED);
      doc.text(`Pagina ${i} de ${totalPages}`, W - MR, pageH - 6, { align: "right" });
      doc.text(
        "Documento gerado automaticamente pelo sistema - Sala Agil",
        W / 2, pageH - 6, { align: "center" },
      );
    }
  });

  return doc.output("blob");
}

// Recebe TODAS as atividades filtradas por sprint/data, SEM filtro de analista,
// para garantir que todos os membros apareçam na tabela de Produtividade.
function buildMemberMetrics(developers: Props["developers"], allActivities: any[]) {
  return developers.map((dev) => {
    const acts       = allActivities.filter((a: any) => a.assignee_id === dev.id);
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
  const { user, isAdmin } = useAuth();

  // FIX 1: Resolve o developer do usuário logado a partir de rawData.developers
  // (que inclui user_id), usado apenas para travar o filtro de não-admins.
  const ownDeveloperId = useMemo(() => {
    if (!user || isAdmin) return null;
    const own = (rawData.developers as any[]).find((d: any) => d.user_id === user.id);
    return own?.id ?? null;
  }, [rawData.developers, user, isAdmin]);

  // FIX 2: Estado inicial sempre começa em "all"; o useEffect abaixo aplica
  // a restrição de não-admin DEPOIS que rawData.developers for resolvido,
  // evitando a race condition do lazy initializer.
  const [filters, setFilters] = useState<Record<string, string>>({
    sprintId: "all",
    memberId: "all",
    dateFrom: "",
    dateTo:   "",
  });

  // FIX 2 (cont): Aplica/mantém o travamento do filtro para não-admins.
  // Só dispara quando ownDeveloperId muda (i.e., quando rawData.developers carrega).
  // Não interfere com a seleção livre do admin.
  useEffect(() => {
    if (!isAdmin && ownDeveloperId) {
      setFilters((f) => ({ ...f, memberId: ownDeveloperId }));
    }
  }, [isAdmin, ownDeveloperId]);

  const [exportingPDF, setExportingPDF] = useState(false);
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const [previewBlob,  setPreviewBlob]  = useState<Blob | null>(null);
  const [previewNome,  setPreviewNome]  = useState<string>("");

  const periodReady = !!(filters.dateFrom && filters.dateTo);
  const periodValid = !periodReady || filters.dateFrom <= filters.dateTo;

  const sprintOptions = [
    { value: "all", label: "Todas" },
    ...sprints.map((s) => ({ value: s.id, label: s.name })),
  ];
  const memberOptions = [
    { value: "all", label: "Todos" },
    ...developers.map((d) => ({ value: d.id, label: d.name })),
  ];

  // Atividades filtradas por sprint e período — SEM filtro de analista.
  // Usadas para construir a tabela de Produtividade por Analista (todos os membros).
  const activitiesBySprintAndDate = useMemo(() => {
    let acts = rawData.activities;
    if (filters.sprintId !== "all") {
      const huIds = new Set(rawData.hus.filter((h: any) => h.sprint_id === filters.sprintId).map((h: any) => h.id));
      acts = acts.filter((a: any) => huIds.has(a.hu_id));
    }
    if (filters.dateFrom) {
      acts = acts.filter((a: any) => {
        const d = (a.start_date || a.end_date || a.created_at || "").slice(0, 10);
        return d >= filters.dateFrom;
      });
    }
    if (filters.dateTo) {
      acts = acts.filter((a: any) => {
        const d = (a.start_date || a.end_date || a.created_at || "").slice(0, 10);
        return d <= filters.dateTo;
      });
    }
    return acts;
  }, [rawData, filters.sprintId, filters.dateFrom, filters.dateTo]);

  // Atividades filtradas incluindo o analista — usadas nos KPIs e no Detalhamento.
  const filteredActivities = useMemo(() => {
    let acts = activitiesBySprintAndDate;
    if (filters.memberId !== "all") acts = acts.filter((a: any) => a.assignee_id === filters.memberId);
    return acts;
  }, [activitiesBySprintAndDate, filters.memberId]);

  // Produtividade usa sempre TODOS os membros (sem filtro de analista)
  const memberMetrics = useMemo(
    () => buildMemberMetrics(developers, activitiesBySprintAndDate),
    [activitiesBySprintAndDate, developers],
  );

  const totalActs   = filteredActivities.length;
  const totalClosed = filteredActivities.filter((a: any) => a.is_closed).length;
  const totalMinP   = filteredActivities.reduce((s: number, a: any) => s + toMin(a.hours), 0);
  const totalMinC   = filteredActivities.filter((a: any) => a.is_closed).reduce((s: number, a: any) => s + toMin(a.hours), 0);
  const isIndividualView = filters.memberId !== "all";
  const teamTotalActs = activitiesBySprintAndDate.length;
  const avgEff      = memberMetrics.length > 0
    ? Math.round(memberMetrics.reduce((s, m) => s + m.eff, 0) / memberMetrics.length)
    : 0;

  const kpis = [
    { label: isIndividualView ? "Atividades do Analista" : "Atividades do Time", value: totalActs, sub: totalActs > 0 ? `${totalClosed} concluídas` : isIndividualView && teamTotalActs > 0 ? `${teamTotalActs} atividades no time` : "Nenhuma no recorte atual", icon: <CheckCircle className="h-4 w-4" />, status: totalClosed > 0 ? "good" : "neutral" as any },
    { label: isIndividualView ? "Horas do Analista" : "Horas Concluídas", value: formatMinutes(totalMinC), sub: totalMinP > 0 ? `de ${formatMinutes(totalMinP)} planejadas` : isIndividualView && teamTotalActs > 0 ? "Analista sem horas neste recorte" : "Sem horas registradas", icon: <Clock className="h-4 w-4" />, status: (totalMinP > 0 && totalMinC / totalMinP >= 0.7) ? "good" : "neutral" as any },
    { label: "Eficiência Média do Time", value: `${avgEff}%`, sub: memberMetrics.length > 0 ? "Visão agregada · meta >= 80%" : "Sem base para cálculo", icon: <Zap className="h-4 w-4" />, status: memberMetrics.length > 0 ? effStatus(avgEff) : "neutral" as any },
    { label: "Analistas Ativos no Time", value: memberMetrics.length, sub: memberMetrics.length > 0 ? `de ${developers.length} no recorte agregado` : "Nenhum no recorte atual", icon: <User className="h-4 w-4" />, status: "neutral" as any },
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
    analista:          m.name.split(" ")[0],
    Eficiência:        m.eff,
    "Concluídas":      Math.min(100, Math.round((m.closed / Math.max(m.total, 1)) * 100)),
    "Bugs Resolvidos": m.bugs > 0 ? Math.round((m.bugsClosed / m.bugs) * 100) : 100,
  }));

  // tableData respeita o filtro de analista — só aparece quando analista selecionado
  const tableData = useMemo(() => {
    return filteredActivities.map((a: any) => {
      const dev    = developers.find((d) => d.id === a.assignee_id);
      const hu     = rawData.hus.find((h: any) => h.id === a.hu_id);
      const sprint = hu ? rawData.sprints.find((s: any) => s.id === hu.sprint_id) : null;
      return {
        membro:      dev?.name    || "---",
        titulo:      a.title,
        sprint:      sprint?.name || "---",
        hu:          hu?.code     || "---",
        horas:       a.hours,
        lancamento:  lancamentoDate(a),
        status:      a.is_closed,
        _code:       a.code       || "",
        _huTitle:    hu?.title    || "",
        _role:       dev?.role    || "",
        _assigneeId: a.assignee_id,
        _sprintName: sprint?.name || "",
      };
    });
  }, [filteredActivities, developers, rawData]);

  function handleExportCSV() {
    exportToCSV(
      tableData.map((r) => ({
        Analista:              r.membro,
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
    if (!periodReady) {
      toast.error("Informe o período do relatório para continuar.");
      return;
    }
    if (!periodValid) {
      toast.error("A data inicial não pode ser maior que a data final.");
      return;
    }
    if (memberMetrics.length === 0) {
      toast.error("Nenhum dado para gerar o relatório.");
      return;
    }
    setExportingPDF(true);
    try {
      const selectedSprint = filters.sprintId !== "all"
        ? rawData.sprints.find((s: any) => s.id === filters.sprintId)
        : null;
      const blob = await buildPDFBlob(
        memberMetrics, tableData, teamName, currentUserName,
        selectedSprint?.name ?? "Todas as Sprints", filters,
      );
      setPreviewBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
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

  // FIX 3: handleReset respeita a restrição de não-admin —
  // não-admins voltam ao próprio developer, não a "all".
  function handleReset() {
    setFilters({
      sprintId: "all",
      memberId: !isAdmin && ownDeveloperId ? ownDeveloperId : "all",
      dateFrom: "",
      dateTo:   "",
    });
  }

  const pdfDisabledReason = !periodReady
    ? "Informe o período do relatório para continuar."
    : !periodValid
    ? "A data inicial não pode ser maior que a data final."
    : undefined;

  const selectedMember = filters.memberId !== "all"
    ? developers.find((developer) => developer.id === filters.memberId)
    : null;
  const selectedSprint = filters.sprintId !== "all"
    ? sprints.find((sprint) => sprint.id === filters.sprintId)
    : null;
  const periodLabel = periodReady
    ? `${isoToBR(filters.dateFrom)} a ${isoToBR(filters.dateTo)}`
    : filters.dateFrom
      ? `A partir de ${isoToBR(filters.dateFrom)}`
      : filters.dateTo
        ? `Até ${isoToBR(filters.dateTo)}`
        : "Todo o período";
  const hasNoFilteredActivities = filteredActivities.length === 0;
  const hasNoPeriodActivities = activitiesBySprintAndDate.length === 0;
  const emptyStateTitle = selectedMember && !hasNoPeriodActivities
    ? `${selectedMember.name} não possui atividades neste recorte`
    : "Nenhuma atividade encontrada no período";
  const emptyStateDescription = selectedMember && !hasNoPeriodActivities
    ? `Existem ${teamTotalActs} atividades no time, mas nenhuma para este analista no recorte atual.`
    : "Não há atividades registradas para a sprint e o período selecionados.";
  const emptyChartContent = (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="h-4 w-4" />
      </span>
      <p className="text-sm font-medium text-foreground">Sem dados agregados para exibir</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Não há atividades do time para a sprint e o período selecionados.
      </p>
    </div>
  );

  const exportActions = (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-1.5 h-8">
        <FileDown className="h-3.5 w-3.5" /> CSV
      </Button>
      <div title={pdfDisabledReason}>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExportPDF}
          disabled={exportingPDF || !periodReady || !periodValid}
          className={cn(
            "gap-1.5 h-8",
            periodReady && periodValid
              ? "border-primary text-primary hover:bg-primary/5"
              : "opacity-50 cursor-not-allowed",
          )}
        >
          {exportingPDF
            ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
            : <Eye className="h-3.5 w-3.5" />}
          {exportingPDF ? "Gerando…" : "Visualizar PDF"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
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

      <ReportLayout>
        <ReportPageHeader
          title="Atividades & Produtividade Individual"
          description={isIndividualView
            ? `Recorte individual · ${selectedMember?.name ?? "Analista"} · ${totalActs} atividades · ${teamTotalActs} no time`
            : `Visão agregada do time ${teamName} · ${teamTotalActs} atividades no período`
          }
          icon={<User className="h-5 w-5" />}
          badge="Ágil"
          onBack={onBack}
          extraActions={exportActions}
        />

        {/* ── Filtros unificados: Sprint | Analista | Período Início | Período Fim ── */}
        <ReportFilterBar
          fields={[
            { key: "sprintId", label: "Sprint",         type: "select", options: sprintOptions },
            { key: "memberId", label: "Analista",       type: "select", options: memberOptions, disabled: !isAdmin },
            { key: "dateFrom", label: "Período início", type: "date" },
            { key: "dateTo",   label: "Período fim",    type: "date" },
          ]}
          values={filters}
          onChange={(k, v) => {
            if (k === "memberId" && !isAdmin) return;
            setFilters((f) => ({ ...f, [k]: v }));
          }}
          onReset={handleReset}
          periodValidation={periodReady && !periodValid
            ? "A data inicial não pode ser maior que a data final."
            : undefined
          }
        />

        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
              <CalendarDays className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-foreground">
                  {isIndividualView ? "Visualização individual" : "Visualização agregada do time"}
                </p>
                <Badge variant="secondary" className="h-5 text-[10px] font-medium">
                  {isIndividualView ? "Recorte individual" : "Time completo"}
                </Badge>
              </div>
              <p className="mt-0.5 whitespace-normal break-words text-xs text-muted-foreground">
                {isIndividualView
                  ? `Você está vendo o recorte individual de ${selectedMember?.name ?? "analista selecionado"}.`
                  : `Você está vendo o resultado agregado de todos os analistas de ${teamName}.`
                }
                {" "}{selectedSprint?.name ?? "Todas as sprints"} · {periodLabel}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <Badge variant="outline" className="w-fit bg-background text-[10px] font-medium text-muted-foreground">
              {totalActs} {totalActs === 1 ? "atividade no recorte" : "atividades no recorte"}
            </Badge>
            {isIndividualView && (
              <Badge variant="outline" className="w-fit bg-background text-[10px] font-medium text-muted-foreground">
                {teamTotalActs} {teamTotalActs === 1 ? "atividade no time" : "atividades no time"}
              </Badge>
            )}
          </div>
        </div>

        {hasNoFilteredActivities && (
          <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card px-4 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Inbox className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{emptyStateTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {emptyStateDescription} Revise o analista, a sprint ou o período para ampliar o resultado.
              </p>
            </div>
          </div>
        )}

        <ReportKPISummary items={kpis} cols={4} />

        <div className="grid gap-4 lg:grid-cols-2">
          <ReportChart title="Horas por Analista" subtitle="Visão agregada do time · concluídas vs. pendentes" height="h-72">
            {hasNoPeriodActivities ? emptyChartContent : (
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
            )}
          </ReportChart>

          <ReportChart title="Throughput por Sprint" subtitle="Histórico agregado do time · atividades concluídas por analista" height="h-72">
            {hasNoPeriodActivities ? emptyChartContent : (
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
            )}
          </ReportChart>
        </div>

        {radarData.length > 1 && (
          <ReportChart title="Comparação de Produtividade" subtitle="Visão agregada do time · eficiência, conclusões e bugs (%)" height="h-72">
            {hasNoPeriodActivities ? emptyChartContent : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="analista" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} tickCount={4} />
                  <Radar name="Eficiência"      dataKey="Eficiência"      stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                  <Radar name="Concluídas"      dataKey="Concluídas"      stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
                  <Radar name="Bugs Resolvidos" dataKey="Bugs Resolvidos" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </ReportChart>
        )}

        {/* ── Produtividade: sempre mostra todos os analistas ── */}
        <ReportDataTable
          title="Produtividade por Analista"
          subtitle="Visão agregada do time para a sprint e o período selecionados."
          badge={memberMetrics.length}
          data={memberMetrics}
          emptyMessage="Nenhum analista possui atividades registradas para a sprint e o período selecionados."
          rowKey={(r) => r.id}
          columns={[
            { key: "name", header: "Analista",
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
            { key: "total",     header: "Atividades",  align: "center", sortable: true },
            { key: "closed",    header: "Concluídas",  align: "center", sortable: true,
              render: (v) => <span className="font-semibold text-emerald-600">{v}</span> },
            { key: "hoursC",    header: "Horas Concl.", align: "center", sortable: true,
              render: (v, row) => `${fmtH(v)} / ${fmtH(row.hoursP)}` },
            { key: "eff",       header: "Eficiência",  align: "center", sortable: true,
              render: (v) => (
                <Badge className={cn("text-[10px]",
                  v >= 80 ? "bg-emerald-500/15 text-emerald-600" :
                  v >= 60 ? "bg-amber-400/15 text-amber-600"     :
                            "bg-red-500/15 text-red-600")}>{v}%</Badge>
              ) },
            { key: "bugs",      header: "Bugs", align: "center",
              render: (v, row) => v > 0 ? (
                <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-600">
                  <Bug className="h-2.5 w-2.5 mr-0.5" />{row.bugsClosed}/{v}
                </Badge>
              ) : <span className="text-muted-foreground text-xs">---</span> },
            { key: "cycleTime", header: "Cycle Time", align: "center", sortable: true,
              render: (v) => v > 0 ? `${v}d` : "---" },
          ]}
        />

        {/* ── Detalhamento: só exibe quando um analista específico estiver selecionado ── */}
        {filters.memberId !== "all" && (
          <ReportDataTable
            title="Detalhamento individual"
            subtitle={`Atividades associadas a ${selectedMember?.name ?? "analista selecionado"} no recorte atual.`}
            badge={tableData.length}
            data={tableData}
            emptyMessage={`${selectedMember?.name ?? "O analista selecionado"} não possui atividades registradas neste recorte.`}
            rowKey={(_, i) => i}
            columns={[
              { key: "_code",      header: "Código",
                render: (v) => <span className="font-mono text-xs text-muted-foreground">{v || "---"}</span> },
              { key: "membro",     header: "Analista",             sortable: true },
              { key: "hu",         header: "HU", align: "center",
                render: (v) => v !== "---" ? <span className="font-mono text-xs">{v}</span> : "---" },
              { key: "lancamento", header: "Data Início", align: "center",
                render: (v) => v ? fmtDate(v) : "---" },
              { key: "titulo",     header: "Descrição Atividade", sortable: true },
              { key: "horas",      header: "Duração", align: "center", sortable: true,
                render: (v) => <span className="font-semibold text-primary">{fmtH(v)}</span> },
              { key: "status",     header: "Status", align: "center",
                render: (v) => v
                  ? <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600">Concluída</Badge>
                  : <Badge className="text-[10px] bg-amber-400/15 text-amber-600">Em aberto</Badge> },
            ]}
          />
        )}
      </ReportLayout>
    </>
  );
}
