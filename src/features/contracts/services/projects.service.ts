import { supabase } from '@/integrations/supabase/client';

export interface Project {
  id: string;
  contract_id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  module_type: 'sustenance' | 'agile' | 'mixed';
  status: 'active' | 'paused' | 'archived';
  redmine_id?: number | null;
  created_at: string;
  updated_at: string;
  // join
  teams?: { id: string; name: string; team_type?: string | null }[];
}

export interface ProjectInput {
  contract_id: string;
  name: string;
  code?: string;
  description?: string;
  module_type: 'sustenance' | 'agile' | 'mixed';
  redmine_id?: number | null;
}

export async function fetchProjectsByContract(contractId: string): Promise<Project[]> {
  const { data, error } = await (supabase as any)
    .from('projects')
    .select('id, contract_id, name, code, description, module_type, status, redmine_id, created_at, updated_at, teams(id, name, team_type)')
    .eq('contract_id', contractId)
    .eq('status', 'active')
    .order('name');
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const { data, error } = await (supabase as any)
    .from('projects')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

export async function updateProject(id: string, input: Partial<ProjectInput>): Promise<void> {
  const { error } = await (supabase as any)
    .from('projects')
    .update(input)
    .eq('id', id);
  if (error) throw error;
}

export async function archiveProject(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('projects')
    .update({ status: 'archived' })
    .eq('id', id);
  if (error) throw error;
}

export async function linkTeamToProject(projectId: string, teamId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('teams')
    .update({ project_id: projectId })
    .eq('id', teamId);
  if (error) throw error;
}

export async function unlinkTeamFromProject(teamId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('teams')
    .update({ project_id: null })
    .eq('id', teamId);
  if (error) throw error;
}
