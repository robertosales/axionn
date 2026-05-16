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

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  currentTeamId: string | null;
  setCurrentTeamId: (id: string | null) => void;
  teams: { id: string; name: string; module: string }[];
  refreshTeams: () => Promise<void>;
  roles: AppRole[];
  hasPermission: (permission: Permission) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set());
  const [loading, setLoading] = useState(true);
  const [currentTeamId, setCurrentTeamIdState] = useState<string | null>(null);
  const [teams, setTeams] = useState<{ id: string; name: string; module: string }[]>([]);

  // ref para evitar que refreshTeams capture currentTeamId stale no closure
  const currentTeamIdRef = useRef<string | null>(null);

  const setCurrentTeamId = (id: string | null) => {
    currentTeamIdRef.current = id;
    setCurrentTeamIdState(id);
    if (id) {
      localStorage.setItem("selectedTeamId", id);
    } else {
      localStorage.removeItem("selectedTeamId");
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
      if (data) setProfile(data as Profile);
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id);
  };

  const fetchRoles = async (userId: string) => {
    try {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const userRoles = data?.map((r: any) => r.role as AppRole) ?? [];
      setRoles(userRoles);
      const admin = userRoles.includes("admin");
      setIsAdmin(admin);
      const perms = await getPermissionsForRoles(userRoles);
      setPermissions(perms);
      return admin;
    } catch (err) {
      console.error("Error fetching roles:", err);
      return false;
    }
  };

  const refreshTeams = async () => {
    try {
      const { data } = await supabase.from("teams").select("id, name, module");
      const teamList = (data || []) as { id: string; name: string; module: string }[];
      setTeams(teamList);
      // usa a ref para evitar loop: não depende do estado currentTeamId do closure
      if (teamList.length > 0 && !currentTeamIdRef.current) {
        const savedTeamId = localStorage.getItem("selectedTeamId");
        const validSaved = savedTeamId && teamList.some((t) => t.id === savedTeamId);
        const initialTeam = validSaved ? savedTeamId! : teamList[0].id;
        setCurrentTeamId(initialTeam);
      }
    } catch (err) {
      console.error("Error fetching teams:", err);
    }
  };

  const hasPermission = (permission: Permission): boolean => {
    return isAdmin || permissions.has(permission);
  };

  const loadUserData = async (userId: string) => {
    try {
      await Promise.all([fetchProfile(userId), fetchRoles(userId), refreshTeams()]);
    } catch (err) {
      console.error("Error loading user data:", err);
    }
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => {
          loadUserData(session.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setRoles([]);
        setPermissions(new Set());
        setTeams([]);
        setCurrentTeamId(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setRoles([]);
    setPermissions(new Set());
    setTeams([]);
    setCurrentTeamId(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isAdmin,
        loading,
        signOut,
        currentTeamId,
        setCurrentTeamId,
        teams,
        refreshTeams,
        roles,
        hasPermission,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
