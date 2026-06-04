// ============================================================
// B — SlaStatusBadge
// Badge dinâmico de status SLA para demandas de sustentação.
// Usa calc_sla_demanda via RPC e exibe cor + label.
// ============================================================
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

type SlaStatus = 'dentro' | 'em_risco' | 'violado' | 'concluido' | 'n/a';

const STATUS_CONFIG: Record<SlaStatus, { label: string; className: string; dot: string }> = {
  dentro:    { label: 'No prazo',  className: 'bg-green-950  text-green-400  border-green-800',  dot: 'bg-green-400'  },
  em_risco:  { label: 'Em risco',  className: 'bg-yellow-950 text-yellow-400 border-yellow-800', dot: 'bg-yellow-400' },
  violado:   { label: 'Violado',   className: 'bg-red-950    text-red-400    border-red-800',    dot: 'bg-red-400'    },
  concluido: { label: 'Concluído', className: 'bg-blue-950   text-blue-400   border-blue-800',   dot: 'bg-blue-400'   },
  'n/a':     { label: 'Sem SLA',   className: 'bg-muted      text-muted-foreground border-border', dot: 'bg-muted-foreground' },
};

interface Props {
  demandaId: string;
  teamModule?: string;  // se não for sustentacao, mostra n/a sem chamar RPC
  className?: string;
}

export function SlaStatusBadge({ demandaId, teamModule, className = '' }: Props) {
  const [status, setStatus] = useState<SlaStatus | null>(null);
  const [pct,    setPct]    = useState<number | null>(null);

  useEffect(() => {
    // Salas ágeis não têm SLA contratual
    if (teamModule && teamModule !== 'sustentacao') {
      setStatus('n/a');
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await (supabase as any).rpc('calc_sla_demanda', {
          p_demanda_id: demandaId,
        });
        if (error || !data || cancelled) return;
        setStatus((data.statusSLA as SlaStatus) ?? 'n/a');
        setPct(data.resolutionPct ?? null);
      } catch {
        setStatus('n/a');
      }
    }
    load();
    return () => { cancelled = true; };
  }, [demandaId, teamModule]);

  if (status === null) {
    return <Loader2 className={`h-3 w-3 animate-spin text-muted-foreground ${className}`} />;
  }

  const cfg = STATUS_CONFIG[status];

  return (
    <Badge
      variant="outline"
      className={`text-[10px] border gap-1 ${cfg.className} ${className}`}
      title={pct !== null ? `${pct}% do prazo consumido` : undefined}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
      {pct !== null && status !== 'concluido' && status !== 'n/a' && (
        <span className="opacity-70">({pct}%)</span>
      )}
    </Badge>
  );
}
