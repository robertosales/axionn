import { supabase } from "@/integrations/supabase/client";

function queryError(scope: string, error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "erro desconhecido")
      : String(error ?? "erro desconhecido");
  return new Error(`${scope}: ${message}`);
}

/** Resolve todos os vínculos de time existentes para um contrato. */
export async function resolveContractTeamIds(
  contractId?: string | null,
): Promise<string[] | null> {
  if (!contractId) return null;

  const [teamsRes, projectsRes, contractTeamsRes, roomTeamsRes] = await Promise.all([
    supabase.from("teams").select("id").eq("contract_id", contractId),
    supabase.from("projects").select("team_id").eq("contract_id", contractId).not("team_id", "is", null),
    supabase.from("contract_teams").select("team_id").eq("contract_id", contractId),
    supabase.from("contract_room_teams").select("team_id").eq("contract_id", contractId).eq("is_active", true),
  ]);

  if (teamsRes.error) throw queryError("Times do contrato", teamsRes.error);
  if (projectsRes.error) throw queryError("Projetos do contrato", projectsRes.error);
  if (contractTeamsRes.error) throw queryError("Vínculos contrato-time", contractTeamsRes.error);
  if (roomTeamsRes.error) throw queryError("Salas do contrato", roomTeamsRes.error);

  const ids = new Set<string>();
  for (const row of teamsRes.data ?? []) if (row.id) ids.add(row.id);
  for (const row of projectsRes.data ?? []) if (row.team_id) ids.add(row.team_id);
  for (const row of contractTeamsRes.data ?? []) if (row.team_id) ids.add(row.team_id);
  for (const row of roomTeamsRes.data ?? []) if (row.team_id) ids.add(row.team_id);
  return [...ids];
}

export const compareTeamNames = (a: string, b: string) =>
  (a ?? "").localeCompare(b ?? "", "pt-BR", { sensitivity: "base", numeric: true });
