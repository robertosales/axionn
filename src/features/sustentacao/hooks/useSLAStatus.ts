import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SLAColor = 'green' | 'yellow' | 'orange' | 'red' | 'none';

export interface SLAStatus {
  color: SLAColor;
  elapsed_minutes: number;
  resolution_pct: number;
  response_pct: number;
  response_breached: boolean;
  resolution_breached: boolean;
  business_hours_only: boolean;
  response_limit_minutes: number;
  resolution_limit_minutes: number;
}

interface Params {
  demandaId: string | null;
  contractId: string | null;
  priority: string | null;   // urgent | high | medium | low
  createdAt: string | null;
  enabled?: boolean;
}

export function useSLAStatus({ demandaId, contractId, priority, createdAt, enabled = true }: Params) {
  const [status, setStatus]   = useState<SLAStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !demandaId || !contractId || !priority || !createdAt) {
      setStatus(null);
      return;
    }

    let cancelled = false;

    async function fetch() {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any).rpc('fn_check_sla_status', {
          p_demanda_id:  demandaId,
          p_contract_id: contractId,
          p_priority:    priority,
          p_created_at:  createdAt,
        });
        if (!cancelled && !error && data && data.status !== 'no_sla_configured') {
          setStatus({
            color:                    data.sla_color       ?? 'none',
            elapsed_minutes:          data.elapsed_minutes ?? 0,
            resolution_pct:           data.resolution_pct  ?? 0,
            response_pct:             data.response_pct    ?? 0,
            response_breached:        data.response_breached    ?? false,
            resolution_breached:      data.resolution_breached  ?? false,
            business_hours_only:      data.business_hours_only  ?? true,
            response_limit_minutes:   data.response_limit_minutes   ?? 0,
            resolution_limit_minutes: data.resolution_limit_minutes ?? 0,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    // Atualiza a cada 5 minutos
    const interval = setInterval(fetch, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [demandaId, contractId, priority, createdAt, enabled]);

  return { status, loading };
}
