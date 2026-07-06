export interface AuthTeam {
  id: string;
  name: string;
  module: string;
  organizationId: string | null;
}

export function deduplicateTeams(teams: AuthTeam[]) {
  const seen = new Set<string>();

  return teams.filter((team) => {
    const key = `${team.id}::${team.module}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function chooseCurrentTeamId(options: {
  teams: AuthTeam[];
  currentTeamId: string | null;
  savedTeamId: string | null;
  activeModule: string | null;
}) {
  const { teams, currentTeamId, savedTeamId, activeModule } = options;
  const isValid = (teamId: string | null) =>
    Boolean(
      teamId &&
        teams.some(
          (team) =>
            team.id === teamId &&
            (activeModule === null || team.module === activeModule),
        ),
    );

  if (isValid(currentTeamId)) return currentTeamId;
  if (isValid(savedTeamId)) return savedTeamId;

  return (
    teams.find(
      (team) => activeModule === null || team.module === activeModule,
    )?.id ?? null
  );
}
