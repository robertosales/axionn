import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RdmParticipanteProfile {
  display_name: string | null;
  email:        string | null;
  avatar_url:   string | null;
}

export interface RdmParticipanteEnriquecido {
  id:         string;
  rdm_id:     string;
  profile_id: string;
  papel:      string;
  created_at: string;
  profile:    RdmParticipanteProfile | null;
}

export function useRdmParticipantes(rdmId: string | null) {
  const [participantes, setParticipantes] = useState<RdmParticipanteEnriquecido[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!rdmId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("rdm_participantes")
        .select(`
          id, rdm_id, profile_id, papel, created_at,
          profile:profiles!rdm_participantes_profile_id_fkey(display_name, email, avatar_url)
        `)
        .eq("rdm_id", rdmId)
        .order("created_at");
      if (err) throw err;
      setParticipantes((data ?? []) as RdmParticipanteEnriquecido[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar participantes");
    } finally {
      setLoading(false);
    }
  }, [rdmId]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(
    async (payload: { rdm_id: string; profile_id: string; papel: string }) => {
      // Upsert por (rdm_id, profile_id) — evita duplicatas do mesmo usuário
      // Se já existir, atualiza o papel
      const { error: err } = await supabase
        .from("rdm_participantes")
        .upsert(
          {
            rdm_id:     payload.rdm_id,
            profile_id: payload.profile_id,
            papel:      payload.papel,
          },
          { onConflict: "rdm_id,profile_id" }
        );
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
