import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Schema real: rdm_gonogo { id, rdm_id, profile_id, papel, decisao, justificativa, comentario, created_at }
export interface RdmGoNogoRow {
  id:           string;
  rdm_id:       string;
  profile_id:   string;
  papel:        string;
  decisao:      string; // "go" | "nogo"
  justificativa: string | null;
  comentario:   string | null;
  created_at:   string;
}

export function useRdmGoNogo(rdmId: string | null) {
  const [votes, setVotes]     = useState<RdmGoNogoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!rdmId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("rdm_gonogo")
        .select("id, rdm_id, profile_id, papel, decisao, justificativa, comentario, created_at")
        .eq("rdm_id", rdmId)
        .order("created_at");
      if (err) throw err;
      setVotes(data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar Go/No-Go");
    } finally {
      setLoading(false);
    }
  }, [rdmId]);

  useEffect(() => { load(); }, [load]);

  const vote = useCallback(
    async (payload: { rdm_id: string; profile_id: string; papel: string; decisao: string; justificativa?: string | null }) => {
      // Upsert por rdm_id + profile_id + papel
      const { error: err } = await supabase
        .from("rdm_gonogo")
        .upsert(
          { ...payload },
          { onConflict: "rdm_id,profile_id,papel" }
        );
      if (err) throw err;
      await load();
    },
    [load]
  );

  const totalGo   = votes.filter((v) => v.decisao === "go").length;
  const totalNogo = votes.filter((v) => v.decisao === "nogo").length;
  const consensus: "go" | "nogo" | "pendente" =
    votes.length === 0 ? "pendente" : totalNogo > 0 ? "nogo" : "go";

  return { votes, loading, error, load, vote, totalGo, totalNogo, consensus };
}
