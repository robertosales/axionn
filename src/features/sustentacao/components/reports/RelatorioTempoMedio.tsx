import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { useDemandas } from "../../hooks/useDemandas";
import { useAllTransitions, useProfiles } from "../../hooks/useAllTransitions";
import { calcTempos, formatHours } from "../../utils/kpiCalculations";
import { getReportConfig } from "../../utils/reportConfig";
import { buildAnalistasDedup, analistaMatches } from "../../utils/analistasDedup";
import { ExportButton } from "@/components/dashboard/ExportButton";
import {
  ReportLayout,
  ReportPageHeader,
  ReportFilterBar,
  ReportKPISummary,
  ReportDataTable,
  ReportLegendBlock,
} from "@/shared/components/reports";
import type { KPIItem, TableColumn } from "@/shared/components/reports";
import { Clock, Timer, TrendingUp, Target, Activity } from "lucide-react";

const META_MTTR = 4;
const META_TMR  = 1;

function today()        { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; }
function fmtDateBR(d: string) { return d ? new Date(d).toLocaleDateString("pt-BR") : "—"; }

type KPIStatus = KPIItem["status"];

function kpiStatus(val: number, meta: number): KPIStatus {
  if (val <= meta)       return "good";
  if (val <= meta * 1.5) return "warning";
  return "danger";
}

interface Props { onBack?: () => void; }

export function RelatorioTempoMedio({ onBack }: Props) {
  const { demandas }      = useDemandas();
  const { transitions }   = useAllTransitions();
  const profiles          = useProfiles();
  const [periodo, setPeriodo]         = useState("30");
  const [dataInicio, setDataInicio]   = useState(daysAgo(30));
  const [dataFim,    setDataFim]      = useState(today());
  const [analista,   setAnalista]     = useState("all");

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

  const getExportData = () => ({
    title: reportCfg.tituloExportacao,
    headers: ["Analista", "Total", "TMR", "MTTR", "TMA", "MTTA", "Acima Meta", "% Acima"],
    rows: analistaStats.map(a => [a.nome, a.total, formatHours(a.tmr), formatHours(a.mttr), formatHours(a.tma), formatHours(a.mtta), a.acimaMeta, `${a.pctAcima}%`]),
  });

  return (
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
          onClear={() => { setPeriodo("30"); setDataInicio(daysAgo(30)); setDataFim(today()); setAnalista("all"); }}
        />
      }
      kpis={<ReportKPISummary items={kpiItems} />}
      table={
        <>
          <div className="flex justify-end mb-2 print:hidden">
            <ExportButton getData={getExportData} />
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
  );
}
