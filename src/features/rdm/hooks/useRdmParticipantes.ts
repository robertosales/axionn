import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Schema real: rdm_participantes { id, rdm_id, profile_id, papel, created_at }
export interface RdmParticipanteRow {
  id:         string;
  rdm_id:     string;
  profile_id: string;
  papel:      string;
  created_at: string;
}

export function useRdmParticipantes(rdmId: string | null) {
  const [participantes, setParticipantes] = useState<RdmParticipanteRow[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!rdmId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("rdm_participantes")
        .select("id, rdm_id, profile_id, papel, created_at")
        .eq("rdm_id", rdmId)
        .order("created_at");
      if (err) throw err;
      setParticipantes(data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar participantes");
    } finally {
      setLoading(false);
    }
  }, [rdmId]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(
    async (payload: { rdm_id: string; profile_id: string; papel: string }) => {
      const { error: err } = await supabase
        .from("rdm_participantes")
        .insert(payload);
      if (err) throw err;
      await load();
    },
    [load]
  );

  const remove = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from("rdm_participantes")
      .delete()
      .eq("id", id);
    if (err) throw err;
    setParticipantes((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { participantes, loading, error, load, add, remove };
}
