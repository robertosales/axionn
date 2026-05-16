import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UserAdmin {
  id: string;          // profiles.id
  user_id: string;     // auth.users id
  display_name: string;
  email: string;
  module_access: string;
  team_id: string | null;   // mantido para compatibilidade com UserFormDialog
  team_name?: string;       // mantido para compatibilidade
  teams: { id: string; name: string }[];  // todos os times via team_members
  is_admin: boolean;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

export function useUsersAdmin() {
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profilesRes, rolesRes, membersRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, user_id, display_name, email, module_access, team_id, must_change_password, is_active, created_at")
          .order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("team_members").select("user_id, teams(id, name)"),
      ]);

      if (profilesRes.error) {
        console.error("[useUsersAdmin] Erro ao buscar profiles:", profilesRes.error);
        setError(`Erro ao buscar usuários: ${profilesRes.error.message}`);
        return;
      }

      const profiles = profilesRes.data || [];
      const roles    = rolesRes.data  || [];
      const members  = membersRes.data || [];

      // Set de admins
      const adminSet = new Set(
        roles.filter((r: any) => r.role === "admin").map((r: any) => r.user_id)
      );

      // Mapa user_id → array de times via team_members
      const teamsMap: Record<string, { id: string; name: string }[]> = {};
      members.forEach((m: any) => {
        if (!m.user_id || !m.teams) return;
        if (!teamsMap[m.user_id]) teamsMap[m.user_id] = [];
        // teams pode ser objeto ou array dependendo do join
        const t = Array.isArray(m.teams) ? m.teams : [m.teams];
        t.forEach((team: any) => {
          if (team?.id && team?.name) teamsMap[m.user_id].push({ id: team.id, name: team.name });
        });
      });

      setUsers(profiles.map((p: any) => ({
        id:                   p.id,
        user_id:              p.user_id,
        display_name:         p.display_name || "",
        email:                p.email || "",
        module_access:        p.module_access || "sala_agil",
        team_id:              p.team_id || null,
        team_name:            undefined,  // descontinuado — usar teams[]
        teams:                teamsMap[p.user_id] || [],
        is_admin:             adminSet.has(p.user_id),
        is_active:            p.is_active ?? true,
        must_change_password: p.must_change_password ?? false,
        created_at:           p.created_at,
      })));
    } catch (err: any) {
      console.error("[useUsersAdmin] Erro inesperado:", err);
      setError("Erro inesperado ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (userId: string, data: {
    display_name?: string;
    module_access?: string;
    team_id?: string | null;
    is_active?: boolean;
  }) => {
    const { error } = await supabase.from("profiles").update(data).eq("user_id", userId);
    if (error) { toast.error("Erro ao atualizar usuário"); return false; }
    toast.success("Usuário atualizado");
    await load();
    return true;
  };

  const toggleAdmin = async (userId: string, isAdmin: boolean) => {
    if (isAdmin) {
      const { error } = await supabase.from("user_roles").upsert({ user_id: userId, role: "admin" });
      if (error) { toast.error("Erro ao promover usuário"); return false; }
      toast.success("Usuário promovido a admin");
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      if (error) { toast.error("Erro ao remover papel admin"); return false; }
      toast.success("Papel admin removido");
    }
    await load();
    return true;
  };

  const toggleActive = async (userId: string, active: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_active: active }).eq("user_id", userId);
    if (error) { toast.error("Erro ao alterar status"); return false; }
    toast.success(active ? "Usuário reativado" : "Usuário desativado");
    await load();
    return true;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { toast.error("Erro ao enviar reset de senha"); return false; }
    toast.success(`Link de reset enviado para ${email}`);
    return true;
  };

  const createUser = async (data: {
    email: string;
    password: string;
    display_name: string;
    module_access: string;
    team_id: string | null;
  }) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { display_name: data.display_name } },
    });
    if (authError || !authData.user) { toast.error("Erro ao criar usuário: " + authError?.message); return false; }

    await supabase.from("profiles").update({
      display_name:         data.display_name,
      module_access:        data.module_access,
      team_id:              data.team_id,
      must_change_password: true,
    }).eq("user_id", authData.user.id);

    // Se informou time, insere em team_members também
    if (data.team_id) {
      await supabase.from("team_members").upsert({
        user_id: authData.user.id,
        team_id: data.team_id,
      });
    }

    toast.success("Usuário criado. Ele deverá trocar a senha no primeiro acesso.");
    await load();
    return true;
  };

  return { users, loading, error, reload: load, update, toggleAdmin, toggleActive, resetPassword, createUser };
}
