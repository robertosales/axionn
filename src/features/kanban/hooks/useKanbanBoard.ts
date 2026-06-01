import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient }                           from "@tanstack/react-query";
import { supabase }                                           from "@/integrations/supabase/client";
import { useAuth }                                            from "@/contexts/AuthContext";
import { toast }                                              from "sonner";
import { KEYS }                                               from "@/lib/queryKeys";
import { STALE }                                              from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────────────────────
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
  id:              string;
  code:            string;
  title:           string;
  status:          string;
  priority:        string;
  story_points:    number;
  estimated_hours: number | null;
  assignee_id:     string | null;
  assignee_name?:  string;
  assignee_avatar?: string | null;
  epic_id:         string | null;
  epic_name?:      string;
  epic_color?:     string;
  sprint_id:       string | null;
  position:        number;
  team_id:         string;
  is_blocked:      boolean;
}

export interface KanbanFilters {
  assigneeId: string;   // "all" | devId
  priority:   string;   // "all" | "high" | "medium" | "low"
  epicId:     string;   // "all" | epicId
  sprintId:   string;   // "all" | "active" | sprintId
  swimlane:   boolean;
}

const BLOCKED_STATUSES = ["bloqueada", "bloqueado"];

// ── Fetchers (fora do hook — sem recriação a cada render) ─────────────────────

async function fetchColumns(teamId: string): Promise<KanbanColumn[]> {
  const { data, error } = await supabase
    .from("workflow_columns")
    .select("id, key, label, color_class, dot_color, hex, sort_order, wip_limit, team_id")
    .eq("team_id", teamId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as KanbanColumn[];
}

async function fetchDevs(teamId: string) {
  const { data, error } = await supabase
    .from("developers")
    .select("id, name, avatar")
    .eq("team_id", teamId);
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; avatar: string | null }[];
}

async function fetchEpics(teamId: string) {
  const { data, error } = await supabase
    .from("epics")
    .select("id, name, color")
    .eq("team_id", teamId);
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; color: string }[];
}

async function fetchSprints(teamId: string) {
  const { data, error } = await supabase
    .from("sprints")
    .select("id, name, is_active")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; is_active: boolean }[];
}

async function fetchCards(
  teamId: string,
  sprints: { id: string; is_active: boolean }[],
  sprintFilter: string,
  devs:  { id: string; name: string; avatar: string | null }[],
  epics: { id: string; name: string; color: string }[],
): Promise<KanbanCard[]> {
  const activeSprint   = sprints.find(s => s.is_active);
  const targetSprintId =
    sprintFilter === "active" ? (activeSprint?.id ?? null)
    : sprintFilter === "all"  ? null
    : sprintFilter;

  let q = supabase
    .from("user_stories")
    .select(
      "id, code, title, status, priority, story_points, estimated_hours, " +
      "assignee_id, epic_id, sprint_id, position, team_id"
    )
    .eq("team_id", teamId)
    .limit(500);

  if (targetSprintId) q = q.eq("sprint_id", targetSprintId);

  const { data, error } = await q;
  if (error) throw error;

  const devMap:  Record<string, { name: string; avatar: string | null }> = {};
  const epicMap: Record<string, { name: string; color: string }>         = {};
  devs.forEach(d  => { devMap[d.id]   = { name: d.name,  avatar: d.avatar }; });
  epics.forEach(e => { epicMap[e.id]  = { name: e.name,  color:  e.color  }; });

  return ((data ?? []) as any[]).map(h => ({
    ...h,
    assignee_name:   h.assignee_id ? devMap[h.assignee_id]?.name   : undefined,
    assignee_avatar: h.assignee_id ? devMap[h.assignee_id]?.avatar  : undefined,
    epic_name:       h.epic_id     ? epicMap[h.epic_id]?.name       : undefined,
    epic_color:      h.epic_id     ? epicMap[h.epic_id]?.color      : undefined,
    is_blocked:      BLOCKED_STATUSES.includes(h.status),
  })) as KanbanCard[];
}

