/**
 * RelatorioSLAContrato
 * Relatório dedicado de compliance SLA por contrato.
 * Exibe KPIs, barra de distribuição, tabela detalhada + exportação CSV/PDF.
 * Usado dentro do ContractDetail (aba Relatório SLA).
 */
import { useMemo } from 'react';
import {
  Shield, TrendingUp, AlertTriangle, CheckCircle2, Clock,
  Download, Printer, RefreshCw,
} from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSLADashboard } from '../hooks/useSLADashboard';
import type { SLADemandaRow } from '../hooks/useSLADashboard';
import { exportToCsv } from '@/lib/exportToCsv';

// ── Labels / cores ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; pill: string; bar: string }> = {
  dentro:    { label: 'No prazo',  pill: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', bar: 'bg-emerald-500' },
  em_risco:  { label: 'Em risco',  pill: 'bg-amber-500/15   text-amber-600   border-amber-500/30',   bar: 'bg-amber-500'   },
  violado:   { label: 'Violado',   pill: 'bg-red-500/15     text-red-600     border-red-500/30',     bar: 'bg-red-500'     },
  concluido: { label: 'Concluído', pill: 'bg-blue-500/15    text-blue-600    border-blue-500/30',    bar: 'bg-blue-400'    },
};

const INDICATOR: Record<string, string> = {
  dentro: 'bg-emerald-500', em_risco: 'bg-amber-500', violado: 'bg-red-500', concluido: 'bg-blue-400',
};

// ── Export helpers ────────────────────────────────────────────────────────────

function toCsvRows(demandas: SLADemandaRow[]) {
  return demandas.map(r => ({
    'ID':             r.demandaId,
    'Título':          r.titulo ?? '',
    'Horas acumuladas': r.horasAcumuladas.toFixed(1),
    'Prazo (h)':       r.prazoHoras.toFixed(1),
    'Consumido %':     r.resolutionPct.toFixed(1),
    'Status SLA':      STATUS_CFG[r.statusSLA]?.label ?? r.statusSLA,
    'Origem SLA':      r.slaSource === 'contract_matrix' ? 'Matriz contratual' : 'SLA legado',
  }));
}

