import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import {
  OKR_FEATURE_KEYS,
  makeMissingResolution,
  type OkrEntitlementResolution,
  type OkrEntitlementRow,
  type OkrFeatureKey,
} from "@/features/okr/entitlements/okrFeatures";

interface RpcErrorLike {
  code?: string;
  message?: string;
}

function isRpcUnavailable(error: RpcErrorLike | null) {
  if (!error) return false;
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    error.message?.includes("Could not find the function") === true ||
    error.message?.includes("does not exist") === true
  );
}

function normalize(row: Record<string, unknown>): OkrEntitlementRow {
  return {
    featureKey: String(row.feature_key),
    enabled: Boolean(row.enabled),
    limitValue: row.limit_value == null ? null : Number(row.limit_value),
    source: String(row.source ?? "missing"),
  };
}

export interface UseOkrEntitlementsResult {
  loading: boolean;
  unavailable: boolean;
  error: string | null;
  rows: OkrEntitlementRow[];
  /** Resolve uma feature específica. Retorna disabled/missing quando não presente. */
  resolve: (featureKey: OkrFeatureKey | string) => OkrEntitlementResolution;
  hasFeature: (featureKey: OkrFeatureKey | string) => boolean;
  getLimit: (featureKey: OkrFeatureKey | string) => number | null;
  refresh: () => Promise<void>;
}

/**
 * PR 1 — Hook canônico do OKR.
 *
 * Fonte única de verdade para o frontend saber, por organização, se cada
 * capability OKR está habilitada e qual o limite efetivo. Delega ao backend
 * (`get_okr_entitlement_matrix_v1`). Nunca faz decisões locais.
 */
export function useOkrEntitlements(): UseOkrEntitlementsResult {
  const { enabled: tenancyEnabled, currentOrganizationId } = useOrganization();
  const [rows, setRows] = useState<OkrEntitlementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenancyEnabled || !currentOrganizationId) {
      setRows([]);
      setUnavailable(false);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await (supabase as any).rpc(
      "get_okr_entitlement_matrix_v1",
      { p_org_id: currentOrganizationId },
    );

    if (isRpcUnavailable(rpcError as RpcErrorLike | null)) {
      console.warn(
        "[useOkrEntitlements] RPC get_okr_entitlement_matrix_v1 indisponível — fallback vazio.",
      );
      setRows([]);
      setUnavailable(true);
      setLoading(false);
      return;
    }
    if (rpcError) {
      console.error("[useOkrEntitlements] Falha ao carregar matriz OKR", rpcError);
      setRows([]);
      setUnavailable(false);
      setError("Não foi possível carregar os limites OKR da organização.");
      setLoading(false);
      return;
    }

    const normalized = ((data ?? []) as Array<Record<string, unknown>>).map(normalize);
    setRows(normalized);
    setUnavailable(false);
    setLoading(false);
  }, [currentOrganizationId, tenancyEnabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const index = useMemo(() => {
    const map = new Map<string, OkrEntitlementRow>();
    for (const row of rows) map.set(String(row.featureKey), row);
    return map;
  }, [rows]);

  const resolve = useCallback(
    (featureKey: OkrFeatureKey | string): OkrEntitlementResolution => {
      if (loading) {
        return { ...makeMissingResolution(featureKey), loading: true };
      }
      if (unavailable) {
        // Sem RPC disponível: falhamos aberto para não travar telas legadas.
        return {
          featureKey,
          enabled: true,
          limitValue: null,
          source: "missing",
          loading: false,
          unavailable: true,
        };
      }
      const row = index.get(featureKey);
      if (!row) return makeMissingResolution(featureKey);
      return { ...row, loading: false, unavailable: false };
    },
    [index, loading, unavailable],
  );

  const hasFeature = useCallback(
    (featureKey: OkrFeatureKey | string) => resolve(featureKey).enabled,
    [resolve],
  );

  const getLimit = useCallback(
    (featureKey: OkrFeatureKey | string) => resolve(featureKey).limitValue,
    [resolve],
  );

  return useMemo(
    () => ({ loading, unavailable, error, rows, resolve, hasFeature, getLimit, refresh }),
    [error, getLimit, hasFeature, loading, refresh, resolve, rows, unavailable],
  );
}

/** Utilitário — retorna features OKR conhecidas com resolução atual. */
export function listOkrEntitlements(
  matrix: OkrEntitlementRow[],
): OkrEntitlementRow[] {
  const index = new Map(matrix.map((r) => [String(r.featureKey), r]));
  return OKR_FEATURE_KEYS.map(
    (key) =>
      index.get(key) ?? { featureKey: key, enabled: false, limitValue: null, source: "missing" },
  );
}