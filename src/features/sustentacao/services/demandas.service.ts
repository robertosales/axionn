import { supabase } from "@/integrations/supabase/client";
import type { Demanda, DemandaTransition, DemandaHour } from "../types/demanda";

/**
 * Guard: converte qualquer formato de horas para number decimal antes de enviar ao banco.
 * Aceita: 1 | 1.5 | "1" | "1.5" | "1:00" | "1:30" | "0:45"
 * Nunca deixa uma string chegar na coluna numeric do Supabase (evita erro 22P02).
 */
function toDecimalHours(value: unknown): number {
  if (typeof value === "number" && !isNaN(value)) return value;
  const str = String(value ?? "").trim();
  if (str.includes(":")) {
    const [h = "0", m = "0"] = str.split(":");
    return (parseInt(h, 10) || 0) + (parseInt(m, 10) || 0) / 60;
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

export async function fetchDemandas(teamId: string): Promise<Demanda[]> {
  const { data, error } = await supabase
    .from("demandas" as any)
    .select("*")
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as Demanda[];
}

export async function createDemanda(demanda: Partial<Demanda> & { team_id: string; rhm: string }) {
  const { data, error } = await supabase
    .from("demandas" as any)
    .insert(demanda as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Demanda;
}

export async function updateDemanda(id: string, updates: Partial<Demanda>) {
  const { data, error } = await supabase
    .from("demandas" as any)
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Demanda;
}

export async function deleteDemanda(id: string) {
  const { error } = await supabase
    .from("demandas" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function addTransition(t: Omit<DemandaTransition, "id" | "created_at">) {
  const { error } = await supabase.from("demanda_transitions" as any).insert(t as any);
  if (error) throw error;
}

export async function fetchTransitions(demandaId: string): Promise<DemandaTransition[]> {
  const { data, error } = await supabase
    .from("demanda_transitions" as any)
    .select("*")
    .eq("demanda_id", demandaId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as DemandaTransition[];
}

export async function addHours(h: Omit<DemandaHour, "id" | "created_at"> & { created_at?: string }) {
  const payload = { ...h, horas: toDecimalHours(h.horas) };
  const { error } = await supabase.from("demanda_hours" as any).insert(payload as any);
  if (error) throw error;
}

/**
 * fetchHours — lê direto da tabela demanda_hours.
 * RLS já permite SELECT para membros do time da demanda e admins.
 */
export async function fetchHours(demandaId: string): Promise<DemandaHour[]> {
  const { data, error } = await supabase
    .from("demanda_hours" as any)
    .select("*")
    .eq("demanda_id", demandaId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as DemandaHour[];
}

export async function updateHour(
  id: string,
  data: { horas: number | string; fase: string; descricao: string; user_id?: string },
) {
  const payload = { ...data, horas: toDecimalHours(data.horas) };
  const { error } = await supabase
    .from("demanda_hours" as any)
    .update(payload as any)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteHour(id: string) {
  const { error } = await supabase
    .from("demanda_hours" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export type UpsertDemandaRow = {
  rhm: string;
  projeto: string;
  situacao: string;
  tipo: string;
  sla?: string;
  descricao?: string;
  tipo_defeito?: string;
  originada_diagnostico?: boolean;
  data_previsao_encerramento?: string;
  prazo_inicio_atendimento?: string;
  prazo_solucao?: string;
};

/**
 * Upsert em lote via RPC upsert_demandas_batch.
 * Substitui o antigo loop N+1 (SELECT + INSERT/UPDATE por linha).
 * 100 linhas = 1 roundtrip HTTP no lugar de ~200 requests sequenciais.
 */
export async function upsertDemandas(
  teamId: string,
  rows: UpsertDemandaRow[],
): Promise<{ importados: number; atualizados: number; erros: number }> {
  if (rows.length === 0) return { importados: 0, atualizados: 0, erros: 0 };

  const { data, error } = await supabase.rpc("upsert_demandas_batch" as any, {
    p_team_id: teamId,
    p_rows:    rows,
  });

  if (error) throw error;
  return data as { importados: number; atualizados: number; erros: number };
}
