import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSLAStatus, type SLAColor } from '../hooks/useSLAStatus';
import { ShieldCheck, ShieldAlert, ShieldX, Shield, Clock } from 'lucide-react';

const COLOR_CONFIG: Record<SLAColor, {
  className: string;
  icon: typeof ShieldCheck;
  label: string;
}> = {
  green:  { className: 'text-emerald-500',  icon: ShieldCheck, label: 'SLA OK'        },
  yellow: { className: 'text-yellow-500',   icon: Shield,      label: 'SLA Atenção'   },
  orange: { className: 'text-orange-500',   icon: ShieldAlert, label: 'SLA em Risco'  },
  red:    { className: 'text-destructive',  icon: ShieldX,     label: 'SLA Violado'   },
  none:   { className: 'text-muted-foreground', icon: Shield,  label: 'Sem SLA'       },
};

interface Props {
  demandaId: string;
  contractId: string | null;
  priority: string | null;
  createdAt: string;
  /** Se false, exibe apenas o badge legado 24x7 */
  slaLegado?: string | null;
}

export function SLABadge({ demandaId, contractId, priority, createdAt, slaLegado }: Props) {
  const enabled = !!contractId && !!priority;
  const { status, loading } = useSLAStatus({
    demandaId,
    contractId,
    priority,
    createdAt,
    enabled,
  });

  // Sem contrato configurado: exibe badge legado se 24x7
  if (!enabled) {
    if (slaLegado === '24x7') {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-destructive">
          <Clock className="h-3 w-3" /> 24×7
        </span>
      );
    }
    return null;
  }

  if (loading && !status) return null;
  if (!status) return null;

  const cfg = COLOR_CONFIG[status.color];
  const Icon = cfg.icon;

  const tooltipText = [
    cfg.label,
    `Decorrido: ${status.elapsed_minutes}min`,
    `Resolução: ${status.resolution_pct}% (${status.resolution_limit_minutes}min)`,
    status.resolution_breached ? '⚠️ SLA VIOLADO' : '',
  ].filter(Boolean).join(' · ');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold cursor-default ${cfg.className}`}>
            <Icon className="h-3 w-3" />
            {status.resolution_pct.toFixed(0)}%
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[220px]">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
