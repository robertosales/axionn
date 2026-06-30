import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  getPermissionsForRoles,
  type AppRole,
  type Permission,
} from "@/hooks/usePermissions";
import { ORGANIZATION_TENANCY_ENABLED } from "@/lib/featureFlags";
import {
  chooseCurrentTeamId,
  deduplicateTeams,
  type AuthTeam,
} from "@/contexts/authTeams";

interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  module_access: string;
  must_change_password?: boolean;
  full_name?: string;
  role?: string;
  is_active?: boolean;
}

interface UserModuleRole {
  module: string;
  role_name: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  isLegacyAdmin: boolean;
  loading: boolean;
  isSigningOut: boolean;
  signOut: () => Promise<void>;
  currentTeamId: string | null;
  currentTeam: AuthTeam | null;
  setCurrentTeamId: (id: string | null) => void;
  teams: AuthTeam[];
  refreshTeams: (
    profileData?: Profile,
    organizationId?: string | null,
  ) => Promise<void>;
  roles: AppRole[];
  hasPermission: (permission: Permission) => boolean;
  refreshProfile: () => Promise<void>;
  moduleRoles: UserModuleRole[];
  hasModuleAccess: (module: string) => boolean;
  getModuleRole: (module: string) => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function auditLog(
  event:
    | "SIGNOUT_INITIATED"
    | "SIGNOUT_REMOTE_SUCCESS"
    | "SIGNOUT_REMOTE_FAILED"
    | "SIGNOUT_LOCAL_CLEARED",
  meta: Record<string, unknown> = {},
) {
  console.info("[Auth:Audit]", event, {
    timestamp: new Date().toISOString(),
    ...meta,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLegacyAdmin, setIsLegacyAdmin] = useState(false);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [currentTeamId, setCurrentTeamIdState] = useState<string | null>(null);
  const [teams, setTeams] = useState<AuthTeam[]>([]);
  const [moduleRoles, setModuleRoles] = useState<UserModuleRole[]>([]);

  const currentTeamIdRef = useRef<string | null>(null);
  const profileRef = useRef<Profile | null>(null);
  const effectiveAdminRef = useRef(false);
  const legacyAdminRef = useRef(false);
  const mountedRef = useRef(true);
  const loadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("selectedTeamId");
    if (saved && !currentTeamIdRef.current) {
      currentTeamIdRef.current = saved;
      setCurrentTeamIdState(saved);
    }
  }, []);

  const setCurrentTeamId = useCallback((id: string | null) => {
    currentTeamIdRef.current = id;
    setCurrentTeamIdState(id);
    if (id) localStorage.setItem("selectedTeamId", id);
    else localStorage.removeItem("selectedTeamId");
  }, []);

  const clearUserState = useCallback(() => {
    localStorage.removeItem("selectedTeamId");
    localStorage.removeItem("selectedOrganizationId");

    if (!mountedRef.current) return;
    profileRef.current = null;
    effectiveAdminRef.current = false;
    legacyAdminRef.current = false;
    setProfile(null);
    setIsAdmin(false);
    setIsPlatformAdmin(false);
    setIsLegacyAdmin(false);
    setRoles([]);
    setPermissions(new Set());
    setTeams([]);
    setModuleRoles([]);
    setCurrentTeamId(null);
  }, [setCurrentTeamId]);

