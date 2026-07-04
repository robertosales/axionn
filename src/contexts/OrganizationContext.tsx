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
  resolveOrganizationPermissionAuthority,
  resolveOrganizationAccess,
  type OrganizationModuleRpcStatus,
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

export interface OrganizationModuleRole {
  module: string;
  roleName: string;
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
  moduleRoles: OrganizationModuleRole[];
  moduleAccessLoading: boolean;
  hasModuleAccess: (module: string) => boolean;
  getModuleRole: (module: string) => string | null;
  refreshModuleAccess: (organizationId?: string | null) => Promise<void>;
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

function isOrganizationModuleRpcUnavailable(error: {
  code?: string;
  message?: string;
}) {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    error.message?.includes("Could not find the function") === true ||
    error.message?.includes("does not exist") === true
  );
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const {
    user,
    session,
    refreshTeams,
    setCurrentTeamId,
    hasModuleAccess: hasLegacyModuleAccess,
    getModuleRole: getLegacyModuleRole,
  } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [currentOrganizationId, setCurrentOrganizationIdState] = useState<
    string | null
  >(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(ORGANIZATION_TENANCY_ENABLED);
  const [error, setError] = useState<string | null>(null);
  const [moduleRoles, setModuleRoles] = useState<OrganizationModuleRole[]>([]);
  const [moduleAccessLoading, setModuleAccessLoading] = useState(
    ORGANIZATION_TENANCY_ENABLED,
  );
  const [moduleAccessAuthoritative, setModuleAccessAuthoritative] =
    useState(false);
  const [moduleRpcStatus, setModuleRpcStatus] =
    useState<OrganizationModuleRpcStatus>("idle");
  const [legacyFallbackEnabled, setLegacyFallbackEnabled] = useState(true);

  const refreshLegacyFallbackFlag = useCallback(async () => {
    if (!ORGANIZATION_TENANCY_ENABLED) {
      setLegacyFallbackEnabled(true);
      return true;
    }

    const { data, error: fallbackError } = await (supabase as any).rpc(
      "is_organization_legacy_permission_fallback_enabled",
    );

    if (fallbackError) {
      console.warn(
        "[OrganizationContext] fallback legado indisponivel; mantendo rollback legado temporario.",
        fallbackError,
      );
      setLegacyFallbackEnabled(true);
      return true;
    }

    const enabled = data === true;
    setLegacyFallbackEnabled(enabled);
    return enabled;
  }, []);

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
          setModuleRoles([]);
          setModuleAccessAuthoritative(false);
          setModuleRpcStatus("idle");
          setModuleAccessLoading(
            ORGANIZATION_TENANCY_ENABLED && Boolean(organizationId),
          );
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
      setModuleRoles([]);
      setModuleAccessAuthoritative(false);
      setModuleRpcStatus("idle");
      setModuleAccessLoading(false);
      setError(null);
      setLoading(false);
      return;
    }

