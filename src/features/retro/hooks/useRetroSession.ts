import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { RetroPhase, RetroModelKey, RetroCard, RetroActionItem } from "../types/retro";

export type { RetroPhase, RetroModelKey };

export type RetroColumnKey = "went_well" | "to_improve" | "action_items";

export const RETRO_COLUMNS: { key: RetroColumnKey; label: string; emoji: string; color: string }[] = [
  { key: "went_well",    label: "O que foi bem",    emoji: "😊", color: "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20" },
  { key: "to_improve",  label: "O que melhorar",   emoji: "🔧", color: "border-orange-400 bg-orange-50/60 dark:bg-orange-950/20" },
  { key: "action_items",label: "Itens de ação",    emoji: "⚡",    color: "border-blue-400 bg-blue-50/60 dark:bg-blue-950/20" },
];

export interface RetroSession {
  id:            string;
  team_id:       string;
  sprint_id:     string;
  sprint_name?:  string;
  status:        string;
  currentPhase:  RetroPhase;
  model:         RetroModelKey;
  created_by:    string;
  created_at:    string;
  finishedAt:    string | null;
}

export interface RetroHistoryItem {
  id:          string;
  sprint_id:   string;
  sprint_name: string;
  status:      string;
  created_at:  string;
  finished_at: string | null;
  cardCount:   number;
  actionCount: number;
  wentWell:    number;
  toImprove:   number;
}

interface UseRetroSessionParams {
  teamId:   string | null;
  sprintId: string | null;
  userId:   string | null;
}

