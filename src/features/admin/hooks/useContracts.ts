import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { resolveOrganizationOperationalError } from "@/features/organization/utils/operationalErrors";
import { toast } from "sonner";

export interface Contract {
  id: string;
  name: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  company_id: string | null;
  number: string | null;
  object: string | null;
  value_per_pfus: number | null;
  currency: string | null;
  org_id?: string | null;
  projectCount?: number;
  slaCount?: number;
}

export interface ContractFormData {
  name: string;
  status: string;
  starts_at: string;
  ends_at: string;
  company_id: string | null;
  number: string;
  object: string;
  value_per_pfus: string;
  currency: string;
  team_ids: string[];
  project_ids: string[];
  sla_ids: string[];
}

export const EMPTY_CONTRACT_FORM: ContractFormData = {
  name: "",
  status: "active",
  starts_at: "",
  ends_at: "",
  company_id: null,
  number: "",
  object: "",
  value_per_pfus: "",
  currency: "BRL",
  team_ids: [],
  project_ids: [],
  sla_ids: [],
};

export interface ContractKpis {
  total: number;
  active: number;
  paused: number;
  critical: number;
}

function normalizeContract(row: Record<string, unknown>): Contract {
  return {
    id: String(row.id),
    name: String(row.name ?? "Contrato"),
    status: String(row.status ?? "active"),
    starts_at: row.starts_at ? String(row.starts_at) : null,
    ends_at: row.ends_at ? String(row.ends_at) : null,
    company_id: row.company_id ? String(row.company_id) : null,
    number: row.number ? String(row.number) : null,
    object: row.object ? String(row.object) : null,
    value_per_pfus:
      row.value_per_pfus == null ? null : Number(row.value_per_pfus),
    currency: row.currency ? String(row.currency) : null,
    org_id: row.org_id ? String(row.org_id) : null,
    projectCount: Number(
      row.project_count ??
        (Array.isArray(row.projects) ? row.projects.length : 0),
    ),
    slaCount: Number(
      row.sla_count ??
        (Array.isArray(row.contract_slas) ? row.contract_slas.length : 0),
    ),
  };
}

