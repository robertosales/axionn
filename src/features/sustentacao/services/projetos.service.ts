import { supabase } from "@/integrations/supabase/client";

export interface Projeto {
  id: string;
  team_id: string;
  nome: string;
  descricao: string;
  equipe: string;
  sla: string;
  sla_id: string | null;
  contract_id: string | null; // Fase 2
  created_at: string;
  updated_at: string;
}

export async function fetchProjetos(teamId: string): Promise<Projeto[]> {
  const { data, error } = await supabase
    .from("projetos" as any)
    .select("*")
    .eq("team_id", teamId)
    .order("nome");
  if (error) throw error;
  return (data || []) as unknown as Projeto[];
}

export async function createProjeto(p: {
  team_id: string;
  nome: string;
  descricao?: string;
  equipe?: string;
  sla?: string;
  sla_id?: string | null;
  contract_id?: string | null;
}) {
  const { data, error } = await supabase
    .from("projetos" as any)
    .insert(p as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Projeto;
}

export async function updateProjeto(id: string, updates: Partial<Projeto>) {
  const { data, error } = await supabase
    .from("projetos" as any)
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Projeto;
}

export async function deleteProjeto(id: string) {
  const { error } = await supabase
    .from("projetos" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function upsertProjetos(
  teamId: string,
  rows: Array<{ nome: string; descricao?: string; equipe?: string; sla?: string }>,
) {
  for (const row of rows) {
    const { error } = await supabase.from("projetos" as any).insert({
      team_id:   teamId,
      nome:      row.nome,
      descricao: row.descricao || "",
      equipe:    row.equipe || "",
      sla:       row.sla || "padrao",
    } as any);
    if (error) throw error;
  }
}
