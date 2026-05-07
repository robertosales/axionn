import { useState, useEffect, useMemo, useCallback } from "react";
import { useSprint } from "@/contexts/SprintContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SizeBadge } from "@/components/SizeBadge";
import { CountdownTimer } from "@/components/CountdownTimer";
import {
  SIZE_REFERENCES,
  FIBONACCI_DECK,
  getSizeByKey,
  getSizeByPoints,
  type SizeReference,
} from "@/lib/sizeReference";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Search,
  Play,
  RotateCcw,
  ChevronRight,
  Check,
  Settings,
  Users,
  Eye,
  EyeOff,
  Clock,
  Coffee,
  Infinity,
  HelpCircle,
  XCircle,
  AlertTriangle,
  FastForward,
  BarChart2,
  ThumbsUp,
} from "lucide-react";
import type { UserStory } from "@/types/sprint";

type DeckMode = "fibonacci" | "hours" | "custom";

interface PlanningSession {
  id: string;
  deckMode: DeckMode;
  deckConfig: any;
  status: string;
  createdBy: string;
}

interface Vote {
  id: string;
  huId: string;
  userId: string;
  voteValue: string;
  revealed: boolean;
}

interface Participant {
  id: string;
  userId: string;
  displayName: string;
  isOnline: boolean;
  isFacilitator: boolean;
}

