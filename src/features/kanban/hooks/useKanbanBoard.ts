/**
 * useKanbanBoard — F3-A: cursor-based pagination para sprintFilter=all
 *
 * ANTES: fetchCards com sprintFilter=all usava .limit(200) fixo, carregando
 *   todo o histórico de sprints em uma única query. Times com 10+ sprints
 *   = até 200 user_stories por cache miss, mesmo quando o board exibe
 *   apenas o sprint ativo.
 *
 * DEPOIS:
 *   • sprintFilter=all  → useInfiniteQuery com fetchCardsPage() (50/pág)
 *     cursor baseado em (position ASC, id ASC) — estável para drag-and-drop
 *   • sprintFilter=active|{id} → useQuery normal, limite 200 conservador
 *     (sprint específico já filtra no banco, volume baixo)
 *   • KEYS.kanban.infinite(teamId) separado de KEYS.kanban.board para
 *     não colidir com cache de sprint específico
 *   • Canal RT invalida a chave correta conforme sprintFilter ativo
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery, useInfiniteQuery, useQueryClient }         from "@tanstack/react-query";
import { supabase }                                           from "@/integrations/supabase/client";
import { useAuth }                                            from "@/contexts/AuthContext";
import { toast }                                              from "sonner";
import { KEYS }                                               from "@/lib/queryKeys";
import { STALE }                                              from "@/lib/queryClient";

// ── Types ────────────────────────────────────────────────────────────────────────
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
  assigneeId: string;
  priority:   string;
  epicId:     string;
  sprintId:   string;
  swimlane:   boolean;
}

export interface CardsPage {
  items:      KanbanCard[];
  nextCursor: string | null; // "position:id" do último item
}

const BLOCKED_STATUSES = ["bloqueada", "bloqueado"];
export const KANBAN_PAGE_SIZE = 50;

// ── Fetchers estáticos ───────────────────────────────────────────────────────────────
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
    .select("id, name, avatar, user_id, created_at")
    .eq("team_id", teamId);
  if (error) throw error;
  const raw = (data ?? []) as Array<{ id: string; name: string; avatar: string | null; user_id: string | null; created_at: string | null }>;
  const memberIds = await (await import("@/lib/teamMemberFilter")).fetchActiveMemberIds(teamId);
  const filtered = (await import("@/lib/teamMemberFilter")).filterActiveDevelopers(raw, memberIds);
  return filtered.map((d) => ({ id: d.id, name: d.name, avatar: d.avatar }));
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

/**
 * enrichCards — enriquece cards com nome/avatar do dev e nome/cor do epic.
 * Usada por fetchCards e fetchCardsPage para evitar duplicação.
 */
function enrichCards(
  raw:   any[],
  devs:  { id: string; name: string; avatar: string | null }[],
  epics: { id: string; name: string; color: string }[],
): KanbanCard[] {
  const devMap:  Record<string, { name: string; avatar: string | null }> = {};
  const epicMap: Record<string, { name: string; color: string }>         = {};
  devs.forEach(d  => { devMap[d.id]  = { name: d.name,  avatar: d.avatar }; });
  epics.forEach(e => { epicMap[e.id] = { name: e.name,  color:  e.color  }; });
  return raw.map(h => ({
    ...h,
    assignee_name:   h.assignee_id ? devMap[h.assignee_id]?.name   : undefined,
    assignee_avatar: h.assignee_id ? devMap[h.assignee_id]?.avatar  : undefined,
    epic_name:       h.epic_id     ? epicMap[h.epic_id]?.name       : undefined,
    epic_color:      h.epic_id     ? epicMap[h.epic_id]?.color      : undefined,
    is_blocked:      BLOCKED_STATUSES.includes(h.status),
  })) as KanbanCard[];
}

/**
 * fetchCards — sprint específico ou ativo (volume baixo, useQuery normal).
 */
async function fetchCards(
  teamId: string,
  sprints: { id: string; is_active: boolean }[],
  sprintFilter: string,
  devs:  { id: string; name: string; avatar: string | null }[],
  epics: { id: string; name: string; color: string }[],
): Promise<KanbanCard[]> {
  const activeSprint   = sprints.find(s => s.is_active);
  const targetSprintId =
    sprintFilter === "active" ? (activeSprint?.id ?? null) : sprintFilter;

  const { data, error } = await supabase
    .from("user_stories")
    .select(
      "id, code, title, status, priority, story_points, estimated_hours, " +
      "assignee_id, epic_id, sprint_id, position, team_id"
    )
    .eq("team_id", teamId)
    .eq("sprint_id", targetSprintId!)
    .order("position")
    .limit(200);
  if (error) throw error;
  return enrichCards(data ?? [], devs, epics);
}

