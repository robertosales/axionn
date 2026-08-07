import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth }  from "@/contexts/AuthContext";
import { toast }    from "sonner";

// ── Decks ───────────────────────────────────────────────────────────────────
export const DECKS = {
  fibonacci:  { label: "Fibonacci",   values: ["0","1","2","3","5","8","13","21","34","55","☕","?"] },
  modified:   { label: "Modificado",  values: ["0","0.5","1","2","3","5","8","13","20","40","100","?"] },
  tshirt:     { label: "T-Shirt",     values: ["XS","S","M","L","XL","XXL","?"] },
  hours:      { label: "Horas",       values: ["1h","2h","4h","8h","16h","24h","40h","?"] },
};
export type DeckMode = keyof typeof DECKS;

// ── Types ───────────────────────────────────────────────────────────────────
export interface PlanningSession {
  id:          string;
  team_id:     string;
  sprint_id:   string;
  sprint_name: string;
  status:      "open" | "closed";
  deck_mode:   DeckMode;
  created_by:  string;
  created_at:  string;
  finished_at: string | null;
  total_hus:   number | null;
  total_horas: number | null;
}

export interface PlanningRound {
  id:           string;
  session_id:   string;
  hu_id:        string;
  hu_code:      string;
  hu_title:     string;
  round_number: number;
  status:       "voting" | "revealed" | "saved";
  result_value: string | null;
  result_hours: number | null;
  revealed_at:  string | null;
  saved_at:     string | null;
  votes:        PlanningVote[];
}

export interface PlanningVote {
  id:         string;
  user_id:    string;
  user_name:  string;
  vote_value: string | null;
  revealed:   boolean;
}

export interface PlanningParticipant {
  user_id:       string;
  user_name:     string;
  is_facilitator: boolean;
  is_online:     boolean;
  has_voted:     boolean; // computed
}

