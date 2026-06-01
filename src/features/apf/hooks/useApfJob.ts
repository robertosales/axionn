/**
 * useApfJob — hook para acompanhar status de um job APF em tempo real.
 *
 * Uso:
 *   const { job, isProcessing, isDone, isFailed } = useApfJob(jobId);
 *
 * Fluxo:
 *   1. Frontend enfileira job via INSERT em apf_jobs → recebe job.id
 *   2. Passa job.id para este hook
 *   3. Hook faz query inicial + subscribe via Realtime
 *   4. Quando job.status = 'done', retorna result com pfTotal, providerUsed etc.
 *   5. Quando job.status = 'dead', retorna error_message
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase }                          from '@/integrations/supabase/client';

export interface ApfJobResult {
  pfTotal?:       number | null;
  pfBreakdown?:   Record<string, number> | null;
  charCount?:     number;
  providerUsed?:  string;
  outputFilename?: string;
  fallback?:      { from: string; to: string; reason: string } | null;
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

export function useApfJob(jobId: string | null) {
  const [job, setJob] = useState<ApfJob | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchJob = useCallback(async (id: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('apf_jobs')
      .select('id, status, attempts, max_attempts, result, error_message, created_at, started_at, finished_at')
      .eq('id', id)
      .maybeSingle();
    if (data) setJob(data as ApfJob);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!jobId) { setJob(null); return; }

    fetchJob(jobId);

    // Realtime: atualiza o job quando o worker muda o status
    const channel = supabase
      .channel(`apf-job-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'apf_jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          setJob(payload.new as ApfJob);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [jobId, fetchJob]);

  const isProcessing = job?.status === 'pending' || job?.status === 'processing';
  const isDone       = job?.status === 'done';
  const isFailed     = job?.status === 'dead';
  const isRetrying   = job?.status === 'failed';

  return { job, loading, isProcessing, isDone, isFailed, isRetrying };
}
