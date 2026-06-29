import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compareTeamNames, resolveContractTeamIds } from "../lib/resolveContractTeamIds";

export type CapacityStatus = "ok" | "warning" | "overloaded" | "idle" | "unknown";

export interface DevCapacity {
  userId: string;
  devId: string;
  devName: string;
  declaredHours: number;
  capacityHours: number;
  allocatedHours: number;
  realizedHours: number;
  utilizationPct: number;
  isOverloaded: boolean;
  status: CapacityStatus;
  wipCount: number;
  pausedCount: number;
  slaCriticalCount: number;
  noActiveSprint: boolean;
  unestimatedCount: number;
  tasks: { title: string; estimatedHours: number; status: string }[];
}

export interface TeamCapacity {
  teamId: string;
  teamName: string;
  module: string;
  sprintAtivo: string | null;
  sprintEndDate: string | null;
  totalCapacity: number;
  totalAllocated: number;
  totalRealized: number;
  utilizationPct: number;
  devs: DevCapacity[];
}

export interface CapacityTeamRow {
  id: string;
  name: string;
  module?: string | null;
}

export interface CapacityDeveloperRow {
  id: string;
  name: string;
  team_id: string;
  user_id?: string | null;
}

export interface CapacitySprintRow {
  id: string;
  name: string;
  team_id: string;
  start_date?: string | null;
  end_date?: string | null;
}

export interface CapacityStoryRow {
  id: string;
  title: string;
  estimated_hours?: number | null;
  story_points?: number | null;
  status: string;
  team_id: string;
  sprint_id?: string | null;
  assignee_id?: string | null;
}

export interface CapacityActivityRow {
  id: string;
  hu_id: string;
  assignee_id?: string | null;
  hours?: number | null;
}

export interface CapacityDeclarationRow {
  user_id?: string | null;
  team_id?: string | null;
  sprint_id?: string | null;
  declared_hours?: number | null;
}

const DEFAULT_CAPACITY_HOURS = 40;
const TERMINAL_STATUSES = new Set([
  "concluido",
  "concluida",
  "done",
  "accepted",
  "aceite",
  "aceite final",
  "ag aceite final",
  "resolvido",
  "cancelado",
  "cancelada",
  "cancelled",
  "backlog",
]);

function normalizeStatus(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
}

function roundHours(value: number) {
  return Math.round(value * 10) / 10;
}

function resolveStatus(args: {
  noActiveSprint: boolean;
  storyCount: number;
  unestimatedCount: number;
  utilizationPct: number;
}): CapacityStatus {
  if (args.noActiveSprint) return "unknown";
  if (args.storyCount > 0 && args.unestimatedCount === args.storyCount) return "unknown";
  if (args.utilizationPct > 100) return "overloaded";
  if (args.utilizationPct >= 80) return "warning";
  if (args.utilizationPct > 0) return "ok";
  return "idle";
}

function latestActiveSprintByTeam(sprints: CapacitySprintRow[]) {
  const result = new Map<string, CapacitySprintRow>();
  for (const sprint of [...sprints].sort((left, right) =>
    String(right.start_date ?? "").localeCompare(String(left.start_date ?? "")))) {
    if (!result.has(sprint.team_id)) result.set(sprint.team_id, sprint);
  }
  return result;
}

function declaredCapacity(args: {
  developer: CapacityDeveloperRow;
  activeSprint: CapacitySprintRow | null;
  declarations: CapacityDeclarationRow[];
}) {
  if (!args.developer.user_id) return DEFAULT_CAPACITY_HOURS;
  const matching = args.declarations.filter((declaration) =>
    declaration.user_id === args.developer.user_id
    && (!declaration.team_id || declaration.team_id === args.developer.team_id)
    && (!declaration.sprint_id || declaration.sprint_id === args.activeSprint?.id));
  const total = matching.reduce((sum, declaration) =>
    sum + Number(declaration.declared_hours ?? 0), 0);
  return total > 0 ? roundHours(total) : DEFAULT_CAPACITY_HOURS;
}

