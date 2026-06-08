import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDemandas } from "../../hooks/useDemandas";
import { useAllTransitions, useProfiles } from "../../hooks/useAllTransitions";
import { calcTempos, formatHours } from "../../utils/kpiCalculations";
import { getReportConfig } from "../../utils/reportConfig";
import { buildAnalistasDedup, analistaMatches } from "../../utils/analistasDedup";
import { useAuth } from "@/contexts/AuthContext";
import {
  ReportLayout,
  ReportPageHeader,
  ReportFilterBar,
  ReportKPISummary,
  ReportDataTable,
  ReportLegendBlock,
} from "@/shared/components/reports";
import type { KPIItem, TableColumn } from "@/shared/components/reports";
import { Clock, Timer, TrendingUp, Target, Activity, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const META_MTTR = 4;
const META_TMR  = 1;
const SUST_PRIMARY: [number, number, number] = [37, 99, 235];

function today()        { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; }
function fmtDateBR(d: string) { return d ? new Date(d).toLocaleDateString("pt-BR") : "—"; }
function trunc(s: string, max: number) { return s.length > max ? s.slice(0, max - 1) + "…" : s; }

type KPIStatus = KPIItem["status"];
function kpiStatus(val: number, meta: number): KPIStatus {
  if (val <= meta)       return "good";
  if (val <= meta * 1.5) return "warning";
  return "danger";
}

async function buildPDFBlob(
  params: {
    analista: string;
    analistaStats: Array<{ nome: string; total: number; tmr: number; mttr: number; tma: number; mtta: number; acimaMeta: number; pctAcima: string; }>;
    tempos: { tmr: number; mttr: number; tma: number; mtta: number; };
    dataInicio: string;
    dataFim: string;
    userName: string;
  }
): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const now = new Date();
  const W = doc.internal.pageSize.getWidth();
  const ML = 12; const MR = 12; const CW = W - ML - MR;
  const PRIMARY = SUST_PRIMARY;
  const DARK: [number,number,number]       = [30, 41, 59];
  const MUTED: [number,number,number]      = [100, 116, 139];
  const LIGHT_BG: [number,number,number]   = [248, 250, 252];
  const BORDER_CLR: [number,number,number] = [226, 232, 240];
  const HEAD_ROW: [number,number,number]   = [51, 65, 85];
  const ALT_ROW: [number,number,number]    = [248, 250, 252];
  const TOTAL_BG: [number,number,number]   = [241, 245, 249];

  // ── Cabeçalho executivo
  doc.setFillColor(...PRIMARY); doc.rect(0, 0, W, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO — TEMPO MÉDIO (MTTR / TMA / TMR / MTTA)", ML, 10);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text("Módulo: Sustentação", ML, 16);
  doc.text(`Gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`, ML, 21);

  let y = 31;

  // ── Card executivo
  doc.setFillColor(...LIGHT_BG); doc.roundedRect(ML, y, CW, 18, 2, 2, "F");
  doc.setDrawColor(...BORDER_CLR); doc.roundedRect(ML, y, CW, 18, 2, 2, "S");
  doc.setTextColor(...DARK); doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text(`Período: ${fmtDateBR(params.dataInicio)} a ${fmtDateBR(params.dataFim)}`, ML + 4, y + 7);
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
  doc.text(`Analista: ${params.analista === "all" ? "Todos" : params.analista}`, ML + 4, y + 13);
  doc.text(`Emitido por: ${params.userName}`, ML + CW - 4, y + 7, { align: "right" });
  doc.text(`Gerado em: ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR")}`, ML + CW - 4, y + 13, { align: "right" });
  y += 23;

  // ── Resumo executivo (KPIs visuais)
  doc.setTextColor(...DARK); doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text("RESUMO EXECUTIVO", ML, y);
  y += 3;
  const kpiW = CW / 4;
  const execKpis = [
    { label: "TMR Médio",  value: formatHours(params.tempos.tmr),  meta: `Meta < ${META_TMR}h`,  ok: params.tempos.tmr  <= META_TMR,  bg: params.tempos.tmr  <= META_TMR  ? [220,252,231] as [number,number,number] : [254,226,226] as [number,number,number], txt: params.tempos.tmr  <= META_TMR  ? [4,120,87]   as [number,number,number] : [185,28,28]  as [number,number,number] },
    { label: "MTTR Médio", value: formatHours(params.tempos.mttr), meta: `Meta < ${META_MTTR}h`, ok: params.tempos.mttr <= META_MTTR, bg: params.tempos.mttr <= META_MTTR ? [220,252,231] as [number,number,number] : [254,226,226] as [number,number,number], txt: params.tempos.mttr <= META_MTTR ? [4,120,87]   as [number,number,number] : [185,28,28]  as [number,number,number] },
    { label: "TMA Médio",  value: formatHours(params.tempos.tma),  meta: `Meta < ${META_MTTR}h`, ok: params.tempos.tma  <= META_MTTR, bg: params.tempos.tma  <= META_MTTR ? [220,252,231] as [number,number,number] : [254,226,226] as [number,number,number], txt: params.tempos.tma  <= META_MTTR ? [4,120,87]   as [number,number,number] : [185,28,28]  as [number,number,number] },
    { label: "MTTA Médio", value: formatHours(params.tempos.mtta), meta: `Meta < ${META_TMR}h`,  ok: params.tempos.mtta <= META_TMR,  bg: params.tempos.mtta <= META_TMR  ? [220,252,231] as [number,number,number] : [254,226,226] as [number,number,number], txt: params.tempos.mtta <= META_TMR  ? [4,120,87]   as [number,number,number] : [185,28,28]  as [number,number,number] },
  ];
  execKpis.forEach(({ label, value, meta, bg, txt }, i) => {
    const x = ML + i * kpiW;
    doc.setFillColor(...bg); doc.roundedRect(x, y, kpiW - 1.5, 17, 1.5, 1.5, "F");
    doc.setTextColor(...MUTED); doc.setFontSize(6); doc.setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), x + (kpiW - 1.5) / 2, y + 5, { align: "center" });
    doc.setTextColor(...txt); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(value, x + (kpiW - 1.5) / 2, y + 12, { align: "center" });
    doc.setTextColor(...MUTED); doc.setFontSize(5.5); doc.setFont("helvetica", "italic");
    doc.text(meta, x + (kpiW - 1.5) / 2, y + 16.5, { align: "center" });
  });
  y += 22;

  // ── Tabela de detalhamento por analista
  autoTable(doc, {
    startY: y,
    head: [["Analista", "Total", "TMR", "MTTR", "TMA", "MTTA", "Acima Meta", "% Acima"]],
    body: [
      ...params.analistaStats.map(a => [
        a.nome,
        a.total,
        { content: formatHours(a.tmr),  styles: { textColor: a.tmr  <= META_TMR  ? [4,120,87] as [number,number,number] : [185,28,28] as [number,number,number] } },
        { content: formatHours(a.mttr), styles: { textColor: a.mttr <= META_MTTR ? [4,120,87] as [number,number,number] : [185,28,28] as [number,number,number] } },
        { content: formatHours(a.tma),  styles: { textColor: a.tma  <= META_MTTR ? [4,120,87] as [number,number,number] : [185,28,28] as [number,number,number] } },
        { content: formatHours(a.mtta), styles: { textColor: a.mtta <= META_TMR  ? [4,120,87] as [number,number,number] : [185,28,28] as [number,number,number] } },
        a.acimaMeta > 0 ? { content: String(a.acimaMeta), styles: { textColor: [185,28,28] as [number,number,number], fontStyle: "bold" as const } } : "0",
        a.acimaMeta > 0 ? { content: `${a.pctAcima}%`, styles: { textColor: [185,28,28] as [number,number,number] } } : "0%",
      ]),
      // linha totais
      [{ content: "Total / Média", styles: { fontStyle: "bold" as const, fillColor: TOTAL_BG, textColor: DARK } },
       { content: String(params.analistaStats.reduce((s, a) => s + a.total, 0)), styles: { fontStyle: "bold" as const, fillColor: TOTAL_BG, textColor: DARK } },
       { content: formatHours(params.tempos.tmr),  styles: { fontStyle: "bold" as const, fillColor: TOTAL_BG, textColor: params.tempos.tmr  <= META_TMR  ? [4,120,87] as [number,number,number] : [185,28,28] as [number,number,number] } },
       { content: formatHours(params.tempos.mttr), styles: { fontStyle: "bold" as const, fillColor: TOTAL_BG, textColor: params.tempos.mttr <= META_MTTR ? [4,120,87] as [number,number,number] : [185,28,28] as [number,number,number] } },
       { content: formatHours(params.tempos.tma),  styles: { fontStyle: "bold" as const, fillColor: TOTAL_BG, textColor: params.tempos.tma  <= META_MTTR ? [4,120,87] as [number,number,number] : [185,28,28] as [number,number,number] } },
       { content: formatHours(params.tempos.mtta), styles: { fontStyle: "bold" as const, fillColor: TOTAL_BG, textColor: params.tempos.mtta <= META_TMR  ? [4,120,87] as [number,number,number] : [185,28,28] as [number,number,number] } },
       { content: String(params.analistaStats.reduce((s, a) => s + a.acimaMeta, 0)), styles: { fontStyle: "bold" as const, fillColor: TOTAL_BG, textColor: DARK } },
       { content: params.analistaStats.reduce((s, a) => s + a.total, 0) > 0 ? `${((params.analistaStats.reduce((s, a) => s + a.acimaMeta, 0) / params.analistaStats.reduce((s, a) => s + a.total, 0)) * 100).toFixed(1)}%` : "0%", styles: { fontStyle: "bold" as const, fillColor: TOTAL_BG, textColor: DARK } },
      ],
    ],
    styles: { fontSize: 7.5, cellPadding: 2.2, textColor: DARK },
    headStyles: { fillColor: HEAD_ROW, textColor: 255, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "right", cellWidth: 18 }, 2: { halign: "right", cellWidth: 22 }, 3: { halign: "right", cellWidth: 22 }, 4: { halign: "right", cellWidth: 22 }, 5: { halign: "right", cellWidth: 22 }, 6: { halign: "right", cellWidth: 22 }, 7: { halign: "right", cellWidth: 18 } },
    margin: { left: ML, right: MR },
    tableLineColor: BORDER_CLR,
    tableLineWidth: 0.2,
  });

  // ── Legenda
  const lastY = (doc as any).lastAutoTable.finalY + 6;
  doc.setTextColor(...MUTED); doc.setFontSize(6.5); doc.setFont("helvetica", "italic");
  doc.text("TMR: Tempo Médio de Resposta  ·  MTTR: Tempo Médio de Resolução  ·  TMA: Tempo Médio de Atendimento  ·  MTTA: Tempo Médio de Reconhecimento", ML, lastY);

  // ── Rodapé com paginação
  const total = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
    doc.text(`Página ${i} de ${total}`, W - MR, doc.internal.pageSize.getHeight() - 6, { align: "right" });
    doc.text(`SprintFlow — Módulo Sustentação`, ML, doc.internal.pageSize.getHeight() - 6);
    doc.text(`Gerado em ${now.toLocaleDateString("pt-BR")}`, W / 2, doc.internal.pageSize.getHeight() - 6, { align: "center" });
  }

  return doc.output("blob");
}

