import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { ExportButton } from "@/components/dashboard/ExportButton";
import {
  ChevronDown, ChevronRight,
  ClipboardList, CheckCircle2, Clock, AlertTriangle,
  FileText, FileDown,
} from "lucide-react";
import { getInitials } from "@/lib/personName";

function useDemandaResponsaveis() {
  const [responsaveis, setResponsaveis] = useState<Array<{ demanda_id: string; user_id: string; papel: string }>>([]);
  useEffect(() => {
    supabase.from("demanda_responsaveis").select("demanda_id, user_id, papel")
      .then(({ data }) => setResponsaveis(data || []));
  }, []);
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
interface AnalistaGroup { userId: string; nome: string; atividades: AtividadeRow[]; totalHoras: number; resolvidos: number; emAberto: number; taxaResolucao: number; }

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

async function gerarPDFIndividual(grupo: AnalistaGroup, dataInicio: string, dataFim: string) {
  try {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const now = new Date(); const W = doc.internal.pageSize.getWidth(); const ML = 12; const MR = 12; const CW = W - ML - MR;
    const PRIMARY=[15,118,110] as [number,number,number],DARK=[30,41,59] as [number,number,number],MUTED=[100,116,139] as [number,number,number],LIGHT_BG=[248,250,252] as [number,number,number],BORDER_CLR=[226,232,240] as [number,number,number],HEAD_ROW=[51,65,85] as [number,number,number],ALT_ROW=[248,250,252] as [number,number,number],TOTAL_BG=[241,245,249] as [number,number,number];
    doc.setFillColor(...PRIMARY); doc.rect(0,0,W,26,"F");
    doc.setTextColor(255,255,255); doc.setFontSize(13); doc.setFont("helvetica","bold"); doc.text("RELATÓRIO DE PRODUTIVIDADE — INDIVIDUAL",ML,10);
    doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.text("Módulo: Sustentação",ML,16); doc.text(`Gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`,ML,21);
    let y=31;
    doc.setFillColor(...LIGHT_BG); doc.roundedRect(ML,y,CW,16,2,2,"F"); doc.setDrawColor(...BORDER_CLR); doc.roundedRect(ML,y,CW,16,2,2,"S");
    doc.setFillColor(...PRIMARY); doc.circle(ML+8,y+8,5.5,"F"); doc.setTextColor(255,255,255); doc.setFontSize(7.5); doc.setFont("helvetica","bold"); doc.text(getInitials(grupo.nome),ML+8,y+10,{align:"center"});
    doc.setTextColor(...DARK); doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.text(grupo.nome,ML+17,y+7);
    doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(...MUTED); doc.text(`Período: ${fmtDate(dataInicio)} a ${fmtDate(dataFim)}`,ML+17,y+13);
    y+=21; doc.setTextColor(...DARK); doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.text("RESUMO DO PERÍODO",ML,y);
    y+=3; const kpiW=CW/5;
    const kpis=[{label:"Atividades",value:String(grupo.atividades.length),bg:[219,234,254] as [number,number,number],txt:[30,64,175] as [number,number,number]},{label:"Resolvidas",value:String(grupo.resolvidos),bg:[220,252,231] as [number,number,number],txt:[4,120,87] as [number,number,number]},{label:"Em Aberto",value:String(grupo.emAberto),bg:[255,237,213] as [number,number,number],txt:[154,52,18] as [number,number,number]},{label:"Taxa Resolução",value:`${grupo.taxaResolucao.toFixed(0)}%`,bg:[243,232,255] as [number,number,number],txt:[109,40,217] as [number,number,number]},{label:"Total Horas",value:`${grupo.totalHoras.toFixed(1)}h`,bg:[204,251,241] as [number,number,number],txt:[15,118,110] as [number,number,number]}];
    kpis.forEach(({label,value,bg,txt},i)=>{ const x=ML+i*kpiW; doc.setFillColor(...bg); doc.roundedRect(x,y,kpiW-1.5,15,1.5,1.5,"F"); doc.setTextColor(...MUTED); doc.setFontSize(6); doc.setFont("helvetica","normal"); doc.text(label.toUpperCase(),x+(kpiW-1.5)/2,y+5,{align:"center"}); doc.setTextColor(...txt); doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.text(value,x+(kpiW-1.5)/2,y+13,{align:"center"}); });
    y+=20;
    for (const ativ of grupo.atividades) {
      if (y>252) { doc.addPage(); y=14; }
      const sitLabel=situacaoLabel(ativ.situacao);
      doc.setFillColor(...PRIMARY); doc.roundedRect(ML,y,CW,10,2,2,"F");
      doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont("helvetica","bold"); const rhmLabel=`RHM ${ativ.rhm}`; doc.text(rhmLabel,ML+3,y+7); const rhmW=doc.getTextWidth(rhmLabel); doc.setFont("helvetica","normal"); doc.text(`  ·  ${trunc(ativ.projeto,40)}`,ML+3+rhmW,y+7);
      doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(204,255,249); doc.text(trunc(sitLabel,22),ML+CW-3,y+7,{align:"right"});
      y+=10;
      doc.setFillColor(...TOTAL_BG); doc.rect(ML,y,CW,8,"F"); doc.setDrawColor(...BORDER_CLR); doc.rect(ML,y,CW,8,"S");
      const c1X=ML+3,c2X=ML+CW*0.36,c3X=ML+CW*0.68;
      doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.setTextColor(...MUTED); doc.text("Início:",c1X,y+5.5); doc.text("Fim:",c2X,y+5.5); doc.text("Horas:",c3X,y+5.5);
      doc.setFont("helvetica","normal"); doc.setTextColor(...DARK); doc.text(ativ.dataInicio,c1X+doc.getTextWidth("Início: "),y+5.5); doc.text(ativ.dataFim,c2X+doc.getTextWidth("Fim: "),y+5.5); doc.text(ativ.horasAnalista>0?`${ativ.horasAnalista.toFixed(1)}h`:"—",c3X+doc.getTextWidth("Horas: "),y+5.5);
      y+=10;
      if (ativ.horasDetalhadas.length>0) {
        const totalDem=ativ.horasDetalhadas.reduce((s,h)=>s+h.horas,0);
        autoTable(doc,{startY:y,head:[["Data","Fase","Descrição","Horas"]],body:[...ativ.horasDetalhadas.map(h=>[h.data,trunc(h.fase,24),trunc(h.descricao,80),`${h.horas.toFixed(1)}h`]),[{content:"Total nesta demanda",colSpan:3,styles:{fontStyle:"bold" as const,fillColor:TOTAL_BG,textColor:DARK}},{content:`${totalDem.toFixed(1)}h`,styles:{fontStyle:"bold" as const,halign:"right" as const,fillColor:TOTAL_BG,textColor:PRIMARY}}]],styles:{fontSize:7.5,cellPadding:2.2,textColor:DARK,overflow:"linebreak"},headStyles:{fillColor:HEAD_ROW,textColor:255,fontStyle:"bold",fontSize:7},alternateRowStyles:{fillColor:ALT_ROW},columnStyles:{0:{cellWidth:22},1:{cellWidth:35},2:{cellWidth:"auto"},3:{cellWidth:18,halign:"right"}},margin:{left:ML,right:MR},tableLineColor:BORDER_CLR,tableLineWidth:0.2,showHead:"firstPage"});
        y=(doc as any).lastAutoTable.finalY+6;
      } else {
        doc.setFillColor(...ALT_ROW); doc.rect(ML,y,CW,8,"F"); doc.setDrawColor(...BORDER_CLR); doc.rect(ML,y,CW,8,"S"); doc.setTextColor(...MUTED); doc.setFontSize(7.5); doc.setFont("helvetica","italic"); doc.text("Sem horas lançadas neste período",ML+4,y+5.5); y+=12;
      }
    }
    if (y>263) { doc.addPage(); y=14; }
    y+=2; doc.setFillColor(...PRIMARY); doc.roundedRect(ML,y,CW,11,2,2,"F"); doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.text("TOTAL GERAL DE HORAS",ML+4,y+7.5); doc.setFontSize(11); doc.text(`${grupo.totalHoras.toFixed(1)}h`,ML+CW-4,y+7.5,{align:"right"});
    y+=16; doc.setTextColor(...MUTED); doc.setFontSize(6.5); doc.setFont("helvetica","italic"); doc.text("Documento gerado automaticamente pelo sistema de gestão — Sustentação",W/2,y,{align:"center"});
    const total=(doc as any).internal.getNumberOfPages();
    for (let i=1;i<=total;i++) { doc.setPage(i); doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(...MUTED); doc.text(`Página ${i} de ${total}`,W-MR,doc.internal.pageSize.getHeight()-6,{align:"right"}); }
    doc.save(`Produtividade_${grupo.nome.replace(/\s+/g,"_")}_${dataInicio}_${dataFim}.pdf`);
    toast.success("Relatório individual exportado!");
  } catch (err) { console.error(err); toast.error("Erro ao gerar relatório individual"); }
}

interface Props { onBack?: () => void; }

export function RelatorioProdutividade({ onBack }: Props) {
  const { demandas }    = useDemandas();
  const { transitions } = useAllTransitions();
  const { hours }       = useAllHours();
  const profiles        = useProfiles();
  const { responsaveis } = useDemandaResponsaveis();
  const { teams }       = useAuth();
  const { fases }       = useFases();

  const fasesMap = useMemo(() => { const m: Record<string,string>={}; fases.forEach(f => { m[f.key]=f.label; }); return m; }, [fases]);

  const [teamId,      setTeamId]      = useState("all");
  const [analista,    setAnalista]    = useState("all");
  const [dataInicio,  setDataInicio]  = useState(daysAgo(30));
  const [dataFim,     setDataFim]     = useState(today());
  const [openGroups,  setOpenGroups]  = useState<Set<string>>(new Set());
  const [exportingPDF, setExportingPDF] = useState(false);
  const [periodo,     setPeriodo]     = useState("30");

  const sustTeams   = teams.filter(t => t.module === "sustentacao");
  const profileIds  = useMemo(() => new Set(profiles.map(p => p.user_id)), [profiles]);
  const nomeMap     = useMemo(() => { const m=new Map<string,string>(); profiles.forEach(p => m.set(p.user_id, p.display_name||p.email||p.user_id.slice(0,8))); return m; }, [profiles]);

  const responsaveisPorDemanda = useMemo(() => {
    const m=new Map<string,Set<string>>();
    demandas.forEach(d => { const ids=new Set<string>(); if(d.responsavel_dev) ids.add(d.responsavel_dev); if(d.responsavel_requisitos) ids.add(d.responsavel_requisitos); if(d.responsavel_teste) ids.add(d.responsavel_teste); if(d.responsavel_arquiteto) ids.add(d.responsavel_arquiteto); m.set(d.id,ids); });
    responsaveis.forEach(r => { if(!m.has(r.demanda_id)) m.set(r.demanda_id,new Set()); m.get(r.demanda_id)!.add(r.user_id); });
    return m;
  }, [demandas, responsaveis]);

  const resolveUserId = (h: any): string|null => h.user_id || h.lancado_por || null;

  const horasPorDemandaUser = useMemo(() => {
    const m=new Map<string,Map<string,number>>();
    hours.forEach(h => { const uid=resolveUserId(h); if(!h.demanda_id||!uid) return; if(!m.has(h.demanda_id)) m.set(h.demanda_id,new Map()); const inner=m.get(h.demanda_id)!; inner.set(uid,(inner.get(uid)??0)+Number(h.horas??0)); });
    return m;
  }, [hours]);

  const horasDetalhadasMap = useMemo(() => {
    const m=new Map<string,HoraLancada[]>();
    hours.forEach(h => { const uid=resolveUserId(h); if(!h.demanda_id||!uid) return; const key=`${h.demanda_id}::${uid}`; if(!m.has(key)) m.set(key,[]); m.get(key)!.push({id:h.id||`${key}-${Math.random()}`,data:fmtDate(h.created_at),fase:fasesMap[h.fase]||h.fase||"--",descricao:h.descricao||"—",horas:Number(h.horas??0)}); });
    m.forEach(list => list.sort((a,b)=>new Date(b.data.split("/").reverse().join("-")).getTime()-new Date(a.data.split("/").reverse().join("-")).getTime()));
    return m;
  }, [hours, fasesMap]);

  const analistasList = useMemo(() => {
    const idSet=new Set<string>();
    demandas.filter(d=>teamId==="all"||d.team_id===teamId).forEach(d => { responsaveisPorDemanda.get(d.id)?.forEach(uid=>idSet.add(uid)); horasPorDemandaUser.get(d.id)?.forEach((_,uid)=>idSet.add(uid)); });
    return profiles.filter(p=>idSet.has(p.user_id)).map(p=>({user_id:p.user_id,display_name:p.display_name||p.email||p.user_id.slice(0,8)})).sort((a,b)=>a.display_name.localeCompare(b.display_name));
  }, [demandas, responsaveisPorDemanda, horasPorDemandaUser, profiles, teamId]);

  const demandasFiltradas = useMemo(() => {
    const ini=new Date(dataInicio+"T00:00:00"); const fim=new Date(dataFim+"T23:59:59");
    return demandas.filter(d => { if(teamId!=="all"&&d.team_id!==teamId) return false; const c=new Date(d.created_at); return c>=ini&&c<=fim; });
  }, [demandas, teamId, dataInicio, dataFim]);

  const grupos = useMemo(() => {
    const todosIds=new Set<string>();
    demandasFiltradas.forEach(d => { responsaveisPorDemanda.get(d.id)?.forEach(uid=>todosIds.add(uid)); horasPorDemandaUser.get(d.id)?.forEach((_,uid)=>todosIds.add(uid)); });
    const ids=analista!=="all"?[analista]:[...todosIds].filter(id=>profileIds.has(id));
    return ids.map(userId => {
      const atividades: AtividadeRow[] = demandasFiltradas
        .filter(d => (responsaveisPorDemanda.get(d.id)?.has(userId)??false)||(horasPorDemandaUser.get(d.id)?.has(userId)??false))
        .map(d => {
          const horasAnalista=horasPorDemandaUser.get(d.id)?.get(userId)??0;
          const outrosIds=new Set<string>(); responsaveisPorDemanda.get(d.id)?.forEach(uid=>{if(uid!==userId)outrosIds.add(uid);}); horasPorDemandaUser.get(d.id)?.forEach((_,uid)=>{if(uid!==userId)outrosIds.add(uid);});
          const conclusao=transitions.filter(t=>t.demanda_id===d.id).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).find(t=>["aceite_final","ag_aceite_final","concluido","resolvido"].includes(t.to_status??""));
          return { demandaId:d.id, rhm:d.rhm||"—", projeto:d.projeto||d.titulo||"—", situacao:d.situacao||"—", dataInicio:fmtDate(d.created_at), dataFim:fmtDate(d.aceite_data??conclusao?.created_at??null), horasAnalista, outrosAnalistas:[...outrosIds].filter(id=>profileIds.has(id)).map(id=>nomeMap.get(id)||id.slice(0,8)), horasDetalhadas:horasDetalhadasMap.get(`${d.id}::${userId}`)??[] };
        });
      const totalHoras=atividades.reduce((s,a)=>s+a.horasAnalista,0);
      const resolvidos=atividades.filter(a=>isResolvido(a.situacao)).length;
      const emAberto=atividades.length-resolvidos;
      return { userId, nome:nomeMap.get(userId)||userId.slice(0,8), atividades, totalHoras, resolvidos, emAberto, taxaResolucao:atividades.length>0?(resolvidos/atividades.length)*100:0 };
    }).filter(g=>g.atividades.length>0).sort((a,b)=>b.resolvidos-a.resolvidos);
  }, [demandasFiltradas, responsaveisPorDemanda, horasPorDemandaUser, horasDetalhadasMap, transitions, nomeMap, analista, profileIds]);

  const kpis = useMemo(() => ({
    totalAtividades: grupos.reduce((s,g)=>s+g.atividades.length,0),
    totalResolvidos:  grupos.reduce((s,g)=>s+g.resolvidos,0),
    totalEmAberto:    grupos.reduce((s,g)=>s+g.emAberto,0),
    totalHoras:       grupos.reduce((s,g)=>s+g.totalHoras,0),
  }), [grupos]);

  const toggleGroup  = (id: string) => setOpenGroups(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  const expandAll    = () => setOpenGroups(new Set(grupos.map(g=>g.userId)));
  const collapseAll  = () => setOpenGroups(new Set());

  const reportCfg    = getReportConfig("produtividade");
  const periodoLabel = `${fmtDate(dataInicio)} a ${fmtDate(dataFim)}`;
  const isIndividual = analista !== "all";

  const kpiItems: KPIItem[] = [
    { label: "Total Atividades", value: kpis.totalAtividades, status: "neutral",                                                                                         icon: <ClipboardList className="h-5 w-5" /> },
    { label: "Resolvidos",       value: kpis.totalResolvidos,  status: "good",                                                                                           icon: <CheckCircle2  className="h-5 w-5" /> },
    { label: "Em Aberto",        value: kpis.totalEmAberto,    status: kpis.totalEmAberto > 10 ? "danger" : kpis.totalEmAberto > 0 ? "warning" : "good",                  icon: <AlertTriangle className="h-5 w-5" /> },
    { label: "Horas Lançadas",   value: `${kpis.totalHoras.toFixed(1)}h`,                                                                                 status: "neutral", icon: <Clock         className="h-5 w-5" /> },
  ];

  const getExportData = () => {
    const nomeAnalista = isIndividual ? nomeMap.get(analista)||analista : null;
    return {
      title: isIndividual ? `Produtividade — ${nomeAnalista} | ${periodoLabel}` : `Relatório de Produtividade — ${periodoLabel}`,
      analista: nomeAnalista,
      headers: [...(isIndividual?[]:["Analista"]),"RHM","Projeto","Situação","Data Início","Data Fim","Horas","Outros Analistas"],
      rows: grupos.flatMap(g => g.atividades.flatMap(a => {
        const resumo=[...(isIndividual?[]:[g.nome]),a.rhm,a.projeto,situacaoLabel(a.situacao),a.dataInicio,a.dataFim,a.horasAnalista.toFixed(1),a.outrosAnalistas.join(", ")||"—"];
        const detalhe=a.horasDetalhadas.map(h=>[...(isIndividual?[]:[""]),"","",`  ↳ ${h.fase}`,h.data,"",h.horas.toFixed(1),h.descricao]);
        return [resumo,...detalhe];
      })),
    };
  };

  const handleExportIndividual = async () => {
    if (analista==="all"||grupos.length===0) return;
    setExportingPDF(true);
    await gerarPDFIndividual(grupos[0], dataInicio, dataFim);
    setExportingPDF(false);
  };

  return (
    <ReportLayout
      header={
        <ReportPageHeader
          title="Produtividade por Analista"
          description="Clique na linha do RHM para ver o detalhe das horas lançadas"
          icon={<FileText className="h-5 w-5" />}
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
          analistas={analistasList}
          modulo="sustentacao"
          totalFiltrado={demandasFiltradas.length}
          onClear={() => { setPeriodo("30"); setDataInicio(daysAgo(30)); setDataFim(today()); setAnalista("all"); setTeamId("all"); }}
        />
      }
      kpis={<ReportKPISummary items={kpiItems} />}
      table={
        <div className="space-y-4">
          <div className="flex items-center justify-between print:hidden">
            <div className="flex gap-2">
              {grupos.length > 0 && (
                <>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={expandAll}>Expandir tudo</Button>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={collapseAll}>Recolher tudo</Button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {isIndividual && (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-primary text-primary hover:bg-primary/5" onClick={handleExportIndividual} disabled={exportingPDF}>
                  {exportingPDF ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-1" /> : <FileDown className="h-3.5 w-3.5" />}
                  Relatório Individual (PDF)
                </Button>
              )}
              <ExportButton getData={getExportData} />
            </div>
          </div>
          {grupos.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-10 text-center"><p className="text-sm text-muted-foreground">Nenhuma atividade encontrada para os filtros selecionados.</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {grupos.map(grupo => {
                const isOpen=openGroups.has(grupo.userId);
                return (
                  <Card key={grupo.userId} className="overflow-hidden">
                    <Collapsible open={isOpen} onOpenChange={()=>toggleGroup(grupo.userId)}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">{getInitials(grupo.nome)}</div>
                            <div>
                              <p className="text-sm font-semibold">{grupo.nome}</p>
                              <p className="text-xs text-muted-foreground">{grupo.atividades.length} atividade{grupo.atividades.length!==1?"s":""} · {grupo.totalHoras.toFixed(1)}h lançadas</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={`text-[10px] ${rateColor(grupo.taxaResolucao)}`}>{grupo.taxaResolucao.toFixed(0)}% resolução</Badge>
                            <Badge variant="outline" className="text-[10px]">{grupo.resolvidos} resolvidos</Badge>
                            {grupo.emAberto>0&&<Badge className="text-[10px] bg-orange-100 text-orange-700 border-orange-200">{grupo.emAberto} em aberto</Badge>}
                            {isOpen?<ChevronDown className="h-4 w-4 text-muted-foreground"/>:<ChevronRight className="h-4 w-4 text-muted-foreground"/>}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 px-0 pb-0">
                          <div className="overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/30">
                                  <TableHead className="font-semibold text-xs pl-4 w-[90px]">RHM</TableHead>
                                  <TableHead className="font-semibold text-xs">Projeto</TableHead>
                                  <TableHead className="font-semibold text-xs">Situação</TableHead>
                                  <TableHead className="font-semibold text-xs text-right">Dt. Início</TableHead>
                                  <TableHead className="font-semibold text-xs text-right">Dt. Fim</TableHead>
                                  <TableHead className="font-semibold text-xs text-right">Horas</TableHead>
                                  <TableHead className="font-semibold text-xs pr-4">Outros Analistas</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {grupo.atividades.map(a=><AtividadeExpandivel key={`${grupo.userId}-${a.demandaId}`} atividade={a}/>)}
                                <TableRow className="bg-muted/20 border-t font-semibold">
                                  <TableCell colSpan={5} className="text-xs pl-4 text-muted-foreground">Subtotal — {grupo.nome}</TableCell>
                                  <TableCell className="text-right text-xs tabular-nums">{grupo.totalHoras.toFixed(1)}h</TableCell>
                                  <TableCell className="pr-4"/>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      }
      footer={
        <ReportLegendBlock items={[
          { sigla: "RHM",              descricao: "Clique na linha para ver o detalhe das horas lançadas" },
          { sigla: "Horas",            descricao: "Total de horas lançadas pelo analista nesta atividade" },
          { sigla: "Outros Analistas", descricao: "Demais pessoas vinculadas à mesma atividade" },
          { sigla: "Taxa Resolução",   descricao: "Atividades resolvidas ÷ total × 100 — por analista" },
          { sigla: "Data Fim",         descricao: "Data de aceite ou da última transição de conclusão" },
        ]} />
      }
    />
  );
}
