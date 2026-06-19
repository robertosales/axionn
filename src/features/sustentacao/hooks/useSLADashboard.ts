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

// Linha bruta retornada por fn_sla_dashboard_batch (campos relevantes)
interface BatchDemanda {
  demandaId:       string;
  titulo:          string | null;
  situacao:        string;
  horasAcumuladas: number;
  prazoHoras:      number;
  statusSLA:       'dentro' | 'em_risco' | 'violado' | 'concluido';
  resolutionPct:   number;
  slaColor:        'green' | 'orange' | 'red' | 'blue';
  slaSource:       'contract_matrix' | 'legacy_fallback';
}

// Mapeia statusSLA → cor usada pela UI (green/yellow/orange/red)
function mapColor(status: BatchDemanda['statusSLA'], pct: number): SLADashboardItem['sla_color'] {
  if (status === 'violado')   return 'red';
  if (status === 'em_risco')  return 'orange';
  // dentro: ainda diferencia amarelo (>=70%) de verde
  if (pct >= 70)              return 'yellow';
  return 'green';
}

export function useSLADashboard(contractId: string | null) {
  const [summary, setSummary]   = useState<SLASummary | null>(null);
  const [items, setItems]       = useState<SLADashboardItem[]>([]);
  const [loading, setLoading]   = useState(false);

  const load = useCallback(async () => {
    if (!contractId) { setSummary(null); setItems([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('fn_sla_dashboard_batch', {
        p_contract_id: contractId,
        p_team_id:     null,
        p_project_id:  null,
        p_limit:       500,
      });

      if (error || !data) throw error;

      const payload  = data as { summary?: unknown; demandas?: BatchDemanda[] };
      const demandas = payload.demandas ?? [];

      // Considera "ativo" o que não está concluído. Concluído entra como no_sla.
      const ativos   = demandas.filter(d => d.statusSLA !== 'concluido');
      const concluidos = demandas.length - ativos.length;

      const enriched: SLADashboardItem[] = ativos.map(d => ({
        demanda_id:          d.demandaId,
        rhm:                 (d.titulo ?? d.demandaId.slice(0, 8)).toString(),
        projeto:             d.situacao,
        priority:            d.slaSource === 'contract_matrix' ? 'medium' : 'legacy',
        sla_color:           mapColor(d.statusSLA, d.resolutionPct),
        elapsed_minutes:     Math.round((d.horasAcumuladas || 0) * 60),
        resolution_pct:      d.resolutionPct ?? 0,
        resolution_breached: d.statusSLA === 'violado',
      }));

      const green  = enriched.filter(d => d.sla_color === 'green').length;
      const yellow = enriched.filter(d => d.sla_color === 'yellow').length;
      const orange = enriched.filter(d => d.sla_color === 'orange').length;
      const red    = enriched.filter(d => d.sla_color === 'red').length;
      const no_sla = concluidos;
      const withSla = enriched.length;

      setSummary({
        total:      demandas.length,
        green, yellow, orange, red, no_sla,
        compliance: withSla === 0 ? 100 : Math.round(((green + yellow) / withSla) * 100),
        em_risco:   orange + red,
        violados:   red,
      });

      setItems(
        enriched
          .filter(d => d.sla_color === 'orange' || d.sla_color === 'red')
          .sort((a, b) => b.resolution_pct - a.resolution_pct)
          .slice(0, 20)
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
