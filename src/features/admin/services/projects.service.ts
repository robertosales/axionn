/**
 * projects.service.ts
 * Fase 5c: CRUD em public.projects (tabela nova).
 * Usa FK-hint "!team_id" e "!contract_id" para desambiguar joins no Supabase
 * quando a tabela projects tem mais de uma FK para teams ou contracts.
 */
import { supabase } from '@/integrations/supabase/client';

export interface ProjetoAdmin {
  id:                  string;
  contract_id:         string | null;
  team_id:             string | null;
  name:                string;
  description:         string | null;
  code:                string | null;
  module_type:         'sustenance' | 'agile' | 'mixed';
  status:              'active' | 'paused' | 'archived';
  redmine_id:          number | null;
  sla_id:              string | null;
  legacy_projetos_id:  string | null;
  created_at:          string;
  updated_at:          string;
  // joins opcionais
  contract_name?:      string | null;
  team_name?:          string | null;
  demandas_count?:     number;
}

/** Shape mínimo usado pela ImportacaoView para montar o projetoMap */
export interface ProjetoImport {
  id:          string;
  name:        string;
  team_id:     string | null;
  contract_id: string | null;
  status:      string;
}

export async function fetchProjetosAdmin(): Promise<ProjetoAdmin[]> {
  // Busca todos os projetos exceto arquivados
  const { data, error } = await (supabase as any)
    .from('projects')
    .select(`
      id, contract_id, team_id, name, description, code,
      module_type, status, redmine_id, sla_id, legacy_projetos_id,
      created_at, updated_at,
      contracts ( name )
    `)
    .neq('status', 'archived')
    .order('name');
  if (error) throw error;

  const rows = ((data ?? []) as any[]);

  // Busca nomes dos times em lote para evitar o join ambíguo
  const teamIds = [...new Set(rows.map((p: any) => p.team_id).filter(Boolean))] as string[];
  let teamMap: Record<string, string> = {};
  if (teamIds.length > 0) {
    const { data: teamsData } = await (supabase as any)
      .from('teams')
      .select('id, name')
      .in('id', teamIds);
    (teamsData ?? []).forEach((t: any) => { teamMap[t.id] = t.name; });
  }

  return rows.map((p: any) => ({
    ...p,
    contract_name: p.contracts?.name ?? null,
    team_name:     teamMap[p.team_id] ?? null,
    contracts:     undefined,
  })) as ProjetoAdmin[];
}

/**
 * fetchProjetosForImport — versão leve para a tela de importação de demandas.
 * Retorna TODOS os projetos ativos/pausados (sem filtro de time),
 * para que o projetoMap cubra qualquer projeto que apareça na planilha.
 */
export async function fetchProjetosForImport(): Promise<ProjetoImport[]> {
  const { data, error } = await (supabase as any)
    .from('projects')
    .select('id, name, team_id, contract_id, status')
    .neq('status', 'archived')
    .order('name');
  if (error) throw error;
  return (data ?? []) as ProjetoImport[];
}

export async function createProjetoAdmin(payload: {
  contract_id:  string;
  team_id:      string | null;
  name:         string;
  description?: string | null;
  code?:        string | null;
  module_type:  string;
  redmine_id?:  number | null;
}): Promise<ProjetoAdmin> {
  const { data, error } = await (supabase as any)
    .from('projects')
    .insert({ ...payload, status: 'active' })
    .select()
    .single();
  if (error) throw error;
  return data as ProjetoAdmin;
}

export async function updateProjetoAdmin(
  id: string,
  updates: Partial<ProjetoAdmin>,
): Promise<ProjetoAdmin> {
  const { data, error } = await (supabase as any)
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ProjetoAdmin;
}

export async function archiveProjetoAdmin(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('projects')
    .update({ status: 'archived' })
    .eq('id', id);
  if (error) throw error;
}
