// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { AppRole, Permission, getPermissionsForRoles } from "@/hooks/usePermissions";

interface Profile {
  id:                   string;
  user_id:              string;
  display_name:         string;
  email:                string;
  avatar_url:           string | null;
  module_access:        string;   // legado — mantido para fallback
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session,       setSession]       = useState<Session | null>(null);
  const [user,          setUser]          = useState<User | null>(null);
  const [profile,       setProfile]       = useState<Profile | null>(null);
  const [isAdmin,       setIsAdmin]       = useState(false);
  const [roles,         setRoles]         = useState<AppRole[]>([]);
  const [permissions,   setPermissions]   = useState<Set<Permission>>(new Set());
  const [loading,       setLoading]       = useState(true);
  const [currentTeamId, setCurrentTeamIdState] = useState<string | null>(null);
  const [teams,         setTeams]         = useState<AuthTeam[]>([]);
  const [moduleRoles,   setModuleRoles]   = useState<UserModuleRole[]>([]);

  const currentTeamIdRef = useRef<string | null>(null);
  const mountedRef       = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
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

  // ─── refreshTeams via team_modules (N:N) ──────────────────────────────────
  // Cada linha de team_modules gera um AuthTeam { id, name, module }.
  // Um mesmo time pode aparecer múltiplas vezes — uma por módulo associado.
  // Isso permite que TeamSwitcher filtre por module sem gambiarras.
  const refreshTeams = async () => {
    const { data, error } = await supabase
      .from("team_modules")
      .select("module, team:team_id(id, name)");

    if (error) { console.error("[Auth] refreshTeams:", error); return; }

    const teamList: AuthTeam[] = (data ?? []).flatMap((row: any) => {
      if (!row.team) return [];
      return [{ id: row.team.id, name: row.team.name, module: row.module }];
    });

    if (!mountedRef.current) return;
    setTeams(teamList);

    if (teamList.length > 0 && !currentTeamIdRef.current) {
      const saved = localStorage.getItem("selectedTeamId");
      const valid = saved && teamList.some(t => t.id === saved);
      setCurrentTeamId(valid ? saved! : teamList[0].id);
    }
  };

  const hasPermission = (permission: Permission) => isAdmin || permissions.has(permission);

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
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    resetAuthState();
  };

  return (
    <AuthContext.Provider value={{
      session, user, profile, isAdmin, loading, signOut,
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
