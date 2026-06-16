import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve os IDs dos times pertencentes a um contrato, unindo duas fontes
 * (sem perder dados legados):
 *   - teams.contract_id    = :contractId
 *   - projects.contract_id = :contractId  → DISTINCT team_id
 *
 * Retorna:
 *   - null      → sem filtro (contractId vazio)
 *   - string[]  → IDs únicos (pode ser vazio se nenhum time vinculado)
 */
export async function resolveContractTeamIds(
  contractId?: string | null,
): Promise<string[] | null> {
  if (!contractId) return null;

  const [teamsRes, projsRes] = await Promise.all([
    supabase.from("teams").select("id").eq("contract_id", contractId),
    supabase
      .from("projects")
      .select("team_id")
      .eq("contract_id", contractId)
      .not("team_id", "is", null),
  ]);

  const ids = new Set<string>();
  (teamsRes.data ?? []).forEach((t: any) => t?.id && ids.add(t.id as string));
  (projsRes.data ?? []).forEach((p: any) => p?.team_id && ids.add(p.team_id as string));
  return [...ids];
}

/** Comparador alfabético pt-BR, case/accent-insensitive, com ordenação numérica natural. */
export const compareTeamNames = (a: string, b: string) =>
  (a ?? "").localeCompare(b ?? "", "pt-BR", { sensitivity: "base", numeric: true });