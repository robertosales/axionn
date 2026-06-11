import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SprintMetrics {
  sprintId:         string;
  sprintName:       string;
  teamId:           string;
  teamName:         string;
  startDate:        string;
  endDate:          string;
  totalHUs:         number;
  completedHUs:     number;
  completionRate:   number;
  plannedPoints:    number;
  deliveredPoints:  number;
  velocity:         number;
  avgCycleTime:     number | null;
  bugs:             number;
  rework:           number;
  // extra
  sprintGoal?:      string;
  retroNotes?:      string;
}

export interface TeamComparativo {
  teamId:   string;
  teamName: string;
  avgVelocity:       number;
  avgCompletionRate: number;
  totalSprints:      number;
}

export interface HistoryFilters {
  teamId:  string;
  periodo: string;
}

/**
 * contractId: quando fornecido, filtra sprints pelos times
 * que pertencem a projetos desse contrato.
 */
export function useSprintHistory(contractId?: string | null) {
  const [metrics,         setMetrics]         = useState<SprintMetrics[]>([]);
  const [teamComparativo, setTeamComparativo] = useState<TeamComparativo[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [filters,         setFilters]         = useState<HistoryFilters>({ teamId: 'all', periodo: '90' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Se contractId, restringe aos times vinculados ao contrato
      let allowedTeamIds: string[] | null = null;
      if (contractId) {
        const { data: projs } = await supabase
          .from('projects')
          .select('team_id')
          .eq('contract_id', contractId)
          .not('team_id', 'is', null);
        allowedTeamIds = [...new Set((projs ?? []).map((p: any) => p.team_id as string))];
        if (allowedTeamIds.length === 0) {
          setMetrics([]); setTeamComparativo([]); setLoading(false); return;
        }
      }

      let sprintsQuery = supabase
        .from('sprints')
        .select('id, name, team_id, start_date, end_date, goal, teams(name)')
        .eq('status', 'completed')
        .order('end_date', { ascending: false });

      if (filters.periodo !== 'all') {
        const since = new Date();
        since.setDate(since.getDate() - Number(filters.periodo));
        sprintsQuery = sprintsQuery.gte('end_date', since.toISOString().slice(0, 10));
      }
      if (filters.teamId !== 'all') {
        sprintsQuery = sprintsQuery.eq('team_id', filters.teamId);
      } else if (allowedTeamIds) {
        sprintsQuery = sprintsQuery.in('team_id', allowedTeamIds);
      }

      const { data: sprints, error: spErr } = await sprintsQuery;
      if (spErr || !sprints?.length) { setMetrics([]); setTeamComparativo([]); setLoading(false); return; }

      const sprintIds = sprints.map((s: any) => s.id);

      const [husRes, demandasRes] = await Promise.all([
        supabase.from('user_stories')
          .select('sprint_id, status, story_points, cycle_time_days, is_bug, is_rework')
          .in('sprint_id', sprintIds),
        supabase.from('demandas')
          .select('sprint_id, status, pontos, cycle_time_days, is_bug, is_rework')
          .in('sprint_id', sprintIds),
      ]);

      const hus      = husRes.data      ?? [];
      const demandas = demandasRes.data  ?? [];

      const result: SprintMetrics[] = sprints.map((s: any) => {
        const spHus = hus.filter((h: any) => h.sprint_id === s.id);
        const spDem = demandas.filter((d: any) => d.sprint_id === s.id);
        const allItems = [
          ...spHus.map((h: any) => ({ completed: ['done','accepted'].includes(h.status), points: h.story_points ?? 0, cycleTime: h.cycle_time_days ?? null, isBug: h.is_bug, isRework: h.is_rework })),
          ...spDem.map((d: any) => ({ completed: ['done','accepted'].includes(d.status), points: d.pontos ?? 0, cycleTime: d.cycle_time_days ?? null, isBug: d.is_bug, isRework: d.is_rework })),
        ];
        const total     = allItems.length;
        const completed = allItems.filter(i => i.completed).length;
        const planned   = allItems.reduce((a, i) => a + i.points, 0);
        const delivered = allItems.filter(i => i.completed).reduce((a, i) => a + i.points, 0);
        const cycleTimes = allItems.map(i => i.cycleTime).filter((c): c is number => c !== null);
        return {
          sprintId: s.id, sprintName: s.name,
          teamId: s.team_id, teamName: (Array.isArray(s.teams) ? s.teams[0]?.name : s.teams?.name) ?? s.team_id,
          startDate: s.start_date, endDate: s.end_date,
          totalHUs: total, completedHUs: completed,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
          plannedPoints: planned, deliveredPoints: delivered, velocity: delivered,
          avgCycleTime: cycleTimes.length ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) : null,
          bugs: allItems.filter(i => i.isBug).length,
          rework: allItems.filter(i => i.isRework).length,
          sprintGoal: s.goal ?? undefined,
        };
      });

      setMetrics(result);

      // Comparativo por time
      const byTeam: Record<string, SprintMetrics[]> = {};
      result.forEach(m => { if (!byTeam[m.teamId]) byTeam[m.teamId] = []; byTeam[m.teamId].push(m); });
      setTeamComparativo(Object.entries(byTeam).map(([teamId, ms]) => ({
        teamId, teamName: ms[0].teamName,
        avgVelocity:       Math.round(ms.reduce((a, m) => a + m.velocity, 0) / ms.length),
        avgCompletionRate: Math.round(ms.reduce((a, m) => a + m.completionRate, 0) / ms.length),
        totalSprints: ms.length,
      })));
    } finally {
      setLoading(false);
    }
  }, [contractId, filters]);

  useEffect(() => { load(); }, [load]);

  return { metrics, teamComparativo, loading, filters, setFilters };
}
