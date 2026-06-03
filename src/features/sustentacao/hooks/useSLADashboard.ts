import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SLASummary {
  total:       number;
  green:       number;
  yellow:      number;
  orange:      number;
  red:         number;
  no_sla:      number;
  compliance:  number;  // % (green+yellow / total com SLA)
  em_risco:    number;  // orange + red
  violados:    number;  // red
}

export interface SLADashboardItem {
  demanda_id:         string;
  rhm:                string;
  projeto:            string;
  priority:           string;
  sla_color:          'green' | 'yellow' | 'orange' | 'red';
  elapsed_minutes:    number;
  resolution_pct:     number;
  resolution_breached: boolean;
}

export function useSLADashboard(contractId: string | null) {
  const [summary, setSummary]   = useState<SLASummary | null>(null);
  const [items, setItems]       = useState<SLADashboardItem[]>([]);
  const [loading, setLoading]   = useState(false);

  const load = useCallback(async () => {
    if (!contractId) { setSummary(null); setItems([]); return; }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .rpc('fn_sla_status_summary', { p_contract_id: contractId });

      if (error || !data) throw error;

      const list = (data as any[]);
      const withSla  = list.filter(d => d.sla_color !== null);
      const green    = withSla.filter(d => d.sla_color === 'green').length;
      const yellow   = withSla.filter(d => d.sla_color === 'yellow').length;
      const orange   = withSla.filter(d => d.sla_color === 'orange').length;
      const red      = withSla.filter(d => d.sla_color === 'red').length;
      const no_sla   = list.length - withSla.length;

      setSummary({
        total:      list.length,
        green, yellow, orange, red, no_sla,
        compliance: withSla.length === 0 ? 100 : Math.round(((green + yellow) / withSla.length) * 100),
        em_risco:   orange + red,
        violados:   red,
      });

      setItems(
        list
          .filter(d => d.sla_color === 'orange' || d.sla_color === 'red')
          .sort((a: any, b: any) => b.resolution_pct - a.resolution_pct)
          .slice(0, 20) as SLADashboardItem[]
      );
    } catch {
      setSummary(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  return { summary, items, loading, reload: load };
}
