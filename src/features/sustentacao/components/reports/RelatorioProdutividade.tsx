import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useDemandas } from "../../hooks/useDemandas";
import { useAllTransitions, useAllHours, useProfiles } from "../../hooks/useAllTransitions";
import { useFases } from "../../hooks/useFases";
import { getReportConfig } from "../../utils/reportConfig";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ReportLayout,
  ReportPageHeader,
  ReportFilterBar,
  ReportKPISummary,
  ReportLegendBlock,
} from "@/shared/components/reports";
import type { KPIItem } from "@/shared/components/reports";
import {
  ChevronDown, ChevronRight,
  ClipboardList, CheckCircle2, Clock, AlertTriangle,
  FileText, Eye,
} from "lucide-react";
import { getInitials } from "@/lib/personName";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

function useDemandaResponsaveis() {
  const { currentTeamId } = useAuth();
  const [responsaveis, setResponsaveis] = useState<Array<{ demanda_id: string; user_id: string; papel: string }>>([])

  useEffect(() => {
    if (!currentTeamId) return;
    supabase.from("demanda_responsaveis" as any)
      .select("demanda_id, user_id, papel, demandas!inner(team_id)")
      .eq("demandas.team_id", currentTeamId)
      .then(({ data }) => setResponsaveis((data || []) as any[]));
  }, [currentTeamId]);

  return { responsaveis };
}

function fmtDate(d?: string | null) { return d ? new Date(d).toLocaleDateString("pt-BR") : "—"; }
function today()        { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; }
function trunc(s: string, max: number) { return s.length > max ? s.slice(0, max - 1) + "…" : s; }

