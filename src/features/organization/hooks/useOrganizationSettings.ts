import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface OrganizationSettings {
  organizationId: string;
  name: string;
  slug: string;
  logoUrl: string;
  contactName: string;
  contactEmail: string;
  status: string;
  plan: string;
  updatedAt: string;
}

export interface OrganizationSettingsAudit {
  auditId: string;
  actorId: string | null;
  actorName: string;
  actorEmail: string;
  action: string;
  changedFields: string[];
  beforeValues: Record<string, unknown>;
  afterValues: Record<string, unknown>;
  createdAt: string;
}

export interface UpdateOrganizationSettingsInput {
  name: string;
  logoUrl: string;
  contactName: string;
  contactEmail: string;
}

function normalizeSettings(row: Record<string, unknown>): OrganizationSettings {
  return {
    organizationId: String(row.organization_id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    logoUrl: String(row.logo_url ?? ""),
    contactName: String(row.contact_name ?? ""),
    contactEmail: String(row.contact_email ?? ""),
    status: String(row.status ?? "active"),
    plan: String(row.plan ?? "free"),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function normalizeAudit(row: Record<string, unknown>): OrganizationSettingsAudit {
  return {
    auditId: String(row.audit_id),
    actorId: row.actor_id == null ? null : String(row.actor_id),
    actorName: String(row.actor_name ?? "Usuário"),
    actorEmail: String(row.actor_email ?? ""),
    action: String(row.action ?? "settings_updated"),
    changedFields: Array.isArray(row.changed_fields)
      ? row.changed_fields.map(String)
      : [],
    beforeValues: (row.before_values ?? {}) as Record<string, unknown>,
    afterValues: (row.after_values ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at ?? ""),
  };
}

export function useOrganizationSettings() {
  const {
    currentOrganizationId,
    currentOrganization,
    refreshOrganizations,
  } = useOrganization();
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [audit, setAudit] = useState<OrganizationSettingsAudit[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentOrganizationId) {
      setSettings(null);
      setAudit([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [settingsResult, auditResult] = await Promise.all([
      (supabase as any).rpc("get_organization_settings_v2", {
        p_org_id: currentOrganizationId,
      }),
      (supabase as any).rpc("get_organization_settings_audit_v2", {
        p_org_id: currentOrganizationId,
        p_limit: 50,
      }),
    ]);

    if (settingsResult.error || auditResult.error) {
      console.error("[useOrganizationSettings] load failed", {
        settingsError: settingsResult.error,
        auditError: auditResult.error,
      });
      setSettings(null);
      setAudit([]);
      setError("Não foi possível carregar as configurações da organização.");
      setLoading(false);
      return;
    }

    const settingsRow = Array.isArray(settingsResult.data)
      ? settingsResult.data[0]
      : settingsResult.data;

    setSettings(
      settingsRow
        ? normalizeSettings(settingsRow as Record<string, unknown>)
        : null,
    );
    setAudit(
      ((auditResult.data ?? []) as Array<Record<string, unknown>>).map(
        normalizeAudit,
      ),
    );
    setLoading(false);
  }, [currentOrganizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateSettings = useCallback(
    async (input: UpdateOrganizationSettingsInput) => {
      if (!currentOrganizationId) {
        throw new Error("Organização não selecionada.");
      }

      setSaving(true);
      setError(null);
      try {
        const { data, error: mutationError } = await (supabase as any).rpc(
          "update_organization_settings_v2",
          {
            p_org_id: currentOrganizationId,
            p_name: input.name,
            p_contact_name: input.contactName || null,
            p_contact_email: input.contactEmail || null,
            p_logo_url: input.logoUrl || null,
          },
        );

        if (mutationError) throw mutationError;

        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          setSettings(normalizeSettings(row as Record<string, unknown>));
        }

        await Promise.all([refreshOrganizations(), refresh()]);
        return row;
      } finally {
        setSaving(false);
      }
    },
    [currentOrganizationId, refresh, refreshOrganizations],
  );

  return useMemo(
    () => ({
      organization: currentOrganization,
      settings,
      audit,
      loading,
      saving,
      error,
      refresh,
      updateSettings,
    }),
    [
      audit,
      currentOrganization,
      error,
      loading,
      refresh,
      saving,
      settings,
      updateSettings,
    ],
  );
}
