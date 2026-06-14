import { supabase } from "@/integrations/supabase/client";

export interface DemandaResponsavel {
  id: string;
  demanda_id: string;
  user_id: string;
  papel: string;
  created_at: string;
  profile?: { display_name: string; email: string };
}

export async function fetchResponsaveis(demandaId: string): Promise<DemandaResponsavel[]> {
  const { data, error } = await supabase
    .from("demanda_responsaveis" as any)
    .select("*")
    .eq("demanda_id", demandaId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data || []) as unknown as DemandaResponsavel[];

  // Enrich with profile names
  const userIds = rows.map(r => r.user_id);
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, email")
      .in("user_id", userIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    rows.forEach(r => {
      const p = profileMap.get(r.user_id);
      if (p) r.profile = { display_name: p.display_name, email: p.email };
    });
  }

  return rows;
}

export async function addResponsavel(demandaId: string, userId: string, papel: string) {
  const { error } = await supabase
    .from("demanda_responsaveis" as any)
    .insert({ demanda_id: demandaId, user_id: userId, papel } as any);
  if (error) throw error;
}

export async function removeResponsavel(id: string) {
  const { error } = await supabase
    .from("demanda_responsaveis" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Busca de candidatos a responsável.
 *
 * Escopo correto = CONTRATO. Quando `contractId` é fornecido, agrega usuários
 * de TODOS os times do contrato (via contract_room_teams → team_members) +
 * usuários diretamente vinculados ao contrato (contract_members). Fallback
 * por `teamId` apenas quando a demanda não tem contrato (legado).
 *
 * Mantém retrocompatibilidade com a chamada antiga `searchProfiles(q, teamId)`.
 */
export type SearchProfilesScope = { contractId?: string | null; teamId?: string | null };

async function collectContractUserIds(contractId: string): Promise<string[]> {
  const [roomTeamsRes, membersRes] = await Promise.all([
    supabase
      .from("contract_room_teams")
      .select("team_id")
      .eq("contract_id", contractId)
      .eq("is_active", true),
    supabase
      .from("contract_members")
      .select("user_id")
      .eq("contract_id", contractId),
  ]);

  const teamIds = (roomTeamsRes.data ?? [])
    .map((r: any) => r.team_id)
    .filter(Boolean);

  const set = new Set<string>();
  (membersRes.data ?? []).forEach((m: any) => m.user_id && set.add(m.user_id));

  if (teamIds.length > 0) {
    const { data: tm } = await supabase
      .from("team_members")
      .select("user_id")
      .in("team_id", teamIds);
    (tm ?? []).forEach((r: any) => r.user_id && set.add(r.user_id));
  }
  return [...set];
}

async function collectTeamUserIds(teamId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.user_id).filter(Boolean);
}

export async function searchProfiles(
  query: string,
  scopeOrTeamId?: SearchProfilesScope | string | null,
) {
  type R = { user_id: string; display_name: string; email: string };
  if (!query) return [] as R[];

  // Normaliza assinatura (compat: string = teamId)
  const scope: SearchProfilesScope =
    typeof scopeOrTeamId === "string" || scopeOrTeamId === null || scopeOrTeamId === undefined
      ? { teamId: (scopeOrTeamId as string | null) ?? null }
      : scopeOrTeamId;

  let ids: string[] = [];
  if (scope.contractId) {
    ids = await collectContractUserIds(scope.contractId);
  } else if (scope.teamId) {
    ids = await collectTeamUserIds(scope.teamId);
  } else {
    return [] as R[];
  }
  if (ids.length === 0) return [] as R[];

  const q = query.replace(/[,()]/g, "");
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, display_name, email")
    .in("user_id", ids)
    .eq("is_active", true)
    .or(`display_name.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(10);
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    user_id: p.user_id,
    display_name: p.display_name,
    email: p.email,
  })) as R[];
}

// Prioridade: papel mais específico primeiro, depois genéricos.
const ROLE_PRIORITY = [
  "scrum_master",
  "product_owner",
  "architect",
  "developer",
  "qa_analyst",
  "analyst",
  "admin",
  "member",
] as const;

const ROLE_LABEL_PT: Record<string, string> = {
  scrum_master: "Scrum Master",
  product_owner: "Product Owner",
  architect: "Arquiteto",
  developer: "Desenvolvedor",
  qa_analyst: "Analista de QA",
  analyst: "Analista",
  admin: "Administrador",
  member: "Membro",
};

/**
 * Retorna o papel principal do usuário a partir de user_roles,
 * formatado em PT-BR (ex: "Scrum Master"). Cai em "Membro" se não houver.
 */
export async function fetchPrimaryRoleLabel(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error || !data?.length) return ROLE_LABEL_PT.member;
  const roles = data.map((r: any) => r.role as string);
  const picked = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? roles[0];
  return ROLE_LABEL_PT[picked] ?? picked;
}
