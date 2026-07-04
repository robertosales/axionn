import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface OrganizationUsageSummary {
  organizationId: string;
  planCode: string;
  subscriptionStatus: string;
  usersUsed: number;
  usersLimit: number | null;
  projectsUsed: number;
  projectsLimit: number | null;
  contractsUsed: number;
  contractsLimit: number | null;
  apfCountingsUsed: number;
  apfCountingsLimit: number | null;
  aiCallsUsed: number;
  aiCallsLimit: number | null;
  quotaResetAt: string | null;
}

export interface OrganizationEntitlement {
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
  source: string;
}

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeUsage(row: Record<string, unknown>): OrganizationUsageSummary {
  return {
    organizationId: String(row.organization_id),
    planCode: String(row.plan_code ?? "starter"),
    subscriptionStatus: String(row.subscription_status ?? "active"),
    usersUsed: toNumber(row.users_used),
    usersLimit: toNullableNumber(row.users_limit),
    projectsUsed: toNumber(row.projects_used),
    projectsLimit: toNullableNumber(row.projects_limit),
    contractsUsed: toNumber(row.contracts_used),
    contractsLimit: toNullableNumber(row.contracts_limit),
    apfCountingsUsed: toNumber(row.apf_countings_used),
    apfCountingsLimit: toNullableNumber(row.apf_countings_limit),
    aiCallsUsed: toNumber(row.ai_calls_used),
    aiCallsLimit: toNullableNumber(row.ai_calls_limit),
    quotaResetAt: row.quota_reset_at == null ? null : String(row.quota_reset_at),
  };
}

function normalizeEntitlement(
  row: Record<string, unknown>,
): OrganizationEntitlement {
  return {
    featureKey: String(row.feature_key),
    enabled: Boolean(row.enabled),
    limitValue: toNullableNumber(row.limit_value),
    source: String(row.source ?? "plan"),
  };
}

export function useOrganizationUsage() {
  const { currentOrganizationId, currentOrganization } = useOrganization();
  const [usage, setUsage] = useState<OrganizationUsageSummary | null>(null);
  const [entitlements, setEntitlements] = useState<OrganizationEntitlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentOrganizationId) {
      setUsage(null);
      setEntitlements([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [usageResult, entitlementsResult] = await Promise.all([
      (supabase as any).rpc("get_organization_usage_summary", {
        p_org_id: currentOrganizationId,
      }),
      (supabase as any).rpc("get_my_organization_entitlements", {
        p_org_id: currentOrganizationId,
      }),
    ]);

    if (usageResult.error || entitlementsResult.error) {
      console.error("[useOrganizationUsage] load failed", {
        usageError: usageResult.error,
        entitlementsError: entitlementsResult.error,
      });
      setUsage(null);
      setEntitlements([]);
      setError("Não foi possível carregar o plano e o uso da organização.");
      setLoading(false);
      return;
    }

    const usageRow = Array.isArray(usageResult.data)
      ? usageResult.data[0]
      : usageResult.data;

    setUsage(
      usageRow ? normalizeUsage(usageRow as Record<string, unknown>) : null,
    );
    setEntitlements(
      ((entitlementsResult.data ?? []) as Array<Record<string, unknown>>).map(
        normalizeEntitlement,
      ),
    );
    setLoading(false);
  }, [currentOrganizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      organization: currentOrganization,
      usage,
      entitlements,
      loading,
      error,
      refresh,
    }),
    [currentOrganization, entitlements, error, loading, refresh, usage],
  );
}