export function useRetroSession({ teamId, sprintId, userId }: UseRetroSessionParams) {
  const [session,      setSession]      = useState<RetroSession | null>(null);
  const [cards,        setCards]        = useState<RetroCard[]>([]);
  const [votes,        setVotes]        = useState<string[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [actionItems,  setActionItems]  = useState<RetroActionItem[]>([]);
  const [profiles,     setProfiles]     = useState<Record<string, string>>({});
  const [history,      setHistory]      = useState<RetroHistoryItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [isFacilitator,     setIsFacilitator]     = useState(false);
  const [facilitatorOffline,setFacilitatorOffline] = useState(false);

  // ─ Carrega perfis de uma lista de user_ids ──────────────────────────────────
  const loadProfiles = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const unique = [...new Set(ids)];
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", unique);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((p: any) => { map[p.user_id] = p.display_name; });
      setProfiles((prev) => ({ ...prev, ...map }));
    }
  }, []);

  // ─ Carrega sessão aberta + cards + action items + histórico ──────────────
  const loadAll = useCallback(async () => {
    if (!teamId) { setLoading(false); return; }
    setLoading(true);
    try {
      // Sessão aberta
      const { data: sessions } = await supabase
        .from("retro_sessions")
        .select("*")
        .eq("team_id", teamId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1);

      if (sessions && sessions.length > 0) {
        const s = sessions[0] as any;
        const uid = userId ?? "";

        const [cardsRes, votesRes, partRes, actionsRes, sprintRes] = await Promise.all([
          supabase.from("retro_cards").select("*").eq("session_id", s.id).order("created_at"),
          supabase.from("retro_votes").select("card_id").eq("session_id", s.id).eq("user_id", uid),
          supabase.from("retro_participants").select("user_id, is_facilitator, is_online").eq("session_id", s.id),
          supabase.from("retro_actions").select("*").eq("session_id", s.id).order("created_at"),
          supabase.from("sprints").select("name").eq("id", s.sprint_id).single(),
        ]);

        const rawCards    = (cardsRes.data    ?? []) as any[];
        const rawParts    = (partRes.data     ?? []) as any[];
        const rawActions  = (actionsRes.data  ?? []) as any[];

        // Normaliza cards (snake_case → camelCase)
        const normalizedCards: RetroCard[] = rawCards.map((c: any) => ({
          id:           c.id,
          sessionId:    c.session_id,
          columnKey:    c.column_key,
          text:         c.text,
          authorId:     c.author_id,
          votes:        c.votes ?? 0,
          hidden:       c.hidden ?? false,
          isAction:     c.is_action ?? false,
          actionOwnerId:c.action_owner_id ?? null,
          createdAt:    c.created_at,
        }));

        // Normaliza action items
        const normalizedActions: RetroActionItem[] = rawActions.map((a: any) => ({
          id:             a.id,
          sessionId:      a.session_id,
          cardId:         a.card_id ?? null,
          title:          a.description ?? a.title ?? "",
          description:    a.description ?? "",
          ownerId:        a.owner_id ?? null,
          status:         a.status ?? "pending",
          targetSprintId: a.target_sprint_id ?? null,
          createdAt:      a.created_at,
        }));

        // Facilitador
        const myPart = rawParts.find((p: any) => p.user_id === uid);
        const facilitatorPart = rawParts.find((p: any) => p.is_facilitator);
        setIsFacilitator(myPart?.is_facilitator ?? false);
        setFacilitatorOffline(facilitatorPart ? !facilitatorPart.is_online : false);

        setSession({
          id:           s.id,
          team_id:      s.team_id,
          sprint_id:    s.sprint_id,
          sprint_name:  sprintRes.data?.name ?? "",
          status:       s.status,
          currentPhase: s.current_phase as RetroPhase,
          model:        s.model as RetroModelKey,
          created_by:   s.created_by,
          created_at:   s.created_at,
          finishedAt:   s.finished_at ?? null,
        });
        setCards(normalizedCards);
        setVotes((votesRes.data ?? []).map((v: any) => v.card_id));
        setParticipants(rawParts.map((p: any) => p.user_id));
        setActionItems(normalizedActions);

        // Perfis
        const allIds = [...new Set([
          ...rawCards.map((c: any) => c.author_id),
          ...rawActions.map((a: any) => a.owner_id).filter(Boolean),
          ...rawParts.map((p: any) => p.user_id),
        ])];
        await loadProfiles(allIds);

      } else {
        setSession(null);
        setCards([]);
        setVotes([]);
        setParticipants([]);
        setActionItems([]);
      }

      // Histórico
      const { data: histSessions } = await supabase
        .from("retro_sessions")
        .select("id, sprint_id, status, created_at, finished_at")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (histSessions && histSessions.length > 0) {
        const ids      = histSessions.map((h: any) => h.id);
        const sprintIds = [...new Set(histSessions.map((h: any) => h.sprint_id))];
        const [allCards, allSprintsRes] = await Promise.all([
          supabase.from("retro_cards").select("id, session_id, column_key, is_action").in("session_id", ids),
          supabase.from("sprints").select("id, name").in("id", sprintIds),
        ]);
        const sprintMap: Record<string, string> = {};
        (allSprintsRes.data ?? []).forEach((sp: any) => { sprintMap[sp.id] = sp.name; });
        setHistory(histSessions.map((h: any) => {
          const hCards = (allCards.data ?? []).filter((c: any) => c.session_id === h.id);
          return {
            id:          h.id,
            sprint_id:   h.sprint_id,
            sprint_name: sprintMap[h.sprint_id] ?? "-",
            status:      h.status,
            created_at:  h.created_at,
            finished_at: h.finished_at,
            cardCount:   hCards.length,
            actionCount: hCards.filter((c: any) => c.is_action).length,
            wentWell:    hCards.filter((c: any) => c.column_key === "went_well").length,
            toImprove:   hCards.filter((c: any) => c.column_key === "to_improve").length,
          };
        }));
      }
    } finally {
      setLoading(false);
    }
  }, [teamId, userId, loadProfiles]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime
  useEffect(() => {
    if (!session?.id) return;
    const channel = supabase
      .channel(`retro-session-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "retro_cards",        filter: `session_id=eq.${session.id}` }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "retro_votes",        filter: `session_id=eq.${session.id}` }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "retro_participants", filter: `session_id=eq.${session.id}` }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "retro_actions",      filter: `session_id=eq.${session.id}` }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.id, loadAll]);

  // ─ CRUD ────────────────────────────────────────────────────────────────────────────
  const createSession = useCallback(async (sprintIdOverride?: string, model: RetroModelKey = "classic") => {
    if (!userId || !teamId) return;
    const sid = sprintIdOverride ?? sprintId;
    if (!sid) { toast.error("Nenhuma sprint ativa para criar retrospectiva"); return; }
    const { error } = await supabase.from("retro_sessions").insert({
      team_id: teamId, sprint_id: sid, created_by: userId,
      status: "open", current_phase: "writing", model,
    });
    if (error) { toast.error("Erro ao criar sessão"); return; }
    const { data: newSess } = await supabase
      .from("retro_sessions").select("id").eq("team_id", teamId).eq("status", "open")
      .order("created_at", { ascending: false }).limit(1).single();
    if (newSess) {
      await supabase.from("retro_participants").insert({ session_id: newSess.id, user_id: userId, is_facilitator: true });
    }
    toast.success("Sessão de retrospectiva criada!");
    await loadAll();
  }, [teamId, sprintId, userId, loadAll]);

  const setPhase = useCallback(async (phase: RetroPhase) => {
    if (!session) return;
    await supabase.from("retro_sessions").update({ current_phase: phase }).eq("id", session.id);
    await loadAll();
  }, [session, loadAll]);

  const close = useCallback(async () => {
    if (!session) return;
    await supabase.from("retro_sessions")
      .update({ status: "closed", current_phase: "closed", finished_at: new Date().toISOString() })
      .eq("id", session.id);
    await loadAll();
  }, [session, loadAll]);

  const cancel = useCallback(async () => {
    if (!session) return;
    await supabase.from("retro_sessions").delete().eq("id", session.id);
    await loadAll();
  }, [session, loadAll]);

  const addCard = useCallback(async (columnKey: string, text: string) => {
    if (!session || !userId || !text.trim()) return;
    const { error } = await supabase.from("retro_cards").insert({
      session_id: session.id, column_key: columnKey,
      text: text.trim(), author_id: userId, hidden: false,
    });
    if (error) toast.error("Erro ao adicionar card");
    else await loadAll();
  }, [session, userId, loadAll]);

  const updateCardText = useCallback(async (cardId: string, text: string) => {
    await supabase.from("retro_cards").update({ text }).eq("id", cardId);
    await loadAll();
  }, [loadAll]);

  const toggleHide = useCallback(async (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    await supabase.from("retro_cards").update({ hidden: !card.hidden }).eq("id", cardId);
    await loadAll();
  }, [cards, loadAll]);

  const deleteCard = useCallback(async (cardId: string) => {
    await supabase.from("retro_cards").delete().eq("id", cardId);
    await loadAll();
  }, [loadAll]);

  const toggleVote = useCallback(async (cardId: string) => {
    if (!session || !userId) return;
    const alreadyVoted = votes.includes(cardId);
    const card = cards.find((c) => c.id === cardId);
    if (alreadyVoted) {
      await supabase.from("retro_votes").delete().eq("card_id", cardId).eq("user_id", userId);
      await supabase.from("retro_cards").update({ votes: Math.max(0, (card?.votes ?? 1) - 1) }).eq("id", cardId);
    } else {
      await supabase.from("retro_votes").insert({ session_id: session.id, card_id: cardId, user_id: userId });
      await supabase.from("retro_cards").update({ votes: (card?.votes ?? 0) + 1 }).eq("id", cardId);
    }
    await loadAll();
  }, [session, userId, votes, cards, loadAll]);

  const assumeFacilitator = useCallback(async () => {
    if (!session || !userId) return;
    await supabase.from("retro_participants").update({ is_facilitator: false }).eq("session_id", session.id);
    await supabase.from("retro_participants").update({ is_facilitator: true }).eq("session_id", session.id).eq("user_id", userId);
    await loadAll();
  }, [session, userId, loadAll]);

  const transferFacilitatorTo = useCallback(async (targetUserId: string) => {
    if (!session) return;
    await supabase.from("retro_participants").update({ is_facilitator: false }).eq("session_id", session.id);
    await supabase.from("retro_participants").update({ is_facilitator: true }).eq("session_id", session.id).eq("user_id", targetUserId);
    await loadAll();
  }, [session, loadAll]);

  const createActionItem = useCallback(async (description: string, cardId?: string, ownerId?: string) => {
    if (!session) return;
    await supabase.from("retro_actions").insert({
      session_id: session.id, description,
      card_id: cardId ?? null, owner_id: ownerId ?? null, status: "pending",
    });
    await loadAll();
  }, [session, loadAll]);

  const updateActionItem = useCallback(async (id: string, patch: Partial<RetroActionItem>) => {
    const dbPatch: any = {};
    if (patch.status      !== undefined) dbPatch.status       = patch.status;
    if (patch.description !== undefined) dbPatch.description  = patch.description;
    if (patch.title       !== undefined) dbPatch.description  = patch.title;
    if (patch.ownerId     !== undefined) dbPatch.owner_id     = patch.ownerId;
    await supabase.from("retro_actions").update(dbPatch).eq("id", id);
    await loadAll();
  }, [loadAll]);

  const deleteActionItem = useCallback(async (id: string) => {
    await supabase.from("retro_actions").delete().eq("id", id);
    await loadAll();
  }, [loadAll]);

  return {
    session,
    cards,
    votes,
    participants,
    actionItems,
    profiles,
    history,
    loading,
    isFacilitator,
    facilitatorOffline,
    createSession,
    setPhase,
    close,
    cancel,
    addCard,
    updateCardText,
    toggleHide,
    deleteCard,
    toggleVote,
    assumeFacilitator,
    transferFacilitatorTo,
    createActionItem,
    updateActionItem,
    deleteActionItem,
    refresh: loadAll,
  };
}
