import { useState, useMemo, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { useDemandas } from "../../hooks/useDemandas";
import { useAuth } from "@/contexts/AuthContext";
import { calcIAP, calcIQS, calcICT, calcISS, calcGlosasSummary } from "../../utils/imrCalculations";
import type { DemandaIMR, DemandaEvento } from "../../utils/imrCalculations";
import { INDICADORES_GRUPO2, getIndicadorFaixa, EVENTOS_CONFIG } from "../../types/imr";
import * as eventosSvc from "../../services/eventos.service";
import { REPORT_CONFIGS } from "../../utils/reportConfig";
import {
  ReportLayout,
  ReportPageHeader,
  ReportFilterBar,
  ReportKPISummary,
  ReportDataTable,
  ReportLegendBlock,
} from "@/shared/components/reports";
import type { KPIItem, TableColumn } from "@/shared/components/reports";
import { BarChart3 } from "lucide-react";

function today()        { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; }
function fmtDateBR(d: string) { return d ? new Date(d).toLocaleDateString("pt-BR") : "—"; }

const FAIXA_STATUS: Record<string, KPIItem["status"]> = {
  green:  "good",
  yellow: "warning",
  orange: "warning",
  red:    "danger",
};
const STATUS_LABEL = { green: "Meta atingida", yellow: "Abaixo da meta", orange: "Faixa intermediária", red: "Glosa máxima" };

interface Props { onBack?: () => void; }

export function RelatorioIMR({ onBack }: Props) {
  const { demandas }               = useDemandas();
  const { currentTeamId, profile } = useAuth();
  const [eventos, setEventos]      = useState<DemandaEvento[]>([]);
  const [periodo, setPeriodo]      = useState("30");
  const [dataInicio, setDataInicio] = useState(daysAgo(30));
  const [dataFim,    setDataFim]    = useState(today());

  const load = useCallback(async () => {
    if (!currentTeamId) return;
    try { setEventos(await eventosSvc.fetchEventosByTeam(currentTeamId)); } catch { /* */ }
  }, [currentTeamId]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let items = demandas as unknown as DemandaIMR[];
    if (dataInicio) items = items.filter(d => new Date(d.created_at) >= new Date(dataInicio + "T00:00:00"));
    if (dataFim)    items = items.filter(d => new Date(d.created_at) <= new Date(dataFim    + "T23:59:59"));
    return items;
  }, [demandas, dataInicio, dataFim]);

  const iap    = useMemo(() => calcIAP(filtered),          [filtered]);
  const iqs    = useMemo(() => calcIQS(filtered),          [filtered]);
  const ict    = useMemo(() => calcICT(filtered),          [filtered]);
  const iss    = useMemo(() => calcISS(filtered),          [filtered]);
  const glosas = useMemo(() => calcGlosasSummary(eventos), [eventos]);

  const indicators = [
    { ...INDICADORES_GRUPO2[0], valor: iap.valor, detail: `${iap.qdap}/${iap.qdtot}` },
    { ...INDICADORES_GRUPO2[1], valor: iqs.valor, detail: `${iqs.qdr} rejeições em ${iqs.qde}` },
    { ...INDICADORES_GRUPO2[2], valor: ict.valor, detail: `${ict.total} avaliadas` },
    { ...INDICADORES_GRUPO2[3], valor: iss.valor, detail: `${iss.total} avaliadas` },
  ];

  const periodoLabel = `${fmtDateBR(dataInicio)} a ${fmtDateBR(dataFim)}`;

  const kpiItems: KPIItem[] = indicators.map(ind => {
    const faixa = getIndicadorFaixa(ind, ind.valor);
    return {
      label:  `${ind.sigla} — ${ind.nome}`,
      value:  ind.sigla === "ISS" ? ind.valor.toFixed(1) : `${ind.valor.toFixed(1)}%`,
      meta:   `Meta: ≥ ${ind.meta}${ind.unidade}`,
      status: FAIXA_STATUS[faixa.cor] ?? "neutral",
      sub:    STATUS_LABEL[faixa.cor as keyof typeof STATUS_LABEL],
      icon:   <BarChart3 className="h-5 w-5" />,
    };
  });

  const eventosData = Object.entries(glosas.byEvento).map(([ev, data]) => {
    const c = EVENTOS_CONFIG.find(e => e.codigo === ev);
    return { ev, descricao: c?.descricao || ev, count: data.count, redutor: c?.redutor ?? 0, total: data.total, incidencia: c?.incidencia || "" };
  });

  const colsEventos: TableColumn[] = [
    { key: "ev",         label: "Código",      render: (v) => <span className="font-mono font-bold">{v}</span> },
    { key: "descricao",  label: "Descrição" },
    { key: "count",      label: "Ocorrências",  align: "right", sortable: true },
    { key: "redutor",    label: "Redutor Unit.", align: "right", render: (v) => `${v}%` },
    { key: "total",      label: "Total",        align: "right", sortable: true, render: (v) => <span className="text-destructive font-medium">{v.toFixed(2)}%</span> },
    { key: "incidencia", label: "Incidência",   render: (v) => <Badge variant="secondary" className="text-[10px] capitalize">{v}</Badge> },
  ];

  const exportCSV = () => {
    const cfg   = REPORT_CONFIGS.sustentacao_imr;
    const lines = [cfg.titulo, `Gerado em: ${new Date().toLocaleString("pt-BR")}`, `Responsável: ${profile?.display_name || ""}`, ""];
    lines.push("Indicador,Valor,Meta,Status,% Glosa");
    indicators.forEach(ind => {
      const faixa  = getIndicadorFaixa(ind, ind.valor);
      const status = faixa.cor === "green" ? "✅" : faixa.cor === "yellow" ? "⚠️" : "❌";
      lines.push(`${ind.sigla} - ${ind.nome},${ind.sigla === "ISS" ? ind.valor.toFixed(1) : ind.valor.toFixed(1) + "%"},≥${ind.meta}${ind.unidade},${status},${faixa.glosa}%`);
    });
    lines.push("", "Eventos de Glosa", "Código,Descrição,Ocorrências,Redutor Total,Incidência");
    Object.entries(glosas.byEvento).forEach(([ev, data]) => {
      const c = EVENTOS_CONFIG.find(e => e.codigo === ev);
      lines.push(`${ev},"${c?.descricao || ""}",${data.count},${data.total.toFixed(2)}%,${c?.incidencia || ""}`);
    });
    lines.push("", `Glosa Integral Total: ${glosas.totalIntegral.toFixed(2)}%`, `Glosa Limitada Total: ${glosas.totalLimitada.toFixed(2)}%`);
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "IMR_Grupo2.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <ReportLayout
      header={
        <ReportPageHeader
          title={REPORT_CONFIGS.sustentacao_imr.titulo.replace("Relatório — ", "")}
          description={REPORT_CONFIGS.sustentacao_imr.subtitulo}
          icon={<BarChart3 className="h-5 w-5" />}
          badge={periodoLabel}
          onBack={onBack}
          onExportCSV={exportCSV}
        />
      }
      filters={
        <ReportFilterBar
          periodo={periodo}    setPeriodo={setPeriodo}
          dataInicio={dataInicio} setDataInicio={setDataInicio}
          dataFim={dataFim}    setDataFim={setDataFim}
          showAnalista={false}
          modulo="sustentacao"
          totalFiltrado={filtered.length}
          onClear={() => { setPeriodo("30"); setDataInicio(daysAgo(30)); setDataFim(today()); }}
        />
      }
      kpis={<ReportKPISummary items={kpiItems} />}
      table={
        <div className="space-y-4">
          {eventosData.length > 0 ? (
            <ReportDataTable titulo="Eventos de Glosa" columns={colsEventos} data={eventosData} rowKey={(r) => r.ev} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento de glosa registrado no período.</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Glosa Integral Total", value: glosas.totalIntegral },
              { label: "Glosa Limitada Total", value: glosas.totalLimitada },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${value > 0 ? "text-destructive" : "text-emerald-600"}`}>{value.toFixed(2)}%</p>
              </div>
            ))}
          </div>
        </div>
      }
      footer={
        <ReportLegendBlock items={[
          { sigla: "IAP",   descricao: "Índice de Atendimento no Prazo" },
          { sigla: "IQS",   descricao: "Índice de Qualidade de Soluções" },
          { sigla: "ICT",   descricao: "Índice de Conformidade Técnica" },
          { sigla: "ISS",   descricao: "Índice de Satisfação do Solicitante" },
          { sigla: "Glosa", descricao: "Redutor contratual aplicado quando o indicador fica abaixo da meta" },
        ]} />
      }
    />
  );
}