export function useContracts() {
  const { enabled, currentOrganizationId, canOperate } = useOrganization();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<ContractKpis>({
    total: 0,
    active: 0,
    paused: 0,
    critical: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let rows: Array<Record<string, unknown>> = [];

      if (enabled) {
        if (!currentOrganizationId) {
          setContracts([]);
          setKpis({ total: 0, active: 0, paused: 0, critical: 0 });
          return;
        }

        const { data, error } = await supabase.rpc(
          "get_accessible_contracts_v2",
          { p_org_id: currentOrganizationId },
        );
        if (error) throw error;
        rows = (data ?? []) as Array<Record<string, unknown>>;
      } else {
        const { data, error } = await supabase
          .from("contracts")
          .select(`
            id, name, status, starts_at, ends_at,
            company_id, number, object, value_per_pfus, currency, org_id,
            projects:projects(id),
            contract_slas:contract_slas(id)
          `)
          .order("name", { ascending: true });
        if (error) throw error;
        rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
      }

      const list = rows.map(normalizeContract);
      setContracts(list);
      setKpis({
        total: list.length,
        active: list.filter((contract) => contract.status === "active").length,
        paused: list.filter((contract) => contract.status === "paused").length,
        critical: list.filter((contract) => {
          if (!contract.ends_at) return false;
          const daysLeft = Math.ceil(
            (new Date(contract.ends_at).getTime() - Date.now()) / 86_400_000,
          );
          return daysLeft >= 0 && daysLeft <= 30;
        }).length,
      });
    } catch (error) {
      console.error("[useContracts] load:", error);
      setContracts([]);
      setKpis({ total: 0, active: 0, paused: 0, critical: 0 });
      toast.error("Não foi possível carregar os contratos desta organização");
    } finally {
      setLoading(false);
    }
  }, [currentOrganizationId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadFormData = async (
    contractId: string,
  ): Promise<ContractFormData> => {
    let query = supabase
      .from("contracts")
      .select(`
        id, name, status, starts_at, ends_at,
        company_id, number, object, value_per_pfus, currency,
        contract_teams:contract_teams(team_id),
        projects:projects(id),
        contract_slas:contract_slas(id)
      `)
      .eq("id", contractId);

    if (enabled && currentOrganizationId) {
      query = query.eq("org_id", currentOrganizationId);
    }

    const { data, error } = await query.single();
    if (error || !data) return { ...EMPTY_CONTRACT_FORM };

    const row = data as Record<string, unknown>;
    return {
      name: String(row.name ?? ""),
      status: String(row.status ?? "active"),
      starts_at: row.starts_at ? String(row.starts_at) : "",
      ends_at: row.ends_at ? String(row.ends_at) : "",
      company_id: row.company_id ? String(row.company_id) : null,
      number: row.number ? String(row.number) : "",
      object: row.object ? String(row.object) : "",
      value_per_pfus:
        row.value_per_pfus == null ? "" : String(row.value_per_pfus),
      currency: String(row.currency ?? "BRL"),
      team_ids: (
        (row.contract_teams ?? []) as Array<{ team_id: string }>
      ).map((relation) => relation.team_id),
      project_ids: ((row.projects ?? []) as Array<{ id: string }>).map(
        (project) => project.id,
      ),
      sla_ids: ((row.contract_slas ?? []) as Array<{ id: string }>).map(
        (sla) => sla.id,
      ),
    };
  };

  const persistRelations = async (
    contractId: string,
    data: ContractFormData,
  ) => {
    const deleteTeams = supabase
      .from("contract_teams")
      .delete()
      .eq("contract_id", contractId);

    let clearProjects = supabase
      .from("projects")
      .update({ contract_id: null })
      .eq("contract_id", contractId);

    if (enabled && currentOrganizationId) {
      clearProjects = clearProjects.eq("org_id", currentOrganizationId);
    }

    await Promise.all([deleteTeams, clearProjects]);

    if (data.team_ids.length > 0) {
      const { error } = await supabase.from("contract_teams").insert(
        data.team_ids.map((teamId) => ({
          contract_id: contractId,
          team_id: teamId,
        })),
      );
      if (error) throw error;
    }

    if (data.project_ids.length > 0) {
      let projectQuery = supabase
        .from("projects")
        .update({ contract_id: contractId })
        .in("id", data.project_ids);

      if (enabled && currentOrganizationId) {
        projectQuery = projectQuery.eq("org_id", currentOrganizationId);
      }

      const { error } = await projectQuery;
      if (error) throw error;
    }
  };

  const buildPayload = (data: ContractFormData) => ({
    name: data.name.trim(),
    status: data.status,
    starts_at: data.starts_at || null,
    ends_at: data.ends_at || null,
    company_id: data.company_id || null,
    number: data.number.trim() || null,
    object: data.object.trim() || null,
    value_per_pfus: data.value_per_pfus
      ? Number.parseFloat(data.value_per_pfus)
      : null,
    currency: data.currency || "BRL",
    ...(enabled && currentOrganizationId
      ? { org_id: currentOrganizationId }
      : {}),
  });

  const assertWritableOrganization = () => {
    if (!enabled) return true;
    if (!currentOrganizationId || !canOperate) {
      toast.error("A organização atual não permite alterações");
      return false;
    }
    return true;
  };

  const create = async (data: ContractFormData): Promise<boolean> => {
    if (!assertWritableOrganization()) return false;

    const { data: inserted, error } =
      enabled && currentOrganizationId
        ? await (supabase as any).rpc("create_organization_contract_v2", {
            p_org_id: currentOrganizationId,
            p_name: data.name,
            p_company_id: data.company_id,
            p_status: data.status,
            p_starts_at: data.starts_at || null,
            p_ends_at: data.ends_at || null,
            p_number: data.number || null,
            p_object: data.object || null,
            p_value_per_pfus: data.value_per_pfus
              ? Number.parseFloat(data.value_per_pfus)
              : null,
            p_currency: data.currency || "BRL",
          })
        : await supabase
            .from("contracts")
            .insert(buildPayload(data))
            .select("id")
            .single();

    const contractId =
      typeof inserted === "string"
        ? inserted
        : (inserted as { id?: string } | null)?.id;

    if (error || !contractId) {
      toast.error(resolveOrganizationOperationalError(error, "Erro ao criar contrato"));
      return false;
    }

    try {
      await persistRelations(contractId, data);
    } catch (relationError) {
      console.error("[useContracts] persistRelations(create):", relationError);
      toast.error("Contrato criado, mas houve erro nos vínculos");
      await load();
      return false;
    }

    toast.success("Contrato criado com sucesso");
    await load();
    return true;
  };

  const update = async (
    id: string,
    data: ContractFormData,
  ): Promise<boolean> => {
    if (!assertWritableOrganization()) return false;

    let query = supabase.from("contracts").update(buildPayload(data)).eq("id", id);
    if (enabled && currentOrganizationId) {
      query = query.eq("org_id", currentOrganizationId);
    }

    const { error } = await query;
    if (error) {
      toast.error(resolveOrganizationOperationalError(error, "Erro ao atualizar contrato"));
      return false;
    }

    try {
      await persistRelations(id, data);
    } catch (relationError) {
      console.error("[useContracts] persistRelations(update):", relationError);
      toast.error("Contrato atualizado, mas houve erro nos vínculos");
      await load();
      return false;
    }

    toast.success("Contrato atualizado");
    await load();
    return true;
  };

  const remove = async (id: string): Promise<boolean> => {
    if (!assertWritableOrganization()) return false;

    const { error } =
      enabled && currentOrganizationId
        ? await (supabase as any).rpc("archive_organization_contract_v2", {
            p_org_id: currentOrganizationId,
            p_contract_id: id,
          })
        : await supabase.from("contracts").delete().eq("id", id);
    if (error) {
      toast.error(resolveOrganizationOperationalError(error, "Erro ao arquivar contrato"));
      return false;
    }

    toast.success("Contrato excluído");
    await load();
    return true;
  };

  return {
    contracts,
    loading,
    kpis,
    create,
    update,
    remove,
    loadFormData,
  };
}
