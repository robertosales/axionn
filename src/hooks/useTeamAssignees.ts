import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  const byUser = new Map<string, AssigneeOption>();
  for (const d of developers ?? []) {
    if (!d?.user_id || !activeUserIds.has(d.user_id)) continue;
    if (!byUser.has(d.user_id)) {
      byUser.set(d.user_id, { id: d.id, name: d.name });
    }
  }

  const list = Array.from(byUser.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
  );

  if (currentAssigneeId && !list.some((o) => o.id === currentAssigneeId)) {
    const dev = (developers ?? []).find((d) => d.id === currentAssigneeId);
    if (dev) {
      list.push({ id: dev.id, name: `${dev.name} (ex-membro)`, isFormerMember: true });
    }
  }

  return list;
}