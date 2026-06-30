import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  resolveContractTeamIds,
  compareTeamNames,
} from "../lib/resolveContractTeamIds";

export interface TeamAdmin {
  id: string;
  name: string;
  module: string;
  company_id: string | null;
  created_at: string;
  org_id?: string | null;
  memberCount?: number;
}

export interface TeamFormValues {
  name: string;
  module: string;
  company_id: string | null;
}

export function useTeamsAdmin(contractId?: string | null) {
  const { refreshTeams } = useAuth();
  const { enabled, currentOrganizationId, canOperate } = useOrganization();
  const [teams, setTeams] = useState<TeamAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const contractTeamIds = await resolveContractTeamIds(contractId);
      if (contractTeamIds !== null && contractTeamIds.length === 0) {
        setTeams([]);
        return;
      }

      let teamList: TeamAdmin[] = [];

      if (enabled) {
        if (!currentOrganizationId) {
          setTeams([]);
          return;
        }

        const { data, error } = await supabase.rpc(
          "get_accessible_teams_v2",
          { p_org_id: currentOrganizationId },
        );
        if (error) throw error;

        const allowedIds = contractTeamIds
          ? new Set(contractTeamIds)
          : null;
        teamList = ((data ?? []) as Array<Record<string, unknown>>)
          .filter((team) => !allowedIds || allowedIds.has(String(team.id)))
          .map((team) => ({
            id: String(team.id),
            name: String(team.name ?? "Time"),
            module: String(team.module ?? ""),
            company_id: null,
            created_at: "",
            org_id: String(team.org_id ?? currentOrganizationId),
          }));
      } else {
        let query = supabase
          .from("teams")
          .select("id, name, module, company_id, created_at")
          .order("name", { ascending: true });

        if (contractTeamIds) query = query.in("id", contractTeamIds);

        const { data, error } = await query;
        if (error) throw error;
        teamList = ((data ?? []) as TeamAdmin[]).slice();
      }

      teamList.sort((a, b) => compareTeamNames(a.name, b.name));

      const teamIds = teamList.map((team) => team.id);
      const countMap: Record<string, number> = {};
      if (teamIds.length > 0) {
        const { data: membersData, error: membersError } = await supabase
          .from("team_members")
          .select("team_id")
          .in("team_id", teamIds);
        if (membersError) throw membersError;

        (membersData ?? []).forEach((member: { team_id: string | null }) => {
          if (member.team_id) {
            countMap[member.team_id] = (countMap[member.team_id] ?? 0) + 1;
          }
        });
      }

      setTeams(
        teamList.map((team) => ({
          ...team,
          memberCount: countMap[team.id] ?? 0,
        })),
      );
    } catch (error) {
      console.error("[useTeamsAdmin] load:", error);
      setTeams([]);
      toast.error("Não foi possível carregar os times desta organização");
    } finally {
      setLoading(false);
    }
  }, [contractId, currentOrganizationId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const canWrite = () => {
    if (!enabled) return true;
    if (!currentOrganizationId || !canOperate) {
      toast.error("A organização atual não permite alterações");
      return false;
    }
    return true;
  };

  const refreshAuthTeams = async () => {
    await refreshTeams(
      undefined,
      enabled ? currentOrganizationId : undefined,
    );
  };

  const create = async (data: TeamFormValues) => {
    if (!canWrite()) return false;

    const payload = {
      name: data.name,
      module: data.module,
      ...(data.company_id ? { company_id: data.company_id } : {}),
      ...(enabled && currentOrganizationId
        ? { org_id: currentOrganizationId }
        : {}),
    };
    const { error } = await supabase.from("teams").insert(payload);
    if (error) {
      toast.error("Erro ao criar time");
      return false;
    }
    toast.success("Time criado com sucesso");
    await load();
    await refreshAuthTeams();
    return true;
  };

  const update = async (id: string, data: Partial<TeamFormValues>) => {
    if (!canWrite()) return false;

    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.module !== undefined) payload.module = data.module;
    if ("company_id" in data) payload.company_id = data.company_id ?? null;

    let query = supabase.from("teams").update(payload).eq("id", id);
    if (enabled && currentOrganizationId) {
      query = query.eq("org_id", currentOrganizationId);
    }

    const { error } = await query;
    if (error) {
      toast.error("Erro ao atualizar time");
      return false;
    }
    toast.success("Time atualizado");
    await load();
    await refreshAuthTeams();
    return true;
  };

  const remove = async (id: string) => {
    if (!canWrite()) return false;

    const [{ count: huCount }, { count: demCount }] = await Promise.all([
      supabase
        .from("user_stories")
        .select("id", { count: "exact", head: true })
        .eq("team_id", id),
      supabase
        .from("demandas")
        .select("id", { count: "exact", head: true })
        .eq("team_id", id),
    ]);
    if ((huCount ?? 0) > 0 || (demCount ?? 0) > 0) {
      toast.error("Não é possível excluir: time possui dados ativos (HUs ou demandas)");
      return false;
    }

    let query = supabase.from("teams").delete().eq("id", id);
    if (enabled && currentOrganizationId) {
      query = query.eq("org_id", currentOrganizationId);
    }

    const { error } = await query;
    if (error) {
      toast.error("Erro ao excluir time");
      return false;
    }
    toast.success("Time excluído");
    await load();
    await refreshAuthTeams();
    return true;
  };

  return { teams, loading, reload: load, create, update, remove };
}
