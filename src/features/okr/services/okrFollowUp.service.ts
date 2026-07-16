import { supabase } from "@/integrations/supabase/client";
import type { OkrInitiative, OkrSnapshot } from "../types";

export async function fetchKrSnapshots(keyResultId: string): Promise<OkrSnapshot[]> {
  const { data, error } = await (supabase as any).from("okr_key_result_snapshots").select("*")
    .eq("key_result_id", keyResultId).order("measured_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchObjectiveInitiatives(objectiveId: string): Promise<OkrInitiative[]> {
  const { data, error } = await (supabase as any).from("okr_initiatives").select("*")
    .eq("objective_id", objectiveId).order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createObjectiveInitiative(args: { objectiveId: string; title: string; dueDate?: string; createdBy: string }) {
  const { error } = await (supabase as any).from("okr_initiatives").insert({
    objective_id: args.objectiveId, title: args.title.trim(), due_date: args.dueDate || null,
    status: "planned", created_by: args.createdBy,
  });
  if (error) throw error;
}

export async function updateInitiativeStatus(id: string, status: OkrInitiative["status"]) {
  const now = new Date().toISOString();
  const { error } = await (supabase as any).from("okr_initiatives").update({
    status, completed_at: status === "completed" ? now : null, updated_at: now,
  }).eq("id", id);
  if (error) throw error;
}
