import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  persistModuleTeamSelection,
  readModuleTeamSelection,
  type OperationalModule,
} from "@/lib/moduleTeamSelection";

export function useModuleTeam(module: OperationalModule) {
  const { teams, currentTeamId, setCurrentTeamId, loading } = useAuth();
  const [showTeamModal, setShowTeamModal] = useState(false);

  const moduleTeams = useMemo(
    () => teams.filter((team) => team.module === module),
    [module, teams],
  );

  const selectModuleTeam = useCallback((teamId: string) => {
    if (!moduleTeams.some((team) => team.id === teamId)) return;
    persistModuleTeamSelection(module, teamId);
    setCurrentTeamId(teamId);
    setShowTeamModal(false);
  }, [module, moduleTeams, setCurrentTeamId]);

  useEffect(() => {
    if (loading || moduleTeams.length === 0) return;

    const savedTeamId = readModuleTeamSelection(module);
    if (savedTeamId && moduleTeams.some((team) => team.id === savedTeamId)) {
      if (currentTeamId !== savedTeamId) setCurrentTeamId(savedTeamId);
      setShowTeamModal(false);
      return;
    }

    if (currentTeamId && moduleTeams.some((team) => team.id === currentTeamId)) {
      persistModuleTeamSelection(module, currentTeamId);
      setShowTeamModal(false);
      return;
    }

    if (moduleTeams.length === 1) {
      selectModuleTeam(moduleTeams[0].id);
      return;
    }

    setShowTeamModal(true);
  }, [currentTeamId, loading, module, moduleTeams, selectModuleTeam, setCurrentTeamId]);

  const moduleTeamId = moduleTeams.some((team) => team.id === currentTeamId)
    ? currentTeamId
    : null;

  return {
    moduleTeamId,
    moduleTeams,
    showTeamModal,
    setModuleTeamId: selectModuleTeam,
    closeTeamModal: () => setShowTeamModal(false),
  };
}
