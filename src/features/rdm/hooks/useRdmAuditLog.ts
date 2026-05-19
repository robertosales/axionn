import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Schema real: rdm_audit_log { id, rdm_id, profile_id, campo, valor_anterior, valor_novo, created_at }
export interface RdmAuditLogRow {
  id:             string;
  rdm_id:         string;
  profile_id:     string;
  campo:          string;
  valor_anterior: string | null;
  valor_novo:     string | null;
  created_at:     string;
}

export function useRdmAuditLog(rdmId: string | null) {
  const [logs, setLogs]       = useState<RdmAuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!rdmId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("rdm_audit_log")
        .select("id, rdm_id, profile_id, campo, valor_anterior, valor_novo, created_at")
        .eq("rdm_id", rdmId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (err) throw err;
      setLogs(data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  }, [rdmId]);

  useEffect(() => { load(); }, [load]);

  return { logs, loading, error, load };
}