// ── Hook principal ────────────────────────────────────────────────────────────
export function useKanbanBoard() {
  const { currentTeam } = useAuth();
  const teamId          = currentTeam?.id ?? "";
  const qc              = useQueryClient();

  const [dragging,  setDraggingState] = useState<string | null>(null);
  const [filters,   setFilters]       = useState<KanbanFilters>({
    assigneeId: "all", priority: "all", epicId: "all", sprintId: "active", swimlane: false,
  });

  const draggingRef    = useRef(false);
  const lastLocalWrite = useRef<number>(0);

  // ── Dados estáticos — cache longo, não mudam durante uma sessão ──────────
  const { data: columns = [] } = useQuery({
    queryKey: [...KEYS.kanban.all(teamId), "columns"],
    queryFn:  () => fetchColumns(teamId),
    enabled:  !!teamId,
    staleTime: STALE.REFERENCE,   // 5 min
  });

  const { data: devs = [] } = useQuery({
    queryKey: [...KEYS.kanban.all(teamId), "devs"],
    queryFn:  () => fetchDevs(teamId),
    enabled:  !!teamId,
    staleTime: STALE.REFERENCE,   // 5 min
  });

  const { data: epics = [] } = useQuery({
    queryKey: [...KEYS.kanban.all(teamId), "epics"],
    queryFn:  () => fetchEpics(teamId),
    enabled:  !!teamId,
    staleTime: STALE.REFERENCE,   // 5 min
  });

  const { data: sprints = [] } = useQuery({
    queryKey: KEYS.sprints.all(teamId),
    queryFn:  () => fetchSprints(teamId),
    enabled:  !!teamId,
    staleTime: STALE.SESSION,     // 10 min — lista de sprints muda pouco
  });

  // ── Cards — cache curto, invalidado pelo Realtime ────────────────────────
  const boardKey = KEYS.kanban.board(teamId, filters.sprintId);

  const { data: cards = [], isLoading: loadingCards } = useQuery({
    queryKey: boardKey,
    queryFn:  () => fetchCards(teamId, sprints, filters.sprintId, devs, epics),
    enabled:  !!teamId && sprints.length > 0,
    staleTime: STALE.REALTIME,    // 30 s
  });

  const loading = loadingCards;

  // ── Realtime: invalida boardKey com debounce ──────────────────────────────
  useEffect(() => {
    if (!teamId) return;
    let timeoutId: ReturnType<typeof setTimeout>;

    const channel = supabase
      .channel(`kanban-rt-${teamId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_stories", filter: `team_id=eq.${teamId}` },
        () => {
          if (draggingRef.current)                                         return;
          if (Date.now() - lastLocalWrite.current < 3000)                  return;
          if (typeof document !== "undefined" && document.hidden)          return;
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            qc.invalidateQueries({ queryKey: boardKey });
          }, 2000);
        },
      )
      .subscribe();

    return () => { clearTimeout(timeoutId); supabase.removeChannel(channel); };
  }, [teamId, boardKey, qc]);

  // ── moveCard: optimistic update + write no banco ──────────────────────────
  const moveCard = useCallback(async (cardId: string, newStatus: string) => {
    const allCards = qc.getQueryData<KanbanCard[]>(boardKey) ?? [];
    const card     = allCards.find(c => c.id === cardId);
    if (!card || card.status === newStatus) return;

    const col = columns.find(c => c.key === newStatus);
    if (col?.wip_limit) {
      const currentWip = allCards.filter(c => c.status === newStatus).length;
      if (currentWip >= col.wip_limit) {
        toast.warning(`WIP limit atingido para "${col.label}" (máx. ${col.wip_limit})`);
        return;
      }
    }

    // Optimistic update — UI responde imediatamente
    qc.setQueryData<KanbanCard[]>(boardKey, prev =>
      (prev ?? []).map(c =>
        c.id === cardId
          ? { ...c, status: newStatus, is_blocked: BLOCKED_STATUSES.includes(newStatus) }
          : c
      )
    );

    lastLocalWrite.current = Date.now();
    const { error } = await supabase
      .from("user_stories")
      .update({ status: newStatus })
      .eq("id", cardId);

    if (error) {
      toast.error("Erro ao mover card");
      // Reverte o optimistic update
      qc.invalidateQueries({ queryKey: boardKey });
    }
  }, [boardKey, columns, qc]);

  // ── updateWipLimit ────────────────────────────────────────────────────────
  const updateWipLimit = useCallback(async (colId: string, limit: number | null) => {
    const { error } = await supabase
      .from("workflow_columns")
      .update({ wip_limit: limit })
      .eq("id", colId);
    if (!error) {
      qc.invalidateQueries({ queryKey: [...KEYS.kanban.all(teamId), "columns"] });
    }
  }, [teamId, qc]);

  // ── Dados derivados (memoizados) ──────────────────────────────────────────
  const activeSprint = useMemo(() => sprints.find(s => s.is_active), [sprints]);

  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      if (filters.assigneeId !== "all" && c.assignee_id !== filters.assigneeId) return false;
      if (filters.priority   !== "all" && c.priority    !== filters.priority)   return false;
      if (filters.epicId     !== "all" && c.epic_id     !== filters.epicId)     return false;
      if (filters.sprintId === "active") {
        if (!activeSprint || c.sprint_id !== activeSprint.id)                   return false;
      } else if (filters.sprintId !== "all") {
        if (c.sprint_id !== filters.sprintId)                                   return false;
      }
      return true;
    });
  }, [cards, filters, activeSprint]);

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
      name: id === "__unassigned__"
        ? "Sem assignee"
        : (devs.find(d => d.id === id)?.name ?? id),
    }));
  }, [filteredCards, devs, filters.swimlane]);

  // ── API pública (idêntica ao hook original) ───────────────────────────────
  return {
    columns,
    cards,
    filteredCards,
    devs,
    epics,
    sprints,
    loading,
    filters,
    setFilters,
    dragging,
    setDragging: (id: string | null) => { draggingRef.current = !!id; setDraggingState(id); },
    moveCard,
    updateWipLimit,
    wipCounts,
    swimlaneDevs,
    reload: () => qc.invalidateQueries({ queryKey: KEYS.kanban.all(teamId) }),
  };
}
