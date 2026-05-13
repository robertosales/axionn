import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UserAdmin {
  id: string;          // profiles.id
  user_id: string;     // auth.users id
  display_name: string;
  email: string;
  module_access: string;
  team_id: string | null;
  team_name?: string;
  is_admin: boolean;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

export function useUsersAdmin() {
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: profiles }, { data: roles }, { data: teams }] = await Promise.all([
        supabase.from("profiles").select("id, user_id, display_name, email, module_access, team_id, must_change_password, is_active, created_at").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("teams").select("id, name"),
      ]);

      const adminSet = new Set(
        (roles || []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id)
      );
      const teamMap: Record<string, string> = {};
      (teams || []).forEach((t: any) => { teamMap[t.id] = t.name; });

      setUsers((profiles || []).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        display_name: p.display_name || "",
        email: p.email || "",
        module_access: p.module_access || "sala_agil",
        team_id: p.team_id || null,
        team_name: p.team_id ? teamMap[p.team_id] : undefined,
        is_admin: adminSet.has(p.user_id),
        is_active: p.is_active ?? true,
        must_change_password: p.must_change_password ?? false,
        created_at: p.created_at,
      })));
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
      // Promover
      const { error } = await supabase.from("user_roles").upsert({ user_id: userId, role: "admin" });
      if (error) { toast.error("Erro ao promover usuário"); return false; }
      toast.success("Usuário promovido a admin");
    } else {
      // Remover admin
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
    // Cria via Supabase Auth signup (admin usa service role em produção)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { display_name: data.display_name } },
    });
    if (authError || !authData.user) { toast.error("Erro ao criar usuário: " + authError?.message); return false; }

    // Atualiza profile com team_id, module_access e força troca de senha
    await supabase.from("profiles").update({
      display_name: data.display_name,
      module_access: data.module_access,
      team_id: data.team_id,
      must_change_password: true,
    }).eq("user_id", authData.user.id);

    toast.success("Usuário criado. Ele deverá trocar a senha no primeiro acesso.");
    await load();
    return true;
  };

  return { users, loading, reload: load, update, toggleAdmin, toggleActive, resetPassword, createUser };
}
