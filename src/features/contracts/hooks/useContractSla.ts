import { useState, useEffect, useRef, useCallback } from 'react';
import { checkSlaStatus, getTeamContract } from '../services/contracts.service';
import type { SlaStatusResult, ContractSla, SLAPriority } from '../types/contract';

// ── SLA em tempo real para um chamado ─────────────────────────────────────────

interface UseSlaParams {
  /** ID do contrato vinculado ao team da sala de sustentação */
  contractId: string | null;
  /** Prioridade da demanda: urgent | high | medium | low */
  priority: SLAPriority | string;
  /** created_at da demanda (ISO 8601) */
  createdAt: string;
  /** ID da demanda */
  demandaId: string;
  /** Intervalo de polling em ms. Default: 60000 (1 min) */
  pollingMs?: number;
  /** Não inicia polling se false. Útil em listas grandes. */
  enabled?: boolean;
}

export function useContractSla({
  contractId,
  priority,
  createdAt,
  demandaId,
  pollingMs = 60_000,
  enabled = true,
}: UseSlaParams) {
  const [slaStatus, setSlaStatus] = useState<SlaStatusResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const fetch = useCallback(async () => {
    if (!contractId || !enabled) return;
    setLoading(true);
    try {
      const result = await checkSlaStatus({ demandaId, contractId, priority, createdAt });
      setSlaStatus(result as SlaStatusResult | null);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao calcular SLA');
    } finally {
      setLoading(false);
    }
  }, [contractId, priority, createdAt, demandaId, enabled]);

  useEffect(() => {
    fetch();
    if (enabled) {
      timerRef.current = setInterval(fetch, pollingMs);
    }
    return () => clearInterval(timerRef.current);
  }, [fetch, pollingMs, enabled]);

  /** Cor derivada do status para uso em badges/barras */
  const cor = slaStatus?.sla_color ?? 'green';

  /** % de resolução para uso em progress bars */
  const resolutionPct = Math.min(slaStatus?.resolution_pct ?? 0, 100);

  return { slaStatus, loading, error, cor, resolutionPct, refetch: fetch };
}

// ── Contrato vinculado a um team (com todos os SLAs) ──────────────────────────

export function useTeamContract(teamId: string | null) {
  const [data, setData]   = useState<{ contract_id: string; contract_name: string; slas: ContractSla[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    getTeamContract(teamId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [teamId]);

  return { data, loading };
}
