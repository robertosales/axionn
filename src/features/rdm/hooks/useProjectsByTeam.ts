import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProjectOption = {
  id: string;
  name: string;
};

export function useProjectsByTeam(teamId: string | null) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId) {
      setProjects([]);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("projects")
          .select("id, name")
          .eq("team_id", teamId)
          .order("name");

        if (!error && !cancelled) {
          setProjects(data ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return { projects, loading };
}
