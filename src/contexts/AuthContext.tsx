// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { AppRole, Permission, getPermissionsForRoles } from "@/hooks/usePermissions";

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
}

type AuthTeam = { id: string; name: string; module: string };

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  currentTeamId: string | null;
  currentTeam: AuthTeam | null;
  setCurrentTeamId: (id: string | null) => void;
  teams: AuthTeam[];
  refreshTeams: () => Promise<void>;
  roles: AppRole[];
  hasPermission: (permission: Permission) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session,     setSession]     = useState<Session | null>(null);
  const [user,        setUser]        = useState<User | null>(null);
  const [profile,     setProfile]     = useState<Profile | null>(null);
  const [isAdmin,     setIsAdmin]     = useState(false);
  const [roles,       setRoles]       = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set());
  const [loading,     setLoading]     = useState(true);
  const [currentTeamId, setCurrentTeamIdState] = useState<string | null>(null);
  const [teams,       setTeams]       = useState<AuthTeam[]>([]);

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
      .from("profiles")
      .select("id, user_id, display_name, email, avatar_url, module_access, must_change_password, full_name, role")
      .eq("user_id", userId)
      .single();
    if (error) { console.error("[Auth] fetchProfile:", error); return; }
    if (data && mountedRef.current) setProfile(data as Profile);
  };

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id);
  };

  const fetchRoles = async (userId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
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

  const refreshTeams = async (userId?: string) => {
    // Filtra apenas os times do usuário logado via user_team_members
    // Com RLS ativo isso já é garantido, mas o filtro explícito evita
    // trazer times desnecessários em ambientes sem RLS completo.
    const query = supabase
      .from("teams")
      .select("id, name, module");

    // Se user_team_members existir como tabela de junção, usa ela;
    // caso contrário o RLS do Supabase já filtra por usuário.
    const { data, error } = await query;
    if (error) { console.error("[Auth] refreshTeams:", error); return; }
    const teamList = (data ?? []) as AuthTeam[];
    if (!mountedRef.current) return;
    setTeams(teamList);
    if (teamList.length > 0 && !currentTeamIdRef.current) {
      const saved = localStorage.getItem("selectedTeamId");
      const valid = saved && teamList.some(t => t.id === saved);
      setCurrentTeamId(valid ? saved! : teamList[0].id);
    }
  };

  const hasPermission = (permission: Permission) => isAdmin || permissions.has(permission);

  const loadUserData = async (userId: string) => {
    try {
      // Dispara profile + roles + teams em paralelo — nenhum bloqueia o outro
      await Promise.all([
        fetchProfile(userId),
        fetchRoles(userId),
        refreshTeams(userId),
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
    setCurrentTeamId(null);
    localStorage.removeItem("selectedTeamId");
  };

  useEffect(() => {
    let initialised = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mountedRef.current) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadUserData(session.user.id);
      }
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
      currentTeamId, currentTeam: teams.find((t) => t.id === currentTeamId) ?? null,
      setCurrentTeamId, teams, refreshTeams,
      roles, hasPermission, refreshProfile,
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
