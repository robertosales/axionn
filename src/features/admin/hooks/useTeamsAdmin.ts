import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { resolveContractTeamIds, compareTeamNames } from "../lib/resolveContractTeamIds";

export interface TeamAdmin {
  id: string;
  name: string;
  module: string;
  created_at: string;
  memberCount?: number;
}

/**
 * contractId: quando fornecido, retorna apenas os times que possuem
 * ao menos um projeto vinculado a esse contrato.
 * null = todos os times (sem filtro).
 */
export function useTeamsAdmin(contractId?: string | null) {
  const { refreshTeams } = useAuth();
  const [teams,   setTeams]   = useState<TeamAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Times do contrato: união entre teams.contract_id e projects.contract_id
      const teamIds = await resolveContractTeamIds(contractId);
      if (teamIds !== null && teamIds.length === 0) {
        setTeams([]); setLoading(false); return;
      }

      let query = supabase
        .from("teams")
        .select("id, name, module, created_at")
        .order("name", { ascending: true });

      if (teamIds) query = query.in("id", teamIds);

      const { data: teamsData } = await query;
      const teamList = ((teamsData || []) as TeamAdmin[])
        .slice()
        .sort((a, b) => compareTeamNames(a.name, b.name));

      const { data: membersData } = await supabase
        .from("team_members")
        .select("team_id");

      const countMap: Record<string, number> = {};
      (membersData || []).forEach((m: any) => {
        if (m.team_id) countMap[m.team_id] = (countMap[m.team_id] ?? 0) + 1;
      });

      setTeams(teamList.map(t => ({ ...t, memberCount: countMap[t.id] ?? 0 })));
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  const create = async (data: { name: string; module: string }) => {
    const { error } = await supabase.from("teams").insert(data);
    if (error) { toast.error("Erro ao criar time"); return false; }
    toast.success("Time criado com sucesso");
    await load(); await refreshTeams(); return true;
  };

  const update = async (id: string, data: { name?: string; module?: string }) => {
    const { error } = await supabase.from("teams").update(data).eq("id", id);
    if (error) { toast.error("Erro ao atualizar time"); return false; }
    toast.success("Time atualizado");
    await load(); await refreshTeams(); return true;
  };

  const remove = async (id: string) => {
    const [{ count: huCount }, { count: demCount }] = await Promise.all([
      supabase.from("user_stories").select("id", { count: "exact", head: true }).eq("team_id", id),
      supabase.from("demandas").select("id", { count: "exact", head: true }).eq("team_id", id),
    ]);
    if ((huCount ?? 0) > 0 || (demCount ?? 0) > 0) {
      toast.error("Não é possível excluir: time possui dados ativos (HUs ou demandas)");
      return false;
    }
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir time"); return false; }
    toast.success("Time excluído");
    await load(); await refreshTeams(); return true;
  };

  return { teams, loading, reload: load, create, update, remove };
}
