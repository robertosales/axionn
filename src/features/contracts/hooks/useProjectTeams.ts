import { useState, useEffect, useCallback } from 'react';
import {
  fetchProjectsByContract,
  addTeamToProject,
  removeTeamFromProject,
  type ProjectWithTeams,
  type ProjectTeamRole,
} from '../services/project_teams.service';

export function useProjectsByContract(contractId: string | null) {
  const [projects, setProjects] = useState<ProjectWithTeams[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!contractId) { setProjects([]); return; }
    setLoading(true);
    setError(null);
    try {
      setProjects(await fetchProjectsByContract(contractId));
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  const linkTeam = useCallback(async (
    projectId: string,
    teamId: string,
    role: ProjectTeamRole,
  ) => {
    await addTeamToProject(projectId, teamId, role);
    await load();
  }, [load]);

  const unlinkTeam = useCallback(async (projectTeamId: string) => {
    await removeTeamFromProject(projectTeamId);
    await load();
  }, [load]);

  return { projects, loading, error, reload: load, linkTeam, unlinkTeam };
}
