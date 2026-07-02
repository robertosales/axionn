import { supabase } from "@/integrations/supabase/client";
import { ORGANIZATION_TENANCY_ENABLED } from "@/lib/featureFlags";

export interface ProjetoAdmin {
  id: string;
  contract_id: string | null;
  team_id: string | null;
  name: string;
  description: string | null;
  code: string | null;
  module_type: "sustenance" | "agile" | "mixed";
  status: "active" | "paused" | "archived";
  redmine_id: number | null;
  sla_id: string | null;
  legacy_projetos_id: string | null;
  created_at: string;
  updated_at: string;
  org_id?: string | null;
  contract_name?: string | null;
  team_name?: string | null;
  demandas_count?: number;
}

export interface ProjetoImport {
  id: string;
  name: string;
  team_id: string | null;
  contract_id: string | null;
  status: string;
}

export interface CreateProjetoPayload {
  contract_id: string;
  team_id: string | null;
  name: string;
  description?: string | null;
  code?: string | null;
  module_type: string;
  redmine_id?: number | null;
}

function resolveOrganizationScope(organizationId?: string | null) {
  if (!ORGANIZATION_TENANCY_ENABLED) return organizationId ?? null;
  return organizationId ?? localStorage.getItem("selectedOrganizationId");
}

function normalizeProject(row: Record<string, unknown>): ProjetoAdmin {
  const contract = row.contracts as { name?: string } | null | undefined;
  return {
    id: String(row.id),
    contract_id: row.contract_id ? String(row.contract_id) : null,
    team_id: row.team_id ? String(row.team_id) : null,
    name: String(row.name ?? "Projeto"),
    description: row.description ? String(row.description) : null,
    code: row.code ? String(row.code) : null,
    module_type: String(row.module_type ?? "sustenance") as ProjetoAdmin["module_type"],
    status: String(row.status ?? "active") as ProjetoAdmin["status"],
    redmine_id: row.redmine_id == null ? null : Number(row.redmine_id),
    sla_id: row.sla_id ? String(row.sla_id) : null,
    legacy_projetos_id: row.legacy_projetos_id
      ? String(row.legacy_projetos_id)
      : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    org_id: row.org_id ? String(row.org_id) : null,
    contract_name: row.contract_name
      ? String(row.contract_name)
      : contract?.name ?? null,
    team_name: row.team_name ? String(row.team_name) : null,
  };
}

export async function fetchProjetosAdmin(
  organizationId?: string | null,
): Promise<ProjetoAdmin[]> {
  const scope = resolveOrganizationScope(organizationId);

  if (ORGANIZATION_TENANCY_ENABLED) {
    if (!scope) return [];
    const { data, error } = await supabase.rpc(
      "get_accessible_projects_v2",
      { p_org_id: scope, p_contract_id: null },
    );
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map(normalizeProject);
  }

  const { data, error } = await supabase
    .from("projects")
    .select(`
      id, contract_id, team_id, name, description, code,
      module_type, status, redmine_id, sla_id, legacy_projetos_id,
      created_at, updated_at,
      contracts ( name )
    `)
    .neq("status", "archived")
    .order("name");
  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const teamIds = [
    ...new Set(rows.map((project) => project.team_id).filter(Boolean)),
  ] as string[];
  const teamMap: Record<string, string> = {};

  if (teamIds.length > 0) {
    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("id, name")
      .in("id", teamIds);
    if (teamsError) throw teamsError;
    (teamsData ?? []).forEach((team: { id: string; name: string }) => {
      teamMap[team.id] = team.name;
    });
  }

  return rows.map((project) =>
    normalizeProject({
      ...project,
      team_name: project.team_id
        ? teamMap[String(project.team_id)] ?? null
        : null,
    }),
  );
}

export async function fetchProjetosForImport(
  organizationId?: string | null,
): Promise<ProjetoImport[]> {
  const scope = resolveOrganizationScope(organizationId);
  if (ORGANIZATION_TENANCY_ENABLED && !scope) return [];

  let query = supabase
    .from("projects")
    .select("id, name, team_id, contract_id, status")
    .neq("status", "archived")
    .order("name");

  if (scope) query = query.eq("org_id", scope);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProjetoImport[];
}

export async function createProjetoAdmin(
  payload: CreateProjetoPayload,
  organizationId?: string | null,
): Promise<ProjetoAdmin> {
  const scope = resolveOrganizationScope(organizationId);
  if (ORGANIZATION_TENANCY_ENABLED && !scope) {
    throw new Error("Organização obrigatória para criar projeto");
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      ...payload,
      status: "active",
      ...(scope ? { org_id: scope } : {}),
    })
    .select()
    .single();
  if (error) throw error;
  return normalizeProject(data as unknown as Record<string, unknown>);
}

export async function updateProjetoAdmin(
  id: string,
  updates: Partial<ProjetoAdmin>,
  organizationId?: string | null,
): Promise<ProjetoAdmin> {
  const scope = resolveOrganizationScope(organizationId);
  if (ORGANIZATION_TENANCY_ENABLED && !scope) {
    throw new Error("Organização obrigatória para atualizar projeto");
  }

  let query = supabase.from("projects").update(updates).eq("id", id);
  if (scope) query = query.eq("org_id", scope);

  const { data, error } = await query.select().single();
  if (error) throw error;
  return normalizeProject(data as unknown as Record<string, unknown>);
}

export async function archiveProjetoAdmin(
  id: string,
  organizationId?: string | null,
): Promise<void> {
  const scope = resolveOrganizationScope(organizationId);
  if (ORGANIZATION_TENANCY_ENABLED && !scope) {
    throw new Error("Organização obrigatória para arquivar projeto");
  }

  let query = supabase
    .from("projects")
    .update({ status: "archived" })
    .eq("id", id);
  if (scope) query = query.eq("org_id", scope);

  const { error } = await query;
  if (error) throw error;
}