/** Retorna as iniciais usando a PRIMEIRA e a ÚLTIMA palavra do nome */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PlanningPoker() {
  const { userStories, activeSprint, updateUserStory, refreshAll } = useSprint();
  const { currentTeamId, profile } = useAuth();

  const [session, setSession] = useState<PlanningSession | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [currentHuId, setCurrentHuId] = useState<string | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deckMode, setDeckMode] = useState<DeckMode>("fibonacci");
  const [customCards, setCustomCards] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [hoursConfig, setHoursConfig] = useState(SIZE_REFERENCES.map((s) => ({ ...s })));
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selectedConsensus, setSelectedConsensus] = useState<string | null>(null);

  const userId = profile?.user_id;
  const isHost = session?.createdBy === userId;

  const sprintStories = useMemo(() => {
    if (!activeSprint) return [];
    return userStories.filter((hu) => hu.sprintId === activeSprint.id);
  }, [activeSprint, userStories]);

  const categorizedStories = useMemo(() => {
    const pending: UserStory[] = [];
    const voting: UserStory[] = [];
    const voted: UserStory[] = [];
    sprintStories.forEach((hu) => {
      if (hu.id === currentHuId) voting.push(hu);
      else if (hu.planningStatus === "voted" || hu.sizeReference) voted.push(hu);
      else pending.push(hu);
    });
    return { pending, voting, voted };
  }, [sprintStories, currentHuId]);

  const filteredPending = useMemo(() => {
    if (!searchTerm) return categorizedStories.pending;
    const q = searchTerm.toLowerCase();
    return categorizedStories.pending.filter(
      (hu) => hu.title.toLowerCase().includes(q) || hu.code.toLowerCase().includes(q),
    );
  }, [categorizedStories.pending, searchTerm]);

  const votedSummary = useMemo(() => {
    const items = categorizedStories.voted.map((hu) => ({
      code: hu.code,
      title: hu.title,
      sizeReference: hu.sizeReference,
      hours: hu.estimatedHours ?? 0,
      storyPoints: hu.storyPoints,
    }));
    const totalHours = items.reduce((sum, hu) => sum + hu.hours, 0);
    const totalPoints = items.reduce((sum, hu) => sum + (hu.storyPoints ?? 0), 0);
    return { items, totalHours, totalPoints };
  }, [categorizedStories.voted]);

  useEffect(() => {
    const loadProfiles = async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name").limit(500);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((p) => {
          map[p.user_id] = p.display_name;
        });
        setProfiles(map);
      }
    };
    loadProfiles();
  }, []);

  const loadSession = useCallback(async () => {
    if (!currentTeamId || !activeSprint) return;
    const { data } = await supabase
      .from("planning_sessions")
      .select("*")
      .eq("team_id", currentTeamId)
      .eq("sprint_id", activeSprint.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const s = data[0];
      setSession({
        id: s.id,
        deckMode: s.deck_mode as DeckMode,
        deckConfig: s.deck_config,
        status: s.status,
        createdBy: s.created_by,
      });
      setDeckMode(s.deck_mode as DeckMode);
      if (s.deck_config && Array.isArray(s.deck_config)) setCustomCards(s.deck_config as string[]);
    }
  }, [currentTeamId, activeSprint]);

  const loadParticipants = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from("planning_participants").select("*").eq("session_id", session.id).limit(100);
    if (data) {
      setParticipants(
        data.map((p: any) => ({
          id: p.id,
          userId: p.user_id,
          displayName: profiles[p.user_id] || "Participante",
          isOnline: p.is_online,
          isFacilitator: p.is_facilitator,
        })),
      );
    }
  }, [session, profiles]);

  const loadVotes = useCallback(async () => {
    if (!session || !currentHuId) return;
    const { data } = await supabase
      .from("planning_votes")
      .select("*")
      .eq("session_id", session.id)
      .eq("hu_id", currentHuId)
      .limit(500);
    if (data) {
      setVotes(
        data.map((v: any) => ({
          id: v.id,
          huId: v.hu_id,
          userId: v.user_id,
          voteValue: v.vote_value,
          revealed: v.revealed,
        })),
      );
      const mine = data.find((v: any) => v.user_id === userId);
      setMyVote(mine?.vote_value || null);
      setRevealed(data.every((v: any) => v.revealed));
    }
  }, [session, currentHuId, userId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);
  useEffect(() => {
    loadVotes();
  }, [loadVotes]);
  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);
  useEffect(() => {
    setSelectedConsensus(null);
  }, [currentHuId, revealed]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`planning-session-${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "planning_votes", filter: `session_id=eq.${session.id}` },
        () => {
          loadVotes();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "planning_participants", filter: `session_id=eq.${session.id}` },
        () => {
          loadParticipants();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, loadVotes, loadParticipants]);

  const joinSession = useCallback(
    async (sessionId: string, isCreator: boolean) => {
      if (!userId) return;
      const { data: existing } = await supabase
        .from("planning_participants")
        .select("id")
        .eq("session_id", sessionId)
        .eq("user_id", userId)
        .limit(1);
      if (existing && existing.length > 0) {
        await supabase
          .from("planning_participants")
          .update({ is_online: true, last_seen_at: new Date().toISOString() })
          .eq("id", existing[0].id);
      } else {
        await supabase
          .from("planning_participants")
          .insert({ session_id: sessionId, user_id: userId, is_facilitator: isCreator, is_online: true });
      }
    },
    [userId],
  );

  useEffect(() => {
    if (session && userId) joinSession(session.id, session.createdBy === userId);
  }, [session, userId, joinSession]);

  const startSession = async () => {
    if (!currentTeamId || !activeSprint || !userId) return;
    const config = deckMode === "custom" ? customCards : [];
    const { data, error } = await supabase
      .from("planning_sessions")
      .insert({
        team_id: currentTeamId,
        sprint_id: activeSprint.id,
        deck_mode: deckMode,
        deck_config: config,
        created_by: userId,
      })
      .select()
      .single();
    if (error) {
      toast.error("Erro ao iniciar sessão");
      return;
    }
    setSession({
      id: data.id,
      deckMode: data.deck_mode as DeckMode,
      deckConfig: data.deck_config,
      status: data.status,
      createdBy: data.created_by,
    });
    await joinSession(data.id, true);
    const firstPending = sprintStories.find((hu) => hu.planningStatus !== "voted" && !hu.sizeReference);
    if (firstPending) setCurrentHuId(firstPending.id);
    toast.success("Sessão iniciada!");
  };

  const castVote = async (value: string) => {
    if (!session || !currentHuId || !userId) return;
    await supabase
      .from("planning_votes")
      .delete()
      .eq("session_id", session.id)
      .eq("hu_id", currentHuId)
      .eq("user_id", userId);
    await supabase
      .from("planning_votes")
      .insert({ session_id: session.id, hu_id: currentHuId, user_id: userId, vote_value: value, revealed: false });
    setMyVote(value);
  };

  const revealVotes = async () => {
    if (!session || !currentHuId) return;
    await supabase
      .from("planning_votes")
      .update({ revealed: true })
      .eq("session_id", session.id)
      .eq("hu_id", currentHuId);
    setRevealed(true);
  };

  const forceReveal = async () => {
    if (!session || !currentHuId) return;
    const voterIds = new Set(votes.map((v) => v.userId));
    const nonVoters = participants.filter((p) => !voterIds.has(p.userId));
    for (const p of nonVoters) {
      await supabase
        .from("planning_votes")
        .insert({ session_id: session.id, hu_id: currentHuId, user_id: p.userId, vote_value: "—", revealed: true });
    }
    await supabase
      .from("planning_votes")
      .update({ revealed: true })
      .eq("session_id", session.id)
      .eq("hu_id", currentHuId);
    setRevealed(true);
    toast.info("Votos forçados e revelados");
  };

  const revote = async () => {
    if (!session || !currentHuId) return;
    await supabase.from("planning_votes").delete().eq("session_id", session.id).eq("hu_id", currentHuId);
    setVotes([]);
    setMyVote(null);
    setRevealed(false);
    setSelectedConsensus(null);
    toast.info("Nova rodada de votação");
  };

  const confirmAndAdvance = async (sizeKey: string) => {
    if (!currentHuId || !userId) return;
    const size =
      deckMode === "hours"
        ? (hoursConfig.find((s) => s.key === sizeKey) ?? getSizeByKey(sizeKey))
        : getSizeByKey(sizeKey);
    if (!size) return;
    await updateUserStory(currentHuId, {
      storyPoints: size.points,
      sizeReference: size.key,
      estimatedHours: size.hours,
      planningStatus: "voted",
      votedAt: new Date().toISOString(),
      votedBy: userId,
    } as any);
    toast.success(`HU confirmada: ${size.label} — ${size.hours}h`);
    const nextPending = sprintStories.find(
      (hu) => hu.id !== currentHuId && hu.planningStatus !== "voted" && !hu.sizeReference,
    );
    setCurrentHuId(nextPending?.id || null);
    setMyVote(null);
    setVotes([]);
    setRevealed(false);
    setSelectedConsensus(null);
    await refreshAll();
  };

  const endSession = async () => {
    if (!session) return;
    await supabase
      .from("planning_sessions")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("id", session.id);
    setSession(null);
    setCurrentHuId(null);
    toast.success("Sessão encerrada!");
  };

  const cancelSession = async () => {
    if (!session) return;
    setCancelling(true);
    try {
      const votedHus = sprintStories.filter((hu) => hu.planningStatus === "voted" && hu.votedAt);
      for (const hu of votedHus) {
        await supabase
          .from("user_stories")
          .update({
            planning_status: "pending",
            story_points: null,
            size_reference: null,
            estimated_hours: null,
            voted_at: null,
            voted_by: null,
          })
          .eq("id", hu.id);
      }
      await supabase.from("planning_votes").delete().eq("session_id", session.id);
      await supabase.from("planning_participants").delete().eq("session_id", session.id);
      await supabase
        .from("planning_sessions")
        .update({ status: "cancelled", finished_at: new Date().toISOString() })
        .eq("id", session.id);
      setSession(null);
      setCurrentHuId(null);
      setMyVote(null);
      setVotes([]);
      setSelectedConsensus(null);
      setCancelOpen(false);
      await refreshAll();
      toast.success("Sessão cancelada. Todas as votações foram descartadas.");
    } catch {
      toast.error("Erro ao cancelar sessão");
    } finally {
      setCancelling(false);
    }
  };

  const getDeckCards = (): string[] => {
    if (deckMode === "fibonacci") return FIBONACCI_DECK;
    if (deckMode === "hours") return hoursConfig.map((s) => s.key);
    return customCards;
  };

  const resolveSizeFromVote = useCallback(
    (voteValue: string): SizeReference | null => {
      if (deckMode === "hours") {
        return (hoursConfig.find((s) => s.key === voteValue) as SizeReference) ?? getSizeByKey(voteValue);
      }
      const num = parseFloat(voteValue === "½" ? "0.5" : voteValue);
      if (isNaN(num)) return null;
      return getSizeByPoints(num);
    },
    [deckMode, hoursConfig],
  );

  // ✅ LÓGICA CORRIGIDA: divergência baseada em HORAS reais (P=4, M=6, G=12, GG=16, XG=24)
  const getConsensus = useCallback((): {
    suggestedKey: string | null;
    suggestedSize: SizeReference | null;
    counts: Record<string, number>;
    isUnanimous: boolean;
    divergenceLevel: "none" | "low" | "high"; // none=ok, low=aviso, high=alerta
    divergenceLabel: string;
    allKeys: string[];
  } => {
    const counts: Record<string, number> = {};
    votes.forEach((v) => {
      if (v.voteValue === "—") return;
      counts[v.voteValue] = (counts[v.voteValue] || 0) + 1;
    });

    const validVotes = votes.filter((v) => v.voteValue !== "—");
    if (validVotes.length === 0) {
      return {
        suggestedKey: null,
        suggestedSize: null,
        counts,
        isUnanimous: false,
        divergenceLevel: "none",
        divergenceLabel: "",
        allKeys: getDeckCards(),
      };
    }

    const uniqueValues = [...new Set(validVotes.map((v) => v.voteValue))];
    const isUnanimous = uniqueValues.length === 1;

    // Moda: valor mais votado (critério de sugestão)
    let maxCount = 0;
    let modeKey = uniqueValues[0];
    Object.entries(counts).forEach(([val, count]) => {
      if (count > maxCount) {
        maxCount = count;
        modeKey = val;
      }
    });

    // ✅ Divergência calculada por HORAS reais
    let divergenceLevel: "none" | "low" | "high" = "none";
    let divergenceLabel = "";

    if (!isUnanimous) {
      let hoursList: number[] = [];

      if (deckMode === "hours") {
        // Usa horas diretamente do hoursConfig: P=4, M=6, G=12, GG=16, XG=24
        hoursList = uniqueValues.map((k) => hoursConfig.find((h) => h.key === k)?.hours ?? 0).filter((h) => h > 0);
      } else {
        // Fibonacci: converte pontos em horas aproximadas via SIZE_REFERENCES
        hoursList = uniqueValues
          .map((v) => {
            const num = parseFloat(v === "½" ? "0.5" : v);
            if (isNaN(num)) return 0;
            const size = getSizeByPoints(num);
            return size?.hours ?? num; // fallback para o valor numérico
          })
          .filter((h) => h > 0);
      }

      if (hoursList.length >= 2) {
        const minH = Math.min(...hoursList);
        const maxH = Math.max(...hoursList);
        const ratio = maxH / Math.max(minH, 1);

        if (ratio >= 2.5) {
          divergenceLevel = "high";
          divergenceLabel = `Diferença de ${minH}h → ${maxH}h (${ratio.toFixed(1)}x) — discussão necessária`;
        } else if (ratio >= 1.8) {
          divergenceLevel = "low";
          divergenceLabel = `Diferença de ${minH}h → ${maxH}h — verifique com a equipe`;
        }
      }
    }

    const suggestedSize = resolveSizeFromVote(modeKey);

    return {
      suggestedKey: modeKey,
      suggestedSize,
      counts,
      isUnanimous,
      divergenceLevel,
      divergenceLabel,
      allKeys: getDeckCards(),
    };
  }, [votes, deckMode, hoursConfig, resolveSizeFromVote]);

  const currentHu = currentHuId ? sprintStories.find((hu) => hu.id === currentHuId) : null;
  const consensus = revealed ? getConsensus() : null;
  const finalKey = consensus?.isUnanimous ? consensus.suggestedKey : selectedConsensus;
  const finalSize = finalKey ? resolveSizeFromVote(finalKey) : null;

  const votedCount = categorizedStories.voted.length;
  const pendingCount = categorizedStories.pending.length;
  const votingCount = currentHuId ? 1 : 0;

  const participantVoteStatus = useMemo(() => {
    const voterIds = new Set(votes.map((v) => v.userId));
    return participants.map((p) => ({
      ...p,
      displayName: profiles[p.userId] || p.displayName,
      hasVoted: voterIds.has(p.userId),
    }));
  }, [participants, votes, profiles]);

  const cardDisplayValue = (val: string) => {
    if (val === "☕") return <Coffee className="h-5 w-5" />;
    if (val === "∞") return <Infinity className="h-5 w-5" />;
    if (val === "?") return <HelpCircle className="h-5 w-5" />;
    if (val === "—") return <span className="text-muted-foreground text-xs">N/V</span>;
    return val;
  };

  if (!activeSprint) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Settings className="h-14 w-14 text-muted-foreground/30" />
        <p className="text-lg text-muted-foreground font-medium">Ative uma Sprint para usar o Planning Poker</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" /> Planning Poker
            </h2>
            <p className="text-sm text-muted-foreground">
              {activeSprint.name} · {sprintStories.length} HUs
            </p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configurar Baralho</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {[
                { mode: "fibonacci" as DeckMode, label: "Fibonacci", desc: "0, ½, 1, 2, 3, 5, 8, 13, 21..." },
                {
                  mode: "hours" as DeckMode,
                  label: "Referência em Horas",
                  desc: "P=4h · M=6h · G=12h · GG=16h · XG=24h",
                },
                { mode: "custom" as DeckMode, label: "Customizado", desc: "Crie seu próprio baralho" },
              ].map(({ mode, label, desc }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDeckMode(mode)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border-2 p-4 text-left transition-all",
                    deckMode === mode ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                  )}
                >
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-[11px] text-muted-foreground">{desc}</span>
                </button>
              ))}
            </div>
            {deckMode === "fibonacci" && (
              <div className="flex flex-wrap gap-2">
                {FIBONACCI_DECK.map((card) => (
                  <div
                    key={card}
                    className="flex items-center justify-center h-12 w-12 rounded-lg border bg-card text-sm font-bold"
                  >
                    {cardDisplayValue(card)}
                  </div>
                ))}
              </div>
            )}
            {deckMode === "hours" && (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-medium text-muted-foreground px-1">
                  <span>Tamanho</span>
                  <span>Label</span>
                  <span>Horas</span>
                  <span>Pontos</span>
                </div>
                {hoursConfig.map((s, i) => (
                  <div key={s.key} className="grid grid-cols-4 gap-2 items-center">
                    <Input value={s.key} readOnly className="h-8 text-xs text-center font-bold" />
                    <Input value={s.label} readOnly className="h-8 text-xs text-center" />
                    <Input
                      type="number"
                      value={s.hours}
                      onChange={(e) => {
                        const c = [...hoursConfig];
                        c[i] = { ...c[i], hours: Number(e.target.value) };
                        setHoursConfig(c);
                      }}
                      className="h-8 text-xs text-center"
                    />
                    <Input value={s.pointsLabel} readOnly className="h-8 text-xs text-center text-muted-foreground" />
                  </div>
                ))}
                {/* Preview das cartas com horas */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {hoursConfig.map((s) => (
                    <div
                      key={s.key}
                      className="flex flex-col items-center justify-center h-14 w-12 rounded-lg border bg-card gap-0.5"
                    >
                      <span className="text-sm font-bold">{s.key}</span>
                      <span className="text-[10px] text-muted-foreground">{s.hours}h</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {deckMode === "custom" && (
              <div className="space-y-3">
                <Input
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customInput.trim()) {
                      setCustomCards([...customCards, customInput.trim()]);
                      setCustomInput("");
                    }
                  }}
                  placeholder="Adicione um valor e pressione Enter"
                  className="h-8 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  {customCards.map((card, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="text-sm gap-1 cursor-pointer"
                      onClick={() => setCustomCards(customCards.filter((_, j) => j !== i))}
                    >
                      {card} ✕
                    </Badge>
                  ))}
                </div>
                {customCards.length < 2 && <p className="text-xs text-muted-foreground">Mínimo 2 cartas necessárias</p>}
              </div>
            )}
            <Separator />
            <div className="flex justify-end">
              <Button
                onClick={startSession}
                disabled={deckMode === "custom" && customCards.length < 2}
                className="gap-2"
              >
                <Play className="h-4 w-4" /> Salvar e Iniciar Sessão
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" /> Planning Poker
          </h2>
          <p className="text-sm text-muted-foreground">
            {activeSprint.name} · {sprintStories.length} HUs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CountdownTimer isFacilitator={isHost} />
          <Badge className="bg-success/15 text-success border border-success/30 gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Sessão Ativa
          </Badge>
          <Button variant="outline" size="sm" onClick={endSession}>
            Encerrar Sessão
          </Button>
          {isHost && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setCancelOpen(true)}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Left panel */}
        <div className="col-span-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por ID ou título..."
              className="pl-8 h-8 text-xs"
            />
          </div>
          <ScrollArea className="h-[calc(100vh-380px)]">
            <div className="space-y-2 pr-2">
              {categorizedStories.voting.map((hu) => (
                <Card
                  key={hu.id}
                  className="border-warning/50 bg-warning/5 cursor-pointer"
                  onClick={() => setCurrentHuId(hu.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {hu.code}
                      </Badge>
                      <Badge className="bg-warning/15 text-warning border border-warning/30 text-[10px] gap-1">
                        <Clock className="h-2.5 w-2.5" /> ⏳ Votando
                      </Badge>
                    </div>
                    <p className="text-xs font-medium line-clamp-2">{hu.title}</p>
                  </CardContent>
                </Card>
              ))}
              {filteredPending.map((hu) => (
                <Card
                  key={hu.id}
                  className={cn(
                    "cursor-pointer hover:shadow-sm transition-shadow",
                    currentHuId === hu.id && "ring-2 ring-primary",
                  )}
                  onClick={() => {
                    setCurrentHuId(hu.id);
                    setMyVote(null);
                    setVotes([]);
                    setRevealed(false);
                    setSelectedConsensus(null);
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {hu.code}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        Pendente
                      </Badge>
                    </div>
                    <p className="text-xs font-medium line-clamp-2">{hu.title}</p>
                  </CardContent>
                </Card>
              ))}
              {categorizedStories.voted.map((hu) => (
                <Card key={hu.id} className="border-success/50 bg-success/5 opacity-75">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {hu.code}
                      </Badge>
                      <SizeBadge sizeReference={hu.sizeReference} storyPoints={hu.storyPoints} />
                      <Badge className="bg-success/15 text-success border border-success/30 text-[10px] gap-1">
                        <Check className="h-2.5 w-2.5" /> ✓ Votado
                      </Badge>
                    </div>
                    <p className="text-xs font-medium line-clamp-2">{hu.title}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Center panel */}
        <div className="col-span-6 space-y-4">
          {currentHu ? (
            <>
              <Card className="border-warning/30 bg-warning/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-warning" />
                    <span className="text-xs font-semibold text-warning uppercase">⏳ Em votação agora</span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="font-mono text-xs">
                      {currentHu.code}
                    </Badge>
                    <h3 className="text-sm font-bold">{currentHu.title}</h3>
                  </div>
                  {currentHu.description && (
                    <p className="text-xs text-muted-foreground mt-1">{currentHu.description}</p>
                  )}
                </CardContent>
              </Card>

              {votes.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        Votos ({votes.length})
                      </span>
                      {!revealed && isHost && (
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" onClick={revealVotes} className="gap-1 text-xs">
                            <Eye className="h-3 w-3" /> Revelar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={forceReveal}
                            className="gap-1 text-xs text-warning border-warning/30"
                          >
                            <FastForward className="h-3 w-3" /> Forçar
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Lista de votos */}
                    <div className="space-y-1.5">
                      {votes.map((v) => (
                        <div key={v.id} className="flex items-center gap-3 rounded-lg border p-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0">
                            <span className="text-[10px] font-bold text-primary">
                              {getInitials(profiles[v.userId] || "?")}
                            </span>
                          </div>
                          <span className="text-xs font-medium flex-1 truncate">
                            {v.userId === userId ? "Você" : profiles[v.userId] || "Participante"}
                          </span>
                          <div
                            className={cn(
                              "h-10 w-8 rounded-lg border-2 flex items-center justify-center text-sm font-bold transition-all",
                              revealed
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-muted bg-muted text-muted-foreground",
                            )}
                          >
                            {revealed ? cardDisplayValue(v.voteValue) : <EyeOff className="h-3.5 w-3.5" />}
                          </div>
                          {revealed && (
                            <span className="text-xs text-muted-foreground w-12 text-right">
                              {(() => {
                                const s = resolveSizeFromVote(v.voteValue);
                                return s ? `${s.hours}h` : "";
                              })()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Painel pós-revelação */}
                    {revealed && consensus && (
                      <div className="space-y-4">
                        {/* Alerta de divergência HIGH */}
                        {consensus.divergenceLevel === "high" && (
                          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs text-destructive font-semibold">
                                🚨 Alta divergência entre os votos
                              </p>
                              <p className="text-[11px] text-destructive/80 mt-0.5">{consensus.divergenceLabel}</p>
                            </div>
                          </div>
                        )}

                        {/* Alerta de divergência LOW */}
                        {consensus.divergenceLevel === "low" && (
                          <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs text-warning font-semibold">⚠️ Divergência moderada</p>
                              <p className="text-[11px] text-warning/80 mt-0.5">{consensus.divergenceLabel}</p>
                            </div>
                          </div>
                        )}

                        {/* Distribuição */}
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase mb-1.5">Distribuição dos votos</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(consensus.counts)
                              .sort(([, a], [, b]) => b - a)
                              .map(([val, count]) => {
                                const size = resolveSizeFromVote(val);
                                return (
                                  <Badge
                                    key={val}
                                    variant="outline"
                                    className={cn(
                                      "text-xs gap-1",
                                      val === consensus.suggestedKey && "border-primary text-primary bg-primary/5",
                                    )}
                                  >
                                    {val}
                                    {size ? ` (${size.hours}h)` : ""} × {count}
                                    {val === consensus.suggestedKey && <span className="text-[9px] ml-0.5">★</span>}
                                  </Badge>
                                );
                              })}
                          </div>
                        </div>

                        {/* Consenso */}
                        {consensus.isUnanimous ? (
                          <div className="rounded-lg bg-success/10 border border-success/30 p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ThumbsUp className="h-4 w-4 text-success" />
                              <span className="text-xs font-semibold text-success">Unanimidade!</span>
                            </div>
                            <p className="text-sm font-bold text-success">
                              {consensus.suggestedSize
                                ? `${consensus.suggestedSize.key} — ${consensus.suggestedSize.hours}h`
                                : consensus.suggestedKey}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase text-muted-foreground">
                                Consenso da equipe
                              </p>
                              {consensus.suggestedKey && consensus.suggestedSize && (
                                <span className="text-[10px] text-muted-foreground">
                                  Sugestão (mais votado):
                                  <span className="font-semibold text-primary ml-1">
                                    {consensus.suggestedKey} — {consensus.suggestedSize.hours}h ★
                                  </span>
                                </span>
                              )}
                            </div>

                            {/* Cards clicáveis — facilitador escolhe o consenso */}
                            <div className="flex flex-wrap gap-2">
                              {consensus.allKeys
                                .filter((k) => !["☕", "∞", "?"].includes(k))
                                .map((key) => {
                                  const size = resolveSizeFromVote(key);
                                  const isSuggested = key === consensus.suggestedKey;
                                  const isSelected = key === selectedConsensus;
                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      onClick={() => setSelectedConsensus(isSelected ? null : key)}
                                      className={cn(
                                        "flex flex-col items-center justify-center h-14 w-12 rounded-lg border-2 text-xs font-bold transition-all cursor-pointer relative",
                                        isSelected
                                          ? "border-success bg-success text-success-foreground shadow-md scale-105"
                                          : isSuggested
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border bg-card hover:border-primary/40",
                                      )}
                                    >
                                      <span className="text-sm">{key}</span>
                                      {size && <span className="text-[9px] font-normal opacity-80">{size.hours}h</span>}
                                      {isSuggested && !isSelected && (
                                        <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-primary text-[8px] text-primary-foreground flex items-center justify-center">
                                          ★
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                            </div>

                            {selectedConsensus && finalSize ? (
                              <div className="rounded-lg bg-success/10 border border-success/30 p-2.5 flex items-center justify-between">
                                <span className="text-xs text-success font-medium flex items-center gap-1">
                                  <Check className="h-3.5 w-3.5" /> Consenso registrado:
                                </span>
                                <span className="text-sm font-bold text-success">
                                  {finalSize.key} — {finalSize.hours}h
                                </span>
                              </div>
                            ) : (
                              <p className="text-[11px] text-muted-foreground text-center py-1">
                                👆 Selecione o tamanho acordado pela equipe para liberar o botão confirmar
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Baralho de votação */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Escolha sua carta</p>
                  <div className="flex flex-wrap gap-2">
                    {getDeckCards().map((card) => {
                      const size = deckMode === "hours" ? resolveSizeFromVote(card) : null;
                      return (
                        <button
                          key={card}
                          type="button"
                          onClick={() => castVote(card)}
                          className={cn(
                            "flex flex-col items-center justify-center h-16 w-12 rounded-lg border-2 text-sm font-bold transition-all cursor-pointer",
                            myVote === card
                              ? "border-primary bg-primary text-primary-foreground shadow-md scale-105"
                              : "border-border bg-card hover:border-primary/50 hover:shadow-sm",
                          )}
                        >
                          <span>{cardDisplayValue(card)}</span>
                          {size && (
                            <span
                              className={cn(
                                "text-[9px] font-normal mt-0.5",
                                myVote === card ? "text-primary-foreground/80" : "text-muted-foreground",
                              )}
                            >
                              {size.hours}h
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : votedSummary.items.length > 0 ? (
            <Card className="border-success/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-success" /> Resumo das Estimativas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="space-y-1.5">
                  {votedSummary.items.map((hu) => (
                    <div
                      key={hu.code}
                      className="flex items-center justify-between rounded-lg border border-success/20 bg-success/5 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                          {hu.code}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">{hu.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {hu.sizeReference && (
                          <Badge className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
                            {hu.sizeReference}
                          </Badge>
                        )}
                        <span className="text-xs font-semibold text-success w-10 text-right">{hu.hours}h</span>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex items-center justify-between rounded-lg bg-success/10 border border-success/30 px-4 py-3">
                  <div>
                    <p className="text-[10px] text-success uppercase font-semibold">Total estimado</p>
                    <p className="text-xs text-muted-foreground">
                      {votedSummary.items.length} HU{votedSummary.items.length !== 1 ? "s" : ""} estimada
                      {votedSummary.items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-success">{votedSummary.totalHours}h</p>
                    {votedSummary.totalPoints > 0 && (
                      <p className="text-[10px] text-muted-foreground">{votedSummary.totalPoints} pts</p>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  Selecione uma HU pendente para continuar
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Play className="h-14 w-14 text-muted-foreground/30" />
              <p className="text-lg text-muted-foreground font-medium">Selecione uma HU para iniciar a votação</p>
            </div>
          )}
        </div>

        {/* Right panel — Participantes */}
        <div className="col-span-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Participantes ({participants.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-1.5">
                {participantVoteStatus.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg border p-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <span className="text-[10px] font-bold text-primary">
                        {getInitials(p.displayName)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {p.userId === userId ? `${p.displayName} (você)` : p.displayName}
                      </p>
                      {p.isFacilitator && <p className="text-[10px] text-primary">Facilitador</p>}
                    </div>
                    {currentHuId && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] shrink-0",
                          p.hasVoted
                            ? "bg-success/15 text-success border-success/30"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {p.hasVoted ? "✅ votou" : "⏳ aguardando"}
                      </Badge>
                    )}
                  </div>
                ))}
                {participants.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum participante ainda</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t p-3 -mx-4 md:-mx-6 px-4 md:px-6">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3 text-success" /> {votedCount} votadas
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-warning" /> {votingCount} em andamento
            </span>
            <span className="flex items-center gap-1">○ {pendingCount} pendentes</span>
            {votedSummary.totalHours > 0 && (
              <>
                <Separator orientation="vertical" className="h-3" />
                <span className="flex items-center gap-1 text-success font-semibold">
                  <BarChart2 className="h-3 w-3" /> {votedSummary.totalHours}h estimadas
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentHuId && revealed && (
              <>
                <Button variant="outline" size="sm" onClick={revote} className="gap-1 text-xs">
                  <RotateCcw className="h-3 w-3" /> Revotar
                </Button>
                {finalKey && finalSize && (
                  <Button
                    size="sm"
                    onClick={() => confirmAndAdvance(finalKey)}
                    className="gap-1 text-xs bg-success hover:bg-success/90 text-success-foreground"
                  >
                    <Check className="h-3 w-3" /> Confirmar {finalSize.key} ({finalSize.hours}h) e avançar
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Cancelar sessão de Planning Poker?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Todas as votações serão descartadas. As HUs voltarão ao status anterior (não estimadas).
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={cancelSession} disabled={cancelling} className="gap-1">
              {cancelling && (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-destructive-foreground" />
              )}
              Sim, cancelar sessão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
