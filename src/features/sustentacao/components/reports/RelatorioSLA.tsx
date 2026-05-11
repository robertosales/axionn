import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { useDemandas } from "../../hooks/useDemandas";
import { useAllTransitions, useProfiles } from "../../hooks/useAllTransitions";
import { calcSLA, formatHours } from "../../utils/kpiCalculations";
import { getReportConfig } from "../../utils/reportConfig";
import { buildAnalistasDedup, analistaMatches } from "../../utils/analistasDedup";
import { ExportButton } from "@/components/dashboard/ExportButton";
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
import { Shield, AlertTriangle, CheckCircle2 } from "lucide-react";

const META_SLA = 95;

function today()        { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; }
function fmtDateBR(d: string) { return d ? new Date(d).toLocaleDateString("pt-BR") : "—"; }

interface Props { onBack?: () => void; }

export function RelatorioSLA({ onBack }: Props) {
  const { demandas }    = useDemandas();
  const { transitions } = useAllTransitions();
  const profiles        = useProfiles();
  const [periodo, setPeriodo]         = useState("30");
  const [dataInicio, setDataInicio]   = useState(daysAgo(30));
  const [dataFim,    setDataFim]      = useState(today());
  const [analista,   setAnalista]     = useState("all");

  const filtered = useMemo(() => {
    let items = demandas;
    if (dataInicio) items = items.filter(d => new Date(d.created_at) >= new Date(dataInicio + "T00:00:00"));
    if (dataFim)    items = items.filter(d => new Date(d.created_at) <= new Date(dataFim    + "T23:59:59"));
    if (analista !== "all") items = items.filter(d => analistaMatches(analista, d.responsavel_dev));
    return items;
  }, [demandas, dataInicio, dataFim, analista]);

  const sla = useMemo(() => calcSLA(filtered, transitions), [filtered, transitions]);

  const analistas = useMemo(() => {
    const pIds = new Set(profiles.map(p => p.user_id));
    const ids = new Set<string>();
    demandas.forEach(d => [d.responsavel_dev, d.responsavel_requisitos, d.responsavel_teste, d.responsavel_arquiteto]
      .filter((x): x is string => !!x && pIds.has(x)).forEach(x => ids.add(x)));
    return buildAnalistasDedup([...ids], profiles);
  }, [demandas, profiles]);

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

  const getExportData = () => ({
    title: reportCfg.tituloExportacao,
    headers: ["RHM", "Projeto", "Prioridade", "Abertura", "Prazo SLA", "Resolução", "Status SLA", "Atraso"],
    rows: sla.results.map(r => [r.rhm, r.projeto, r.prioridade, new Date(r.abertura).toLocaleDateString("pt-BR"), `${new Date(r.prazoSLA).toLocaleDateString("pt-BR")} ${new Date(r.prazoSLA).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, r.resolucao ? new Date(r.resolucao).toLocaleDateString("pt-BR") : "Em aberto", r.statusSLA === "dentro" ? "Dentro do prazo" : r.statusSLA === "em_risco" ? "Em risco" : "Violado", r.atraso > 0 ? formatHours(r.atraso) : "-"]),
  });

  return (
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
          onClear={() => { setPeriodo("30"); setDataInicio(daysAgo(30)); setDataFim(today()); setAnalista("all"); }}
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
            <ExportButton getData={getExportData} />
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
  );
}
