/**
 * useSLAStatus — versão otimizada (sem N+1)
 *
 * ANTES: 1 RPC `fn_check_sla_status` por demanda montada na tela
 *   (cada SLABadge chamava este hook → 30 demandas = 30 RPCs simultâneas).
 *
 * DEPOIS: cálculo 100% client-side baseado nos dados já presentes em `Demanda`.
 *   Sem nenhuma requisição extra ao banco. A cor é derivada de `sla_status`
 *   (campo populado pela RPC `get_demandas_with_responsaveis` no batch do board).
 *   O hook mantém a mesma interface pública para não quebrar consumidores.
 *
 * QUANDO USAR A RPC (fn_check_sla_status):
 *   Apenas no DemandaDetail (view individual), onde precisão ao minuto importa.
 *   Não usar em listagens / tabelas / cards do Kanban.
 */
import { useMemo } from 'react';

export type SLAColor = 'green' | 'yellow' | 'orange' | 'red' | 'none';

export interface SLAStatus {
  color:                    SLAColor;
  elapsed_minutes:          number;
  resolution_pct:           number;
  response_pct:             number;
  response_breached:        boolean;
  resolution_breached:      boolean;
  business_hours_only:      boolean;
  response_limit_minutes:   number;
  resolution_limit_minutes: number;
}

interface Params {
  demandaId:   string | null;
  contractId:  string | null;
  priority:    string | null;
  createdAt:   string | null;
  enabled?:    boolean;
  /** Campo sla_status já calculado pela RPC batch do board (preferencial) */
  slaStatus?:  string | null;
}

/** Mapeia sla_status string → SLAColor */
function toColor(s: string | null | undefined): SLAColor {
  if (s === 'violado')  return 'red';
  if (s === 'em_risco') return 'orange';
  if (s === 'dentro')   return 'green';
  return 'none';
}

/** Estimativa de % decorrida baseada apenas em createdAt (sem RPC) */
function estimatePct(createdAt: string | null, priority: string | null): number {
  if (!createdAt) return 0;
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 60000; // minutos
  // Limites aproximados por prioridade (horas úteis médias)
  const limits: Record<string, number> = {
    urgent: 240,    // 4h
    high:   480,    // 8h
    medium: 1440,   // 24h
    low:    2880,   // 48h
  };
  const limit = limits[priority ?? 'medium'] ?? 1440;
  return Math.min((elapsed / limit) * 100, 100);
}

export function useSLAStatus({
  contractId,
  priority,
  createdAt,
  enabled = true,
  slaStatus,
}: Params) {
  const status = useMemo<SLAStatus | null>(() => {
    if (!enabled || (!contractId && !slaStatus)) return null;

    const color = toColor(slaStatus);
    const pct   = estimatePct(createdAt, priority);
    const elapsed = createdAt
      ? Math.round((Date.now() - new Date(createdAt).getTime()) / 60000)
      : 0;

    return {
      color,
      elapsed_minutes:          elapsed,
      resolution_pct:           pct,
      response_pct:             pct,
      response_breached:        color === 'red',
      resolution_breached:      color === 'red',
      business_hours_only:      true,
      response_limit_minutes:   0,
      resolution_limit_minutes: 0,
    };
  }, [contractId, priority, createdAt, enabled, slaStatus]);

  // loading sempre false — cálculo local síncrono
  return { status, loading: false };
}

/**
 * useSLAStatusRemote — versão original com RPC, para uso no DemandaDetail APENAS.
 * Importar explicitamente quando precisar de dados precisos ao minuto.
 */
export function useSLAStatusRemote(params: Omit<Params, 'slaStatus'>) {
  // Importação lazy para não arrastar o módulo nos bundles de listagem
  const { useState, useEffect } = require('react');
  const { supabase } = require('@/integrations/supabase/client');

  const [status, setStatus]   = useState<SLAStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { demandaId, contractId: cId, priority: p, createdAt: ca, enabled: en = true } = params;
    if (!en || !demandaId || !cId || !p || !ca) { setStatus(null); return; }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any).rpc('fn_check_sla_status', {
          p_demanda_id:  demandaId,
          p_contract_id: cId,
          p_priority:    p,
          p_created_at:  ca,
        });
        if (!cancelled && !error && data && data.status !== 'no_sla_configured') {
          setStatus({
            color:                    data.sla_color              ?? 'none',
            elapsed_minutes:          data.elapsed_minutes         ?? 0,
            resolution_pct:           data.resolution_pct          ?? 0,
            response_pct:             data.response_pct            ?? 0,
            response_breached:        data.response_breached        ?? false,
            resolution_breached:      data.resolution_breached      ?? false,
            business_hours_only:      data.business_hours_only      ?? true,
            response_limit_minutes:   data.response_limit_minutes   ?? 0,
            resolution_limit_minutes: data.resolution_limit_minutes ?? 0,
          });
        }
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.demandaId, params.contractId, params.priority, params.createdAt, params.enabled]);

  return { status, loading };
}
