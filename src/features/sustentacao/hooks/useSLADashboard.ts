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

// Retorno do RPC fn_sla_contract_panel
interface PanelSummary {
  total: number; dentro: number; em_risco: number; violado: number;
  no_sla: number; compliance: number;
}
interface PanelItem {
  demanda_id: string; rhm: string; projeto: string; titulo: string | null;
  priority: string; sla_bucket: 'dentro' | 'em_risco' | 'violado' | 'no_sla';
  elapsed_minutes: number; resolution_pct: number;
}
interface PanelResponse { summary: PanelSummary; items: PanelItem[] }

export function useSLADashboard(contractId: string | null) {
  const [summary, setSummary]   = useState<SLASummary | null>(null);
  const [items, setItems]       = useState<SLADashboardItem[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!contractId) { setSummary(null); setItems([]); setError(null); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('fn_sla_contract_panel', {
        p_contract_id: contractId,
        p_limit_risco: 20,
      });
      if (rpcErr) throw rpcErr;
      if (!data) throw new Error('SLA panel sem retorno');

      const payload = data as unknown as PanelResponse;
      const s = payload.summary;

      // Mapeia bucket → cor usada pelos componentes (yellow reservado para "no_sla"/aviso)
      setSummary({
        total:      s.total,
        green:      s.dentro,
        yellow:     s.no_sla,
        orange:     s.em_risco,
        red:        s.violado,
        no_sla:     s.no_sla,
        compliance: s.compliance,
        em_risco:   s.em_risco,
        violados:   s.violado,
      });

      setItems(
        (payload.items ?? []).map<SLADashboardItem>(it => ({
          demanda_id:          it.demanda_id,
          rhm:                 it.rhm,
          projeto:             it.projeto,
          priority:            it.priority,
          sla_color:           it.sla_bucket === 'violado' ? 'red' : 'orange',
          elapsed_minutes:     it.elapsed_minutes,
          resolution_pct:      it.resolution_pct,
          resolution_breached: it.sla_bucket === 'violado',
        })),
      );
    } catch (e) {
      setSummary(null);
      setItems([]);
      setError((e as Error)?.message ?? 'Falha ao calcular SLA');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  return { summary, items, loading, error, reload: load };
}
