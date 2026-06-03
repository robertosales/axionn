import { supabase } from "./supabase/client";

export type DemandaWithProjeto = {
  id: string;
  rhm: string | null;
  project_id: string | null;
  project_name: string | null;
  contract_id: string | null;
  contract_name: string | null;
};

export async function getDemandasWithResponsaveis(
  teamId: string
): Promise<DemandaWithProjeto[]> {
  const { data, error } = await supabase.rpc(
    "get_demandas_with_responsaveis",
    { p_team_id: teamId }
  );

  if (error) {
    console.error("Erro ao buscar demandas com responsáveis:", error);
    throw error;
  }

  return (data as DemandaWithProjeto[]) ?? [];
}
