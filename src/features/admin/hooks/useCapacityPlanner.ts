import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DevCapacity {
  userId:        string;
  devName:       string;
  declaredHours: number;
  allocatedHours: number;
  utilizationPct: number;
  isOverloaded:   boolean;
  tasks:          { title: string; estimatedHours: number; status: string }[];
}

export interface TeamCapacity {
  teamId:        string;
  teamName:      string;
  totalCapacity: number;
  totalAllocated: number;
  utilizationPct: number;
  devs:          DevCapacity[];
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
      // Descobre times permitidos pelo contrato
      let allowedTeamIds: string[] | null = null;
      if (contractId) {
        const { data: projs } = await supabase
          .from('projects')
          .select('team_id')
          .eq('contract_id', contractId)
          .not('team_id', 'is', null);
        allowedTeamIds = [...new Set((projs ?? []).map((p: any) => p.team_id as string))];
        if (allowedTeamIds.length === 0) {
          setTeamCapacities([]); setOverloadedDevs([]); setUniqueTeams([]);
          setLoading(false); return;
        }
      }

      let teamsQuery = supabase.from('teams').select('id, name');
      if (allowedTeamIds) teamsQuery = teamsQuery.in('id', allowedTeamIds);
      const { data: teams } = await teamsQuery;
      if (!teams?.length) { setTeamCapacities([]); setUniqueTeams([]); setLoading(false); return; }

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
          return {
            userId: m.user_id, devName: name ?? 'Sem nome',
            declaredHours: decl, allocatedHours: alloc,
            utilizationPct: utilPct, isOverloaded: utilPct > 100, tasks,
          };
        });
        const totCap   = devs.reduce((a, d) => a + d.declaredHours,  0);
        const totAlloc = devs.reduce((a, d) => a + d.allocatedHours, 0);
        return {
          teamId: team.id, teamName: team.name,
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
