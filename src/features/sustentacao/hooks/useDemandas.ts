import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Demanda } from "../types/demanda";
import { ALL_SITUACOES } from "../types/demanda";

export const DEMANDAS_QUERY_KEY = "demandas";

// Garante que fila_concluida está sempre incluída nas queries
export const ALL_VALID_SITUACOES = ALL_SITUACOES as readonly string[];

interface UseDemandasOptions {
  teamId?: string;
  situacoes?: string[];
  projectId?: string;
  enabled?: boolean;
}

async function fetchDemandas(options: UseDemandasOptions): Promise<Demanda[]> {
  let query = supabase
    .from("demandas")
    .select("*")
    .order("updated_at", { ascending: false });

  if (options.teamId) {
    query = query.eq("team_id", options.teamId);
  }

  if (options.projectId) {
    query = query.eq("project_id", options.projectId);
  }

  if (options.situacoes && options.situacoes.length > 0) {
    // Inclui fila_concluida se a lista de situações não for explicitamente filtrada
    const situacoesComConcluida = options.situacoes.includes("fila_concluida")
      ? options.situacoes
      : [...options.situacoes];
    query = query.in("situacao", situacoesComConcluida);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data ?? []) as Demanda[];
}

export function useDemandas(options: UseDemandasOptions = {}) {
  const queryClient = useQueryClient();

  const queryKey = [
    DEMANDAS_QUERY_KEY,
    options.teamId ?? "all",
    options.projectId ?? "all",
    options.situacoes?.join(",") ?? "all",
  ];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchDemandas(options),
    enabled: options.enabled !== false,
    staleTime: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [DEMANDAS_QUERY_KEY] });
  };

  return { ...query, invalidate };
}

export function useDemandasByStatus(teamId: string) {
  return useDemandas({ teamId });
}

export function useDemandasConcluidas(teamId?: string) {
  return useDemandas({
    teamId,
    situacoes: ["fila_concluida"],
  });
}
