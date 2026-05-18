import { supabase } from "@/integrations/supabase/client";
import type { Demanda, DemandaTransition, DemandaHour } from "../types/demanda";

/**
 * Guard: converte qualquer formato de horas para number decimal antes de enviar ao banco.
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

/**
 * Colunas usadas na lista/board de demandas.
 * Evita trazer campos pesados (descricao longa, prazo_solucao, etc.) desnecessariamente.
 * Para a tela de detalhe, usar fetchDemandaById que traz tudo.
 */
const DEMANDA_LIST_FIELDS = [
  "id",
  "team_id",
  "rhm",
  "projeto",
  "titulo",
  "tipo",
  "situacao",
  "sla",
  "descricao",
  "demandante",
  "data_previsao_encerramento",
  "prazo_inicio_atendimento",
  "prazo_solucao",
  "tipo_defeito",
  "regime",
  "originada_diagnostico",
  "created_at",
  "updated_at",
].join(",");

export async function fetchDemandas(teamId: string): Promise<Demanda[]> {
  const { data, error } = await supabase
    .from("demandas" as any)
    .select(DEMANDA_LIST_FIELDS)
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as Demanda[];
}

/** Busca uma demanda completa (todos os campos) para a tela de detalhe. */
export async function fetchDemandaById(id: string): Promise<Demanda | null> {
  const { data, error } = await supabase
    .from("demandas" as any)
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as unknown as Demanda;
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

export async function upsertDemandas(
  teamId: string,
  rows: Array<{
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
  }>,
) {
  const results = { importados: 0, atualizados: 0, erros: 0 };

  for (const row of rows) {
    try {
      const { data: existing } = await supabase
        .from("demandas" as any)
        .select("id")
        .eq("team_id", teamId)
        .eq("rhm", row.rhm)
        .maybeSingle();

      if ((existing as any)?.id) {
        await supabase
          .from("demandas" as any)
          .update({
            projeto: row.projeto,
            situacao: row.situacao,
            tipo: row.tipo,
            sla: row.sla,
            descricao: row.descricao,
            tipo_defeito: row.tipo_defeito,
            originada_diagnostico: row.originada_diagnostico,
            data_previsao_encerramento: row.data_previsao_encerramento,
            prazo_inicio_atendimento: row.prazo_inicio_atendimento,
            prazo_solucao: row.prazo_solucao,
          } as any)
          .eq("id", (existing as any).id);
        results.atualizados++;
      } else {
        await supabase.from("demandas" as any).insert({
          team_id: teamId,
          rhm: row.rhm,
          projeto: row.projeto,
          situacao: row.situacao,
          tipo: row.tipo,
          sla: row.sla,
          descricao: row.descricao,
          tipo_defeito: row.tipo_defeito,
          originada_diagnostico: row.originada_diagnostico,
          data_previsao_encerramento: row.data_previsao_encerramento,
          prazo_inicio_atendimento: row.prazo_inicio_atendimento,
          prazo_solucao: row.prazo_solucao,
        } as any);
        results.importados++;
      }
    } catch {
      results.erros++;
    }
  }

  return results;
}
