// src/contexts/AuthContext.tsx
/**
 * F4-fix: resolução eager de currentTeamId no boot
 *
 * fix(teams-dedup-v2): o dedup anterior usava team.id como chave única,
 *   descartando linhas com módulos distintos para o mesmo time.
 *   Isso fazia SustentacaoPage.teams.filter(t => t.module === 'sustentacao')
 *   retornar [] quando a primeira ocorrência do time era de outro módulo
 *   (ex: sala_agil), resultando em currentTeamId=null e board sem cards.
 *
 *   CORRIGIDO: dedup agora usa `${id}::${module}` como chave, preservando
 *   uma entrada por (time × módulo). O dedup ainda evita linhas 100%
 *   duplicadas (mesmo id E mesmo module), que podem ocorrer se team_modules
 *   tiver entradas repetidas.
 */
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { AppRole, Permission, getPermissionsForRoles } from "@/hooks/usePermissions";
import { toast } from "sonner";

interface Profile {
  id:                   string;
  user_id:              string;
  display_name:         string;
  email:                string;
  avatar_url:           string | null;
  module_access:        string;
  must_change_password?: boolean;
  full_name?:           string;
  role?:                string;
}

interface UserModuleRole {
  module:    string;
  role_name: string;
}

type AuthTeam = { id: string; name: string; module: string };

interface AuthContextType {
  session:           Session | null;
  user:              User | null;
  profile:           Profile | null;
  isAdmin:           boolean;
  loading:           boolean;
  isSigningOut:      boolean;
  signOut:           () => Promise<void>;
  currentTeamId:     string | null;
  currentTeam:       AuthTeam | null;
  setCurrentTeamId:  (id: string | null) => void;
  teams:             AuthTeam[];
  refreshTeams:      () => Promise<void>;
  roles:             AppRole[];
  hasPermission:     (permission: Permission) => boolean;
  refreshProfile:    () => Promise<void>;
  moduleRoles:       UserModuleRole[];
  hasModuleAccess:   (module: string) => boolean;
  getModuleRole:     (module: string) => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function auditLog(
  event: "SIGNOUT_INITIATED" | "SIGNOUT_REMOTE_SUCCESS" | "SIGNOUT_REMOTE_FAILED" | "SIGNOUT_LOCAL_CLEARED",
  meta: Record<string, unknown> = {},
) {
  console.info("[Auth:Audit]", event, { timestamp: new Date().toISOString(), ...meta });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session,       setSession]       = useState<Session | null>(null);
  const [user,          setUser]          = useState<User | null>(null);
  const [profile,       setProfile]       = useState<Profile | null>(null);
  const [isAdmin,       setIsAdmin]       = useState(false);
  const [roles,         setRoles]         = useState<AppRole[]>([]);
  const [permissions,   setPermissions]   = useState<Set<Permission>>(new Set());
  const [loading,       setLoading]       = useState(true);
  const [isSigningOut,  setIsSigningOut]  = useState(false);
  const [currentTeamId, setCurrentTeamIdState] = useState<string | null>(null);
  const [teams,         setTeams]         = useState<AuthTeam[]>([]);
  const [moduleRoles,   setModuleRoles]   = useState<UserModuleRole[]>([]);

