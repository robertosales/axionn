import { useCallback, useEffect, useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import type { RbacAuditAction, RbacAuditEvent } from "@/features/rbac/types";

function normalizeDetails(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeEvent(row: Record<string, unknown>): RbacAuditEvent {
  return {
    id: String(row.audit_id),
    action: String(row.action) as RbacAuditAction,
    actorId: row.actor_id ? String(row.actor_id) : null,
    actorName: String(row.actor_name ?? "Sistema"),
    subjectUserId: row.subject_user_id ? String(row.subject_user_id) : null,
    subjectName: row.subject_name ? String(row.subject_name) : null,
    profileKey: row.profile_key ? String(row.profile_key) : null,
    details: normalizeDetails(row.details),
    createdAt: String(row.created_at),
  };
}

export function useRbacAudit(profileKey: string | null) {
  const { currentOrganizationId } = useOrganization();
  const [events, setEvents] = useState<RbacAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentOrganizationId) {
      setEvents([]);
      setError("Selecione uma organização para consultar o histórico.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: auditError } = await supabase.rpc(
      "list_rbac_audit_events_v1",
      {
        p_org_id: currentOrganizationId,
        p_limit: 250,
        p_profile_key: profileKey,
      },
    );

    if (auditError) {
      console.error("[useRbacAudit] load failed", auditError);
      setEvents([]);
      setError(
        "Não foi possível carregar o histórico RBAC. Aplique a migration de insights ou tente novamente.",
      );
      setLoading(false);
      return;
    }

    setEvents(((data ?? []) as Record<string, unknown>[]).map(normalizeEvent));
    setLoading(false);
  }, [currentOrganizationId, profileKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { events, loading, error, refresh };
}
