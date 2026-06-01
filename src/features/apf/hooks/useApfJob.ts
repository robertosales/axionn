/**
 * useApfJob — hook para acompanhar status de um job APF em tempo real.
 *
 * Fluxo:
 *   1. Frontend enfileira job via INSERT em apf_jobs → recebe job.id
 *   2. Passa job.id para este hook
 *   3. Hook faz query inicial + subscribe via Realtime
 *   4. Fallback: polling a cada 3s caso o Realtime não dispare (race condition)
 *   5. Quando job.status = 'done', retorna result com pfTotal, providerUsed etc.
 *   6. Quando job.status = 'dead', retorna error_message
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase }                                  from '@/integrations/supabase/client';

export interface ApfJobResult {
  pfTotal?:        number | null;
  pfBreakdown?:    Record<string, number> | null;
  charCount?:      number;
  providerUsed?:   string;
  outputFilename?: string;
  markdown?:       string;
  fallback?:       { from: string; to: string; reason: string } | null;
}

export interface ApfJob {
  id:            string;
  status:        'pending' | 'processing' | 'done' | 'failed' | 'dead';
  attempts:      number;
  max_attempts:  number;
  result:        ApfJobResult | null;
  error_message: string | null;
  created_at:    string;
  started_at:    string | null;
  finished_at:   string | null;
}

const TERMINAL_STATUSES = new Set(['done', 'dead']);
const POLL_INTERVAL_MS  = 3_000; // fallback polling a cada 3s

export function useApfJob(jobId: string | null) {
  const [job, setJob]       = useState<ApfJob | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJob = useCallback(async (id: string): Promise<ApfJob | null> => {
    const { data } = await supabase
      .from('apf_jobs')
      .select('id, status, attempts, max_attempts, result, error_message, created_at, started_at, finished_at')
      .eq('id', id)
      .maybeSingle();
    if (data) {
      setJob(data as ApfJob);
      return data as ApfJob;
    }
    return null;
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      stopPolling();
      return;
    }

    setLoading(true);
    fetchJob(jobId).then((initial) => {
      setLoading(false);
      // Se já chegou terminal na query inicial, não precisa de canal
      if (initial && TERMINAL_STATUSES.has(initial.status)) return;

      // Realtime: atualiza o job quando o worker muda o status
      const channel = supabase
        .channel(`apf-job-${jobId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'apf_jobs', filter: `id=eq.${jobId}` },
          (payload) => {
            const updated = payload.new as ApfJob;
            setJob(updated);
            if (TERMINAL_STATUSES.has(updated.status)) stopPolling();
          },
        )
        .subscribe();

      // Fallback polling — garante que race conditions no Realtime não travem a UI
      pollRef.current = setInterval(async () => {
        const polled = await fetchJob(jobId);
        if (polled && TERMINAL_STATUSES.has(polled.status)) {
          stopPolling();
          supabase.removeChannel(channel);
        }
      }, POLL_INTERVAL_MS);

      return () => {
        stopPolling();
        supabase.removeChannel(channel);
      };
    });

    return () => { stopPolling(); };
  }, [jobId, fetchJob, stopPolling]);

  const isProcessing = job?.status === 'pending' || job?.status === 'processing';
  const isDone       = job?.status === 'done';
  const isFailed     = job?.status === 'dead';
  const isRetrying   = job?.status === 'failed';

  return { job, loading, isProcessing, isDone, isFailed, isRetrying };
}
