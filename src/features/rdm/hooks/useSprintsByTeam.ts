import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SprintOption {
  id:        string;
  name:      string;
  is_active: boolean;
  start_date: string;
  end_date:   string;
}

export function useSprintsByTeam(teamId: string | null) {
  const [sprints, setSprints]   = useState<SprintOption[]>([]);
  const [loading, setLoading]   = useState(false);

  const load = useCallback(async () => {
    if (!teamId) { setSprints([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sprints")
        .select("id, name, is_active, start_date, end_date")
        .eq("team_id", teamId)
        .order("is_active", { ascending: false }) // ativa primeiro
        .order("start_date", { ascending: false });
      if (error) throw error;
      setSprints((data ?? []) as SprintOption[]);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  // Sprint ativa (pode ser null se não houver)
  const sprintAtiva = sprints.find((s) => s.is_active) ?? null;

  return { sprints, sprintAtiva, loading };
}
