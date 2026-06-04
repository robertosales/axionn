import {
  RefreshCw, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, Zap, Download, Printer,
} from 'lucide-react';
import { Button }     from '@/components/ui/button';
import { Badge }      from '@/components/ui/badge';
import { Skeleton }   from '@/components/ui/skeleton';
import { Progress }   from '@/components/ui/progress';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSLADashboard } from '../hooks/useSLADashboard';
import type { SLADemandaRow } from '../hooks/useSLADashboard';
import { exportToCsv } from '@/lib/exportToCsv';

// ── Helpers ───────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  green:  'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  orange: 'bg-amber-500/15   text-amber-600   border-amber-500/30',
  red:    'bg-red-500/15     text-red-600     border-red-500/30',
  blue:   'bg-blue-500/15    text-blue-600    border-blue-500/30',
};

const LABEL_MAP: Record<string, string> = {
  dentro:    'No prazo',
  em_risco:  'Em risco',
  violado:   'Violado',
  concluido: 'Concluído',
};

function SlaColorBadge({ row }: { row: SLADemandaRow }) {
  const cls = COLOR_MAP[row.slaColor] ?? COLOR_MAP.green;
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${cls}`}>
      {LABEL_MAP[row.statusSLA] ?? row.statusSLA}
    </Badge>
  );
}

function SlaProgressBar({ pct, color }: { pct: number; color: string }) {
  const indicatorColor = {
    green:  'bg-emerald-500',
    orange: 'bg-amber-500',
    red:    'bg-red-500',
    blue:   'bg-blue-400',
  }[color] ?? 'bg-emerald-500';
  return (
    <div className="w-full">
      <Progress value={Math.min(pct, 100)} className="h-1.5" indicatorClassName={indicatorColor} />
      <span className="text-[10px] text-muted-foreground">{pct.toFixed(1)}%</span>
    </div>
  );
}

// ── Export helpers ────────────────────────────────────────────────────────────

function buildCsvRows(demandas: SLADemandaRow[]) {
  return demandas.map(r => ({
    'ID':            r.demandaId,
    'Título':         r.titulo ?? '',
    'Horas acumuladas': r.horasAcumuladas.toFixed(1),
    'Prazo (h)':      r.prazoHoras.toFixed(1),
    'Consumido %':    r.resolutionPct.toFixed(1),
    'Status SLA':     LABEL_MAP[r.statusSLA] ?? r.statusSLA,
    'Origem SLA':     r.slaSource === 'contract_matrix' ? 'Contrato' : 'Legado',
  }));
}

function handlePrint(title: string) {
  const original = document.title;
  document.title = title;
  window.print();
  document.title = original;
}

// ── Componente principal ──────────────────────────────────────────────────────

interface SLACompliancePanelProps {
  contractId?:   string | null;
  contractName?: string | null;   // usado no nome do arquivo exportado
  projectId?:    string | null;
  teamId?:       string | null;
  title?:        string;
}

export function SLACompliancePanel({
  contractId   = null,
  contractName = null,
  projectId    = null,
  teamId       = null,
  title        = 'SLA – Compliance',
}: SLACompliancePanelProps) {
  const { summary, demandas, loading, error, refetch } = useSLADashboard({
    contractId,
    projectId,
    teamId,
    enabled: !!(contractId || projectId || teamId),
  });

  const kpis = [
    {
      label: 'Compliance',
      value: `${summary.compliance_pct}%`,
      icon:  <TrendingUp className="h-4 w-4" />,
      color: summary.compliance_pct >= 90
        ? 'text-emerald-600'
        : summary.compliance_pct >= 70
        ? 'text-amber-600'
        : 'text-red-600',
    },
    {
      label: 'No prazo',
      value: summary.dentro,
      icon:  <CheckCircle2 className="h-4 w-4" />,
      color: 'text-emerald-600',
    },
    {
      label: 'Em risco',
      value: summary.em_risco,
      icon:  <Clock className="h-4 w-4" />,
      color: summary.em_risco > 0 ? 'text-amber-600' : 'text-muted-foreground',
    },
    {
      label: 'Violados',
      value: summary.violado,
      icon:  <AlertTriangle className="h-4 w-4" />,
      color: summary.violado > 0 ? 'text-red-600' : 'text-muted-foreground',
    },
  ];

  const exportSlug = contractName
    ? `sla-compliance-${contractName.toLowerCase().replace(/\s+/g, '-')}`
    : 'sla-compliance';

  if (!contractId && !projectId && !teamId) {
    return (
      <div className="rounded-lg border bg-card p-6 flex flex-col items-center gap-2 text-muted-foreground">
        <Zap className="h-6 w-6 opacity-40" />
        <p className="text-sm">Selecione um contrato para ver o painel de SLA.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-1 print:hidden">
          {/* Exportar */}
          {!loading && demandas.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                  <Download className="h-3 w-3" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    exportToCsv({
                      filename: exportSlug,
                      rows: buildCsvRows(demandas),
                    })
                  }
                >
                  Baixar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePrint(title)}>
                  <Printer className="h-3.5 w-3.5 mr-2" /> Imprimir / PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Refresh */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => refetch()}
            disabled={loading}
            aria-label="Atualizar SLA"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                {k.icon}{k.label}
              </div>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600">
          Erro ao carregar SLA: {error}
        </div>
      )}

      {/* Tabela de demandas */}
      {!loading && demandas.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between px-4 py-2.5 border-b">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Demandas ({demandas.length})
            </span>
            {summary.violado > 0 && (
              <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/30">
                {summary.violado} violad{summary.violado > 1 ? 'os' : 'o'}
              </Badge>
            )}
          </div>
          <div className="divide-y max-h-96 overflow-y-auto scrollbar-none">
            {[...demandas]
              .sort((a, b) => {
                const order: Record<string, number> = { violado: 0, em_risco: 1, dentro: 2, concluido: 3 };
                return (order[a.statusSLA] ?? 2) - (order[b.statusSLA] ?? 2);
              })
              .map((row) => (
                <div key={row.demandaId} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {row.titulo ?? row.demandaId.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.horasAcumuladas.toFixed(1)}h / {row.prazoHoras.toFixed(1)}h
                      {row.slaSource === 'contract_matrix' && (
                        <span className="ml-1.5 text-[10px] text-indigo-400">contrato</span>
                      )}
                    </p>
                  </div>
                  <div className="w-28 shrink-0">
                    <SlaProgressBar pct={row.resolutionPct} color={row.slaColor} />
                  </div>
                  <SlaColorBadge row={row} />
                </div>
              ))
            }
          </div>
        </div>
      )}

      {!loading && !error && demandas.length === 0 && (
        <div className="rounded-lg border bg-card py-10 flex flex-col items-center gap-2 text-muted-foreground">
          <CheckCircle2 className="h-6 w-6 opacity-30" />
          <p className="text-sm">Nenhuma demanda ativa encontrada.</p>
        </div>
      )}
    </div>
  );
}