export function buildCapacityModel(args: {
  teams: CapacityTeamRow[];
  developers: CapacityDeveloperRow[];
  sprints: CapacitySprintRow[];
  stories: CapacityStoryRow[];
  activities: CapacityActivityRow[];
  declarations?: CapacityDeclarationRow[];
}): TeamCapacity[] {
  const activeSprintByTeam = latestActiveSprintByTeam(args.sprints);
  const declarations = args.declarations ?? [];

  return [...args.teams]
    .sort((left, right) => compareTeamNames(left.name, right.name))
    .map((team) => {
      const activeSprint = activeSprintByTeam.get(team.id) ?? null;
      const teamDevelopers = args.developers.filter((developer) => developer.team_id === team.id);
      const sprintStories = activeSprint
        ? args.stories.filter((story) =>
          story.team_id === team.id && story.sprint_id === activeSprint.id)
        : [];

      const devs = teamDevelopers.map((developer) => {
        const developerStories = sprintStories.filter((story) => story.assignee_id === developer.id);
        const developerStoryIds = new Set(developerStories.map((story) => story.id));
        const capacityHours = declaredCapacity({ developer, activeSprint, declarations });
        const allocatedHours = roundHours(developerStories.reduce((sum, story) =>
          sum + Number(story.estimated_hours ?? 0), 0));
        const realizedHours = roundHours(args.activities
          .filter((activity) =>
            activity.assignee_id === developer.id && developerStoryIds.has(activity.hu_id))
          .reduce((sum, activity) => sum + Number(activity.hours ?? 0), 0));
        const unestimatedCount = developerStories.filter((story) =>
          story.estimated_hours == null).length;
        const activeTasks = developerStories.filter((story) =>
          !TERMINAL_STATUSES.has(normalizeStatus(story.status)));
        const utilizationPct = capacityHours > 0
          ? Math.round((allocatedHours / capacityHours) * 100)
          : allocatedHours > 0 ? 100 : 0;
        const noActiveSprint = !activeSprint;
        const status = resolveStatus({
          noActiveSprint,
          storyCount: developerStories.length,
          unestimatedCount,
          utilizationPct,
        });

        return {
          userId: developer.user_id ?? developer.id,
          devId: developer.id,
          devName: developer.name || "Sem nome",
          declaredHours: capacityHours,
          capacityHours,
          allocatedHours,
          realizedHours,
          utilizationPct,
          isOverloaded: status === "overloaded",
          status,
          wipCount: activeTasks.length,
          pausedCount: 0,
          slaCriticalCount: 0,
          noActiveSprint,
          unestimatedCount,
          tasks: activeTasks.map((story) => ({
            title: story.title,
            estimatedHours: Number(story.estimated_hours ?? 0),
            status: story.status,
          })),
        } satisfies DevCapacity;
      }).sort((left, right) =>
        right.utilizationPct - left.utilizationPct
        || left.devName.localeCompare(right.devName, "pt-BR"));

      const totalCapacity = roundHours(devs.reduce((sum, developer) =>
        sum + developer.capacityHours, 0));
      const totalAllocated = roundHours(devs.reduce((sum, developer) =>
        sum + developer.allocatedHours, 0));
      const totalRealized = roundHours(devs.reduce((sum, developer) =>
        sum + developer.realizedHours, 0));

      return {
        teamId: team.id,
        teamName: team.name,
        module: team.module ?? "sala_agil",
        sprintAtivo: activeSprint?.name ?? null,
        sprintEndDate: activeSprint?.end_date ?? null,
        totalCapacity,
        totalAllocated,
        totalRealized,
        utilizationPct: totalCapacity > 0
          ? Math.round((totalAllocated / totalCapacity) * 100)
          : 0,
        devs,
      } satisfies TeamCapacity;
    });
}

/**
 * Agrega a capacidade dos times vinculados ao contrato. A fonte oficial do
 * roster da Sala Ágil é `developers`; `team_members` representa acesso/RBAC e
 * não pode ser usado para concluir que um time não possui desenvolvedores.
 */
