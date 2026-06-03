import { supabase } from '@/integrations/supabase/client';

export type ProjectTeamRole = 'agile' | 'sustentacao';

export interface ProjectTeam {
  id: string;
  project_id: string;
  team_id: string;
  role: ProjectTeamRole;
  created_at: string;
  // join fields
  team_name?: string;
  team_module?: string;
}

export interface ProjectWithTeams {
  id: string;
  nome: string;
  descricao?: string | null;
  contract_id?: string | null;
  sla?: string | null;
  project_teams: ProjectTeam[];
}

// ─ Busca projetos de um contrato com seus times vinculados ──────────────────
export async function fetchProjectsByContract(contractId: string): Promise<ProjectWithTeams[]> {
  const { data, error } = await (supabase as any)
    .from('projetos')
    .select(`
      id, nome, descricao, contract_id, sla,
      project_teams (
        id, project_id, team_id, role, created_at,
        teams ( id, name, module )
      )
    `)
    .eq('contract_id', contractId)
    .order('nome');
  if (error) throw error;

  return ((data ?? []) as any[]).map((p: any) => ({
    ...p,
    project_teams: (p.project_teams ?? []).map((pt: any) => ({
      id:          pt.id,
      project_id:  pt.project_id,
      team_id:     pt.team_id,
      role:        pt.role,
      created_at:  pt.created_at,
      team_name:   pt.teams?.name,
      team_module: pt.teams?.module,
    })),
  })) as ProjectWithTeams[];
}

// ─ Adiciona um time a um projeto ────────────────────────────────────────────
export async function addTeamToProject(
  projectId: string,
  teamId: string,
  role: ProjectTeamRole,
): Promise<void> {
  const { error } = await (supabase as any)
    .from('project_teams')
    .upsert({ project_id: projectId, team_id: teamId, role }, { onConflict: 'project_id,team_id' });
  if (error) throw error;
}

// ─ Remove um time de um projeto ──────────────────────────────────────────
export async function removeTeamFromProject(projectTeamId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('project_teams')
    .delete()
    .eq('id', projectTeamId);
  if (error) throw error;
}