/**
 * fetchCardsPage — F3-A: cursor-based pagination para sprintFilter=all.
 *
 * Cursor: string no formato "position:id" do último card da página anterior.
 * Ordenação: (position ASC, id ASC) — estável mesmo durante drag-and-drop
 * (position muda só após persistência, id é UUID imutável).
 *
 * A primeira página recebe cursor=null e retorna os primeiros KANBAN_PAGE_SIZE cards.
 * Páginas seguintes decodificam o cursor para filtrar após o último item visto.
 */
async function fetchCardsPage(
  teamId: string,
  cursor: string | null,
  devs:   { id: string; name: string; avatar: string | null }[],
  epics:  { id: string; name: string; color: string }[],
): Promise<CardsPage> {
  let q = supabase
    .from("user_stories")
    .select(
      "id, code, title, status, priority, story_points, estimated_hours, " +
      "assignee_id, epic_id, sprint_id, position, team_id"
    )
    .eq("team_id", teamId)
    .order("position", { ascending: true })
    .order("id",       { ascending: true })
    .limit(KANBAN_PAGE_SIZE);

  if (cursor) {
    const [posStr, afterId] = cursor.split(":");
    const pos = parseInt(posStr, 10);
    // Keyset pagination: (position > pos) OR (position = pos AND id > afterId)
    q = q.or(`position.gt.${pos},and(position.eq.${pos},id.gt.${afterId})`);
  }

  const { data, error } = await q;
  if (error) throw error;

  const raw  = data ?? [];
  const items = enrichCards(raw, devs, epics);
  const last  = raw[raw.length - 1] as any;
  const nextCursor = items.length < KANBAN_PAGE_SIZE
    ? null
    : `${last.position}:${last.id}`;

  return { items, nextCursor };
}

