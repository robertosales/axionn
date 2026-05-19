import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TeamMember {
  id:           string;   // profiles.id
  display_name: string | null;
  email:        string | null;
  avatar_url:   string | null;
  role:         string | null;  // team_members.role (developer, scrum_master, architect...)
}

// Mapa de team_members.role → papel válido no CHECK do banco (rdm_participantes)
export const ROLE_TO_PAPEL: Record<string, string> = {
  architect:     "arquiteto",
  scrum_master:  "scrum_master",
  admin:         "ad",
  ad:            "ad",
  product_owner: "product_owner",
  analyst:       "requisitos",
  developer:     "desenvolvedor",
  qa_analyst:    "desenvolvedor",
  member:        "desenvolvedor",
};

export function useTeamMembers(teamId: string | null) {
  const [members, setMembers]   = useState<TeamMember[]>([]);
  const [loading, setLoading]   = useState(false);

  const load = useCallback(async () => {
    if (!teamId) { setMembers([]); return; }
    setLoading(true);
    try {
      // team_members.user_id = auth.users.id
      // profiles.user_id    = auth.users.id
      // Portanto: busca team_members do time e depois profiles pelo user_id
      const { data: tmData, error: tmError } = await supabase
        .from("team_members")
        .select("user_id, role")
        .eq("team_id", teamId);
      if (tmError) throw tmError;
      if (!tmData || tmData.length === 0) { setMembers([]); return; }

      const userIds = tmData.map((m: any) => m.user_id);

      const { data: profData, error: profError } = await supabase
        .from("profiles")
        .select("id, user_id, display_name, email, avatar_url")
        .in("user_id", userIds);
      if (profError) throw profError;

      // Une profile com o role do time
      const mapped: TeamMember[] = (profData ?? []).map((p: any) => {
        const tm = tmData.find((m: any) => m.user_id === p.user_id);
        return {
          id:           p.id,
          display_name: p.display_name,
          email:        p.email,
          avatar_url:   p.avatar_url,
          role:         tm?.role ?? null,
        };
      });

      mapped.sort((a, b) =>
        (a.display_name ?? a.email ?? "").localeCompare(b.display_name ?? b.email ?? "")
      );
      setMembers(mapped);
    } catch (e) {
      console.error("useTeamMembers error:", e);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  return { members, loading };
}
