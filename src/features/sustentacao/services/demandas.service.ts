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

/**
 * fetchDemandasEnriched — substitui fetchDemandas + enrichComResponsaveis.
 *
 * ANTES: 2 roundtrips HTTP por cache miss
 *   1. SELECT * FROM demandas WHERE team_id = ?
 *   2. SELECT FROM demanda_responsaveis WHERE demanda_id IN (...)
 *
 * DEPOIS: 1 RPC = 1 roundtrip, retorno já enriquecido.
 *   Com TanStack Query staleTime: 30s, 150 usuários no mesmo time
 *   geram 1 query ao banco a cada 30s (em vez de 150 paralelas).
 */
export async function fetchDemandasEnriched(teamId: string): Promise<Demanda[]> {
  const { data, error } = await supabase
    .rpc("get_demandas_with_responsaveis", { p_team_id: teamId } as any);
  if (error) throw error;
  return (data as unknown as Demanda[]) ?? [];
}

// Mantido para compatibilidade com imports existentes que usem fetchDemandas diretamente
export const fetchDemandas = fetchDemandasEnriched;

// ── Paginação cursor-based ────────────────────────────────────────────────────
/**
 * fetchDemandasPage — busca uma página de demandas enriquecidas.
 *
 * Usa cursor baseado em updated_at (coluna indexada) em ordem decrescente:
 * a primeira página recebe cursor=null e retorna os N mais recentes;
 * páginas seguintes recebem o updated_at da última demanda da página anterior.
 *
 * Retorna:
 *   items      — demandas da página (já enriquecidas com responsáveis)
 *   nextCursor — updated_at da última demanda, ou null se não há próxima página
 */
export const PAGE_SIZE = 50;

export interface DemandasPage {
  items:      Demanda[];
  nextCursor: string | null;
}

export async function fetchDemandasPage(
  teamId: string,
  cursor: string | null,
  limit = PAGE_SIZE,
): Promise<DemandasPage> {
  const { data, error } = await supabase
    .rpc("get_demandas_with_responsaveis_paged", {
      p_team_id: teamId,
      p_cursor:  cursor,
      p_limit:   limit,
    } as any);

  if (error) throw error;

  const items = (data as unknown as Demanda[]) ?? [];
  const nextCursor =
    items.length < limit
      ? null
      : (items[items.length - 1].updated_at ?? null);

  return { items, nextCursor };
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