export function useCapacityPlanner(contractId?: string | null) {
  const [teamCapacities, setTeamCapacities] = useState<TeamCapacity[]>([]);
  const [overloadedDevs, setOverloadedDevs] = useState<DevCapacity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [uniqueTeams, setUniqueTeams] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWarnings([]);

    try {
      const allowedTeamIds = await resolveContractTeamIds(contractId);
      if (allowedTeamIds !== null && allowedTeamIds.length === 0) {
        setTeamCapacities([]);
        setOverloadedDevs([]);
        setUniqueTeams([]);
        return;
      }

      let teamsQuery = supabase
        .from("teams")
        .select("id,name,module")
        .order("name", { ascending: true });
      if (allowedTeamIds) teamsQuery = teamsQuery.in("id", allowedTeamIds);
      const { data: teamsRaw, error: teamsError } = await teamsQuery;
      if (teamsError) throw teamsError;

      const teams = ((teamsRaw ?? []) as CapacityTeamRow[])
        .slice()
        .sort((left, right) => compareTeamNames(left.name, right.name));
      setUniqueTeams(teams.map((team) => ({ id: team.id, name: team.name })));
      if (!teams.length) {
        setTeamCapacities([]);
        setOverloadedDevs([]);
        return;
      }

      const scopedTeams = selectedTeam === "all"
        ? teams
        : teams.filter((team) => team.id === selectedTeam);
      const scopedTeamIds = scopedTeams.map((team) => team.id);
      if (!scopedTeamIds.length) {
        setTeamCapacities([]);
        setOverloadedDevs([]);
        return;
      }

      const [developersResult, sprintsResult, declarationsResult] = await Promise.all([
        supabase
          .from("developers")
          .select("id,name,team_id,user_id")
          .in("team_id", scopedTeamIds)
          .order("name", { ascending: true }),
        supabase
          .from("sprints")
          .select("id,name,team_id,start_date,end_date")
          .in("team_id", scopedTeamIds)
          .eq("is_active", true)
          .order("start_date", { ascending: false }),
        (supabase as any)
          .from("capacity_declarations")
          .select("user_id,team_id,sprint_id,declared_hours")
          .in("team_id", scopedTeamIds),
      ]);

      if (developersResult.error) throw developersResult.error;
      if (sprintsResult.error) throw sprintsResult.error;

      const developers = (developersResult.data ?? []) as CapacityDeveloperRow[];
      const sprints = (sprintsResult.data ?? []) as CapacitySprintRow[];
      const activeSprintIds = sprints.map((sprint) => sprint.id);

      let stories: CapacityStoryRow[] = [];
      let activities: CapacityActivityRow[] = [];
      if (activeSprintIds.length) {
        const storiesResult = await supabase
          .from("user_stories")
          .select("id,title,estimated_hours,story_points,status,team_id,sprint_id,assignee_id")
          .in("team_id", scopedTeamIds)
          .in("sprint_id", activeSprintIds)
          .limit(5000);
        if (storiesResult.error) throw storiesResult.error;
        stories = (storiesResult.data ?? []) as CapacityStoryRow[];

        const storyIds = stories.map((story) => story.id);
        if (storyIds.length) {
          const activitiesResult = await supabase
            .from("activities")
            .select("id,hu_id,assignee_id,hours")
            .in("team_id", scopedTeamIds)
            .in("hu_id", storyIds)
            .limit(5000);
          if (activitiesResult.error) throw activitiesResult.error;
          activities = (activitiesResult.data ?? []) as CapacityActivityRow[];
        }
      }

      const capacityWarning = declarationsResult?.error
        ? "As declarações de capacidade não puderam ser carregadas; foi aplicado o padrão de 40h por desenvolvedor."
        : null;
      const declarations = declarationsResult?.error
        ? []
        : (declarationsResult?.data ?? []) as CapacityDeclarationRow[];
      if (capacityWarning) setWarnings([capacityWarning]);

      const result = buildCapacityModel({
        teams: scopedTeams,
        developers,
        sprints,
        stories,
        activities,
        declarations,
      });

      setTeamCapacities(result);
      setOverloadedDevs(result.flatMap((team) => team.devs)
        .filter((developer) => developer.isOverloaded));
    } catch (loadError: any) {
      console.error("[useCapacityPlanner] Falha ao carregar capacidade:", loadError);
      setError(loadError?.message ?? "Não foi possível carregar a capacidade dos times.");
      setTeamCapacities([]);
      setOverloadedDevs([]);
    } finally {
      setLoading(false);
    }
  }, [contractId, selectedTeam]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    teamCapacities,
    overloadedDevs,
    loading,
    error,
    warnings,
    selectedTeam,
    setSelectedTeam,
    reload: load,
    uniqueTeams,
  };
}