// ── Hook ────────────────────────────────────────────────────────────────────────
export function usePlanningPoker() {
  const { profile, currentTeam } = useAuth();
  const teamId = currentTeam?.id ?? "";
  const userId = profile?.user_id ?? "";

  const [session,      setSession]      = useState<PlanningSession | null>(null);
  const [round,        setRound]        = useState<PlanningRound | null>(null);
  const [history,      setHistory]      = useState<PlanningSession[]>([]);
  const [participants, setParticipants] = useState<PlanningParticipant[]>([]);
  const [sprints,      setSprints]      = useState<{ id: string; name: string }[]>([]);
  const [backlogHUs,   setBacklogHUs]   = useState<{ id: string; code: string; title: string; estimated_hours: number | null }[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [myVote,       setMyVote]       = useState<string | null>(null);

  // ─ Carregar sprint list e HUs do backlog ────────────────────────────────
  useEffect(() => {
    if (!teamId) return;
    Promise.all([
      supabase.from("sprints").select("id, name").eq("team_id", teamId).order("created_at", { ascending: false }).limit(30),
      supabase.from("user_stories").select("id, code, title, estimated_hours").eq("team_id", teamId).is("sprint_id", null).limit(200),
    ]).then(([spRes, huRes]) => {
      setSprints((spRes.data ?? []) as { id: string; name: string }[]);
      setBacklogHUs((huRes.data ?? []) as any[]);
    });
  }, [teamId]);

  // ─ Carrega sessão aberta ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      // Sessão aberta
      const { data: sessions } = await supabase
        .from("planning_sessions")
        .select("*")
        .eq("team_id", teamId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1);

      if (sessions && sessions.length > 0) {
        const s = sessions[0] as any;
        const sprintRes = await supabase.from("sprints").select("name").eq("id", s.sprint_id).single();
        const newSession: PlanningSession = { ...s, sprint_name: sprintRes.data?.name ?? "", deck_mode: s.deck_mode ?? "fibonacci" };
        setSession(newSession);

        // Round ativo
        await loadActiveRound(s.id);

        // Participantes
        await loadParticipants(s.id);
      } else {
        setSession(null);
        setRound(null);
        setParticipants([]);
      }

      // Histórico
      const { data: hist } = await supabase
        .from("planning_sessions")
        .select("id, team_id, sprint_id, status, deck_mode, created_by, created_at, finished_at, total_hus, total_horas")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (hist && hist.length > 0) {
        const sprintIds = [...new Set(hist.map((h: any) => h.sprint_id))];
        const { data: spData } = await supabase.from("sprints").select("id, name").in("id", sprintIds);
        const spMap: Record<string, string> = {};
        (spData ?? []).forEach((sp: any) => { spMap[sp.id] = sp.name; });
        setHistory(hist.map((h: any) => ({ ...h, sprint_name: spMap[h.sprint_id] ?? "-", deck_mode: h.deck_mode ?? "fibonacci" })));
      }
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const loadActiveRound = useCallback(async (sessionId: string) => {
    const { data: rounds } = await supabase
      .from("planning_rounds")
      .select("*")
      .eq("session_id", sessionId)
      .in("status", ["voting", "revealed"])
      .order("round_number", { ascending: false })
      .limit(1);

    if (rounds && rounds.length > 0) {
      const r = rounds[0] as any;
      const huRes = await supabase.from("user_stories").select("code, title").eq("id", r.hu_id).single();
      const votesRes = await supabase.rpc("get_planning_round_votes", { p_session_id: sessionId, p_hu_id: r.hu_id });

      // Enriquece votos com nomes
      const userIds = [...new Set((votesRes.data ?? []).map((v: any) => v.user_id))];
      const profilesRes = userIds.length > 0
        ? await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds)
        : { data: [] };
      const nameMap: Record<string, string> = {};
      (profilesRes.data ?? []).forEach((p: any) => { nameMap[p.user_id] = p.display_name; });

      const myVoteRecord = (votesRes.data ?? []).find((v: any) => v.user_id === userId);
      setMyVote(myVoteRecord?.vote_value ?? null);

      setRound({
        ...r,
        hu_code:  huRes.data?.code  ?? "",
        hu_title: huRes.data?.title ?? "",
        votes: (votesRes.data ?? []).map((v: any) => ({
          id:         v.id,
          user_id:    v.user_id,
          user_name:  nameMap[v.user_id] ?? v.user_id,
          vote_value: v.vote_value,
          revealed:   v.revealed,
        })),
      });
    } else {
      setRound(null);
    }
  }, [userId]);

  const loadParticipants = useCallback(async (sessionId: string) => {
    const { data: parts } = await supabase
      .from("planning_participants")
      .select("user_id, is_facilitator, is_online")
      .eq("session_id", sessionId);

    const userIds = (parts ?? []).map((p: any) => p.user_id);
    const namesRes = userIds.length > 0
      ? await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds)
      : { data: [] };
    const nameMap: Record<string, string> = {};
    (namesRes.data ?? []).forEach((p: any) => { nameMap[p.user_id] = p.display_name; });

    setParticipants((parts ?? []).map((p: any) => ({
      user_id:        p.user_id,
      user_name:      nameMap[p.user_id] ?? p.user_id,
      is_facilitator: p.is_facilitator,
      is_online:      p.is_online,
      has_voted:      false, // será calculado no useMemo
    })));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!session?.id) return;
    const ch = supabase.channel(`planning-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "planning_rounds",   filter: `session_id=eq.${session.id}` }, () => loadActiveRound(session.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "planning_participants", filter: `session_id=eq.${session.id}` }, () => loadParticipants(session.id))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session?.id, loadActiveRound, loadParticipants]);

  // Participantes enriquecidos com has_voted
  const enrichedParticipants = useMemo(() => {
    const votedIds = new Set((round?.votes ?? []).map(v => v.user_id));
    return participants.map(p => ({ ...p, has_voted: votedIds.has(p.user_id) }));
  }, [participants, round]);

  const isFacilitator = session?.created_by === userId || profile?.module_access === "admin";

  // ─ CRUD ────────────────────────────────────────────────────────────────────────
  const createSession = useCallback(async (sprintId: string, deckMode: DeckMode = "fibonacci") => {
    if (!teamId || !userId) return;
    const { error } = await supabase.rpc("create_planning_session", {
      p_team_id: teamId, p_sprint_id: sprintId, p_deck_mode: deckMode,
    });
    if (error) { toast.error("Erro ao criar sessão", { description: error.message }); return; }
    toast.success("Sessão de Planning Poker iniciada!");
    await load();
  }, [teamId, userId, load]);

  const joinSession = useCallback(async () => {
    if (!session) return;
    const { error } = await supabase.rpc("join_planning_session", { p_session_id: session.id });
    if (error) { toast.error("Não foi possível entrar na sessão", { description: error.message }); return; }
    await loadParticipants(session.id);
  }, [session, loadParticipants]);

  const startRound = useCallback(async (huId: string) => {
    if (!session) return;
    const { error } = await supabase.rpc("start_planning_round", {
      p_session_id: session.id, p_hu_id: huId,
    });
    if (error) { toast.error("Erro ao iniciar rodada", { description: error.message }); return; }
    await loadActiveRound(session.id);
  }, [session, loadActiveRound]);

  const castVote = useCallback(async (value: string) => {
    if (!session || !round) return;
    const { error } = await supabase.rpc("cast_planning_vote", {
      p_session_id: session.id, p_hu_id: round.hu_id, p_vote_value: value,
    });
    if (error) { toast.error("Não foi possível registrar o voto", { description: error.message }); return; }
    setMyVote(value);
    await loadActiveRound(session.id);
  }, [session, round, loadActiveRound]);

  const revealVotes = useCallback(async () => {
    if (!round) return;
    const { error } = await supabase.rpc("reveal_planning_votes", { p_round_id: round.id });
    if (error) { toast.error("Não foi possível revelar os votos", { description: error.message }); return; }
    await loadActiveRound(session!.id);
  }, [round, session, loadActiveRound]);

  const saveResult = useCallback(async (value: string, hours: number | null) => {
    if (!round || !session) return;
    const { error } = await supabase.rpc("save_planning_result", {
      p_round_id: round.id, p_value: value, p_hours: hours,
    });
    if (error) { toast.error("Não foi possível salvar a estimativa", { description: error.message }); return; }
    toast.success(`HU estimada: ${value}${hours ? ` = ${hours}h` : ""}`);
    setMyVote(null);
    await loadActiveRound(session.id);
  }, [round, session, loadActiveRound]);

  const closeSession = useCallback(async () => {
    if (!session) return;
    const { error } = await supabase.rpc("close_planning_session", { p_session_id: session.id });
    if (error) { toast.error("Não foi possível encerrar a sessão", { description: error.message }); return; }
    toast.success("Sessão de planning encerrada!");
    await load();
  }, [session, load]);

  return {
    session, round, history, participants: enrichedParticipants,
    sprints, backlogHUs, loading, myVote, isFacilitator,
    createSession, joinSession,
    startRound, castVote, revealVotes, saveResult, closeSession,
    reload: load,
  };
}
