import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { canonicalizeDevelopers } from "@/lib/developerIdentity";

export interface AssigneeOption {
  id: string;
  name: string;
  isFormerMember?: boolean;
}

/**
 * Lista canônica para o combo "Responsável" de uma HU:
 * - Apenas developers cujo user_id pertence aos membros atuais do time
 * - Deduplicado por user_id
 * - Ordenado alfabeticamente (pt-BR)
 * - Inclui o assignee atual (mesmo se ex-membro) marcado como "(ex-membro)"
 */
export function useTeamAssignees(
  teamId: string | null | undefined,
  developers: Array<{ id: string; name: string; user_id?: string | null }>,
  currentAssigneeId?: string | null,
): AssigneeOption[] {
  const [activeUserIds, setActiveUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!teamId) {
      setActiveUserIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId);
      if (cancelled) return;
      setActiveUserIds(new Set((data ?? []).map((m: any) => m.user_id).filter(Boolean)));
    })();
    return () => { cancelled = true; };
  }, [teamId]);

  const active = developers.filter((d) => d.user_id && activeUserIds.has(d.user_id));
  const list: AssigneeOption[] = canonicalizeDevelopers(active).map((d) => ({ id: d.id, name: d.name }));

  if (currentAssigneeId && !list.some((o) => o.id === currentAssigneeId)) {
    const dev = (developers ?? []).find((d) => d.id === currentAssigneeId);
    if (dev) {
      list.push({ id: dev.id, name: `${dev.name} (ex-membro)`, isFormerMember: true });
    }
  }

  return list;
}
