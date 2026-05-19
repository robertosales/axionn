import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 20;

export interface RdmAuditLogProfile {
  display_name: string | null;
  email:        string | null;
}

export interface RdmAuditLogRow {
  id:             string;
  rdm_id:         string;
  profile_id:     string;
  campo:          string;
  valor_anterior: string | null;
  valor_novo:     string | null;
  created_at:     string;
  profile:        RdmAuditLogProfile | null;
}

export function useRdmAuditLog(rdmId: string | null) {
  const [logs, setLogs]       = useState<RdmAuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [page, setPage]       = useState(0);

  const fetchPage = useCallback(async (pageIndex: number, replace: boolean) => {
    if (!rdmId) return;
    pageIndex === 0 ? setLoading(true) : setLoadingMore(true);
    setError(null);
    try {
      const from = pageIndex * PAGE_SIZE;
      const to   = from + PAGE_SIZE - 1;
      const { data, error: err } = await supabase
        .from("rdm_audit_log")
        .select(`
          id, rdm_id, profile_id, campo, valor_anterior, valor_novo, created_at,
          profile:profiles!rdm_audit_log_profile_id_fkey(display_name, email)
        `)
        .eq("rdm_id", rdmId)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (err) throw err;
      const rows = (data ?? []) as RdmAuditLogRow[];
      setHasMore(rows.length === PAGE_SIZE);
      replace ? setLogs(rows) : setLogs((prev) => [...prev, ...rows]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar histórico");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [rdmId]);

  // Reload inicial
  const load = useCallback(() => {
    setPage(0);
    fetchPage(0, true);
  }, [fetchPage]);

  useEffect(() => { load(); }, [load]);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchPage(next, false);
  }, [page, fetchPage]);

  return { logs, loading, loadingMore, hasMore, error, load, loadMore };
}
