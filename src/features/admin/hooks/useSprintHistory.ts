import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveContractTeamIds, compareTeamNames } from '../lib/resolveContractTeamIds';

export type PeriodoFiltro = '3m' | '6m' | '12m' | 'all';

export interface SprintDevStat {
  developerId:    string;
  developerName:  string;
  husCount:       number;
  estimatedHours: number;
  realizedHours:  number;
}

export interface SprintMetrics {
  sprintId:         string;
  sprintName:       string;
  teamId:           string;
  teamName:         string;
  startDate:        string;
  endDate:          string;
  durationDays:     number;
  goal?:            string;
  totalHUs:         number;
  completedHUs:     number;
  husConcluidadas:  number;
  completionRate:   number;
  taxaConclusao:    number;
  plannedPoints:    number;
  deliveredPoints:  number;
  velocity:         number;
  velocityPontos:   number;
  horasPlanejadas:  number;
  horasRealizadas:  number;
  desvioHoras:      number;
  impedimentos:     number;
  avgCycleTime:     number | null;
  bugs:             number;
  rework:           number;
  sprintGoal?:      string;
  retroNotes?:      string;
  devStats:         SprintDevStat[];
}

export interface TeamComparativo {
  teamId:             string;
  teamName:           string;
  module?:            string;
  avgVelocity:        number;
  avgCompletionRate:  number;
  avgTaxaConclusao:   number;
  avgDesvioHoras:     number;
  totalImpedimentos:  number;
  totalSprints:       number;
}

export interface HistoryFilters {
  teamId:  string;
  periodo: PeriodoFiltro | string;
}

// Alias mantido para componentes que importam SprintHistoryFilters.
export type SprintHistoryFilters = HistoryFilters;

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
      // Times do contrato: união entre teams.contract_id e projects.contract_id
      const allowedTeamIds = await resolveContractTeamIds(contractId);
      if (allowedTeamIds !== null && allowedTeamIds.length === 0) {
        setMetrics([]); setTeamComparativo([]); setLoading(false); return;
      }

      let sprintsQuery = supabase
        .from('sprints')
        .select('id, name, team_id, start_date, end_date, goal, teams(name)')
        .eq('is_active', false)
        .order('end_date', { ascending: false });

      if (filters.periodo !== 'all') {
        const months = filters.periodo.endsWith('m')
          ? Number(filters.periodo.replace('m', ''))
          : Number(filters.periodo);
        if (!Number.isNaN(months) && months > 0) {
          const since = new Date();
          since.setMonth(since.getMonth() - months);
          sprintsQuery = sprintsQuery.gte('end_date', since.toISOString().slice(0, 10));
        }
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
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const durationDays = s.start_date && s.end_date
          ? Math.max(1, Math.round((new Date(s.end_date).getTime() - new Date(s.start_date).getTime()) / 86_400_000))
          : 0;
        return {
          sprintId: s.id, sprintName: s.name,
          teamId: s.team_id, teamName: (Array.isArray(s.teams) ? s.teams[0]?.name : s.teams?.name) ?? s.team_id,
          startDate: s.start_date, endDate: s.end_date,
          durationDays,
          goal: s.goal ?? undefined,
          totalHUs: total, completedHUs: completed,
          husConcluidadas: completed,
          completionRate,
          taxaConclusao: completionRate,
          plannedPoints: planned, deliveredPoints: delivered, velocity: delivered,
          velocityPontos: delivered,
          horasPlanejadas: 0,
          horasRealizadas: 0,
          desvioHoras: 0,
          impedimentos: 0,
          avgCycleTime: cycleTimes.length ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) : null,
          bugs: allItems.filter(i => i.isBug).length,
          rework: allItems.filter(i => i.isRework).length,
          sprintGoal: s.goal ?? undefined,
          devStats: [],
        };
      });

      setMetrics(result);

      // Comparativo por time
      const byTeam: Record<string, SprintMetrics[]> = {};
      result.forEach(m => { if (!byTeam[m.teamId]) byTeam[m.teamId] = []; byTeam[m.teamId].push(m); });
      const comparativo = Object.entries(byTeam).map(([teamId, ms]) => {
        const avgCompletion = Math.round(ms.reduce((a, m) => a + m.completionRate, 0) / ms.length);
        return {
          teamId, teamName: ms[0].teamName,
          avgVelocity:       Math.round(ms.reduce((a, m) => a + m.velocity, 0) / ms.length),
          avgCompletionRate: avgCompletion,
          avgTaxaConclusao:  avgCompletion,
          avgDesvioHoras:    0,
          totalImpedimentos: 0,
          totalSprints:      ms.length,
        };
      });
      comparativo.sort((a, b) => compareTeamNames(a.teamName, b.teamName));
      setTeamComparativo(comparativo);
    } finally {
      setLoading(false);
    }
  }, [contractId, filters]);

  useEffect(() => { load(); }, [load]);

  return { metrics, teamComparativo, loading, filters, setFilters };
}
