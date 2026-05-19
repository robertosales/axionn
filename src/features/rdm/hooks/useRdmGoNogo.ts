import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Schema real: rdm_gonogo
// UNIQUE (rdm_id, profile_id)  ← sem 'papel' na constraint
// CHECK papel IN ('arquiteto','product_owner','ad')
// CHECK decisao IN ('go','no_go')
export interface RdmGoNogoRow {
  id:            string;
  rdm_id:        string;
  profile_id:    string;
  papel:         string;
  decisao:       "go" | "no_go";
  justificativa: string | null;
  comentario:    string | null;
  created_at:    string;
}

export type RdmGoNogoVotePayload = {
  rdm_id:        string;
  profile_id:    string;
  papel:         string;
  decisao:       "go" | "no_go";
  justificativa?: string | null;
  comentario?:   string | null;
};

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
      setVotes((data ?? []) as RdmGoNogoRow[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar Go/No-Go");
    } finally {
      setLoading(false);
    }
  }, [rdmId]);

  useEffect(() => { load(); }, [load]);

  const vote = useCallback(
    async (payload: RdmGoNogoVotePayload) => {
      // UNIQUE constraint é (rdm_id, profile_id) — sem papel
      const { error: err } = await supabase
        .from("rdm_gonogo")
        .upsert(
          {
            rdm_id:        payload.rdm_id,
            profile_id:    payload.profile_id,
            papel:         payload.papel,
            decisao:       payload.decisao,
            justificativa: payload.justificativa ?? null,
            comentario:    payload.comentario    ?? null,
          },
          { onConflict: "rdm_id,profile_id" }
        );
      if (err) throw err;
      await load();
    },
    [load]
  );

  const totalGo   = votes.filter((v) => v.decisao === "go").length;
  const totalNogo = votes.filter((v) => v.decisao === "no_go").length;
  const consensus: "go" | "no_go" | "pendente" =
    votes.length === 0
      ? "pendente"
      : totalNogo > 0
        ? "no_go"
        : "go";

  return { votes, loading, error, load, vote, totalGo, totalNogo, consensus };
}