  const forceLocalClear = useCallback(() => {
    try {
      const keysToRemove = Object.keys(localStorage).filter(
        (key) => key.startsWith("sb-") || key.startsWith("supabase."),
      );
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.warn("[Auth] forceLocalClear: erro ao limpar localStorage:", error);
    }

    clearUserState();
    if (!mountedRef.current) return;
    setSession(null);
    setUser(null);
  }, [clearUserState]);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("[Auth] fetchProfile:", error);
      return null;
    }

    const nextProfile = data as Profile;
    profileRef.current = nextProfile;
    if (mountedRef.current) setProfile(nextProfile);
    return nextProfile;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) await fetchProfile(user.id);
  }, [fetchProfile, user?.id]);

  const fetchRoles = useCallback(async (userId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) {
      console.error("[Auth] fetchRoles:", error);
      return false;
    }

    const userRoles = (data ?? []).map(
      (roleRow: { role: string }) => roleRow.role as AppRole,
    );
    const legacyAdmin = userRoles.includes("admin");
    let platformAdmin = false;

    if (ORGANIZATION_TENANCY_ENABLED) {
      const { data: platformAccess, error: platformError } = await supabase.rpc(
        "is_platform_admin",
      );

      if (platformError) {
        console.error("[Auth] is_platform_admin:", platformError);
      } else {
        platformAdmin = platformAccess === true;
      }
    }

    const effectiveAdmin = ORGANIZATION_TENANCY_ENABLED
      ? platformAdmin
      : legacyAdmin;

    legacyAdminRef.current = legacyAdmin;
    effectiveAdminRef.current = effectiveAdmin;

    if (!mountedRef.current) return effectiveAdmin;

    setRoles(userRoles);
    setIsLegacyAdmin(legacyAdmin);
    setIsPlatformAdmin(platformAdmin);
    setIsAdmin(effectiveAdmin);

    try {
      const rolePermissions = await getPermissionsForRoles(userRoles);
      if (mountedRef.current) setPermissions(rolePermissions);
    } catch (permissionError) {
      console.error("[Auth] getPermissionsForRoles:", permissionError);
    }

    return effectiveAdmin;
  }, []);

  const fetchModuleRoles = useCallback(
    async (userId: string, profileData?: Profile) => {
      const { data, error } = await supabase
        .from("user_module_roles")
        .select("module, role_name")
        .eq("user_id", userId);

      if (error || !data || data.length === 0) {
        const moduleAccess = profileData?.module_access || "sala_agil";
        const fallback: UserModuleRole[] =
          moduleAccess === "admin"
            ? [
                { module: "sala_agil", role_name: "admin" },
                { module: "sustentacao", role_name: "admin" },
                { module: "rdm", role_name: "admin" },
              ]
            : [{ module: moduleAccess, role_name: "member" }];

        if (mountedRef.current) setModuleRoles(fallback);
        return;
      }

      if (mountedRef.current) {
        setModuleRoles(
          data.map((roleRow: { module: string; role_name: string }) => ({
            module: roleRow.module,
            role_name: roleRow.role_name,
          })),
        );
      }
    },
    [],
  );

  const refreshTeams = useCallback(
    async (profileData?: Profile, organizationId?: string | null) => {
      const effectiveProfile = profileData ?? profileRef.current ?? undefined;
      let rawList: AuthTeam[] = [];

      if (ORGANIZATION_TENANCY_ENABLED) {
        if (!organizationId) {
          if (mountedRef.current) setTeams([]);
          setCurrentTeamId(null);
          return;
        }

        const { data, error } = await supabase.rpc(
          "get_accessible_teams_v2",
          { p_org_id: organizationId },
        );

        if (error) {
          console.error("[Auth] get_accessible_teams_v2:", error);
          if (mountedRef.current) setTeams([]);
          setCurrentTeamId(null);
          return;
        }

        rawList = ((data ?? []) as Array<Record<string, unknown>>).map(
          (team) => ({
            id: String(team.id),
            name: String(team.name ?? "Time"),
            module: String(team.module ?? ""),
            organizationId: String(team.org_id ?? organizationId),
          }),
        );
      } else if (legacyAdminRef.current) {
        const { data, error } = await supabase
          .from("teams")
          .select("id, name, module");

        if (error) {
          console.error("[Auth] refreshTeams(admin):", error);
          return;
        }

        rawList = (data ?? []).map(
          (team: { id: string; name: string; module: string | null }) => ({
            id: team.id,
            name: team.name,
            module: team.module ?? "",
            organizationId: null,
          }),
        );
      } else {
        const { data, error } = await supabase
          .from("team_members")
          .select("team:team_id(id, name, module)");

        if (error) {
          console.error("[Auth] refreshTeams:", error);
          return;
        }

        rawList = (data ?? []).flatMap(
          (row: {
            team:
              | { id: string; name: string; module: string | null }
              | null;
          }) => {
            if (!row.team) return [];
            return [
              {
                id: row.team.id,
                name: row.team.name,
                module: row.team.module ?? "",
                organizationId: null,
              },
            ];
          },
        );
      }

      const teamList = deduplicateTeams(rawList);
      if (!mountedRef.current) return;
      setTeams(teamList);

      const canUseAnyModule =
        effectiveAdminRef.current || effectiveProfile?.module_access === "admin";
      const activeModule = canUseAnyModule
        ? null
        : effectiveProfile?.module_access ?? "sala_agil";
      const savedTeamId = localStorage.getItem("selectedTeamId");
      const selectedTeamId = chooseCurrentTeamId({
        teams: teamList,
        currentTeamId: currentTeamIdRef.current,
        savedTeamId,
        activeModule,
      });

      if (savedTeamId && savedTeamId !== selectedTeamId) {
        console.warn(
          "[Auth] selectedTeamId fora do contexto atual — seleção removida:",
          savedTeamId,
        );
      }

      setCurrentTeamId(selectedTeamId);
    },
    [setCurrentTeamId],
  );

  const loadUserData = useCallback(
    async (userId: string) => {
      try {
        const profileData = await fetchProfile(userId);

        if (profileData?.is_active === false) {
          console.warn("[Auth] Bloqueio: usuário inativo detectado.");
          forceLocalClear();
          return;
        }

        await fetchRoles(userId);
        await fetchModuleRoles(userId, profileData ?? undefined);

        if (!ORGANIZATION_TENANCY_ENABLED) {
          await refreshTeams(profileData ?? undefined);
        }
      } catch (error) {
        console.error("[Auth] loadUserData:", error);
      }
    },
    [
      fetchModuleRoles,
      fetchProfile,
      fetchRoles,
      forceLocalClear,
      refreshTeams,
    ],
  );

  useEffect(() => {
    let initialised = false;

    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mountedRef.current) return;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await loadUserData(session.user.id);
        loadedUserIdRef.current = session.user.id;
      }

      if (mountedRef.current) setLoading(false);
      initialised = true;
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mountedRef.current) return;

      if (nextSession?.user) {
        if (!initialised) return;
        const userId = nextSession.user.id;
        if (loadedUserIdRef.current === userId) return;

        setSession(nextSession);
        setUser(nextSession.user);
        setLoading(true);

        setTimeout(() => {
          void loadUserData(userId).finally(() => {
            loadedUserIdRef.current = userId;
            if (mountedRef.current) setLoading(false);
          });
        }, 0);
      } else if (event === "SIGNED_OUT") {
        loadedUserIdRef.current = null;
        setSession(null);
        setUser(null);
        clearUserState();
        if (mountedRef.current && initialised) setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [clearUserState, loadUserData]);

  const signOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    const currentToken = session?.access_token;
    const tokenExpiresAt = session?.expires_at;

    auditLog("SIGNOUT_INITIATED", {
      userId: user?.id,
      email: user?.email,
      hasToken: Boolean(currentToken),
      tokenExpiresAt,
    });

    let remoteSuccess = false;
    try {
      const timeoutMs = 5_000;
      await Promise.race([
        supabase.auth.signOut(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`timeout_${timeoutMs}ms`)), timeoutMs),
        ),
      ]);
      remoteSuccess = true;
      auditLog("SIGNOUT_REMOTE_SUCCESS", { userId: user?.id });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      auditLog("SIGNOUT_REMOTE_FAILED", {
        userId: user?.id,
        reason,
        tokenState: currentToken ? "present" : "absent",
      });
      console.error(
        "[Auth] signOut falhou — aplicando fallback local:",
        reason,
      );
    } finally {
      forceLocalClear();
      auditLog("SIGNOUT_LOCAL_CLEARED", {
        userId: user?.id,
        remoteSuccess,
      });
      if (mountedRef.current) setIsSigningOut(false);
    }
  };

  const hasPermission = (permission: Permission) =>
    isAdmin || permissions.has(permission);

  const hasModuleAccess = (module: string) => {
    if (isAdmin) return true;
    return moduleRoles.some((moduleRole) => moduleRole.module === module);
  };

  const getModuleRole = (module: string) =>
    moduleRoles.find((moduleRole) => moduleRole.module === module)?.role_name ??
    null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isAdmin,
        isPlatformAdmin,
        isLegacyAdmin,
        loading,
        isSigningOut,
        signOut,
        currentTeamId,
        currentTeam:
          teams.find((team) => team.id === currentTeamId) ?? null,
        setCurrentTeamId,
        teams,
        refreshTeams,
        roles,
        hasPermission,
        refreshProfile,
        moduleRoles,
        hasModuleAccess,
        getModuleRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
