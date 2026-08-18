import { Shield, AlertTriangle, CheckCircle2, ShieldX, ShieldAlert, Clock, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSLADashboard } from '../hooks/useSLADashboard';
import { EmptyState } from '@/shared/components/common/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  contractId: string | null;
}

const COLOR_BAR: Record<string, string> = {
  green:  'bg-emerald-500',
  yellow: 'bg-yellow-500',
  orange: 'bg-orange-500',
  red:    'bg-destructive',
};

const COLOR_BADGE: Record<string, string> = {
  green:  'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  yellow: 'bg-yellow-500/10  text-yellow-500  border-yellow-500/30',
  orange: 'bg-orange-500/10  text-orange-500  border-orange-500/30',
  red:    'bg-destructive/10 text-destructive  border-destructive/30',
};

const COLOR_LABEL: Record<string, string> = {
  green: 'No prazo',
  yellow: 'Atenção',
  orange: 'Em risco',
  red: 'Violado',
};

export function SLADashboardSection({ contractId }: Props) {
  const { summary, items, loading } = useSLADashboard(contractId);

  if (!contractId) {
    return (
      <EmptyState icon={Shield} title="Selecione um contrato" description="Escolha um contrato nos filtros para visualizar o painel de SLA." />
    );
  }

  if (loading && !summary) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Carregando indicadores de SLA">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
      </div>
    );
  }

  if (!summary || summary.total === 0) {
    return (
      <EmptyState icon={CheckCircle2} title="Nenhuma demanda ativa com SLA" description="Este contrato não possui demandas ativas monitoradas por SLA no período." />
    );
  }

  const withSla = summary.total - summary.no_sla;

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          icon={Shield}
          label="Compliance"
          value={`${summary.compliance}%`}
          sub="Meta: ≥ 95%"
          iconClass={summary.compliance >= 95 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}
          borderClass={summary.compliance < 95 ? 'border-destructive/30' : ''}
        />
        <KPICard
          icon={CheckCircle2}
          label="No prazo"
          value={summary.green + summary.yellow}
          sub={`de ${withSla} com SLA`}
          iconClass="bg-emerald-500/10 text-emerald-500"
        />
        <KPICard
          icon={ShieldAlert}
          label="Em risco"
          value={summary.em_risco}
          iconClass={summary.em_risco > 0 ? 'bg-orange-500/10 text-orange-500' : 'bg-muted text-muted-foreground'}
          borderClass={summary.em_risco > 0 ? 'border-orange-400/30' : ''}
        />
        <KPICard
          icon={ShieldX}
          label="Violados"
          value={summary.violados}
          iconClass={summary.violados > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}
          borderClass={summary.violados > 0 ? 'border-destructive/30' : ''}
        />
      </div>

      {/* Barra de distribuição */}
      {withSla > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Distribuição SLA</p>
          <div className="flex h-3 gap-px overflow-hidden rounded-full" role="img" aria-label={`Distribuição SLA de ${withSla} demandas`}>
            {(['green', 'yellow', 'orange', 'red'] as const).map(color => {
              const count = summary[color];
              const pct = (count / withSla) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={color}
                  className={`${COLOR_BAR[color]} transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${COLOR_LABEL[color]}: ${count} (${pct.toFixed(0)}%)`}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {(['green', 'yellow', 'orange', 'red'] as const).map(color => (
              summary[color] > 0 && (
                <span key={color} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className={`w-2 h-2 rounded-full ${COLOR_BAR[color]}`} />
                  {COLOR_LABEL[color]}: {summary[color]}
                </span>
              )
            ))}
          </div>
        </div>
      )}

      {/* Lista de em risco / violados */}
      {items.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
              Demandas em Risco / Violadas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-64 overflow-y-auto">
              {items.map(item => (
                <div key={item.demanda_id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-bold">{item.rhm}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.projeto}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {item.elapsed_minutes}min
                    </div>
                    <Badge variant="outline" className={`text-[10px] border ${COLOR_BADGE[item.sla_color]}`}>
                      {item.resolution_pct.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KPICard({ icon: Icon, label, value, sub, iconClass, borderClass = '' }: {
  icon: LucideIcon; label: string; value: string | number; sub?: string; iconClass: string; borderClass?: string;
}) {
  return (
    <Card className={borderClass}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${iconClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
