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
  // Whitelist: somente colunas que realmente existem na tabela public.demandas.
  // Evita 400 (PGRST204 / column does not exist) quando o caller passa um objeto
  // Demanda enriquecido pela RPC (ex.: sla_priority, data_abertura) ou campos
  // derivados que não pertencem à tabela base.
  const ALLOWED_COLUMNS = new Set<string>([
    "team_id",
    "rhm",
    "projeto",
    "titulo",
    "tipo",
    "situacao",
    "descricao",
    "sla",
    "demandante",
    "tipo_defeito",
    "originada_diagnostico",
    "prazo_inicio_atendimento",
    "prazo_solucao",
    "data_previsao_encerramento",
    "nota_satisfacao",
    "cobertura_testes",
    "artefatos_atualizados",
    "hard_code_identificado",
    "reincidencia_defeito",
    "contador_rejeicoes",
    "responsavel_requisitos",
    "responsavel_dev",
    "responsavel_teste",
    "responsavel_arquiteto",
    "aceite_data",
    "aceite_responsavel",
    "total_horas",
    "situacao_changed_at",
    "contract_id",
    "project_id",
  ]);
  const safeUpdates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates as Record<string, unknown>)) {
    if (ALLOWED_COLUMNS.has(k)) safeUpdates[k] = v;
  }

  const { data, error } = await supabase
    .from("demandas" as any)
    .update(safeUpdates as any)
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

/**
 * checkDemandaDuplicada — retorna true se já existe uma demanda no mesmo time
 * com o mesmo RHM (#) E mesmo projeto (case-insensitive, trim).
 * Regra: mesmo RHM pode existir em projetos diferentes; só bloqueia repetição
 * dentro do mesmo projeto. Considera project_id quando disponível, com
 * fallback no nome do projeto para compatibilidade com registros antigos.
 */
export async function checkDemandaDuplicada(
  teamId: string,
  rhm: string,
  projeto: string,
  projectId?: string | null,
  excludeId?: string,
): Promise<boolean> {
  const r = (rhm ?? "").trim();
  const p = (projeto ?? "").trim();
  if (!r || !teamId) return false;

  let q = supabase
    .from("demandas" as any)
    .select("id,rhm,projeto,project_id")
    .eq("team_id", teamId)
    .eq("rhm", r);

  if (excludeId) q = q.neq("id", excludeId);

  const { data, error } = await q.limit(20);
  if (error) throw error;

  const pl = p.toLowerCase();
  return ((data as any[]) ?? []).some(
    (d) => {
      if (projectId && d.project_id) return d.project_id === projectId;
      return (d.projeto ?? "").trim().toLowerCase() === pl;
    },
  );
}

/**
 * searchDemandas — consulta direta ao banco por RHM / projeto / título.
 * Usada pela tela "Consultar Demandas" para encontrar demandas que ainda
 * não foram carregadas pela paginação infinita.
 */
export async function searchDemandas(
  teamId: string,
  query: string,
  limit = 100,
): Promise<Demanda[]> {
  const q = (query ?? "").trim();
  if (!teamId || !q) return [];
  const like = `%${q}%`;
  const { data, error } = await supabase
    .from("demandas" as any)
    .select("*")
    .eq("team_id", teamId)
    .or(`rhm.ilike.${like},projeto.ilike.${like},titulo.ilike.${like},descricao.ilike.${like}`)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as Demanda[]) ?? [];
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
  rhm:                        string;
  projeto:                    string;
  /** project_id (UUID) de public.projects — preenchido pela importação quando disponível */
  project_id?:                string | null;
  situacao:                   string;
  tipo:                       string;
  sla?:                       string;
  descricao?:                 string;
  tipo_defeito?:              string;
  originada_diagnostico?:     boolean;
  data_previsao_encerramento?: string;
  prazo_inicio_atendimento?:  string;
  prazo_solucao?:             string;
};

export async function upsertDemandas(
  teamId: string,
  rows: UpsertDemandaRow[],
): Promise<{
  importados: number;
  atualizados: number;
  erros: number;
  falhas?: { rhm: string; projeto: string; motivo: string }[];
}> {
  if (rows.length === 0) return { importados: 0, atualizados: 0, erros: 0, falhas: [] };
  const { data, error } = await supabase.rpc("upsert_demandas_batch" as any, {
    p_team_id: teamId,
    p_rows:    rows,
  });
  if (error) throw error;
  return data as {
    importados: number;
    atualizados: number;
    erros: number;
    falhas?: { rhm: string; projeto: string; motivo: string }[];
  };
}
