import { supabase } from '@/integrations/supabase/client';

export interface Project {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  module_type?: string | null;
  redmine_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

// Vínculo retornado pela tela de gestão do contrato
export interface ContractRoomBinding {
  id: string;           // contract_room_teams.id
  contract_id: string;
  team_id: string;
  project_id: string | null;
  room_type: 'agil' | 'sustentacao';
  is_active: boolean;
  team_name?: string;
  project_name?: string;
  project_code?: string | null;
  project_module_type?: string | null;
}

export interface ProjectInput {
  name: string;
  code?: string | null;
  description?: string | null;
  module_type?: string | null;
  redmine_id?: number | null;
}

// ── Catálogo global de projetos ──────────────────────────────────────────────────
// NOTA: `projects` não tem `team_id` nem `status` — é um catálogo global.
// O vínculo projeto ↔ time ↔ contrato é armazenado em contract_room_teams.
export async function fetchAllProjects(): Promise<Project[]> {
  const { data, error } = await (supabase as any)
    .from('projects')
    .select('id, name, code, description, module_type, redmine_id, created_at, updated_at')
    .order('name');
  if (error) throw error;
  return (data ?? []) as Project[];
}

/**
 * Projetos disponíveis para vincular a um time no BindModal (Step 2).
 *
 * Como `projects` é catálogo global sem team_id, retornamos todos os projetos
 * ordenados por nome. O usuário escolhe qual vincular ao time + contrato.
 * O parâmetro `teamId` é mantido na assinatura para compatibilidade futura
 * (ex: filtrar projetos já vinculados a outros contratos do time).
 */
export async function fetchProjectsByTeam(_teamId: string): Promise<Project[]> {
  const { data, error } = await (supabase as any)
    .from('projects')
    .select('id, name, code, description, module_type, redmine_id')
    .order('name');
  if (error) throw error;
  return (data ?? []) as Project[];
}

// ── Vínculos do contrato via contract_room_teams ────────────────────────────
export async function fetchBindingsByContract(contractId: string): Promise<ContractRoomBinding[]> {
  const { data, error } = await (supabase as any)
    .from('contract_room_teams')
    .select(`
      id, contract_id, team_id, project_id, room_type, is_active,
      teams!inner(name),
      projects(name, code, module_type)
    `)
    .eq('contract_id', contractId)
    .eq('is_active', true)
    .order('room_type')
    .order('teams(name)');
  if (error) throw error;
  return ((data ?? []) as any[]).map(r => ({
    id:                  r.id,
    contract_id:         r.contract_id,
    team_id:             r.team_id,
    project_id:          r.project_id,
    room_type:           r.room_type,
    is_active:           r.is_active,
    team_name:           r.teams?.name,
    project_name:        r.projects?.name ?? null,
    project_code:        r.projects?.code ?? null,
    project_module_type: r.projects?.module_type ?? null,
  }));
}

// ── Criar vínculo contrato ↔ time ↔ projeto ─────────────────────────────────
export async function createBinding(
  contractId: string,
  teamId: string,
  roomType: 'agil' | 'sustentacao',
  projectId?: string | null,
): Promise<void> {
  const { error } = await (supabase as any)
    .from('contract_room_teams')
    .insert({ contract_id: contractId, team_id: teamId, room_type: roomType, project_id: projectId ?? null });
  if (error) throw error;
}

// ── Remover vínculo ───────────────────────────────────────────────────────────
export async function removeBinding(bindingId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('contract_room_teams')
    .delete()
    .eq('id', bindingId);
  if (error) throw error;
}

// ── CRUD projetos (catálogo) ────────────────────────────────────────────────
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

// Legado mantido para compatibilidade
export { createProject as linkTeamToProject, archiveProject as unlinkTeamFromProject };
export type { ProjectInput as ProjectFormInput };
