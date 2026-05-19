import { supabase } from "@/integrations/supabase/client";
import type {
  Rdm, RdmInsert, RdmUpdate,
  RdmChecklistItem, RdmChecklistItemInsert, RdmChecklistItemUpdate,
  RdmGoNogo, RdmGoNogoInsert,
  RdmParticipante, RdmParticipanteInsert,
  RdmSprintItem, RdmSprintItemInsert,
  RdmSprint, RdmSprintInsert, RdmSprintUpdate,
  RdmSprintRedmine, RdmSprintRedmineInsert, RdmSprintRedmineUpdate,
} from "../types/rdm";

// ── RDMs ─────────────────────────────────────────────────────────────────────
export async function listRdms(teamId: string): Promise<Rdm[]> {
  const { data, error } = await supabase
    .from("rdms").select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getRdm(id: string): Promise<Rdm | null> {
  const { data, error } = await supabase
    .from("rdms").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function criarRdmComChecklist(
  payload: Omit<RdmInsert, "id" | "codigo" | "updated_at">
): Promise<string> {
  const { data, error } = await supabase.rpc("fn_rdm_criar_com_checklist", {
    p_nome:                   payload.nome,
    p_objetivo:               payload.objetivo,
    p_sistema_modulo:         payload.sistema_modulo,
    p_team_id:                payload.team_id,
    p_sprint_id:              payload.sprint_id ?? null,
    p_tipo_mudanca:           payload.tipo_mudanca,
    p_risco:                  payload.risco,
    p_ambiente:               payload.ambiente,
    p_data_implantacao:       payload.data_implantacao,
    p_hora_inicio:            payload.hora_inicio,
    p_hora_fim_prevista:      payload.hora_fim_prevista,
    p_downtime_previsto:      payload.downtime_previsto ?? false,
    p_rollback_previsto:      payload.rollback_previsto ?? false,
    p_tempo_rollback_minutos: payload.tempo_rollback_minutos ?? null,
    p_observacoes:            payload.observacoes ?? null,
    p_criado_por:             payload.criado_por,
  });
  if (error) throw error;
  return data as string;
}

export async function updateRdm(id: string, updates: RdmUpdate): Promise<void> {
  const { error } = await supabase
    .from("rdms")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRdm(id: string): Promise<void> {
  const { error } = await supabase.from("rdms").delete().eq("id", id);
  if (error) throw error;
}

// ── Checklist ─────────────────────────────────────────────────────────────────
export async function listChecklistItems(rdmId: string): Promise<RdmChecklistItem[]> {
  const { data, error } = await supabase
    .from("rdm_checklist_items").select("*")
    .eq("rdm_id", rdmId).order("ordem");
  if (error) throw error;
  return data ?? [];
}

export async function updateChecklistItem(
  id: string, updates: RdmChecklistItemUpdate
): Promise<void> {
  const { error } = await supabase
    .from("rdm_checklist_items")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ── Go/No-Go ──────────────────────────────────────────────────────────────────
export async function listGoNogo(rdmId: string): Promise<RdmGoNogo[]> {
  const { data, error } = await supabase
    .from("rdm_gonogo").select("*")
    .eq("rdm_id", rdmId).order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function upsertGoNogo(payload: RdmGoNogoInsert): Promise<void> {
  const { error } = await supabase
    .from("rdm_gonogo")
    .upsert(payload, { onConflict: "rdm_id,profile_id,papel" });
  if (error) throw error;
}

// ── Participantes ─────────────────────────────────────────────────────────────
export async function listParticipantes(rdmId: string): Promise<RdmParticipante[]> {
  const { data, error } = await supabase
    .from("rdm_participantes").select("*").eq("rdm_id", rdmId);
  if (error) throw error;
  return data ?? [];
}

export async function addParticipante(payload: RdmParticipanteInsert): Promise<void> {
  const { error } = await supabase.from("rdm_participantes").insert(payload);
  if (error) throw error;
}

export async function removeParticipante(id: string): Promise<void> {
  const { error } = await supabase.from("rdm_participantes").delete().eq("id", id);
  if (error) throw error;
}

// ── Sprint Items (legado) ─────────────────────────────────────────────────────
export async function listSprintItems(rdmId: string): Promise<RdmSprintItem[]> {
  const { data, error } = await supabase
    .from("rdm_sprint_items").select("*").eq("rdm_id", rdmId);
  if (error) throw error;
  return data ?? [];
}

export async function addSprintItem(payload: RdmSprintItemInsert): Promise<void> {
  const { error } = await supabase.from("rdm_sprint_items").insert(payload);
  if (error) throw error;
}

export async function removeSprintItem(id: string): Promise<void> {
  const { error } = await supabase.from("rdm_sprint_items").delete().eq("id", id);
  if (error) throw error;
}

// ── RDM Sprints (nova feature) ────────────────────────────────────────────────
export async function listRdmSprints(rdmId: string): Promise<RdmSprint[]> {
  const { data, error } = await supabase
    .from("rdm_sprints").select("*, redmines:rdm_sprint_redmines(*)")
    .eq("rdm_id", rdmId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RdmSprint[];
}

export async function addRdmSprint(payload: RdmSprintInsert): Promise<RdmSprint> {
  const { data, error } = await supabase
    .from("rdm_sprints").insert(payload).select().single();
  if (error) throw error;
  return data as RdmSprint;
}

export async function updateRdmSprint(id: string, updates: RdmSprintUpdate): Promise<void> {
  const { error } = await supabase
    .from("rdm_sprints")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRdmSprint(id: string): Promise<void> {
  const { error } = await supabase.from("rdm_sprints").delete().eq("id", id);
  if (error) throw error;
}

// ── RDM Sprint Redmines ───────────────────────────────────────────────────────
export async function addRdmSprintRedmine(payload: RdmSprintRedmineInsert): Promise<RdmSprintRedmine> {
  const { data, error } = await supabase
    .from("rdm_sprint_redmines").insert(payload).select().single();
  if (error) throw error;
  return data as RdmSprintRedmine;
}

export async function updateRdmSprintRedmine(
  id: string, updates: RdmSprintRedmineUpdate
): Promise<void> {
  const { error } = await supabase
    .from("rdm_sprint_redmines")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRdmSprintRedmine(id: string): Promise<void> {
  const { error } = await supabase.from("rdm_sprint_redmines").delete().eq("id", id);
  if (error) throw error;
}

// ── Dashboard KPIs ────────────────────────────────────────────────────────────
export async function getDashboardKpis(
  teamId?: string, inicio?: string, fim?: string
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc("fn_rdm_dashboard_kpis", {
    p_team_id: teamId ?? null,
    p_inicio:  inicio ?? null,
    p_fim:     fim ?? null,
  });
  if (error) throw error;
  return (data as Record<string, unknown>) ?? {};
}