const SITUACAO_LABEL: Record<string, { label: string; cls: string }> = {
  concluido:                  { label: "Concluído",          cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  resolvido:                  { label: "Resolvido",          cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  aceite_final:               { label: "Aceite Final",       cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ag_aceite_final:            { label: "Ag. Aceite Final",   cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  em_andamento:               { label: "Em Andamento",       cls: "bg-blue-100 text-blue-700 border-blue-200" },
  em_analise:                 { label: "Em Análise",         cls: "bg-blue-100 text-blue-700 border-blue-200" },
  em_execucao:                { label: "Em Execução",        cls: "bg-blue-100 text-blue-700 border-blue-200" },
  fila_atendimento:           { label: "Fila Atendimento",   cls: "bg-slate-100 text-slate-700 border-slate-200" },
  planejamento_elaboracao:    { label: "Em Elaboração",      cls: "bg-blue-100 text-blue-700 border-blue-200" },
  planejamento_ag_aprovacao:  { label: "Ag. Aprovação",      cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  planejamento_aprovada:      { label: "Aprovada p/ Exec",   cls: "bg-violet-100 text-violet-700 border-violet-200" },
  bloqueada:                  { label: "Bloqueada",          cls: "bg-red-100 text-red-700 border-red-200" },
  hom_ag_homologacao:         { label: "Ag. Homologação",    cls: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  hom_homologada:             { label: "Homologada",         cls: "bg-teal-100 text-teal-700 border-teal-200" },
  fila_producao:              { label: "Fila Produção",      cls: "bg-orange-100 text-orange-700 border-orange-200" },
  aberto:                     { label: "Aberto",             cls: "bg-orange-100 text-orange-700 border-orange-200" },
  nova:                       { label: "Nova",               cls: "bg-orange-100 text-orange-700 border-orange-200" },
  cancelado:                  { label: "Cancelado",          cls: "bg-gray-100 text-gray-500 border-gray-200" },
  cancelada:                  { label: "Cancelada",          cls: "bg-gray-100 text-gray-500 border-gray-200" },
  rejeitado:                  { label: "Rejeitado",          cls: "bg-red-100 text-red-700 border-red-200" },
  rejeitada:                  { label: "Rejeitada",          cls: "bg-red-100 text-red-700 border-red-200" },
};

function situacaoLabel(s?: string | null) {
  if (!s) return "—";
  return SITUACAO_LABEL[s.toLowerCase()]?.label ?? s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
function SituacaoBadge({ situacao }: { situacao?: string | null }) {
  const s = SITUACAO_LABEL[situacao?.toLowerCase() ?? ""];
  return <Badge className={`text-[10px] whitespace-nowrap ${s?.cls ?? "bg-muted text-muted-foreground"}`}>{situacaoLabel(situacao)}</Badge>;
}
function isResolvido(s?: string | null) {
  return ["concluido", "resolvido", "aceite_final", "ag_aceite_final"].includes(s?.toLowerCase() ?? "");
}
function rateColor(r: number) {
  return r >= 80 ? "bg-emerald-100 text-emerald-700 border-emerald-200"
       : r >= 40 ? "bg-orange-100 text-orange-700 border-orange-200"
       : "bg-destructive/10 text-destructive border-destructive/20";
}

interface HoraLancada   { id: string; data: string; fase: string; descricao: string; horas: number; }
interface AtividadeRow  { demandaId: string; rhm: string; projeto: string; situacao: string; dataInicio: string; dataFim: string; horasAnalista: number; outrosAnalistas: string[]; horasDetalhadas: HoraLancada[]; }
interface AnalistaGroup { userId: string; nome: string; cargo: string; atividades: AtividadeRow[]; totalHoras: number; resolvidos: number; emAberto: number; taxaResolucao: number; }

function AtividadeExpandivel({ atividade }: { atividade: AtividadeRow }) {
  const [open, setOpen] = useState(false);
  const tem = atividade.horasDetalhadas.length > 0;
  return (
    <>
      <TableRow className={`hover:bg-muted/20 transition-colors ${tem ? "cursor-pointer select-none" : ""}`} onClick={() => tem && setOpen(v => !v)}>
        <TableCell className="text-xs font-mono pl-4 w-[90px]">
          <div className="flex items-center gap-1">
            {tem ? (open ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />) : <span className="w-3 inline-block" />}
            {atividade.rhm}
          </div>
        </TableCell>
        <TableCell className="text-xs max-w-[180px]"><span className="line-clamp-2" title={atividade.projeto}>{atividade.projeto}</span></TableCell>
        <TableCell className="text-xs"><SituacaoBadge situacao={atividade.situacao} /></TableCell>
        <TableCell className="text-right text-xs tabular-nums">{atividade.dataInicio}</TableCell>
        <TableCell className="text-right text-xs tabular-nums">{atividade.dataFim}</TableCell>
        <TableCell className="text-right text-xs tabular-nums font-medium">{atividade.horasAnalista > 0 ? `${atividade.horasAnalista.toFixed(1)}h` : "—"}</TableCell>
        <TableCell className="text-xs pr-4">
          {atividade.outrosAnalistas.length > 0
            ? <div className="flex flex-wrap gap-1">{atividade.outrosAnalistas.map(n => <Badge key={n} variant="secondary" className="text-[10px] font-normal">{n}</Badge>)}</div>
            : <span className="text-muted-foreground">—</span>}
        </TableCell>
      </TableRow>
      {open && tem && (
        <TableRow className="bg-muted/10 hover:bg-muted/10">
          <TableCell colSpan={7} className="py-0 pl-10 pr-4 pb-2">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-muted/40">
                  <TableHead className="text-[10px] font-semibold text-muted-foreground py-1.5 w-[110px]">Data</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground py-1.5 w-[160px]">Fase</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground py-1.5">Descrição</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground py-1.5 text-right w-[70px]">Horas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atividade.horasDetalhadas.map(h => (
                  <TableRow key={h.id} className="border-b border-muted/20 last:border-0">
                    <TableCell className="text-[11px] py-1.5 tabular-nums">{h.data}</TableCell>
                    <TableCell className="text-[11px] py-1.5">{h.fase}</TableCell>
                    <TableCell className="text-[11px] py-1.5 max-w-[300px]"><span className="line-clamp-2">{h.descricao}</span></TableCell>
                    <TableCell className="text-[11px] py-1.5 text-right tabular-nums font-medium">{h.horas.toFixed(1)}h</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t border-muted/30 bg-muted/10">
                  <TableCell colSpan={3} className="text-[10px] py-1.5 text-muted-foreground font-semibold">Total nesta demanda</TableCell>
                  <TableCell className="text-[11px] py-1.5 text-right tabular-nums font-bold">{atividade.horasDetalhadas.reduce((s, h) => s + h.horas, 0).toFixed(1)}h</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Cor primária Sustentação (azul #2563eb)
const SUST_PRIMARY: [number, number, number] = [37, 99, 235];

// ─── Gera o PDF em blob (sem salvar) para preview
async function buildPDFBlob(grupo: AnalistaGroup, dataInicio: string, dataFim: string): Promise<Blob> {
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

  doc.setFillColor(...PRIMARY); doc.rect(0, 0, W, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO DE PRODUTIVIDADE — INDIVIDUAL", ML, 10);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text("Módulo: Sustentação", ML, 16);
  doc.text(`Gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`, ML, 21);

  let y = 31;

  doc.setFillColor(...LIGHT_BG); doc.roundedRect(ML, y, CW, 18, 2, 2, "F");
  doc.setDrawColor(...BORDER_CLR); doc.roundedRect(ML, y, CW, 18, 2, 2, "S");
  doc.setFillColor(...PRIMARY); doc.circle(ML + 8, y + 9, 5.5, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
  doc.text(getInitials(grupo.nome), ML + 8, y + 11, { align: "center" });
  doc.setTextColor(...DARK); doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text(grupo.nome, ML + 17, y + 8);
  if (grupo.cargo) {
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
    doc.text(grupo.cargo, ML + 17, y + 14);
  }
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
  doc.text(`Período: ${fmtDate(dataInicio)} a ${fmtDate(dataFim)}`, ML + CW - 3, y + 11, { align: "right" });
  y += 23;

  doc.setTextColor(...DARK); doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text("RESUMO DO PERÍODO", ML, y);
  y += 3;
  const kpiW = CW / 5;
  const kpis = [
    { label: "Atividades",     value: String(grupo.atividades.length),         bg: [219,234,254] as [number,number,number], txt: [30,64,175]  as [number,number,number] },
    { label: "Resolvidas",     value: String(grupo.resolvidos),                 bg: [220,252,231] as [number,number,number], txt: [4,120,87]   as [number,number,number] },
    { label: "Em Aberto",      value: String(grupo.emAberto),                   bg: [255,237,213] as [number,number,number], txt: [154,52,18]  as [number,number,number] },
    { label: "Taxa Resolução", value: `${grupo.taxaResolucao.toFixed(0)}%`,     bg: [243,232,255] as [number,number,number], txt: [109,40,217] as [number,number,number] },
    { label: "Total Horas",    value: `${grupo.totalHoras.toFixed(1)}h`,        bg: [219,234,254] as [number,number,number], txt: SUST_PRIMARY },
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

  const atividadesComHoras = grupo.atividades.filter(a => a.horasDetalhadas.length > 0);

  for (const ativ of atividadesComHoras) {
    if (y > 175) { doc.addPage(); y = 14; }
    const sitLabel = situacaoLabel(ativ.situacao);
    doc.setFillColor(...PRIMARY); doc.roundedRect(ML, y, CW, 10, 2, 2, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont("helvetica", "bold");
    const rhmLabel = `RHM ${ativ.rhm}`;
    doc.text(rhmLabel, ML + 3, y + 7);
    const rhmW = doc.getTextWidth(rhmLabel);
    doc.setFont("helvetica", "normal");
    doc.text(`  ·  ${trunc(ativ.projeto, 60)}`, ML + 3 + rhmW, y + 7);
    doc.setFontSize(7); doc.setTextColor(204, 229, 255);
    doc.text(trunc(sitLabel, 22), ML + CW - 3, y + 7, { align: "right" });
    y += 10;

    doc.setFillColor(...TOTAL_BG); doc.rect(ML, y, CW, 8, "F");
    doc.setDrawColor(...BORDER_CLR); doc.rect(ML, y, CW, 8, "S");
    const c1X = ML + 3, c2X = ML + CW * 0.25, c3X = ML + CW * 0.50;
    doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(...MUTED);
    doc.text("Início:", c1X, y + 5.5);
    doc.text("Fim:",    c2X, y + 5.5);
    doc.text("Horas:",  c3X, y + 5.5);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK);
    doc.text(ativ.dataInicio, c1X + doc.getTextWidth("Início: "), y + 5.5);
    doc.text(ativ.dataFim,   c2X + doc.getTextWidth("Fim: "),    y + 5.5);
    doc.text(ativ.horasAnalista > 0 ? `${ativ.horasAnalista.toFixed(1)}h` : "—", c3X + doc.getTextWidth("Horas: "), y + 5.5);
    y += 10;

    const totalDem = ativ.horasDetalhadas.reduce((s, h) => s + h.horas, 0);
    autoTable(doc, {
      startY: y,
      head: [["Data", "Fase", "Descrição", "Horas"]],
      body: [
        ...ativ.horasDetalhadas.map(h => [h.data, trunc(h.fase, 24), trunc(h.descricao, 100), `${h.horas.toFixed(1)}h`]),
        [{ content: "Total nesta demanda", colSpan: 3, styles: { fontStyle: "bold" as const, fillColor: TOTAL_BG, textColor: DARK } },
         { content: `${totalDem.toFixed(1)}h`, styles: { fontStyle: "bold" as const, halign: "right" as const, fillColor: TOTAL_BG, textColor: PRIMARY } }],
      ],
      styles: { fontSize: 7.5, cellPadding: 2.2, textColor: DARK, overflow: "linebreak" },
      headStyles: { fillColor: HEAD_ROW, textColor: 255, fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: ALT_ROW },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 40 }, 2: { cellWidth: "auto" }, 3: { cellWidth: 18, halign: "right" } },
      margin: { left: ML, right: MR },
      tableLineColor: BORDER_CLR,
      tableLineWidth: 0.2,
      showHead: "firstPage",
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (y > 175) { doc.addPage(); y = 14; }
  y += 2;
  doc.setFillColor(...PRIMARY); doc.roundedRect(ML, y, CW, 11, 2, 2, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("TOTAL GERAL DE HORAS", ML + 4, y + 7.5);
  doc.setFontSize(11);
  doc.text(`${grupo.totalHoras.toFixed(1)}h`, ML + CW - 4, y + 7.5, { align: "right" });
  y += 16;
  doc.setTextColor(...MUTED); doc.setFontSize(6.5); doc.setFont("helvetica", "italic");
  doc.text("Documento gerado automaticamente pelo sistema de gestão — Sustentação", W / 2, y, { align: "center" });

  const total = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
    doc.text(`Página ${i} de ${total}`, W - MR, doc.internal.pageSize.getHeight() - 6, { align: "right" });
  }

  return doc.output("blob");
}

interface Props { onBack?: () => void; }

export function RelatorioProdutividade({ onBack }: Props) {
  const { demandas }    = useDemandas();
  const { transitions } = useAllTransitions();
  const { hours }       = useAllHours();
  const profiles        = useProfiles();
  const { responsaveis } = useDemandaResponsaveis();
  const { teams, user, isAdmin } = useAuth();
  const { fases }       = useFases();

  const fasesMap = useMemo(() => { const m: Record<string,string>={}; fases.forEach(f => { m[f.key]=f.label; }); return m; }, [fases]);

  const [teamId,        setTeamId]        = useState("all");
  // Seleção automática: admin inicia com "all", usuário comum inicia com seu próprio userId
  const [analista,      setAnalista]      = useState(() => isAdmin ? "all" : (user?.id ?? "all"));
  const [dataInicio,    setDataInicio]    = useState(daysAgo(30));
  const [dataFim,       setDataFim]       = useState(today());
  const [openGroups,    setOpenGroups]    = useState<Set<string>>(new Set());
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [periodo,       setPeriodo]       = useState("30");
  const [previewUrl,    setPreviewUrl]    = useState<string | null>(null);

  // Garante sincronização caso o perfil do usuário carregue após a montagem
  useEffect(() => {
    if (!isAdmin && user?.id && analista === "all") {
      setAnalista(user.id);
    }
  }, [user?.id, isAdmin]);

  const sustTeams  = teams.filter(t => t.module === "sustentacao");
  const profileIds = useMemo(() => new Set(profiles.map(p => p.user_id)), [profiles]);
  const nomeMap    = useMemo(() => { const m = new Map<string,string>(); profiles.forEach(p => m.set(p.user_id, p.display_name||p.email||p.user_id.slice(0,8))); return m; }, [profiles]);
  const cargoMap   = useMemo(() => { const m = new Map<string,string>(); profiles.forEach(p => m.set(p.user_id, (p as any).role || (p as any).cargo || "")); return m; }, [profiles]);

  const demandasMap = useMemo(() => {
    const m = new Map<string, typeof demandas[number]>();
    demandas.forEach(d => m.set(d.id, d));
    return m;
  }, [demandas]);

  const responsaveisPorDemanda = useMemo(() => {
    const m = new Map<string,Set<string>>();
    demandas.forEach(d => {
      const ids = new Set<string>();
      if (d.responsavel_dev)          ids.add(d.responsavel_dev);
      if (d.responsavel_requisitos)   ids.add(d.responsavel_requisitos);
      if (d.responsavel_teste)        ids.add(d.responsavel_teste);
      if (d.responsavel_arquiteto)    ids.add(d.responsavel_arquiteto);
      m.set(d.id, ids);
    });
    responsaveis.forEach(r => { if (!m.has(r.demanda_id)) m.set(r.demanda_id, new Set()); m.get(r.demanda_id)!.add(r.user_id); });
    return m;
  }, [demandas, responsaveis]);

  const resolveUserId = (h: any): string | null => h.user_id || h.lancado_por || null;

  const hoursFiltradas = useMemo(() => {
    const ini = new Date(dataInicio + "T00:00:00");
    const fim = new Date(dataFim + "T23:59:59");
    return hours.filter(h => {
      if (!h.demanda_id || !resolveUserId(h)) return false;
      const d = new Date(h.created_at);
      if (d < ini || d > fim) return false;
      if (teamId !== "all") {
        const demanda = demandasMap.get(h.demanda_id);
        if (!demanda || demanda.team_id !== teamId) return false;
      }
      return true;
    });
  }, [hours, dataInicio, dataFim, teamId, demandasMap]);

  const demandaIdsNoPeriodo = useMemo(() => {
    const s = new Set<string>();
    hoursFiltradas.forEach(h => { if (h.demanda_id) s.add(h.demanda_id); });
    return s;
  }, [hoursFiltradas]);

  const demandasFiltradas = useMemo(() => {
    return demandas.filter(d => demandaIdsNoPeriodo.has(d.id));
  }, [demandas, demandaIdsNoPeriodo]);

  const horasPorDemandaUser = useMemo(() => {
    const m = new Map<string,Map<string,number>>();
    hoursFiltradas.forEach(h => {
      const uid = resolveUserId(h);
      if (!h.demanda_id || !uid) return;
      if (!m.has(h.demanda_id)) m.set(h.demanda_id, new Map());
      const inner = m.get(h.demanda_id)!;
      inner.set(uid, (inner.get(uid) ?? 0) + Number(h.horas ?? 0));
    });
    return m;
  }, [hoursFiltradas]);

  const horasDetalhadasMap = useMemo(() => {
    const m = new Map<string,HoraLancada[]>();
    hoursFiltradas.forEach(h => {
      const uid = resolveUserId(h);
      if (!h.demanda_id || !uid) return;
      const key = `${h.demanda_id}::${uid}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push({ id: h.id || `${key}-${Math.random()}`, data: fmtDate(h.created_at), fase: fasesMap[h.fase] || h.fase || "--", descricao: h.descricao || "—", horas: Number(h.horas ?? 0) });
    });
    m.forEach(list => list.sort((a, b) => new Date(b.data.split("/").reverse().join("-")).getTime() - new Date(a.data.split("/").reverse().join("-")).getTime()));
    return m;
  }, [hoursFiltradas, fasesMap]);

  const analistasList = useMemo(() => {
    const idSet = new Set<string>();
    demandasFiltradas.forEach(d => {
      responsaveisPorDemanda.get(d.id)?.forEach(uid => idSet.add(uid));
      horasPorDemandaUser.get(d.id)?.forEach((_, uid) => idSet.add(uid));
    });
    return profiles.filter(p => idSet.has(p.user_id)).map(p => ({ user_id: p.user_id, display_name: p.display_name || p.email || p.user_id.slice(0,8) })).sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [demandasFiltradas, responsaveisPorDemanda, horasPorDemandaUser, profiles]);

  const grupos = useMemo(() => {
    const todosIds = new Set<string>();
    demandasFiltradas.forEach(d => {
      horasPorDemandaUser.get(d.id)?.forEach((_, uid) => todosIds.add(uid));
    });
    const ids = analista !== "all" ? [analista] : [...todosIds].filter(id => profileIds.has(id));
    return ids.map(userId => {
      const atividades: AtividadeRow[] = demandasFiltradas
        .filter(d => horasPorDemandaUser.get(d.id)?.has(userId) ?? false)
        .map(d => {
          const horasAnalista = horasPorDemandaUser.get(d.id)?.get(userId) ?? 0;
          const outrosIds = new Set<string>();
          responsaveisPorDemanda.get(d.id)?.forEach(uid => { if (uid !== userId) outrosIds.add(uid); });
          horasPorDemandaUser.get(d.id)?.forEach((_, uid) => { if (uid !== userId) outrosIds.add(uid); });
          const conclusao = transitions.filter(t => t.demanda_id === d.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).find(t => ["aceite_final","ag_aceite_final","concluido","resolvido"].includes(t.to_status ?? ""));
          return {
            demandaId: d.id,
            rhm: d.rhm || "—",
            projeto: d.projeto || d.titulo || "—",
            situacao: d.situacao || "—",
            dataInicio: fmtDate(d.created_at),
            dataFim: fmtDate(d.aceite_data ?? conclusao?.created_at ?? null),
            horasAnalista,
            outrosAnalistas: [...outrosIds].filter(id => profileIds.has(id)).map(id => nomeMap.get(id) || id.slice(0,8)),
            horasDetalhadas: horasDetalhadasMap.get(`${d.id}::${userId}`) ?? [],
          };
        });
      const totalHoras   = atividades.reduce((s, a) => s + a.horasAnalista, 0);
      const resolvidos   = atividades.filter(a => isResolvido(a.situacao)).length;
      const emAberto     = atividades.length - resolvidos;
      const cargo        = cargoMap.get(userId) ?? "";
      return { userId, nome: nomeMap.get(userId) || userId.slice(0,8), cargo, atividades, totalHoras, resolvidos, emAberto, taxaResolucao: atividades.length > 0 ? (resolvidos / atividades.length) * 100 : 0 };
    }).filter(g => g.atividades.length > 0).sort((a, b) => b.resolvidos - a.resolvidos);
  }, [demandasFiltradas, responsaveisPorDemanda, horasPorDemandaUser, horasDetalhadasMap, transitions, nomeMap, cargoMap, analista, profileIds]);

  const kpis = useMemo(() => ({
    totalAtividades: grupos.reduce((s, g) => s + g.atividades.length, 0),
    totalResolvidos:  grupos.reduce((s, g) => s + g.resolvidos, 0),
    totalEmAberto:    grupos.reduce((s, g) => s + g.emAberto, 0),
    totalHoras:       grupos.reduce((s, g) => s + g.totalHoras, 0),
  }), [grupos]);

  const toggleGroup  = (id: string) => setOpenGroups(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const expandAll    = () => setOpenGroups(new Set(grupos.map(g => g.userId)));
  const collapseAll  = () => setOpenGroups(new Set());

  const reportCfg    = getReportConfig("produtividade");
  const periodoLabel = `${fmtDate(dataInicio)} a ${fmtDate(dataFim)}`;
  const isIndividual = analista !== "all";

  const kpiItems: KPIItem[] = [
    { label: "Total Atividades", value: kpis.totalAtividades, status: "neutral",                                                                                          icon: <ClipboardList className="h-5 w-5" /> },
    { label: "Resolvidos",       value: kpis.totalResolvidos,  status: "good",                                                                                            icon: <CheckCircle2  className="h-5 w-5" /> },
    { label: "Em Aberto",        value: kpis.totalEmAberto,    status: kpis.totalEmAberto > 10 ? "danger" : kpis.totalEmAberto > 0 ? "warning" : "good",                   icon: <AlertTriangle className="h-5 w-5" /> },
    { label: "Horas Lançadas",   value: `${kpis.totalHoras.toFixed(1)}h`,                                                                                  status: "neutral", icon: <Clock         className="h-5 w-5" /> },
  ];

  const handleVisualizarPDF = async () => {
    if (analista === "all" || grupos.length === 0) return;
    setGeneratingPDF(true);
    try {
      const grupo = grupos[0];
      const blob = await buildPDFBlob(grupo, dataInicio, dataFim);
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
      <ReportLayout
        header={
          <ReportPageHeader
            title={reportCfg.titulo.replace("Relatório — ", "")}
            description={reportCfg.subtitulo}
            icon={<FileText className="h-5 w-5" />}
            badge={periodoLabel}
            onBack={onBack}
          />
        }
        filters={
          <ReportFilterBar
            periodo={periodo}       setPeriodo={setPeriodo}
            dataInicio={dataInicio} setDataInicio={setDataInicio}
            dataFim={dataFim}       setDataFim={setDataFim}
            analista={analista}     setAnalista={setAnalista}
            analistas={analistasList}
            showAnalista={true}
            analistaDisabled={!isAdmin}
            modulo="sustentacao"
            totalFiltrado={demandasFiltradas.length}
            onClear={() => {
              setPeriodo("30");
              setDataInicio(daysAgo(30));
              setDataFim(today());
              // ao limpar, respeita o perfil: admin volta para "all", usuário comum mantém seu id
              setAnalista(isAdmin ? "all" : (user?.id ?? "all"));
            }}
          />
        }
        kpis={<ReportKPISummary items={kpiItems} />}
        table={
          <div className="space-y-4">
            {/* Botão Visualizar Relatório PDF — único mecanismo de relatório */}
            {isIndividual && (
              <div className="flex justify-end print:hidden">
                <Button
                  onClick={handleVisualizarPDF}
                  disabled={generatingPDF || grupos.length === 0}
                  size="sm"
                  className="gap-2"
                >
                  <Eye className="h-4 w-4" />
                  {generatingPDF ? "Gerando..." : "Visualizar Relatório (PDF)"}
                </Button>
              </div>
            )}

            {grupos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum dado encontrado para o período e filtros selecionados.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {grupos.length > 1 && (
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={expandAll}>Expandir todos</Button>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={collapseAll}>Recolher todos</Button>
                  </div>
                )}
                {grupos.map(grupo => (
                  <Card key={grupo.userId} className="overflow-hidden">
                    <div
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors select-none"
                      onClick={() => toggleGroup(grupo.userId)}
                    >
                      <div className="flex items-center gap-3">
                        {openGroups.has(grupo.userId)
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <div>
                          <p className="font-semibold text-sm">{grupo.nome}</p>
                          {grupo.cargo && <p className="text-xs text-muted-foreground">{grupo.cargo}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Atividades</p>
                          <p className="text-sm font-semibold">{grupo.atividades.length}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Resolvidos</p>
                          <p className="text-sm font-semibold text-emerald-600">{grupo.resolvidos}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Taxa</p>
                          <Badge className={`text-[10px] ${rateColor(grupo.taxaResolucao)}`}>{grupo.taxaResolucao.toFixed(0)}%</Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Horas</p>
                          <p className="text-sm font-semibold tabular-nums">{grupo.totalHoras.toFixed(1)}h</p>
                        </div>
                      </div>
                    </div>

                    {openGroups.has(grupo.userId) && (
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/20">
                              <TableHead className="text-[10px] pl-4 w-[90px]">RHM</TableHead>
                              <TableHead className="text-[10px]">Projeto</TableHead>
                              <TableHead className="text-[10px]">Situação</TableHead>
                              <TableHead className="text-[10px] text-right">Início</TableHead>
                              <TableHead className="text-[10px] text-right">Fim</TableHead>
                              <TableHead className="text-[10px] text-right">Horas</TableHead>
                              <TableHead className="text-[10px] pr-4">Outros Analistas</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {grupo.atividades.map(ativ => (
                              <AtividadeExpandivel key={ativ.demandaId} atividade={ativ} />
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        }
        footer={
          <ReportLegendBlock items={[
            { sigla: "RHM",  descricao: "Registro de Histórico de Manutenção — identificador único da demanda" },
            { sigla: "Horas", descricao: "Total de horas lançadas pelo analista nesta demanda no período selecionado" },
          ]} />
        }
      />

      {/* Dialog de preview do PDF */}
      <Dialog open={!!previewUrl} onOpenChange={open => { if (!open) handleClosePreview(); }}>
        <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-4 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Relatório de Produtividade
            </DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe
              src={previewUrl}
              className="flex-1 w-full rounded-b-lg"
              title="Preview do Relatório"
            />
          )}
          <DialogFooter className="px-6 py-3 border-t">
            <Button variant="outline" onClick={handleClosePreview}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