function handlePrint(title: string) {
  const prev = document.title;
  document.title = title;
  window.print();
  document.title = prev;
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status];
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${cfg?.pill ?? ''}`}>
      {cfg?.label ?? status}
    </Badge>
  );
}

function SlaBar({ pct, status }: { pct: number; status: string }) {
  return (
    <div className="w-full">
      <Progress value={Math.min(pct, 100)} className="h-1.5" indicatorClassName={INDICATOR[status] ?? 'bg-emerald-500'} />
      <span className="text-[10px] text-muted-foreground">{pct.toFixed(1)}%</span>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  contractId:   string;
  contractName: string;
}

export function RelatorioSLAContrato({ contractId, contractName }: Props) {
  const { summary, demandas, loading, error, refetch } = useSLADashboard({
    contractId,
    enabled: true,
  });

  // Distribuição para a barra horizontal
  const dist = useMemo(() => {
    const total = Math.max(summary.dentro + summary.em_risco + summary.violado + summary.concluido, 1);
    return {
      dentro:    (summary.dentro    / total) * 100,
      em_risco:  (summary.em_risco  / total) * 100,
      violado:   (summary.violado   / total) * 100,
      concluido: (summary.concluido / total) * 100,
      total,
    };
  }, [summary]);

  const complianceColor =
    summary.compliance_pct >= 95 ? 'text-emerald-500'
    : summary.compliance_pct >= 80 ? 'text-amber-500'
    : 'text-red-500';

  const kpis = [
    { label: 'Compliance',  value: `${summary.compliance_pct}%`, icon: <TrendingUp   className="h-4 w-4" />, color: complianceColor },
    { label: 'No prazo',   value: summary.dentro,               icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-emerald-500' },
    { label: 'Em risco',   value: summary.em_risco,             icon: <Clock        className="h-4 w-4" />, color: summary.em_risco  > 0 ? 'text-amber-500' : 'text-muted-foreground' },
    { label: 'Violados',   value: summary.violado,              icon: <AlertTriangle className="h-4 w-4" />, color: summary.violado   > 0 ? 'text-red-500'   : 'text-muted-foreground' },
    { label: 'Concluídos', value: summary.concluido,            icon: <Shield       className="h-4 w-4" />, color: 'text-blue-400'   },
  ];

  const exportSlug = `sla-${contractName.toLowerCase().replace(/\s+/g, '-')}`;
  const printTitle = `Relatório SLA — ${contractName}`;

  return (
    <div className="space-y-6 print:space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-400" />
            Relatório SLA
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{contractName}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {!loading && demandas.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Download className="h-3 w-3" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportToCsv({ filename: exportSlug, rows: toCsvRows(demandas) })}>
                  Baixar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePrint(printTitle)}>
                  <Printer className="h-3.5 w-3.5 mr-2" /> Imprimir / PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Título para impressão */}
      <div className="hidden print:block">
        <h2 className="text-lg font-bold">{printTitle}</h2>
        <p className="text-sm text-gray-500">Gerado em {new Date().toLocaleDateString('pt-BR')}</p>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[0,1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {kpis.map(k => (
            <div key={k.label} className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                {k.icon}{k.label}
              </div>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Barra de distribuição */}
      {!loading && dist.total > 1 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Distribuição SLA</p>
          <div className="h-3 rounded-full overflow-hidden flex bg-muted">
            {dist.dentro    > 0 && <div className="bg-emerald-500 h-full transition-all" style={{ width: `${dist.dentro}%`    }} />}
            {dist.em_risco  > 0 && <div className="bg-amber-500   h-full transition-all" style={{ width: `${dist.em_risco}%`  }} />}
            {dist.violado   > 0 && <div className="bg-red-500     h-full transition-all" style={{ width: `${dist.violado}%`   }} />}
            {dist.concluido > 0 && <div className="bg-blue-400    h-full transition-all" style={{ width: `${dist.concluido}%` }} />}
          </div>
          <div className="flex gap-3 flex-wrap text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />No prazo  ({summary.dentro})</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500"   />Em risco  ({summary.em_risco})</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500"     />Violado   ({summary.violado})</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400"    />Concluído ({summary.concluido})</span>
          </div>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600">
          Erro ao carregar SLA: {error}
        </div>
      )}

      {/* Tabela detalhada */}
      {!loading && demandas.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Demandas ({demandas.length})
            </span>
            {summary.violado > 0 && (
              <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/30">
                {summary.violado} violad{summary.violado > 1 ? 'os' : 'o'}
              </Badge>
            )}
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/20 text-muted-foreground uppercase tracking-wide">
                  <th className="text-left py-2 px-4 font-semibold">Título</th>
                  <th className="text-right py-2 px-4 font-semibold">Acumulado</th>
                  <th className="text-right py-2 px-4 font-semibold">Prazo</th>
                  <th className="py-2 px-4 font-semibold w-36">Consumido</th>
                  <th className="text-left py-2 px-4 font-semibold">Status</th>
                  <th className="text-left py-2 px-4 font-semibold">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...demandas]
                  .sort((a, b) => {
                    const o: Record<string, number> = { violado: 0, em_risco: 1, dentro: 2, concluido: 3 };
                    return (o[a.statusSLA] ?? 2) - (o[b.statusSLA] ?? 2);
                  })
                  .map(row => (
                    <tr key={row.demandaId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-4">
                        <p className="font-medium truncate max-w-[200px]">{row.titulo ?? row.demandaId.slice(0, 8)}</p>
                      </td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground">{row.horasAcumuladas.toFixed(1)}h</td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground">{row.prazoHoras.toFixed(1)}h</td>
                      <td className="py-2.5 px-4 w-36">
                        <SlaBar pct={row.resolutionPct} status={row.slaColor} />
                      </td>
                      <td className="py-2.5 px-4"><StatusPill status={row.statusSLA} /></td>
                      <td className="py-2.5 px-4">
                        <span className={`text-[10px] ${row.slaSource === 'contract_matrix' ? 'text-indigo-400' : 'text-muted-foreground'}`}>
                          {row.slaSource === 'contract_matrix' ? 'Contrato' : 'Legado'}
                        </span>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && demandas.length === 0 && (
        <div className="rounded-lg border bg-card py-10 flex flex-col items-center gap-2 text-muted-foreground">
          <CheckCircle2 className="h-6 w-6 opacity-30" />
          <p className="text-sm">Nenhuma demanda encontrada para este contrato.</p>
        </div>
      )}
    </div>
  );
}
