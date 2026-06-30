import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ORGANIZATION_TENANCY_ENABLED } from "@/lib/featureFlags";
import {
  resolveOrganizationAccess,
  type OrganizationAccessMode,
  type OrganizationStatus,
} from "@/contexts/organizationAccess";

const STORAGE_KEY = "selectedOrganizationId";

export interface OrganizationOption {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  plan: "free" | "pro" | "enterprise";
  membershipRole: "owner" | "admin" | "member" | "platform_admin";
  isPlatformAdmin: boolean;
}

interface OrganizationContextValue {
  enabled: boolean;
  loading: boolean;
  error: string | null;
  organizations: OrganizationOption[];
  currentOrganizationId: string | null;
  currentOrganization: OrganizationOption | null;
  setCurrentOrganizationId: (organizationId: string | null) => void;
  refreshOrganizations: () => Promise<void>;
  isPlatformAdmin: boolean;
  isOrganizationAdmin: boolean;
  accessMode: OrganizationAccessMode;
  canOperate: boolean;
  operationBlockReason: string | null;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(
  undefined,
);

export function chooseCurrentOrganizationId(
  organizations: Pick<OrganizationOption, "id">[],
  requestedId: string | null,
) {
  if (
    requestedId &&
    organizations.some((organization) => organization.id === requestedId)
  ) {
    return requestedId;
  }

  return organizations[0]?.id ?? null;
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, session, refreshTeams, setCurrentTeamId } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [currentOrganizationId, setCurrentOrganizationIdState] = useState<
    string | null
  >(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(ORGANIZATION_TENANCY_ENABLED);
  const [error, setError] = useState<string | null>(null);

  const setCurrentOrganizationId = useCallback(
    (organizationId: string | null) => {
      if (
        organizationId &&
        !organizations.some((organization) => organization.id === organizationId)
      ) {
        console.warn(
          "[OrganizationContext] Tentativa de selecionar organização sem acesso:",
          organizationId,
        );
        return;
      }

      setCurrentOrganizationIdState((current) => {
        if (current !== organizationId) {
          localStorage.removeItem("selectedTeamId");
          setCurrentTeamId(null);
        }
        return organizationId;
      });

      if (organizationId) localStorage.setItem(STORAGE_KEY, organizationId);
      else localStorage.removeItem(STORAGE_KEY);
    },
    [organizations, setCurrentTeamId],
  );

  const refreshOrganizations = useCallback(async () => {
    if (!ORGANIZATION_TENANCY_ENABLED) {
      setOrganizations([]);
      setError(null);
      setLoading(false);
      return;
    }

    if (!user?.id || !session) {
      setOrganizations([]);
      setCurrentOrganizationIdState(null);
      setCurrentTeamId(null);
      localStorage.removeItem(STORAGE_KEY);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase.rpc(
      "get_my_organizations_v2",
    );

    if (queryError) {
      console.error("[OrganizationContext] get_my_organizations_v2:", queryError);
      setOrganizations([]);
      setCurrentOrganizationIdState(null);
      setCurrentTeamId(null);
      setError(
        "Não foi possível carregar as organizações disponíveis para esta conta.",
      );
      setLoading(false);
      return;
    }

    const normalized = ((data ?? []) as Array<Record<string, unknown>>).map(
      (row) => ({
        id: String(row.id),
        name: String(row.name ?? "Organização"),
        slug: String(row.slug ?? ""),
        status: String(row.status ?? "active") as OrganizationOption["status"],
        plan: String(row.plan ?? "free") as OrganizationOption["plan"],
        membershipRole: String(
          row.membership_role ?? "member",
        ) as OrganizationOption["membershipRole"],
        isPlatformAdmin: Boolean(row.is_platform_admin),
      }),
    );

    const unique = Array.from(
      new Map(
        normalized.map((organization) => [organization.id, organization]),
      ).values(),
    );

    setOrganizations(unique);
    setCurrentOrganizationIdState((current) => {
      const requested = current ?? localStorage.getItem(STORAGE_KEY);
      const selected = chooseCurrentOrganizationId(unique, requested);

      if (selected) localStorage.setItem(STORAGE_KEY, selected);
      else {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem("selectedTeamId");
        setCurrentTeamId(null);
      }

      return selected;
    });
    setError(
      unique.length === 0
        ? "Esta conta ainda não está vinculada a uma organização."
        : null,
    );
    setLoading(false);
  }, [session, setCurrentTeamId, user?.id]);

  useEffect(() => {
    void refreshOrganizations();
  }, [refreshOrganizations]);

  useEffect(() => {
    if (!ORGANIZATION_TENANCY_ENABLED || !session) return;

    if (!currentOrganizationId) {
      setCurrentTeamId(null);
      return;
    }

    void refreshTeams(undefined, currentOrganizationId);
  }, [currentOrganizationId, refreshTeams, session, setCurrentTeamId]);

  const currentOrganization = useMemo(
    () =>
      organizations.find(
        (organization) => organization.id === currentOrganizationId,
      ) ?? null,
    [currentOrganizationId, organizations],
  );

  const isPlatformAdmin = organizations.some(
    (organization) => organization.isPlatformAdmin,
  );
  const isOrganizationAdmin = Boolean(
    currentOrganization &&
      (currentOrganization.isPlatformAdmin ||
        currentOrganization.membershipRole === "owner" ||
        currentOrganization.membershipRole === "admin"),
  );

  const accessDecision = useMemo(
    () =>
      resolveOrganizationAccess({
        status: currentOrganization?.status ?? null,
        isPlatformAdmin,
      }),
    [currentOrganization?.status, isPlatformAdmin],
  );

  const value = useMemo<OrganizationContextValue>(
    () => ({
      enabled: ORGANIZATION_TENANCY_ENABLED,
      loading,
      error,
      organizations,
      currentOrganizationId,
      currentOrganization,
      setCurrentOrganizationId,
      refreshOrganizations,
      isPlatformAdmin,
      isOrganizationAdmin,
      accessMode: accessDecision.mode,
      canOperate: accessDecision.canOperate,
      operationBlockReason: accessDecision.reason,
    }),
    [
      accessDecision,
      currentOrganization,
      currentOrganizationId,
      error,
      isOrganizationAdmin,
      isPlatformAdmin,
      loading,
      organizations,
      refreshOrganizations,
      setCurrentOrganizationId,
    ],
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error(
      "useOrganization deve ser utilizado dentro de OrganizationProvider.",
    );
  }
  return context;
}
