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

const STORAGE_KEY = "selectedOrganizationId";

export const ORGANIZATION_TENANCY_ENABLED =
  import.meta.env.VITE_ORG_TENANCY_ENABLED === "true";

export interface OrganizationOption {
  id: string;
  name: string;
  slug: string;
  status: "active" | "trial" | "suspended" | "cancelled";
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
  const { user, session } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [currentOrganizationId, setCurrentOrganizationIdState] = useState<
    string | null
  >(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(ORGANIZATION_TENANCY_ENABLED);
  const [error, setError] = useState<string | null>(null);

  const setCurrentOrganizationId = useCallback(
    (organizationId: string | null) => {
      setCurrentOrganizationIdState(organizationId);
      if (organizationId) localStorage.setItem(STORAGE_KEY, organizationId);
      else localStorage.removeItem(STORAGE_KEY);
    },
    [],
  );

  const refreshOrganizations = useCallback(async () => {
    if (!ORGANIZATION_TENANCY_ENABLED || !user?.id || !session) {
      setOrganizations([]);
      setCurrentOrganizationId(null);
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
      setCurrentOrganizationId(null);
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
      new Map(normalized.map((organization) => [organization.id, organization])).values(),
    );

    setOrganizations(unique);
    setCurrentOrganizationIdState((current) => {
      const requested = current ?? localStorage.getItem(STORAGE_KEY);
      const selected = chooseCurrentOrganizationId(unique, requested);
      if (selected) localStorage.setItem(STORAGE_KEY, selected);
      else localStorage.removeItem(STORAGE_KEY);
      return selected;
    });
    setLoading(false);
  }, [session, setCurrentOrganizationId, user?.id]);

  useEffect(() => {
    void refreshOrganizations();
  }, [refreshOrganizations]);

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
    }),
    [
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
