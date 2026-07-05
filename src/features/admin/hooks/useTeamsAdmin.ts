import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { resolveOrganizationOperationalError } from "@/features/organization/utils/operationalErrors";
import {
  resolveContractTeamIds,
  compareTeamNames,
} from "../lib/resolveContractTeamIds";

export interface TeamAdmin {
  id: string;
  name: string;
  module: string;
  company_id: string | null;
  contract_id?: string | null;
  created_at: string;
  org_id?: string | null;
  is_active?: boolean;
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
      let teamList: TeamAdmin[] = [];

      if (enabled) {
        if (!currentOrganizationId) {
          setTeams([]);
          return;
        }

        const { data, error } = await (supabase as any).rpc(
          "get_organization_teams_admin_v2",
          { p_org_id: currentOrganizationId },
        );
        if (error) throw error;

        teamList = ((data ?? []) as Array<Record<string, unknown>>)
          .filter(
            (team) =>
              !contractId ||
              String(team.contract_id ?? "") === contractId,
          )
          .map((team) => ({
            id: String(team.id),
            name: String(team.name ?? "Time"),
            module: String(team.module ?? ""),
            company_id: team.company_id ? String(team.company_id) : null,
            contract_id: team.contract_id ? String(team.contract_id) : null,
            created_at: String(team.created_at ?? ""),
            org_id: String(team.org_id ?? currentOrganizationId),
            is_active: Boolean(team.is_active ?? true),
            memberCount: Number(team.member_count ?? 0),
          }));
      } else {
        const contractTeamIds = await resolveContractTeamIds(contractId);
        if (contractTeamIds !== null && contractTeamIds.length === 0) {
          setTeams([]);
          return;
        }

        let query = supabase
          .from("teams")
          .select("id, name, module, company_id, contract_id, created_at")
          .order("name", { ascending: true });

        if (contractTeamIds) query = query.in("id", contractTeamIds);

        const { data, error } = await query;
        if (error) throw error;
        teamList = ((data ?? []) as TeamAdmin[]).slice();

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

        teamList = teamList.map((team) => ({
          ...team,
          memberCount: countMap[team.id] ?? 0,
        }));
      }

      teamList.sort((a, b) => compareTeamNames(a.name, b.name));
      setTeams(teamList);
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

    const { error } =
      enabled && currentOrganizationId
        ? await (supabase as any).rpc("create_organization_team_v2", {
            p_org_id: currentOrganizationId,
            p_name: data.name,
            p_module: data.module,
            p_company_id: data.company_id,
            p_contract_id: contractId ?? null,
          })
        : await supabase.from("teams").insert({
            name: data.name,
            module: data.module,
            ...(data.company_id ? { company_id: data.company_id } : {}),
            ...(contractId ? { contract_id: contractId } : {}),
          });

    if (error) {
      toast.error(resolveOrganizationOperationalError(error, "Erro ao criar time"));
      return false;
    }
    toast.success("Time criado com sucesso");
    await load();
    await refreshAuthTeams();
    return true;
  };

  const update = async (id: string, data: Partial<TeamFormValues>) => {
    if (!canWrite()) return false;

    const current = teams.find((team) => team.id === id);
    const nextName = data.name ?? current?.name ?? "";
    const nextModule = data.module ?? current?.module ?? "sala_agil";
    const nextCompany =
      "company_id" in data ? data.company_id ?? null : current?.company_id ?? null;

    const { error } =
      enabled && currentOrganizationId
        ? await (supabase as any).rpc("update_organization_team_v2", {
            p_org_id: currentOrganizationId,
            p_team_id: id,
            p_name: nextName,
            p_module: nextModule,
            p_company_id: nextCompany,
            p_contract_id: contractId ?? current?.contract_id ?? null,
          })
        : await supabase
            .from("teams")
            .update({
              name: nextName,
              module: nextModule,
              company_id: nextCompany,
            })
            .eq("id", id);

    if (error) {
      toast.error(resolveOrganizationOperationalError(error, "Erro ao atualizar time"));
      return false;
    }
    toast.success("Time atualizado");
    await load();
    await refreshAuthTeams();
    return true;
  };

  const remove = async (id: string) => {
    if (!canWrite()) return false;

    if (!enabled) {
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
    }

    const { error } =
      enabled && currentOrganizationId
        ? await (supabase as any).rpc("deactivate_organization_team_v2", {
            p_org_id: currentOrganizationId,
            p_team_id: id,
          })
        : await supabase.from("teams").delete().eq("id", id);

    if (error) {
      toast.error(
        resolveOrganizationOperationalError(
          error,
          enabled ? "Erro ao inativar time" : "Erro ao excluir time",
        ),
      );
      return false;
    }
    toast.success(enabled ? "Time inativado" : "Time excluído");
    await load();
    await refreshAuthTeams();
    return true;
  };

  return { teams, loading, reload: load, create, update, remove };
}
