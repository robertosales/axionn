import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import {
  hasEnabledEntitlement,
  type EffectiveOrganizationEntitlement,
  type OrganizationEntitlementKey,
  type OrganizationSubscriptionStatus,
  type OrganizationUsageSummary,
} from "@/saas/entitlements";

interface RpcErrorLike {
  code?: string;
  message?: string;
}

function isEntitlementsRpcUnavailable(error: RpcErrorLike | null) {
  if (!error) return false;
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    error.message?.includes("Could not find the function") === true ||
    error.message?.includes("does not exist") === true
  );
}

function normalizeEntitlement(
  row: Record<string, unknown>,
): EffectiveOrganizationEntitlement {
  return {
    orgId: String(row.org_id),
    planCode: String(row.plan_code ?? "starter"),
    subscriptionStatus: String(
      row.subscription_status ?? "suspended",
    ) as OrganizationSubscriptionStatus,
    featureKey: String(row.feature_key),
    enabled: Boolean(row.enabled),
    limitValue: row.limit_value == null ? null : Number(row.limit_value),
    source: String(row.source ?? "missing"),
  };
}

function normalizeUsage(
  row: Record<string, unknown> | null,
): OrganizationUsageSummary | null {
  if (!row) return null;

  return {
    organizationId: String(row.organization_id),
    planCode: String(row.plan_code ?? "starter"),
    subscriptionStatus: String(
      row.subscription_status ?? "suspended",
    ) as OrganizationSubscriptionStatus,
    usersUsed: Number(row.users_used ?? 0),
    usersLimit: row.users_limit == null ? null : Number(row.users_limit),
    projectsUsed: Number(row.projects_used ?? 0),
    projectsLimit:
      row.projects_limit == null ? null : Number(row.projects_limit),
    contractsUsed: Number(row.contracts_used ?? 0),
    contractsLimit:
      row.contracts_limit == null ? null : Number(row.contracts_limit),
    apfCountingsUsed: Number(row.apf_countings_used ?? 0),
    apfCountingsLimit:
      row.apf_countings_limit == null
        ? null
        : Number(row.apf_countings_limit),
    aiCallsUsed: Number(row.ai_calls_used ?? 0),
    aiCallsLimit:
      row.ai_calls_limit == null ? null : Number(row.ai_calls_limit),
    quotaResetAt:
      row.quota_reset_at == null ? null : String(row.quota_reset_at),
  };
}

export function useOrganizationEntitlements() {
  const { enabled, currentOrganizationId } = useOrganization();
  const [entitlements, setEntitlements] = useState<
    EffectiveOrganizationEntitlement[]
  >([]);
  const [usage, setUsage] = useState<OrganizationUsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !currentOrganizationId) {
      setEntitlements([]);
      setUsage(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const [entitlementsResult, usageResult] = await Promise.all([
      (supabase as any).rpc("get_my_organization_entitlements", {
        p_org_id: currentOrganizationId,
      }),
      (supabase as any).rpc("get_organization_usage_summary", {
        p_org_id: currentOrganizationId,
      }),
    ]);

    const entitlementsError = entitlementsResult.error as RpcErrorLike | null;
    const usageError = usageResult.error as RpcErrorLike | null;

    if (
      isEntitlementsRpcUnavailable(entitlementsError) ||
      isEntitlementsRpcUnavailable(usageError)
    ) {
      console.warn(
        "[useOrganizationEntitlements] RPCs ainda não estão disponíveis neste ambiente.",
      );
      setEntitlements([]);
      setUsage(null);
      setAvailable(false);
      setError(null);
      setLoading(false);
      return;
    }

    if (entitlementsError || usageError) {
      console.error("[useOrganizationEntitlements] Falha ao carregar domínio SaaS", {
        entitlementsError,
        usageError,
      });
      setEntitlements([]);
      setUsage(null);
      setAvailable(true);
      setError("Não foi possível carregar o plano e os limites da organização.");
      setLoading(false);
      return;
    }

    const normalizedEntitlements = (
      (entitlementsResult.data ?? []) as Array<Record<string, unknown>>
    ).map(normalizeEntitlement);
    const usageRow = Array.isArray(usageResult.data)
      ? ((usageResult.data[0] ?? null) as Record<string, unknown> | null)
      : ((usageResult.data ?? null) as Record<string, unknown> | null);

    setEntitlements(normalizedEntitlements);
    setUsage(normalizeUsage(usageRow));
    setAvailable(true);
    setLoading(false);
  }, [currentOrganizationId, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasFeature = useCallback(
    (featureKey: OrganizationEntitlementKey | string) =>
      hasEnabledEntitlement(entitlements, featureKey),
    [entitlements],
  );

  return useMemo(
    () => ({
      entitlements,
      usage,
      loading,
      available,
      error,
      hasFeature,
      refresh,
    }),
    [available, entitlements, error, hasFeature, loading, refresh, usage],
  );
}
