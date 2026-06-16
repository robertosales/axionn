import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveContractTeamIds, compareTeamNames } from '../lib/resolveContractTeamIds';

export type CapacityStatus = 'ok' | 'warning' | 'overloaded' | 'idle' | 'unknown';

export interface DevCapacity {
  userId:           string;
  devId:            string;   // alias de userId
  devName:          string;
  declaredHours:    number;
  capacityHours:    number;   // alias de declaredHours
  allocatedHours:   number;
  realizedHours:    number;
  utilizationPct:   number;
  isOverloaded:     boolean;
  status:           CapacityStatus;
  wipCount:         number;
  pausedCount:      number;
  slaCriticalCount: number;
  tasks:            { title: string; estimatedHours: number; status: string }[];
}

export interface TeamCapacity {
  teamId:         string;
  teamName:       string;
  module:         string;
  sprintAtivo:    string | null;
  sprintEndDate:  string | null;
  totalCapacity:  number;
  totalAllocated: number;
  utilizationPct: number;
  devs:           DevCapacity[];
}

/**
 * contractId: quando fornecido, considera apenas times vinculados
 * a projetos desse contrato.
 */
export function useCapacityPlanner(contractId?: string | null) {
  const [teamCapacities, setTeamCapacities] = useState<TeamCapacity[]>([]);
  const [overloadedDevs, setOverloadedDevs] = useState<DevCapacity[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [selectedTeam,   setSelectedTeam]   = useState('all');
  const [uniqueTeams,    setUniqueTeams]    = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Times do contrato: união entre teams.contract_id e projects.contract_id
      const allowedTeamIds = await resolveContractTeamIds(contractId);
      if (allowedTeamIds !== null && allowedTeamIds.length === 0) {
        setTeamCapacities([]); setOverloadedDevs([]); setUniqueTeams([]);
        setLoading(false); return;
      }

      let teamsQuery = supabase.from('teams').select('id, name').order('name', { ascending: true });
      if (allowedTeamIds) teamsQuery = teamsQuery.in('id', allowedTeamIds);
      const { data: teamsRaw } = await teamsQuery;
      const teams = ((teamsRaw ?? []) as any[]).slice().sort((a, b) => compareTeamNames(a.name, b.name));
      if (!teams.length) { setTeamCapacities([]); setUniqueTeams([]); setLoading(false); return; }

      const teamIds = teams.map((t: any) => t.id);
      setUniqueTeams(teams.map((t: any) => ({ id: t.id, name: t.name })));

      const [membersRes, capacitiesRes, storiesRes] = await Promise.all([
        supabase.from('team_members').select('user_id, team_id, profiles(display_name)').in('team_id', teamIds),
        supabase.from('capacity_declarations').select('user_id, declared_hours, sprint_id').in('team_id', teamIds),
        supabase.from('user_stories').select('assigned_to, title, story_points, status, team_id')
          .in('team_id', teamIds).not('status', 'in', '(done,accepted,cancelled)'),
      ]);

      const members    = membersRes.data    ?? [];
      const capacities = capacitiesRes.data ?? [];
      const stories    = storiesRes.data    ?? [];

      const capacityMap: Record<string, number> = {};
      capacities.forEach((c: any) => {
        capacityMap[c.user_id] = (capacityMap[c.user_id] ?? 0) + (c.declared_hours ?? 0);
      });

      const result: TeamCapacity[] = teams.map((team: any) => {
        const teamMembers = members.filter((m: any) => m.team_id === team.id);
        const devs: DevCapacity[] = teamMembers.map((m: any) => {
          const name    = Array.isArray(m.profiles) ? m.profiles[0]?.display_name : m.profiles?.display_name;
          const decl    = capacityMap[m.user_id] ?? 0;
          const tasks   = stories
            .filter((s: any) => s.assigned_to === m.user_id)
            .map((s: any) => ({ title: s.title, estimatedHours: (s.story_points ?? 0) * 4, status: s.status }));
          const alloc   = tasks.reduce((a, t) => a + t.estimatedHours, 0);
          const utilPct = decl > 0 ? Math.round((alloc / decl) * 100) : (alloc > 0 ? 100 : 0);
          const status: CapacityStatus =
            decl === 0 && alloc === 0 ? 'idle'
            : utilPct > 100           ? 'overloaded'
            : utilPct >= 80           ? 'warning'
            : utilPct > 0             ? 'ok'
            : 'unknown';
          return {
            userId: m.user_id, devId: m.user_id, devName: name ?? 'Sem nome',
            declaredHours: decl, capacityHours: decl,
            allocatedHours: alloc, realizedHours: 0,
            utilizationPct: utilPct, isOverloaded: utilPct > 100,
            status, wipCount: tasks.length, pausedCount: 0, slaCriticalCount: 0,
            tasks,
          };
        });
        const totCap   = devs.reduce((a, d) => a + d.declaredHours,  0);
        const totAlloc = devs.reduce((a, d) => a + d.allocatedHours, 0);
        return {
          teamId: team.id, teamName: team.name,
          module: 'sala_agil',
          sprintAtivo: null, sprintEndDate: null,
          totalCapacity: totCap, totalAllocated: totAlloc,
          utilizationPct: totCap > 0 ? Math.round((totAlloc / totCap) * 100) : 0,
          devs,
        };
      });

      const filtered = selectedTeam === 'all' ? result : result.filter(t => t.teamId === selectedTeam);
      setTeamCapacities(filtered);
      setOverloadedDevs(filtered.flatMap(t => t.devs).filter(d => d.isOverloaded));
    } finally {
      setLoading(false);
    }
  }, [contractId, selectedTeam]);

  useEffect(() => { load(); }, [load]);

  return { teamCapacities, overloadedDevs, loading, selectedTeam, setSelectedTeam, reload: load, uniqueTeams };
}
