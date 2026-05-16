import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth }  from "@/contexts/AuthContext";
import { toast }    from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────────────
export interface KanbanColumn {
  id:          string;
  key:         string;
  label:       string;
  color_class: string;
  dot_color:   string;
  hex:         string | null;
  sort_order:  number;
  wip_limit:   number | null;
  team_id:     string;
}

export interface KanbanCard {
  id:             string;
  code:           string;
  title:          string;
  status:         string;
  priority:       string;
  story_points:   number;
  estimated_hours:number | null;
  assignee_id:    string | null;
  assignee_name?: string;
  assignee_avatar?:string | null;
  epic_id:        string | null;
  epic_name?:     string;
  epic_color?:    string;
  sprint_id:      string | null;
  position:       number;
  team_id:        string;
  is_blocked:     boolean;
}

export interface KanbanFilters {
  assigneeId: string;  // "all" | devId
  priority:   string;  // "all" | "high" | "medium" | "low"
  epicId:     string;  // "all" | epicId
  sprintId:   string;  // "all" | sprintId
  swimlane:   boolean; // agrupar por assignee
}

const BLOCKED_STATUSES = ["bloqueada", "bloqueado"];

export function useKanbanBoard() {
  const { currentTeam } = useAuth();
  const teamId = currentTeam?.id ?? "";

  const [columns,  setColumns]  = useState<KanbanColumn[]>([]);
  const [cards,    setCards]    = useState<KanbanCard[]>([]);
  const [devs,     setDevs]     = useState<{ id: string; name: string; avatar: string | null }[]>([]);
  const [epics,    setEpics]    = useState<{ id: string; name: string; color: string }[]>([]);
  const [sprints,  setSprints]  = useState<{ id: string; name: string }[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);

  const [filters, setFilters] = useState<KanbanFilters>({
    assigneeId: "all", priority: "all", epicId: "all", sprintId: "active", swimlane: false,
  });

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const [colRes, huRes, devRes, epicRes, spRes] = await Promise.all([
        supabase.from("workflow_columns").select("*").eq("team_id", teamId).order("sort_order"),
        supabase.from("user_stories").select(
          "id, code, title, status, priority, story_points, estimated_hours, assignee_id, epic_id, sprint_id, position, team_id"
        ).eq("team_id", teamId).limit(500),
        supabase.from("developers").select("id, name, avatar").eq("team_id", teamId),
        supabase.from("epics").select("id, name, color").eq("team_id", teamId),
        supabase.from("sprints").select("id, name, is_active").eq("team_id", teamId).order("created_at", { ascending: false }).limit(20),
      ]);

      const devMap:  Record<string, { name: string; avatar: string | null }> = {};
      const epicMap: Record<string, { name: string; color: string }> = {};
      (devRes.data  ?? []).forEach((d: any) => { devMap[d.id]  = { name: d.name,  avatar: d.avatar }; });
      (epicRes.data ?? []).forEach((e: any) => { epicMap[e.id] = { name: e.name,  color: e.color  }; });

      setColumns((colRes.data ?? []) as KanbanColumn[]);
      setDevs((devRes.data ?? []).map((d: any) => ({ id: d.id, name: d.name, avatar: d.avatar })));
      setEpics((epicRes.data ?? []).map((e: any) => ({ id: e.id, name: e.name, color: e.color })));
      setSprints((spRes.data ?? []).map((s: any) => ({ id: s.id, name: s.name, is_active: s.is_active })) as any);

      setCards(((huRes.data ?? []) as any[]).map(h => ({
        ...h,
        assignee_name:   h.assignee_id ? devMap[h.assignee_id]?.name   : undefined,
        assignee_avatar: h.assignee_id ? devMap[h.assignee_id]?.avatar  : undefined,
        epic_name:       h.epic_id     ? epicMap[h.epic_id]?.name       : undefined,
        epic_color:      h.epic_id     ? epicMap[h.epic_id]?.color       : undefined,
        is_blocked:      BLOCKED_STATUSES.includes(h.status),
      })));
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!teamId) return;
    const ch = supabase.channel(`kanban-${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_stories", filter: `team_id=eq.${teamId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId, load]);

  const moveCard = useCallback(async (cardId: string, newStatus: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card || card.status === newStatus) return;

    const col = columns.find(c => c.key === newStatus);
    if (col?.wip_limit) {
      const currentWip = cards.filter(c => c.status === newStatus).length;
      if (currentWip >= col.wip_limit) {
        toast.warning(`WIP limit atingido para "${col.label}" (máx. ${col.wip_limit})`);
        return;
      }
    }

    setCards(prev => prev.map(c => c.id === cardId ? { ...c, status: newStatus, is_blocked: BLOCKED_STATUSES.includes(newStatus) } : c));

    const { error } = await supabase.from("user_stories").update({ status: newStatus }).eq("id", cardId);
    if (error) { toast.error("Erro ao mover card"); await load(); }
  }, [cards, columns, load]);

  const updateWipLimit = useCallback(async (colId: string, limit: number | null) => {
    await supabase.from("workflow_columns").update({ wip_limit: limit }).eq("id", colId);
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, wip_limit: limit } : c));
  }, []);

  const filteredCards = useMemo(() => {
    const activeSprint = (sprints as any[]).find((s: any) => s.is_active);
    return cards.filter(c => {
      if (filters.assigneeId !== "all" && c.assignee_id !== filters.assigneeId) return false;
      if (filters.priority   !== "all" && c.priority    !== filters.priority)   return false;
      if (filters.epicId     !== "all" && c.epic_id     !== filters.epicId)     return false;
      if (filters.sprintId   === "active") {
        if (!activeSprint || c.sprint_id !== activeSprint.id) return false;
      } else if (filters.sprintId !== "all") {
        if (c.sprint_id !== filters.sprintId) return false;
      }
      return true;
    });
  }, [cards, filters, sprints]);

  const wipCounts = useMemo(() => {
    const m: Record<string, number> = {};
    filteredCards.forEach(c => { m[c.status] = (m[c.status] ?? 0) + 1; });
    return m;
  }, [filteredCards]);

  const swimlaneDevs = useMemo(() => {
    if (!filters.swimlane) return [];
    const ids = [...new Set(filteredCards.map(c => c.assignee_id ?? "__unassigned__"))];
    return ids.map(id => ({
      id,
      name: id === "__unassigned__" ? "Sem assignee" : (devs.find(d => d.id === id)?.name ?? id),
    }));
  }, [filteredCards, devs, filters.swimlane]);

  return {
    columns, cards, filteredCards, devs, epics, sprints,
    loading, filters, setFilters,
    dragging, setDragging,
    moveCard, updateWipLimit,
    wipCounts, swimlaneDevs,
    reload: load,
  };
}