// ── Hook principal ──────────────────────────────────────────────────────────────────
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

  const { data: columns = [] } = useQuery({
    queryKey:  [...KEYS.kanban.all(teamId), "columns"],
    queryFn:   () => fetchColumns(teamId),
    enabled:   !!teamId,
    staleTime: STALE.REFERENCE,
  });

  const { data: devs = [] } = useQuery({
    queryKey:  [...KEYS.kanban.all(teamId), "devs"],
    queryFn:   () => fetchDevs(teamId),
    enabled:   !!teamId,
    staleTime: STALE.REFERENCE,
  });

  const { data: epics = [] } = useQuery({
    queryKey:  [...KEYS.kanban.all(teamId), "epics"],
    queryFn:   () => fetchEpics(teamId),
    enabled:   !!teamId,
    staleTime: STALE.REFERENCE,
  });

  const { data: sprints = [] } = useQuery({
    queryKey:  KEYS.sprints.all(teamId),
    queryFn:   () => fetchSprints(teamId),
    enabled:   !!teamId,
    staleTime: STALE.SESSION,
  });

  const isAllSprints = filters.sprintId === "all";

  // ── F3-A: infinite query para sprintFilter=all ───────────────────────────────
  const infiniteKey = KEYS.kanban.infinite(teamId);
  const {
    data:               infiniteData,
    isLoading:          loadingAll,
    isFetchingNextPage: loadingMoreAll,
    fetchNextPage:      fetchMoreCards,
    hasNextPage:        hasMoreCards,
  } = useInfiniteQuery({
    queryKey:         infiniteKey,
    queryFn:          ({ pageParam }) =>
      fetchCardsPage(teamId, pageParam as string | null, devs, epics),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled:          !!teamId && isAllSprints && devs.length > 0,
    staleTime:        STALE.REALTIME,
  });

  // ── useQuery normal para sprint específico ou ativo ─────────────────────────
  const boardKey = KEYS.kanban.board(teamId, filters.sprintId);
  const { data: boardCards = [], isLoading: loadingBoard } = useQuery({
    queryKey:  boardKey,
    queryFn:   () => fetchCards(teamId, sprints, filters.sprintId, devs, epics),
    enabled:   !!teamId && !isAllSprints && sprints.length > 0 && devs.length > 0,
    staleTime: STALE.REALTIME,
  });

  // Cards unificados: fonte depende do filtro ativo
  const allCards = useMemo<KanbanCard[]>(
    () => isAllSprints
      ? (infiniteData?.pages.flatMap(p => p.items) ?? [])
      : boardCards,
    [isAllSprints, infiniteData, boardCards],
  );

  const loading     = isAllSprints ? loadingAll    : loadingBoard;
  const loadingMore = isAllSprints ? loadingMoreAll : false;

  // ── Canal RT ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!teamId) return;
    let timeoutId: ReturnType<typeof setTimeout>;

    const channel = supabase
      .channel(`kanban-rt-${teamId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_stories", filter: `team_id=eq.${teamId}` },
        () => {
          if (draggingRef.current)                                return;
          if (Date.now() - lastLocalWrite.current < 3000)         return;
          if (typeof document !== "undefined" && document.hidden) return;
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            if (isAllSprints) {
              // F3-A: reset infinite query (volta para pág 1)
              qc.resetQueries({ queryKey: infiniteKey });
            } else {
              qc.invalidateQueries({ queryKey: boardKey });
            }
          }, 2000);
        },
      )
      .subscribe();

    return () => { clearTimeout(timeoutId); supabase.removeChannel(channel); };
  }, [teamId, boardKey, infiniteKey, isAllSprints, qc]);

  // ── moveCard: optimistic update ──────────────────────────────────────────────
  const moveCard = useCallback(async (cardId: string, newStatus: string) => {
    const card = allCards.find(c => c.id === cardId);
    if (!card || card.status === newStatus) return;

    const col = columns.find(c => c.key === newStatus);
    if (col?.wip_limit) {
      const currentWip = allCards.filter(c => c.status === newStatus).length;
      if (currentWip >= col.wip_limit) {
        toast.warning(`WIP limit atingido para "${col.label}" (máx. ${col.wip_limit})`);
        return;
      }
    }

    // Optimistic update na chave correta
    if (isAllSprints) {
      qc.setQueriesData<{ pages: CardsPage[] }>(
        { queryKey: infiniteKey },
        (prev) => !prev ? prev : ({
          ...prev,
          pages: prev.pages.map(page => ({
            ...page,
            items: page.items.map(c =>
              c.id === cardId
                ? { ...c, status: newStatus, is_blocked: BLOCKED_STATUSES.includes(newStatus) }
                : c
            ),
          })),
        }),
      );
    } else {
      qc.setQueryData<KanbanCard[]>(boardKey, prev =>
        (prev ?? []).map(c =>
          c.id === cardId
            ? { ...c, status: newStatus, is_blocked: BLOCKED_STATUSES.includes(newStatus) }
            : c
        )
      );
    }

    lastLocalWrite.current = Date.now();
    const { error } = await supabase
      .from("user_stories")
      .update({ status: newStatus })
      .eq("id", cardId);

    if (error) {
      toast.error("Erro ao mover card");
      if (isAllSprints) {
        qc.resetQueries({ queryKey: infiniteKey });
      } else {
        qc.invalidateQueries({ queryKey: boardKey });
      }
    }
  }, [allCards, boardKey, columns, infiniteKey, isAllSprints, qc]);

  const updateWipLimit = useCallback(async (colId: string, limit: number | null) => {
    const { error } = await supabase
      .from("workflow_columns")
      .update({ wip_limit: limit })
      .eq("id", colId);
    if (!error) {
      qc.invalidateQueries({ queryKey: [...KEYS.kanban.all(teamId), "columns"] });
    }
  }, [teamId, qc]);

  const activeSprint = useMemo(() => sprints.find(s => s.is_active), [sprints]);

  const filteredCards = useMemo(() => {
    return allCards.filter(c => {
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
  }, [allCards, filters, activeSprint]);

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

  return {
    columns,
    cards:         allCards,
    filteredCards,
    devs,
    epics,
    sprints,
    loading,
    loadingMore,
    hasMoreCards,
    fetchMoreCards,
    filters,
    setFilters,
    dragging,
    setDragging: (id: string | null) => { draggingRef.current = !!id; setDraggingState(id); },
    moveCard,
    updateWipLimit,
    wipCounts,
    swimlaneDevs,
    reload: () => {
      if (isAllSprints) qc.resetQueries({ queryKey: infiniteKey });
      else              qc.invalidateQueries({ queryKey: KEYS.kanban.all(teamId) });
    },
  };
}
