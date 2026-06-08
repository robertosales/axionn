import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEMANDAS_QUERY_KEY } from "./useDemandas";
import type { Demanda } from "../types/demanda";
import { TERMINAL_STATUSES } from "../types/demanda";

type UpdateDemandaPayload = Partial<Omit<Demanda, "id" | "created_at" | "team_id">> & {
  id: string;
};

async function updateDemanda(payload: UpdateDemandaPayload): Promise<Demanda> {
  const { id, ...rest } = payload;

  const { data, error } = await supabase
    .from("demandas")
    .update(rest)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Demanda;
}

async function transitionDemanda(params: {
  id: string;
  situacao: string;
  justificativa?: string;
}): Promise<Demanda> {
  const isTerminal = (TERMINAL_STATUSES as readonly string[]).includes(params.situacao);

  const updatePayload: Record<string, unknown> = {
    situacao: params.situacao,
    situacao_changed_at: new Date().toISOString(),
  };

  // Para fila_concluida, registra a data de aceite automaticamente
  if (params.situacao === "fila_concluida") {
    updatePayload.aceite_data = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("demandas")
    .update(updatePayload)
    .eq("id", params.id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (params.justificativa) {
    await supabase.from("demanda_transitions").insert({
      demanda_id: params.id,
      to_status: params.situacao,
      justificativa: params.justificativa,
    });
  }

  void isTerminal;
  return data as Demanda;
}

async function createDemanda(
  payload: Omit<Demanda, "id" | "created_at" | "updated_at">
): Promise<Demanda> {
  const { data, error } = await supabase
    .from("demandas")
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Demanda;
}

export function useDemandaMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: [DEMANDAS_QUERY_KEY] });
  };

  const updateMutation = useMutation({
    mutationFn: updateDemanda,
    onSuccess: invalidateAll,
  });

  const transitionMutation = useMutation({
    mutationFn: transitionDemanda,
    onSuccess: invalidateAll,
  });

  const createMutation = useMutation({
    mutationFn: createDemanda,
    onSuccess: invalidateAll,
  });

  return {
    update: updateMutation,
    transition: transitionMutation,
    create: createMutation,
  };
}
