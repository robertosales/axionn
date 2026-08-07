import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import type {
  RbacGovernanceOverview,
  RbacGovernanceRequest,
  RbacLeastPrivilegeRecommendation,
  RbacTemporaryAssignment,
} from "@/features/rbac/types";

const EMPTY: RbacGovernanceOverview = {
  pendingRequests: [],
  temporaryAssignments: [],
  recommendations: [],
  generatedAt: "",
  activityWindowDays: 90,
};

function normalizeRequest(row: Record<string, unknown>): RbacGovernanceRequest {
  return {
    id: String(row.id),
    profileKey: String(row.profile_key),
    changeType: row.change_type === "create" ? "create" : "update",
    riskLevel: row.risk_level === "critical" ? "critical" : "high",
    riskReasons: Array.isArray(row.risk_reasons) ? row.risk_reasons.map(String) : [],
    proposedSnapshot: (row.proposed_snapshot ?? {}) as Record<string, unknown>,
    requestedBy: String(row.requested_by),
    requesterName: String(row.requester_name ?? "Administrador"),
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    canReview: Boolean(row.can_review),
  };
}

function normalizeTemporary(row: Record<string, unknown>): RbacTemporaryAssignment {
  return {
    userId: String(row.user_id),
    displayName: String(row.display_name ?? "Usuário"),
    moduleKey: String(row.module_key) as RbacTemporaryAssignment["moduleKey"],
    profileKey: String(row.profile_key),
    profileName: String(row.profile_name ?? row.profile_key),
    expiresAt: String(row.expires_at),
    justification: String(row.justification ?? ""),
    isExpired: Boolean(row.is_expired),
  };
}

function normalizeRecommendation(row: Record<string, unknown>): RbacLeastPrivilegeRecommendation {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    displayName: String(row.display_name ?? "Usuário"),
    moduleKey: String(row.module_key) as RbacLeastPrivilegeRecommendation["moduleKey"],
    profileKey: String(row.profile_key),
    profileName: String(row.profile_name ?? row.profile_key),
    severity: row.severity === "high" ? "high" : "medium",
    kind: String(row.kind) as RbacLeastPrivilegeRecommendation["kind"],
    lastActivityAt: row.last_activity_at ? String(row.last_activity_at) : null,
    events90d: Number(row.events_90d ?? 0),
    evidence: String(row.evidence ?? ""),
  };
}

export function useRbacGovernance() {
  const { currentOrganizationId } = useOrganization();
  const [overview, setOverview] = useState<RbacGovernanceOverview>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentOrganizationId) {
      setOverview(EMPTY);
      setError("Selecione uma organização para consultar a governança de acesso.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await (supabase as any).rpc(
      "list_rbac_governance_v1",
      { p_org_id: currentOrganizationId },
    );
    if (loadError) {
      console.error("[useRbacGovernance] load failed", loadError);
      setOverview(EMPTY);
      setError("Não foi possível carregar a governança de acesso.");
      setLoading(false);
      return;
    }
    const payload = (data ?? {}) as Record<string, unknown>;
    setOverview({
      pendingRequests: Array.isArray(payload.pending_requests)
        ? payload.pending_requests.map(normalizeRequest)
        : [],
      temporaryAssignments: Array.isArray(payload.temporary_assignments)
        ? payload.temporary_assignments.map(normalizeTemporary)
        : [],
      recommendations: Array.isArray(payload.recommendations)
        ? payload.recommendations.map(normalizeRecommendation)
        : [],
      generatedAt: String(payload.generated_at ?? ""),
      activityWindowDays: Number(payload.activity_window_days ?? 90),
    });
    setLoading(false);
  }, [currentOrganizationId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const review = useCallback(async (
    request: RbacGovernanceRequest,
    decision: "approve" | "reject",
    note: string,
  ) => {
    if (!currentOrganizationId) throw new Error("Organização não selecionada.");
    setReviewing(true);
    try {
      const { error: reviewError } = await (supabase as any).rpc(
        "review_rbac_profile_change_v1",
        {
          p_org_id: currentOrganizationId,
          p_request_id: request.id,
          p_decision: decision,
          p_note: note.trim() || null,
        },
      );
      if (reviewError) throw reviewError;
      toast.success(decision === "approve" ? "Alteração aprovada" : "Alteração rejeitada");
      await refresh();
    } finally {
      setReviewing(false);
    }
  }, [currentOrganizationId, refresh]);

  return { overview, loading, reviewing, error, refresh, review };
}