  const currentTeamIdRef = useRef<string | null>(null);
  const mountedRef       = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // F4-fix: boot-sync — pré-popula currentTeamIdRef a partir do localStorage
  useEffect(() => {
    const saved = localStorage.getItem("selectedTeamId");
    if (saved && !currentTeamIdRef.current) {
      currentTeamIdRef.current = saved;
      setCurrentTeamIdState(saved);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCurrentTeamId = (id: string | null) => {
    currentTeamIdRef.current = id;
    setCurrentTeamIdState(id);
    if (id) localStorage.setItem("selectedTeamId", id);
    else     localStorage.removeItem("selectedTeamId");
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles").select("*").eq("user_id", userId).single();
    if (error) { console.error("[Auth] fetchProfile:", error); return; }
    if (data && mountedRef.current) setProfile(data as Profile);
  };

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id);
  };

  const fetchRoles = async (userId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    if (error) { console.error("[Auth] fetchRoles:", error); return false; }
    const userRoles = (data ?? []).map((r: any) => r.role as AppRole);
    const admin     = userRoles.includes("admin");
    if (!mountedRef.current) return admin;
    setRoles(userRoles);
    setIsAdmin(admin);
    try {
      const perms = await getPermissionsForRoles(userRoles);
      if (mountedRef.current) setPermissions(perms);
    } catch (e) {
      console.error("[Auth] getPermissionsForRoles:", e);
    }
    return admin;
  };

  const fetchModuleRoles = async (userId: string, profileData?: Profile) => {
    const { data, error } = await supabase
      .from("user_module_roles")
      .select("module, role_name")
      .eq("user_id", userId);

    if (error || !data || data.length === 0) {
      const moduleAccess = profileData?.module_access || "sala_agil";
      const fallback: UserModuleRole[] =
        moduleAccess === "admin"
          ? [
              { module: "sala_agil",   role_name: "admin" },
              { module: "sustentacao", role_name: "admin" },
              { module: "rdm",         role_name: "admin" },
            ]
          : [{ module: moduleAccess, role_name: "member" }];
      if (mountedRef.current) setModuleRoles(fallback);
      return;
    }
    if (mountedRef.current)
      setModuleRoles(data.map((r: any) => ({ module: r.module, role_name: r.role_name })));
  };

  const refreshTeams = async () => {
    const { data, error } = await supabase
      .from("team_modules")
      .select("module, team:team_id(id, name)");

    if (error) { console.error("[Auth] refreshTeams:", error); return; }

    const rawList: AuthTeam[] = (data ?? []).flatMap((row: any) => {
      if (!row.team) return [];
      return [{ id: row.team.id, name: row.team.name, module: row.module }];
    });

    // fix(teams-dedup-v2): dedup por (id × module) — preserva uma entrada
    // por combinação única de time+módulo. Isso garante que
    // teams.filter(t => t.module === 'sustentacao') nunca retorne []
    // quando o time também pertence a outros módulos.
    const seen = new Set<string>();
    const teamList = rawList.filter(t => {
      const key = `${t.id}::${t.module}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (!mountedRef.current) return;
    setTeams(teamList);

    const saved          = localStorage.getItem("selectedTeamId");
    const savedIsValid   = saved && teamList.some(t => t.id === saved);
    const alreadyHasTeam = !!currentTeamIdRef.current &&
                           teamList.some(t => t.id === currentTeamIdRef.current);

    if (alreadyHasTeam) return;

    if (savedIsValid) {
      setCurrentTeamId(saved!);
    } else {
      if (saved) {
        localStorage.removeItem("selectedTeamId");
        console.warn("[Auth] selectedTeamId inválido removido do localStorage:", saved);
      }
    }
  };

  const hasPermission   = (permission: Permission) => isAdmin || permissions.has(permission);
  const hasModuleAccess = (module: string): boolean => {
    if (isAdmin) return true;
    return moduleRoles.some(mr => mr.module === module);
  };
  const getModuleRole = (module: string): string | null =>
    moduleRoles.find(mr => mr.module === module)?.role_name ?? null;

  const loadUserData = async (userId: string) => {
    try {
      const { data: profileData } = await supabase
        .from("profiles").select("*").eq("user_id", userId).single();

      if (profileData && profileData.is_active === false) {
        console.warn("[Auth] Bloqueio: Usuário inativo detectado.");
        await forceLocalClear();
        return;
      }

      if (profileData && mountedRef.current) setProfile(profileData as Profile);

      await Promise.all([
        fetchRoles(userId),
        refreshTeams(),
        fetchModuleRoles(userId, profileData as Profile),
      ]);
    } catch (err) {
      console.error("[Auth] loadUserData:", err);
    }
  };

  const forceLocalClear = () => {
    localStorage.removeItem("selectedTeamId");
    try {
      const keysToRemove = Object.keys(localStorage).filter(
        (k) => k.startsWith("sb-") || k.startsWith("supabase."),
      );
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn("[Auth] forceLocalClear: erro ao limpar localStorage:", e);
    }
    if (!mountedRef.current) return;
    setProfile(null);
    setIsAdmin(false);
    setRoles([]);
    setPermissions(new Set());
    setTeams([]);
    setModuleRoles([]);
    setCurrentTeamId(null);
    setSession(null);
    setUser(null);
  };

  const resetAuthState = () => {
    if (!mountedRef.current) return;
    setProfile(null);
    setIsAdmin(false);
    setRoles([]);
    setPermissions(new Set());
    setTeams([]);
    setModuleRoles([]);
    setCurrentTeamId(null);
    localStorage.removeItem("selectedTeamId");
  };

  useEffect(() => {
    let initialised = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mountedRef.current) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await loadUserData(session.user.id);
      if (mountedRef.current) setLoading(false);
      initialised = true;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          if (!initialised) return;
          await loadUserData(session.user.id);
        } else {
          resetAuthState();
        }
        if (mountedRef.current && initialised) setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    const currentToken   = session?.access_token;
    const tokenExpiresAt = session?.expires_at;

    auditLog("SIGNOUT_INITIATED", { userId: user?.id, email: user?.email, hasToken: !!currentToken, tokenExpiresAt });

    let remoteSuccess = false;
    try {
      const TIMEOUT_MS = 5_000;
      await Promise.race([
        supabase.auth.signOut(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timeout_${TIMEOUT_MS}ms`)), TIMEOUT_MS)),
      ]);
      remoteSuccess = true;
      auditLog("SIGNOUT_REMOTE_SUCCESS", { userId: user?.id });
    } catch (err: any) {
      const reason = err?.message ?? String(err);
      auditLog("SIGNOUT_REMOTE_FAILED", { userId: user?.id, reason, tokenState: currentToken ? "present" : "absent" });
      console.error("[Auth] signOut falhou — aplicando fallback local:", reason);
    } finally {
      forceLocalClear();
      auditLog("SIGNOUT_LOCAL_CLEARED", { userId: user?.id, remoteSuccess });
      if (mountedRef.current) setIsSigningOut(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      session, user, profile, isAdmin, loading, isSigningOut, signOut,
      currentTeamId,
      currentTeam: teams.find((t) => t.id === currentTeamId) ?? null,
      setCurrentTeamId, teams, refreshTeams,
      roles, hasPermission, refreshProfile,
      moduleRoles, hasModuleAccess, getModuleRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
