import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────────
export type RetroPhase = "writing" | "voting" | "discussing" | "actions" | "closed";
export type RetroColumnKey = "went_well" | "to_improve" | "action_items";
export type RetroModel = "start_stop_continue" | "4ls" | "glad_sad_mad" | "classic";

export const RETRO_COLUMNS: { key: RetroColumnKey; label: string; emoji: string; color: string }[] = [
  { key: "went_well",    label: "O que foi bem",    emoji: "😊", color: "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20" },
  { key: "to_improve",  label: "O que melhorar",   emoji: "🔧", color: "border-orange-400 bg-orange-50/60 dark:bg-orange-950/20" },
  { key: "action_items",label: "Itens de ação",    emoji: "⚡",    color: "border-blue-400 bg-blue-50/60 dark:bg-blue-950/20" },
];

export interface RetroCard {
  id:              string;
  session_id:      string;
  column_key:      RetroColumnKey;
  text:            string;
  author_id:       string;
  votes:           number;
  hidden:          boolean;
  is_action:       boolean;
  action_owner_id: string | null;
  created_at:      string;
}

export interface RetroSession {
  id:            string;
  team_id:       string;
  sprint_id:     string;
  sprint_name?:  string;
  status:        "open" | "closed";
  current_phase: RetroPhase;
  model:         RetroModel;
  created_by:    string;
  created_at:    string;
  finished_at:   string | null;
  cards:         RetroCard[];
  participants:  string[];
  myVotes:       string[];
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

// ── Hook ────────────────────────────────────────────────────────────────────────────
export function useRetroSession({ teamId, sprintId, userId }: UseRetroSessionParams) {
  const [session,  setSession]  = useState<RetroSession | null>(null);
  const [history,  setHistory]  = useState<RetroHistoryItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [sprints,  setSprints]  = useState<{ id: string; name: string }[]>([]);

  // ─ Carrega lista de sprints do time ───────────────────────────────────────────
  useEffect(() => {
    if (!teamId) return;
    supabase
      .from("sprints")
      .select("id, name")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setSprints((data ?? []) as { id: string; name: string }[]));
  }, [teamId]);

