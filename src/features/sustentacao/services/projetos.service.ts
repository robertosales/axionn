/**
 * projetos.service.ts — tabela LEGADA `projetos`
 *
 * ⚠️  DEPRECADO para novos desenvolvimentos.
 *     A fonte de verdade de projetos migrou para `public.projects` (Fase 5c).
 *     Use src/features/admin/services/projects.service.ts para criar/editar projetos.
 *     Este arquivo é mantido para compatibilidade com código existente que ainda leia
 *     da tabela legada via fetchProjetos / fetchProjetosComContrato.
 */
import { supabase } from "@/integrations/supabase/client";

export interface Projeto {
  id: string;
  team_id: string;
  nome: string;
  descricao: string | null;
  equipe: string | null;
  sla: string;
  sla_id: string | null;
  contract_id: string | null;
  created_at: string;
  updated_at: string;
  // join opcional carregado por fetchProjetosComContrato
  contract_name?: string | null;
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

/** Busca projetos já com o nome do contrato vinculado (para exibir no select do DemandaForm) */
export async function fetchProjetosComContrato(teamId: string): Promise<Projeto[]> {
  const { data, error } = await (supabase as any)
    .from("projetos")
    .select(`
      id, team_id, nome, descricao, equipe, sla, sla_id, contract_id, created_at, updated_at,
      contracts ( name )
    `)
    .eq("team_id", teamId)
    .order("nome");
  if (error) throw error;
  return ((data ?? []) as any[]).map((p: any) => ({
    ...p,
    contract_name: p.contracts?.name ?? null,
    contracts: undefined,
  })) as Projeto[];
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

/**
 * upsertProjetos — importação em lote na tabela LEGADA.
 *
 * ⚠️  A ImportacaoView agora grava em public.projects.
 *     Este método existe para retrocompatibilidade com qualquer chamador remanescente.
 *
 * P2a: usa upsert real (onConflict: nome,team_id) em vez de insert puro,
 * evitando erros de unique-constraint quando a função for chamada duas vezes
 * com os mesmos dados.
 */
export async function upsertProjetos(
  teamId: string,
  rows: Array<{ nome: string; descricao?: string; equipe?: string; sla?: string }>,
) {
  if (rows.length === 0) return;
  const payload = rows.map((row) => ({
    team_id:   teamId,
    nome:      row.nome,
    descricao: row.descricao || "",
    equipe:    row.equipe    || "",
    sla:       row.sla       || "padrao",
  }));
  // ignoreDuplicates: true — se o par (nome, team_id) já existir, mantém o registro
  // atual sem sobrescrever; use updateProjeto para edições explícitas.
  const { error } = await (supabase as any)
    .from("projetos")
    .upsert(payload, { onConflict: "nome,team_id", ignoreDuplicates: true });
  if (error) throw error;
}
