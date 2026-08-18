export interface MembershipTeam {
  id: string;
  name: string;
  module: string;
}

export interface TeamMembership {
  team_id: string;
  user_id: string;
  role: string | null;
}

export interface PersonTeamMembership extends MembershipTeam {
  role: string;
}

export function groupTeamMembershipsByUser(
  teams: MembershipTeam[],
  memberships: TeamMembership[],
) {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const result = new Map<string, PersonTeamMembership[]>();

  memberships.forEach((membership) => {
    const team = teamById.get(membership.team_id);
    if (!team) return;
    const existing = result.get(membership.user_id) || [];
    existing.push({ ...team, role: membership.role || "member" });
    result.set(membership.user_id, existing);
  });

  return result;
}