interface Props { onBack?: () => void; }

export function RelatorioTempoMedio({ onBack }: Props) {
  const { demandas }      = useDemandas();
  const { transitions }   = useAllTransitions();
  const profiles          = useProfiles();
  const { profile, isAdmin } = useAuth();

  // ── Seleção automática do analista
  const [periodo, setPeriodo]         = useState("30");
  const [dataInicio, setDataInicio]   = useState(daysAgo(30));
  const [dataFim,    setDataFim]      = useState(today());
  const [analista,   setAnalista]     = useState<string>(() => isAdmin ? "all" : (profile?.user_id ?? "all"));

  useEffect(() => {
    if (!isAdmin && profile?.user_id) setAnalista(profile.user_id);
  }, [isAdmin, profile?.user_id]);

  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const filtered = useMemo(() => {
    let items = demandas;
    if (dataInicio) items = items.filter(d => new Date(d.created_at) >= new Date(dataInicio + "T00:00:00"));
    if (dataFim)    items = items.filter(d => new Date(d.created_at) <= new Date(dataFim    + "T23:59:59"));
    if (analista !== "all") {
      const ids = new Set(transitions.filter(t => analistaMatches(analista, t.user_id)).map(t => t.demanda_id));
      items = items.filter(d => analistaMatches(analista, d.responsavel_dev) || ids.has(d.id));
    }
    return items;
  }, [demandas, dataInicio, dataFim, analista, transitions]);

  const tempos = useMemo(() => calcTempos(filtered, transitions), [filtered, transitions]);

  const analistaStats = useMemo(() => {
    const userIdSet = new Set<string>();
    filtered.forEach(d => { if (d.responsavel_dev) userIdSet.add(d.responsavel_dev); });
    transitions.forEach(t => { if (filtered.some(d => d.id === t.demanda_id)) userIdSet.add(t.user_id); });
    return [...userIdSet].map(uid => {
      const tIds = new Set(transitions.filter(t => t.user_id === uid).map(t => t.demanda_id));
      const devDemandas = filtered.filter(d => d.responsavel_dev === uid || tIds.has(d.id));
      const t = calcTempos(devDemandas, transitions);
      const p = profiles.find(pr => pr.user_id === uid);
      const acimaMeta = devDemandas.filter(d => {
        if (d.situacao !== "aceite_final") return false;
        const tr = transitions.filter(x => x.demanda_id === d.id && x.to_status === "aceite_final");
        if (!tr.length) return false;
        return (new Date(tr[0].created_at).getTime() - new Date(d.created_at).getTime()) / 3_600_000 > META_MTTR;
      }).length;
      return { uid, nome: p?.display_name || uid.slice(0, 8), total: devDemandas.length, tmr: t.tmr, mttr: t.mttr, tma: t.tma, mtta: t.mtta, acimaMeta, pctAcima: devDemandas.length > 0 ? ((acimaMeta / devDemandas.length) * 100).toFixed(1) : "0" };
    }).sort((a, b) => b.total - a.total);
  }, [filtered, transitions, profiles]);

  const analistas = useMemo(() => {
    const pIds = new Set(profiles.map(p => p.user_id));
    const ids = new Set<string>();
    demandas.forEach(d => [d.responsavel_dev, d.responsavel_requisitos, d.responsavel_teste, d.responsavel_arquiteto]
      .filter((x): x is string => !!x && pIds.has(x)).forEach(x => ids.add(x)));
    return buildAnalistasDedup([...ids], profiles);
  }, [demandas, profiles]);

  const totals = useMemo(() => {
    if (!analistaStats.length) return null;
    const total = analistaStats.reduce((s, a) => s + a.total, 0);
    const acima = analistaStats.reduce((s, a) => s + a.acimaMeta, 0);
    return { total, acima, pct: total > 0 ? ((acima / total) * 100).toFixed(1) : "0" };
  }, [analistaStats]);

  const reportCfg = getReportConfig("tempo_medio");
  const periodoLabel = `${fmtDateBR(dataInicio)} a ${fmtDateBR(dataFim)}`;

  const kpiItems: KPIItem[] = [
    { label: "TMR",  value: formatHours(tempos.tmr),  meta: `Meta: < ${META_TMR}h`,  status: kpiStatus(tempos.tmr,  META_TMR),  icon: <Timer className="h-5 w-5" />      },
    { label: "MTTR", value: formatHours(tempos.mttr), meta: `Meta: < ${META_MTTR}h`, status: kpiStatus(tempos.mttr, META_MTTR), icon: <Clock className="h-5 w-5" />      },
    { label: "TMA",  value: formatHours(tempos.tma),  meta: `Meta: < ${META_MTTR}h`, status: kpiStatus(tempos.tma,  META_MTTR), icon: <TrendingUp className="h-5 w-5" /> },
    { label: "MTTA", value: formatHours(tempos.mtta), meta: `Meta: < ${META_TMR}h`,  status: kpiStatus(tempos.mtta, META_TMR),  icon: <Target className="h-5 w-5" />     },
  ];

  const colorCls = (v: number, meta: number) =>
    kpiStatus(v, meta) === "good" ? "text-emerald-600" : kpiStatus(v, meta) === "warning" ? "text-orange-500" : "text-destructive";

  const columns: TableColumn[] = [
    { key: "nome",      label: "Analista",    sortable: true },
    { key: "total",     label: "Total",       align: "right", sortable: true },
    { key: "tmr",       label: "TMR",         align: "right", sortable: true, render: (v) => <span className={`font-medium ${colorCls(v, META_TMR)}`}>{formatHours(v)}</span> },
    { key: "mttr",      label: "MTTR",        align: "right", sortable: true, render: (v) => <span className={`font-medium ${colorCls(v, META_MTTR)}`}>{formatHours(v)}</span> },
    { key: "tma",       label: "TMA",         align: "right", sortable: true, render: (v) => <span className={`font-medium ${colorCls(v, META_MTTR)}`}>{formatHours(v)}</span> },
    { key: "mtta",      label: "MTTA",        align: "right", sortable: true, render: (v) => <span className={`font-medium ${colorCls(v, META_TMR)}`}>{formatHours(v)}</span> },
    { key: "acimaMeta", label: "Acima Meta",  align: "right", sortable: true, render: (v, row) => v > 0 ? <Badge variant="destructive" className="text-[10px]">{v} ({row.pctAcima}%)</Badge> : <span className="text-muted-foreground">0</span> },
  ];

  const handleVisualizarPDF = async () => {
    setGeneratingPDF(true);
    try {
      const analistaLabel = analista === "all" ? "Todos" : (profiles.find(p => p.user_id === analista)?.display_name ?? analista);
      const blob = await buildPDFBlob({
        analista: analistaLabel,
        analistaStats,
        tempos,
        dataInicio,
        dataFim,
        userName: profile?.display_name ?? "Sistema",
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar pré-visualização do relatório");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleClosePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  return (
    <>
      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) handleClosePreview(); }}>
        <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Pré-visualização — Relatório Tempo Médio
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewUrl && <iframe src={previewUrl} className="w-full h-full border-0" title="Preview do relatório PDF" />}
          </div>
          <DialogFooter className="px-6 py-3 border-t flex justify-end">
            <Button variant="outline" size="sm" onClick={handleClosePreview}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReportLayout
        header={
          <ReportPageHeader
            title={reportCfg.titulo.replace("Relatório — ", "")}
            description={reportCfg.subtitulo}
            icon={<Activity className="h-5 w-5" />}
            badge={periodoLabel}
            onBack={onBack}
          />
        }
        filters={
          <ReportFilterBar
            periodo={periodo}    setPeriodo={setPeriodo}
            dataInicio={dataInicio} setDataInicio={setDataInicio}
            dataFim={dataFim}    setDataFim={setDataFim}
            analista={analista}  setAnalista={setAnalista}
            analistas={analistas}
            modulo="sustentacao"
            totalFiltrado={filtered.length}
            onClear={() => {
              setPeriodo("30"); setDataInicio(daysAgo(30)); setDataFim(today());
              setAnalista(isAdmin ? "all" : (profile?.user_id ?? "all"));
            }}
          />
        }
        kpis={<ReportKPISummary items={kpiItems} />}
        table={
          <>
            <div className="flex justify-end mb-2 print:hidden">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-primary text-primary hover:bg-primary/5"
                onClick={handleVisualizarPDF}
                disabled={generatingPDF}
              >
                {generatingPDF
                  ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-1" />
                  : <Eye className="h-3.5 w-3.5" />}
                Visualizar Relatório (PDF)
              </Button>
            </div>
            <ReportDataTable
              titulo="Detalhamento por Analista"
              columns={columns}
              data={analistaStats}
              rowKey={(r) => r.uid}
              totals={totals ? {
                label: "Total / Média",
                values: {
                  total: totals.total,
                  tmr:   <span className={colorCls(tempos.tmr,  META_TMR)} >{formatHours(tempos.tmr)}</span>,
                  mttr:  <span className={colorCls(tempos.mttr, META_MTTR)}>{formatHours(tempos.mttr)}</span>,
                  tma:   <span className={colorCls(tempos.tma,  META_MTTR)}>{formatHours(tempos.tma)}</span>,
                  mtta:  <span className={colorCls(tempos.mtta, META_TMR)} >{formatHours(tempos.mtta)}</span>,
                  acimaMeta: totals.acima > 0 ? <Badge variant="destructive" className="text-[10px]">{totals.acima} ({totals.pct}%)</Badge> : <span className="text-muted-foreground">0</span>,
                },
              } : undefined}
            />
          </>
        }
        footer={
          <ReportLegendBlock items={[
            { sigla: "TMR",  descricao: "Tempo Médio de Resposta — abertura até primeiro atendimento" },
            { sigla: "MTTR", descricao: "Tempo Médio de Resolução — abertura até aceite final" },
            { sigla: "TMA",  descricao: "Tempo Médio de Atendimento — duração total do atendimento" },
            { sigla: "MTTA", descricao: "Tempo Médio de Reconhecimento — abertura até primeira ação" },
          ]} />
        }
      />
    </>
  );
}
