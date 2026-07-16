import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDemandas } from "../../hooks/useDemandas";
import { useAllTransitions, useProfiles } from "../../hooks/useAllTransitions";
import { calcSLA, formatHours } from "../../utils/kpiCalculations";
import { getReportConfig } from "../../utils/reportConfig";
import { buildAnalistasDedup, analistaMatches } from "../../utils/analistasDedup";
import { useAuth } from "@/contexts/AuthContext";
import {
  ReportLayout,
  ReportPageHeader,
  ReportFilterBar,
  ReportKPISummary,
  ReportChart,
  ReportDataTable,
  ReportLegendBlock,
} from "@/shared/components/reports";
import type { KPIItem, TableColumn } from "@/shared/components/reports";
import { Shield, AlertTriangle, CheckCircle2, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const META_SLA = 95;
const SUST_PRIMARY: [number, number, number] = [37, 99, 235];

function today()        { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; }
function fmtDateBR(d: string) { return d ? new Date(d).toLocaleDateString("pt-BR") : "—"; }
function trunc(s: string, max: number) { return s.length > max ? s.slice(0, max - 1) + "…" : s; }

async function buildPDFBlob(
  params: {
    compliance: number;
    dentro: number;
    emRisco: number;
    violados: number;
    total: number;
    results: Array<{ rhm: string; projeto: string; prioridade: string; abertura: string; prazoSLA: string; resolucao?: string | null; statusSLA: string; atraso: number; }>;
    dataInicio: string;
    dataFim: string;
    analista: string;
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
  const GREEN: [number,number,number]      = [4, 120, 87];
  const ORANGE: [number,number,number]     = [154, 52, 18];
  const RED: [number,number,number]        = [185, 28, 28];

  // ── Cabeçalho executivo
  doc.setFillColor(...PRIMARY); doc.rect(0, 0, W, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO — SLA COMPLIANCE", ML, 10);
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
  doc.text(`Analista: ${params.analista}`, ML + 4, y + 13);
  doc.text(`Emitido por: ${params.userName}`, ML + CW - 4, y + 7, { align: "right" });
  doc.text(`Meta contratual SLA: ≥ ${META_SLA}%`, ML + CW - 4, y + 13, { align: "right" });
  y += 23;

  // ── Resumo executivo (KPIs visuais)
  doc.setTextColor(...DARK); doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text("RESUMO EXECUTIVO", ML, y);
  y += 3;
  const kpiW = CW / 5;
  const complianceOk = params.compliance >= META_SLA;
  const execKpis = [
    { label: "Compliance Geral", value: `${params.compliance.toFixed(1)}%`, bg: complianceOk ? [220,252,231] as [number,number,number] : [254,226,226] as [number,number,number], txt: complianceOk ? GREEN : RED },
    { label: "Total Analisado",  value: String(params.total),               bg: [219,234,254] as [number,number,number], txt: PRIMARY },
    { label: "Dentro do SLA",    value: String(params.dentro),              bg: [220,252,231] as [number,number,number], txt: GREEN },
    { label: "Em Risco",         value: String(params.emRisco),             bg: params.emRisco  > 0 ? [255,237,213] as [number,number,number] : [220,252,231] as [number,number,number], txt: params.emRisco  > 0 ? ORANGE : GREEN },
    { label: "Violados",         value: String(params.violados),            bg: params.violados > 0 ? [254,226,226] as [number,number,number] : [220,252,231] as [number,number,number], txt: params.violados > 0 ? RED    : GREEN },
  ];
  execKpis.forEach(({ label, value, bg, txt }, i) => {
    const x = ML + i * kpiW;
    doc.setFillColor(...bg); doc.roundedRect(x, y, kpiW - 1.5, 17, 1.5, 1.5, "F");
    doc.setTextColor(...MUTED); doc.setFontSize(6); doc.setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), x + (kpiW - 1.5) / 2, y + 5, { align: "center" });
    doc.setTextColor(...txt); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(value, x + (kpiW - 1.5) / 2, y + 12, { align: "center" });
  });
  y += 22;

  // ── Barra visual de distribuição SLA
  if (params.total > 0) {
    doc.setTextColor(...DARK); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text("DISTRIBUIÇÃO SLA", ML, y);
    y += 3;
    const barH = 7; const barW = CW;
    const pDentro  = params.dentro  / params.total;
    const pRisco   = params.emRisco / params.total;
    const pViolado = params.violados / params.total;
    doc.setFillColor(16, 185, 129);  doc.rect(ML,                           y, barW * pDentro,  barH, "F");
    doc.setFillColor(251, 146, 60);  doc.rect(ML + barW * pDentro,          y, barW * pRisco,   barH, "F");
    doc.setFillColor(239, 68, 68);   doc.rect(ML + barW * (pDentro + pRisco), y, barW * pViolado, barH, "F");
    doc.setDrawColor(...BORDER_CLR); doc.rect(ML, y, barW, barH, "S");
    y += barH + 8;
  }

  // ── Tabela de detalhamento
  const statusLabel = (s: string) => s === "dentro" ? "Dentro" : s === "em_risco" ? "Em Risco" : "Violado";
  autoTable(doc, {
    startY: y,
    head: [["RHM", "Projeto", "Prioridade", "Abertura", "Prazo SLA", "Resolução", "Status", "Atraso"]],
    body: params.results.map(r => [
      r.rhm,
      trunc(r.projeto, 40),
      r.prioridade,
      new Date(r.abertura).toLocaleDateString("pt-BR"),
      `${new Date(r.prazoSLA).toLocaleDateString("pt-BR")} ${new Date(r.prazoSLA).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      r.resolucao ? new Date(r.resolucao).toLocaleDateString("pt-BR") : "Em aberto",
      { content: statusLabel(r.statusSLA), styles: { textColor: r.statusSLA === "dentro" ? GREEN : r.statusSLA === "em_risco" ? ORANGE : RED, fontStyle: "bold" as const } },
      r.atraso > 0 ? { content: formatHours(r.atraso), styles: { textColor: RED, fontStyle: "bold" as const } } : "—",
    ]),
    styles: { fontSize: 7.5, cellPadding: 2.2, textColor: DARK },
    headStyles: { fillColor: HEAD_ROW, textColor: 255, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: {
      0: { cellWidth: 20 }, 1: { cellWidth: "auto" }, 2: { cellWidth: 22 },
      3: { cellWidth: 22, halign: "center" }, 4: { cellWidth: 34, halign: "center" },
      5: { cellWidth: 22, halign: "center" }, 6: { cellWidth: 22, halign: "center" },
      7: { cellWidth: 18, halign: "right" },
    },
    margin: { left: ML, right: MR },
    tableLineColor: BORDER_CLR,
    tableLineWidth: 0.2,
  });

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

export function RelatorioSLA({ onBack }: Props) {
  const { demandas }    = useDemandas();
  const { transitions } = useAllTransitions();
  const profiles        = useProfiles();
  const { profile, isAdmin } = useAuth();

  // ── Seleção automática do analista
  const [periodo, setPeriodo]         = useState("30");
  const [dataInicio, setDataInicio]   = useState(daysAgo(30));
  const [dataFim,    setDataFim]      = useState(today());
  const [analista,   setAnalista]     = useState<string>(() => isAdmin ? "all" : (profile?.user_id ?? "all"));

  useEffect(() => {
    if (!isAdmin && profile?.user_id) setAnalista(profile.user_id);
  }, [isAdmin, profile?.user_id]);

  const [previewUrl,    setPreviewUrl]    = useState<string | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const filtered = useMemo(() => {
    let items = demandas;
    if (dataInicio) items = items.filter(d => new Date(d.created_at) >= new Date(dataInicio + "T00:00:00"));
    if (dataFim)    items = items.filter(d => new Date(d.created_at) <= new Date(dataFim    + "T23:59:59"));
    if (analista !== "all") items = items.filter(d => analistaMatches(analista, d.responsavel_dev));
    return items;
  }, [demandas, dataInicio, dataFim, analista]);

  const sla = useMemo(() => calcSLA(filtered, transitions), [filtered, transitions]);

  const analistas = useMemo(() => {
    return buildAnalistasDedup(profiles.map(p => p.user_id), profiles);
  }, [profiles]);

  useEffect(() => {
    if (analista !== "all" && !analistas.some(option => option.user_id === analista)) {
      const ownId = profile?.user_id;
      setAnalista(!isAdmin && ownId && analistas.some(option => option.user_id === ownId) ? ownId : "all");
    }
  }, [analista, analistas, isAdmin, profile?.user_id]);

  const barData = useMemo(() => {
    const dentro  = sla.results.filter(r => r.statusSLA === "dentro").length;
    const emRisco = sla.results.filter(r => r.statusSLA === "em_risco").length;
    const violado = sla.results.filter(r => r.statusSLA === "violado").length;
    return { dentro, emRisco, violado, total: Math.max(dentro + emRisco + violado, 1) };
  }, [sla]);

  const maiorViolacao = useMemo(() => {
    const v = sla.results.filter(r => r.statusSLA === "violado");
    return v.filter(r => r.prioridade === "Crítico").length >= v.filter(r => r.prioridade === "Padrão").length
      ? "Crítico" : "Padrão";
  }, [sla]);

  const periodoLabel = `${fmtDateBR(dataInicio)} a ${fmtDateBR(dataFim)}`;
  const reportCfg    = getReportConfig("sla_compliance");

  const complianceStatus: KPIItem["status"] =
    sla.compliance >= META_SLA ? "good" : sla.compliance >= 80 ? "warning" : "danger";

  const kpiItems: KPIItem[] = [
    { label: "Compliance",     value: `${sla.compliance.toFixed(1)}%`, meta: `Meta: ≥ ${META_SLA}%`, status: complianceStatus,                              icon: <Shield className="h-5 w-5" />       },
    { label: "Violados",       value: sla.violados,                    status: sla.violados > 0 ? "danger"  : "good",                                        icon: <AlertTriangle className="h-5 w-5" /> },
    { label: "Em Risco",       value: sla.emRisco,                     status: sla.emRisco  > 0 ? "warning" : "good",                                        icon: <AlertTriangle className="h-5 w-5" /> },
    { label: "Maior Violação", value: maiorViolacao,                   status: "neutral",                                                                   icon: <CheckCircle2 className="h-5 w-5" />  },
  ];

  const statusBadge = (s: string) => {
    if (s === "dentro")   return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Dentro</Badge>;
    if (s === "em_risco") return <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">Em risco</Badge>;
    return <Badge variant="destructive" className="text-[10px]">Violado</Badge>;
  };

  const columns: TableColumn[] = [
    { key: "rhm",       label: "RHM",        sortable: true },
    { key: "projeto",   label: "Projeto",    sortable: true },
    { key: "prioridade",label: "Prioridade", sortable: true },
    { key: "abertura",  label: "Abertura",   sortable: true, render: (v) => new Date(v).toLocaleDateString("pt-BR") },
    { key: "prazoSLA",  label: "Prazo SLA",  sortable: true, render: (v) => `${new Date(v).toLocaleDateString("pt-BR")} ${new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` },
    { key: "resolucao", label: "Resolução",                  render: (v) => v ? new Date(v).toLocaleDateString("pt-BR") : <span className="text-muted-foreground">Em aberto</span> },
    { key: "statusSLA", label: "Status",     sortable: true, render: (v) => statusBadge(v) },
    { key: "atraso",    label: "Atraso",     align: "right", sortable: true, render: (v) => v > 0 ? <span className="text-destructive font-medium">{formatHours(v)}</span> : "—" },
  ];

  const tableData = sla.results.map(r => ({ ...r }));

  const handleVisualizarPDF = async () => {
    setGeneratingPDF(true);
    try {
      const analistaLabel = analista === "all" ? "Todos" : (profiles.find(p => p.user_id === analista)?.display_name ?? analista);
      const blob = await buildPDFBlob({
        compliance: sla.compliance,
        dentro: barData.dentro,
        emRisco: barData.emRisco,
        violados: sla.violados,
        total: sla.results.length,
        results: sla.results,
        dataInicio,
        dataFim,
        analista: analistaLabel,
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
              Pré-visualização — Relatório SLA Compliance
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
            description={`${reportCfg.subtitulo} · Meta: ≥ ${META_SLA}%`}
            icon={<Shield className="h-5 w-5" />}
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
        chart={
          <ReportChart
            titulo="Distribuição SLA"
            badge={periodoLabel}
            height={72}
            legenda={[
              { cor: "#10b981", label: `Dentro (${barData.dentro})` },
              { cor: "#fb923c", label: `Em risco (${barData.emRisco})` },
              { cor: "hsl(var(--destructive))", label: `Violado (${barData.violado})` },
            ]}
          >
            <div className="h-8 rounded-full overflow-hidden flex bg-muted mt-2">
              {barData.dentro  > 0 && <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(barData.dentro  / barData.total) * 100}%` }} />}
              {barData.emRisco > 0 && <div className="bg-orange-400 h-full transition-all" style={{ width: `${(barData.emRisco / barData.total) * 100}%` }} />}
              {barData.violado > 0 && <div className="bg-destructive h-full transition-all" style={{ width: `${(barData.violado / barData.total) * 100}%` }} />}
            </div>
          </ReportChart>
        }
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
              titulo="Detalhamento por Demanda"
              columns={columns}
              data={tableData}
              rowKey={(r) => r.rhm}
            />
          </>
        }
        footer={
          <ReportLegendBlock items={[
            { sigla: "SLA",      descricao: "Service Level Agreement — prazo contratual de atendimento" },
            { sigla: "Dentro",   descricao: "Resolvido antes do prazo SLA" },
            { sigla: "Em Risco", descricao: "Dentro do prazo mas com menos de 20% de margem" },
            { sigla: "Violado",  descricao: "Prazo SLA ultrapassado" },
            { sigla: "Atraso",   descricao: "Horas excedidas após o prazo SLA" },
          ]} />
        }
      />
    </>
  );
}