  // ─ Carrega sessão aberta + histórico ───────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
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
        const [cardsRes, votesRes, partRes, sprintRes] = await Promise.all([
          supabase.from("retro_cards").select("*").eq("session_id", s.id).order("created_at"),
          supabase.from("retro_votes").select("card_id").eq("session_id", s.id).eq("user_id", uid),
          supabase.from("retro_participants").select("user_id").eq("session_id", s.id),
          supabase.from("sprints").select("name").eq("id", s.sprint_id).single(),
        ]);
        setSession({
          ...s,
          sprint_name:  sprintRes.data?.name ?? "",
          cards:        (cardsRes.data ?? []) as RetroCard[],
          myVotes:      (votesRes.data ?? []).map((v: any) => v.card_id),
          participants: (partRes.data  ?? []).map((p: any) => p.user_id),
        });
      } else {
        setSession(null);
      }

      // Histórico
      const { data: histSessions } = await supabase
        .from("retro_sessions")
        .select("id, sprint_id, status, created_at, finished_at")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (histSessions && histSessions.length > 0) {
        const ids = histSessions.map((h: any) => h.id);
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
  }, [teamId, userId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime
  useEffect(() => {
    if (!session?.id) return;
    const channel = supabase
      .channel(`retro-cards-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "retro_cards",       filter: `session_id=eq.${session.id}` }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "retro_votes",       filter: `session_id=eq.${session.id}` }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "retro_participants", filter: `session_id=eq.${session.id}` }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.id, loadAll]);

  // ─ CRUD ──────────────────────────────────────────────────────────────────────────────
  const createSession = useCallback(async (sprintIdOverride?: string, model: RetroModel = "classic") => {
    if (!userId || !teamId) return;
    const sid = sprintIdOverride ?? sprintId;
    if (!sid) { toast.error("Nenhuma sprint ativa para criar retrospectiva"); return; }
    const { error } = await supabase.from("retro_sessions").insert({
      team_id: teamId, sprint_id: sid, created_by: userId,
      status: "open", current_phase: "writing", model,
    });
    if (error) { toast.error("Erro ao criar sessão"); return; }
    const { data: newSession } = await supabase
      .from("retro_sessions").select("id").eq("team_id", teamId).eq("status", "open")
      .order("created_at", { ascending: false }).limit(1).single();
    if (newSession) {
      await supabase.from("retro_participants").insert({ session_id: newSession.id, user_id: userId, is_facilitator: true });
    }
    toast.success("Sessão de retrospectiva criada!");
    await loadAll();
  }, [teamId, sprintId, userId, loadAll]);

  const joinSession = useCallback(async () => {
    if (!session || !userId) return;
    const { data: existing } = await supabase
      .from("retro_participants").select("id").eq("session_id", session.id).eq("user_id", userId).maybeSingle();
    if (!existing) {
      await supabase.from("retro_participants").insert({ session_id: session.id, user_id: userId });
    } else {
      await supabase.from("retro_participants")
        .update({ is_online: true, last_seen_at: new Date().toISOString() })
        .eq("session_id", session.id).eq("user_id", userId);
    }
    await loadAll();
  }, [session, userId, loadAll]);

  const addCard = useCallback(async (columnKey: RetroColumnKey, text: string) => {
    if (!session || !userId || !text.trim()) return;
    const { error } = await supabase.from("retro_cards").insert({
      session_id: session.id, column_key: columnKey,
      text: text.trim(), author_id: userId, hidden: false,
    });
    if (error) toast.error("Erro ao adicionar card");
    else await loadAll();
  }, [session, userId, loadAll]);

  const deleteCard = useCallback(async (cardId: string) => {
    await supabase.from("retro_cards").delete().eq("id", cardId);
    await loadAll();
  }, [loadAll]);

  const editCard = useCallback(async (cardId: string, text: string) => {
    await supabase.from("retro_cards").update({ text }).eq("id", cardId);
    await loadAll();
  }, [loadAll]);

  const voteCard = useCallback(async (cardId: string) => {
    if (!session || !userId) return;
    const alreadyVoted = session.myVotes.includes(cardId);
    const card = session.cards.find(c => c.id === cardId);
    if (alreadyVoted) {
      await supabase.from("retro_votes").delete().eq("card_id", cardId).eq("user_id", userId);
      await supabase.from("retro_cards").update({ votes: Math.max(0, (card?.votes ?? 1) - 1) }).eq("id", cardId);
    } else {
      await supabase.from("retro_votes").insert({ session_id: session.id, card_id: cardId, user_id: userId });
      await supabase.from("retro_cards").update({ votes: (card?.votes ?? 0) + 1 }).eq("id", cardId);
    }
    await loadAll();
  }, [session, userId, loadAll]);

  const advancePhase = useCallback(async () => {
    if (!session) return;
    const phases: RetroPhase[] = ["writing", "voting", "discussing", "actions", "closed"];
    const idx = phases.indexOf(session.current_phase);
    const next = phases[idx + 1] ?? "closed";
    const update: any = { current_phase: next };
    if (next === "closed") { update.status = "closed"; update.finished_at = new Date().toISOString(); }
    await supabase.from("retro_sessions").update(update).eq("id", session.id);
    toast.success(next === "closed" ? "Retrospectiva encerrada!" : `Fase: ${next}`);
    await loadAll();
  }, [session, loadAll]);

  const closeSession = useCallback(async () => {
    if (!session) return;
    await supabase.from("retro_sessions")
      .update({ status: "closed", current_phase: "closed", finished_at: new Date().toISOString() })
      .eq("id", session.id);
    toast.success("Retrospectiva encerrada!");
    await loadAll();
  }, [session, loadAll]);

  return {
    session, history, loading, sprints,
    createSession, joinSession,
    addCard, deleteCard, editCard,
    voteCard, advancePhase, closeSession,
    reload: loadAll,
  };
}
