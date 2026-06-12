import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SprintHistoryItem {
  id: string;
  name: string;
  team_id: string;
  start_date: string | null;
  end_date: string | null;
  goal: string | null;
  teams: { name: string } | null;
}

interface UseSprintHistoryOptions {
  /** IDs dos times a filtrar. Aceita um único ID (string) ou múltiplos (string[]). */
  teamId?: string | string[];
  /** Somente sprints encerradas a partir desta data (YYYY-MM-DD). */
  since?: string;
}

interface UseSprintHistoryResult {
  sprints: SprintHistoryItem[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Busca sprints encerradas (is_active = false) para um ou mais times.
 *
 * Correções aplicadas:
 * - Bug 1: a tabela `sprints` não tem coluna `status`; usa `is_active = false`.
 * - Bug 2: datas nulas causavam RangeError em `toISOString()`; agora há guard.
 */
export function useSprintHistory(
  options: UseSprintHistoryOptions = {},
): UseSprintHistoryResult {
  const { teamId, since } = options;

  const [sprints, setSprints] = useState<SprintHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    // Normaliza teamId para array ou undefined
    const teamIds: string[] | undefined =
      teamId === undefined
        ? undefined
        : Array.isArray(teamId)
        ? teamId.filter(Boolean)
        : [teamId].filter(Boolean);

    if (teamIds !== undefined && teamIds.length === 0) {
      setSprints([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ✅ Fix Bug 1: usa is_active = false (sem coluna `status`)
      let query = (supabase as any)
        .from('sprints')
        .select('id, name, team_id, start_date, end_date, goal, teams(name)')
        .eq('is_active', false)
        .order('end_date', { ascending: false });

      if (teamIds !== undefined) {
        if (teamIds.length === 1) {
          query = query.eq('team_id', teamIds[0]);
        } else {
          query = query.in('team_id', teamIds);
        }
      }

      // ✅ Fix Bug 2: só chama toISOString() se `since` for uma data válida
      if (since) {
        const sinceDate = new Date(since);
        if (!isNaN(sinceDate.getTime())) {
          query = query.gte('end_date', sinceDate.toISOString());
        }
      }

      const { data, error: sbError } = await query;

      if (sbError) {
        console.error('[useSprintHistory] Supabase error:', sbError);
        setError(sbError.message);
        return;
      }

      setSprints((data as SprintHistoryItem[]) ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[useSprintHistory] Unexpected error:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(teamId),
    since,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  return { sprints, loading, error, reload: load };
}
