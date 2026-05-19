import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Team {
  id:   string;
  name: string;
}

export function useTeams() {
  const [teams, setTeams]     = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    // RLS permite ver apenas times em que o usuário é membro (ou admin vê todos)
    supabase
      .from("teams")
      .select("id, name")
      .order("name")
      .then(({ data, error }) => {
        if (!error) setTeams((data ?? []) as Team[]);
        setLoading(false);
      });
  }, []);

  return { teams, loading };
}
