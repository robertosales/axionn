import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Helpers para garantir que listas de membros/analistas/responsáveis
 * exibam apenas usuários atualmente vinculados ao time via `team_members`.
 *
 * Regras:
 * - linhas em `developers` sem `user_id` ou cujo `user_id` não está em
 *   `team_members` do time são descartadas dos seletores;
 * - duplicatas por `user_id` ficam com o registro mais recente em `created_at`;
 * - para exibição de dados históricos (HUs/atividades atribuídas a quem saiu),
 *   `tagExMember()` adiciona o sufixo "(ex-membro)" ao nome.
 */

export async function fetchActiveMemberIds(teamId: string | null | undefined): Promise<Set<string>> {
  if (!teamId) return new Set();
  const { data } = await supabase.from("team_members").select("user_id").eq("team_id", teamId);
  return new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean));
}

export async function fetchActiveMemberIdsForTeams(teamIds: string[]): Promise<Set<string>> {
  if (!teamIds.length) return new Set();
  const { data } = await supabase.from("team_members").select("user_id").in("team_id", teamIds);
  return new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean));
}

export function filterActiveDevelopers<T extends { id: string; name?: string | null; user_id?: string | null; created_at?: string | null }>(
  devs: T[],
  memberIds: Set<string>,
): T[] {
  const byUser = new Map<string, T>();
  for (const d of devs || []) {
    if (!d?.user_id || !memberIds.has(d.user_id)) continue;
    const prev = byUser.get(d.user_id);
    if (!prev || new Date(d.created_at || 0) > new Date(prev.created_at || 0)) {
      byUser.set(d.user_id, d);
    }
  }
  return Array.from(byUser.values()).sort((a, b) =>
    String(a.name ?? "").localeCompare(String(b.name ?? ""), "pt-BR", { sensitivity: "base" }),
  );
}

export function tagExMember(name: string, userId: string | null | undefined, memberIds: Set<string>): string {
  if (!userId || memberIds.has(userId)) return name;
  return `${name} (ex-membro)`;
}

/** Hook reativo que devolve o conjunto de user_ids ativos do time. */
export function useActiveMemberIds(teamId: string | null | undefined): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!teamId) { setIds(new Set()); return; }
    let cancelled = false;
    fetchActiveMemberIds(teamId).then((s) => { if (!cancelled) setIds(s); });
    const channel = supabase
      .channel(`tm-active-${teamId}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "team_members", filter: `team_id=eq.${teamId}` },
        () => { fetchActiveMemberIds(teamId).then((s) => { if (!cancelled) setIds(s); }); })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [teamId]);
  return ids;
}
