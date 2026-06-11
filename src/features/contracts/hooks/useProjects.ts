import { useState, useEffect, useCallback } from 'react';
import {
  fetchProjectsByTeam,
  createProject,
  updateProject,
  archiveProject,
  linkTeamToProject,
  unlinkTeamFromProject,
  type Project,
  type ProjectInput,
} from '../services/projects.service';

export function useProjects(contractId: string | null) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!contractId) { setProjects([]); return; }
    setLoading(true);
    setError(null);
    try {
      setProjects(await fetchProjectsByTeam(contractId));
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  const addProject = useCallback(async (input: ProjectInput) => {
    await createProject(input);
    await load();
  }, [load]);

  const editProject = useCallback(async (id: string, input: Partial<ProjectInput>) => {
    await updateProject(id, input);
    await load();
  }, [load]);

  const removeProject = useCallback(async (id: string) => {
    await archiveProject(id);
    await load();
  }, [load]);

  const linkTeam = useCallback(async (projectId: string, teamId: string) => {
    await linkTeamToProject({ name: projectId } as any);
    await load();
  }, [load]);

  const unlinkTeam = useCallback(async (teamId: string) => {
    await unlinkTeamFromProject(teamId);
    await load();
  }, [load]);

  return { projects, loading, error, reload: load, addProject, editProject, removeProject, linkTeam, unlinkTeam };
}