    if (!user?.id || !session) {
      setOrganizations([]);
      setCurrentOrganizationIdState(null);
      setCurrentTeamId(null);
      setModuleRoles([]);
      setModuleAccessAuthoritative(false);
      setModuleRpcStatus("idle");
      setModuleAccessLoading(false);
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
      setModuleRoles([]);
      setModuleAccessAuthoritative(false);
      setModuleRpcStatus("error");
      setModuleAccessLoading(false);
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

      if (selected) {
        localStorage.setItem(STORAGE_KEY, selected);
        if (current !== selected) {
          setModuleRoles([]);
          setModuleAccessAuthoritative(false);
          setModuleRpcStatus("idle");
          setModuleAccessLoading(true);
        }
      } else {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem("selectedTeamId");
        setCurrentTeamId(null);
        setModuleRoles([]);
        setModuleAccessAuthoritative(false);
        setModuleRpcStatus("idle");
        setModuleAccessLoading(false);
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

  const refreshModuleAccess = useCallback(
    async (organizationId?: string | null) => {
      const targetOrganizationId =
        organizationId === undefined
          ? currentOrganizationId
          : organizationId;

      if (
        !ORGANIZATION_TENANCY_ENABLED ||
        !session ||
        !targetOrganizationId
      ) {
        setModuleRoles([]);
        setModuleAccessAuthoritative(false);
        setModuleRpcStatus("idle");
        setModuleAccessLoading(false);
        return;
      }

      setModuleAccessLoading(true);
      const allowLegacyFallback = await refreshLegacyFallbackFlag();

      const { data, error: moduleError } = await (supabase as any).rpc(
        "get_my_organization_module_roles",
        { p_org_id: targetOrganizationId },
      );

      if (moduleError) {
        if (isOrganizationModuleRpcUnavailable(moduleError)) {
          if (allowLegacyFallback) {
            console.warn(
              "[OrganizationContext] fallback legado usado porque o RPC organizacional de modulos esta indisponivel.",
            );
          }
          setModuleRoles([]);
          setModuleAccessAuthoritative(!allowLegacyFallback);
          setModuleRpcStatus("unavailable");
        } else {
          console.error(
            "[OrganizationContext] get_my_organization_module_roles:",
            moduleError,
          );
          setModuleRoles([]);
          setModuleAccessAuthoritative(!allowLegacyFallback);
          setModuleRpcStatus("error");
        }
        if (!allowLegacyFallback) setCurrentTeamId(null);
        setModuleAccessLoading(false);
        return;
      }

      setModuleRoles(
        ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
          module: String(row.module),
          roleName: String(row.role_name ?? "member"),
        })),
      );
      setModuleAccessAuthoritative(true);
      setModuleRpcStatus("success");
      setModuleAccessLoading(false);
    },
    [
      currentOrganizationId,
      refreshLegacyFallbackFlag,
      session,
      setCurrentTeamId,
    ],
  );

  useEffect(() => {
    void refreshOrganizations();
  }, [refreshOrganizations]);

  useEffect(() => {
    if (!ORGANIZATION_TENANCY_ENABLED || !session) return;

    if (!currentOrganizationId) {
      setCurrentTeamId(null);
      setModuleRoles([]);
      setModuleAccessAuthoritative(false);
      setModuleRpcStatus("idle");
      setModuleAccessLoading(false);
      return;
    }

    void Promise.all([
      refreshTeams(undefined, currentOrganizationId),
      refreshModuleAccess(currentOrganizationId),
    ]);
  }, [
    currentOrganizationId,
    refreshModuleAccess,
    refreshTeams,
    session,
    setCurrentTeamId,
  ]);

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

  const hasModuleAccess = useCallback(
    (module: string) => {
      const decision = resolveOrganizationPermissionAuthority({
        tenancyEnabled: ORGANIZATION_TENANCY_ENABLED,
        legacyFallbackEnabled,
        rpcStatus: moduleRpcStatus,
        isPlatformAdmin,
        module,
        moduleRoles,
        legacyHasAccess: hasLegacyModuleAccess(module),
        legacyRoleName: getLegacyModuleRole(module),
      });

      if (decision.shouldWarnLegacyFallback) {
        console.warn(
          "[OrganizationContext] fallback legado usado para autorizacao de modulo.",
          { module },
        );
      }

      return decision.hasAccess;
    }, [
      getLegacyModuleRole,
      hasLegacyModuleAccess,
      isPlatformAdmin,
      legacyFallbackEnabled,
      moduleAccessAuthoritative,
      moduleRpcStatus,
      moduleRoles,
    ],
  );

  const getModuleRole = useCallback(
    (module: string) => {
      const decision = resolveOrganizationPermissionAuthority({
        tenancyEnabled: ORGANIZATION_TENANCY_ENABLED,
        legacyFallbackEnabled,
        rpcStatus: moduleRpcStatus,
        isPlatformAdmin,
        module,
        moduleRoles,
        legacyHasAccess: hasLegacyModuleAccess(module),
        legacyRoleName: getLegacyModuleRole(module),
      });

      if (decision.shouldWarnLegacyFallback) {
        console.warn(
          "[OrganizationContext] fallback legado usado para papel de modulo.",
          { module },
        );
      }

      return decision.roleName;
    }, [
      getLegacyModuleRole,
      hasLegacyModuleAccess,
      isPlatformAdmin,
      legacyFallbackEnabled,
      moduleAccessAuthoritative,
      moduleRpcStatus,
      moduleRoles,
    ],
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
      moduleRoles,
      moduleAccessLoading,
      hasModuleAccess,
      getModuleRole,
      refreshModuleAccess,
    }),
    [
      accessDecision,
      currentOrganization,
      currentOrganizationId,
      error,
      getModuleRole,
      hasModuleAccess,
      isOrganizationAdmin,
      isPlatformAdmin,
      loading,
      moduleAccessLoading,
      moduleRoles,
      organizations,
      refreshModuleAccess,
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
