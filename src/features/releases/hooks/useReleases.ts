import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth }  from "@/contexts/AuthContext";
import { toast }    from "sonner";

export type ReleaseStatus = "planned" | "in_progress" | "released" | "cancelled";

export interface Release {
  id:          string;
  team_id:     string;
  version:     string;
  name:        string;
  status:      ReleaseStatus;
  description: string | null;
  release_date: string | null;
  changelog:   string | null;
  sprint_ids:  string[];
  created_by:  string;
  created_at:  string;
  hu_count?:   number;
  done_count?: number;
}

export interface ReleaseHU {
  id:          string;
  code:        string;
  title:       string;
  status:      string;
  story_points: number;
  assignee:    string;
}

export function useReleases() {
  const { profile, currentTeam } = useAuth();
  const teamId = currentTeam?.id ?? "";
  const userId = profile?.user_id ?? "";

  const [releases, setReleases] = useState<Release[]>([]);
  const [sprints,  setSprints]  = useState<{ id: string; name: string }[]>([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const [relRes, spRes] = await Promise.all([
        supabase.from("releases").select("*").eq("team_id", teamId).order("created_at", { ascending: false }),
        supabase.from("sprints").select("id, name").eq("team_id", teamId).order("created_at", { ascending: false }).limit(30),
      ]);

      const rels = (relRes.data ?? []) as Release[];

      // Enriquece com contagem de HUs
      const enriched = await Promise.all(rels.map(async (r) => {
        const sprintIds: string[] = r.sprint_ids ?? [];
        if (sprintIds.length === 0) return { ...r, hu_count: 0, done_count: 0 };
        const { data: hus } = await supabase
          .from("user_stories")
          .select("id, status")
          .in("sprint_id", sprintIds)
          .eq("team_id", teamId);
        const done = (hus ?? []).filter((h: any) => ["done","concluido","concluído"].some(ds => h.status?.toLowerCase().includes(ds))).length;
        return { ...r, hu_count: (hus ?? []).length, done_count: done };
      }));

      setReleases(enriched);
      setSprints((spRes.data ?? []) as any[]);
    } finally { setLoading(false); }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  const createRelease = useCallback(async (data: Omit<Release, "id" | "team_id" | "created_by" | "created_at" | "hu_count" | "done_count">) => {
    const { error } = await supabase.from("releases").insert({ ...data, team_id: teamId, created_by: userId });
    if (error) { toast.error("Erro ao criar release"); return; }
    toast.success(`Release ${data.version} criada!`);
    await load();
  }, [teamId, userId, load]);

  const updateRelease = useCallback(async (id: string, data: Partial<Release>) => {
    const { error } = await supabase.from("releases").update(data).eq("id", id);
    if (error) { toast.error("Erro ao atualizar release"); return; }
    toast.success("Release atualizada!");
    await load();
  }, [load]);

  const deleteRelease = useCallback(async (id: string) => {
    await supabase.from("releases").delete().eq("id", id);
    toast.success("Release removida");
    setReleases(prev => prev.filter(r => r.id !== id));
  }, []);

  const getHUs = useCallback(async (sprintIds: string[]): Promise<ReleaseHU[]> => {
    if (sprintIds.length === 0) return [];
    const { data: hus } = await supabase
      .from("user_stories")
      .select("id, code, title, status, story_points, assignee_id")
      .in("sprint_id", sprintIds)
      .eq("team_id", teamId)
      .order("code");

    const devIds = [...new Set((hus ?? []).map((h: any) => h.assignee_id).filter(Boolean))];
    const { data: devData } = devIds.length > 0 ? await supabase.from("developers").select("id, name").in("id", devIds) : { data: [] };
    const devMap: Record<string, string> = {};
    (devData ?? []).forEach((d: any) => { devMap[d.id] = d.name; });

    return (hus ?? []).map((h: any) => ({
      id: h.id, code: h.code, title: h.title, status: h.status,
      story_points: h.story_points ?? 0, assignee: devMap[h.assignee_id] ?? "-",
    }));
  }, [teamId]);

  return { releases, sprints, loading, createRelease, updateRelease, deleteRelease, getHUs, reload: load };
}
