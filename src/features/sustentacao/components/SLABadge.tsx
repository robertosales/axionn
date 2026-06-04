/**
 * SLABadge — versão sem fetch (zero requests extras)
 *
 * ANTES: cada instância chamava useSLAStatus → 1 RPC fn_check_sla_status
 *   por demanda. Em listas/tabelas com 30+ demandas isso causava N+1 RPCs,
 *   travando o pool Supabase e deixando o Kanban sem cards.
 *
 * DEPOIS: badge 100% client-side. Usa o campo `slaStatus` (string do banco)
 *   para determinar a cor. A precisão ao minuto fica reservada ao DemandaDetail,
 *   que pode importar `useSLAStatusRemote` explicitamente.
 */
import {
  Tooltip, TooltipContent,
  TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSLAStatus, type SLAColor } from '../hooks/useSLAStatus';
import { ShieldCheck, ShieldAlert, ShieldX, Shield, Clock } from 'lucide-react';

const COLOR_CONFIG: Record<SLAColor, {
  className: string;
  icon:      typeof ShieldCheck;
  label:     string;
}> = {
  green:  { className: 'text-emerald-500',      icon: ShieldCheck, label: 'SLA OK'       },
  yellow: { className: 'text-yellow-500',        icon: Shield,      label: 'SLA Atenção'  },
  orange: { className: 'text-orange-500',        icon: ShieldAlert, label: 'SLA em Risco' },
  red:    { className: 'text-destructive',       icon: ShieldX,     label: 'SLA Violado'  },
  none:   { className: 'text-muted-foreground',  icon: Shield,      label: 'Sem SLA'      },
};

interface Props {
  demandaId:  string;
  contractId: string | null;
  priority:   string | null;
  createdAt:  string;
  slaLegado?: string | null;
  /** sla_status já calculado no backend (dentro | em_risco | violado) — preferencial */
  slaStatus?: string | null;
}

export function SLABadge({
  contractId, priority, createdAt,
  slaLegado, slaStatus,
}: Props) {
  const enabled = !!contractId && !!priority;

  const { status } = useSLAStatus({
    demandaId:  null, // não usamos mais o fetch por demanda aqui
    contractId,
    priority,
    createdAt,
    enabled,
    slaStatus,
  });

  // Sem contrato: badge legado
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

  if (!status || status.color === 'none') return null;

  const cfg  = COLOR_CONFIG[status.color];
  const Icon = cfg.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold cursor-default ${cfg.className}`}>
            <Icon className="h-3 w-3" />
            {status.resolution_pct.toFixed(0)}%
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {cfg.label}
          {status.elapsed_minutes > 0 && ` · ${Math.round(status.elapsed_minutes / 60)}h decorridas`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
