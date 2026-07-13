import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSprint } from "@/contexts/SprintContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Spade,
  MessageSquare,
  Search,
  BarChart3,
  Eye,
  Filter,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ThumbsUp,
  Calendar,
  Hash,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type SizeKey = "P" | "M" | "G" | "GG" | "XG";
type DeckMode = "fibonacci" | "hours" | "custom";

interface SprintScoreBreakdown {
  P: number;
  M: number;
  G: number;
  GG: number;
  XG: number;
  total: number;
  totalPoints: number;
  totalHours: number;
}

interface PlanningSessionHistory {
  id: string;
  sprintId: string;
  sprintName: string;
  deckMode: DeckMode;
  status: "finished" | "cancelled";
  createdAt: string;
  finishedAt: string | null;
  createdBy: string;
  participantCount: number;
  participantIds: string[];
  husVoted: number;
  totalHours: number;
  divergenceCount: number;
}

interface HuVoteSummary {
  huId: string;
  huCode: string;
  huTitle: string;
  votes: { userId: string; value: string }[];
  consensusKey: string | null;
  consensusHours: number;
  hadDivergence: boolean;
}

interface RetroSessionHistory {
  id: string;
  sprintId: string;
  sprintName: string;
  model: string;
  status: "finished" | "cancelled";
  createdAt: string;
  finishedAt: string | null;
  createdBy: string;
  cardCount: number;
  actionCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RETRO_MODEL_LABELS: Record<string, string> = {
  "4ls": "4Ls",
  start_stop_continue: "Iniciar/Parar/Continuar",
  mad_sad_glad: "Frustrado/Triste/Feliz",
  starfish: "Estrela do Mar",
  kpt: "KPT",
};

const SIZE_COLORS: Record<SizeKey, { badge: string; bar: string }> = {
  P: { badge: "bg-emerald-500/15 text-emerald-600 border-emerald-300", bar: "bg-emerald-400" },
  M: { badge: "bg-blue-500/15 text-blue-600 border-blue-300", bar: "bg-blue-400" },
  G: { badge: "bg-yellow-500/15 text-yellow-600 border-yellow-300", bar: "bg-yellow-400" },
  GG: { badge: "bg-orange-500/15 text-orange-600 border-orange-300", bar: "bg-orange-400" },
  XG: { badge: "bg-red-500/15 text-red-600 border-red-300", bar: "bg-red-400" },
};

const HOURS_MAP: Record<SizeKey, number> = { P: 4, M: 6, G: 12, GG: 16, XG: 24 };
const POINTS_MAP: Record<SizeKey, number> = { P: 2, M: 3, G: 6, GG: 13, XG: 21 };
const SIZE_KEYS: SizeKey[] = ["P", "M", "G", "GG", "XG"];
const DECK_MODE_LABELS: Record<string, string> = { fibonacci: "Fibonacci", hours: "Horas", custom: "Custom" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function classifyVoteToSize(value: string): SizeKey | null {
  const map: Record<string, SizeKey> = {
    "½": "P",
    "1": "P",
    "2": "P",
    "3": "M",
    "5": "G",
    "6": "G",
    "7": "G",
    "8": "G",
    "13": "GG",
    "21": "XG",
    "40": "XG",
    "100": "XG",
  };
  return map[value] ?? null;
}

function formatVoteEstimate(value: string): { label: string; size: SizeKey | null } {
  const normalizedValue = value.trim();

  if (!normalizedValue || normalizedValue === "—") {
    return { label: "Sem estimativa", size: null };
  }

  const directSize = SIZE_KEYS.includes(normalizedValue as SizeKey) ? (normalizedValue as SizeKey) : null;
  const size = directSize ?? classifyVoteToSize(normalizedValue);

  return size
    ? { label: `${size} ${HOURS_MAP[size]}h`, size }
    : { label: normalizedValue, size: null };
}

function getModeVote(voteValues: string[]): string {
  const freq: Record<string, number> = {};
  voteValues.forEach((v) => {
    freq[v] = (freq[v] || 0) + 1;
  });
  const maxFreq = Math.max(...Object.values(freq));
  const candidates = Object.entries(freq)
    .filter(([, f]) => f === maxFreq)
    .map(([v]) => v);
  if (candidates.length === 1) return candidates[0];
  const nums = candidates
    .map((v) => parseFloat(v === "½" ? "0.5" : v))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);
  return nums.length ? String(nums[0]) : candidates[0];
}

function calcDivergenceLevel(voteValues: string[], deckMode: string): "none" | "low" | "high" {
  const unique = [...new Set(voteValues.filter((v) => v !== "—"))];
  if (unique.length <= 1) return "none";
  const hours = unique
    .map((v) => {
      if (deckMode === "hours") return HOURS_MAP[v as SizeKey] ?? 0;
      const size = classifyVoteToSize(v);
      return size ? HOURS_MAP[size] : 0;
    })
    .filter((h) => h > 0);
  if (hours.length < 2) return "none";
  const ratio = Math.max(...hours) / Math.max(Math.min(...hours), 1);
  if (ratio >= 2.5) return "high";
  if (ratio >= 1.8) return "low";
  return "none";
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function MetricCard({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className="text-[10px] text-muted-foreground uppercase mb-1">{label}</p>
        <p className={cn("text-2xl font-bold", valueClass)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: "finished" | "cancelled" }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] gap-1",
        status === "finished"
          ? "bg-success/15 text-success border-success/30"
          : "bg-destructive/15 text-destructive border-destructive/30",
      )}
    >
      {status === "finished" ? (
        <>
          <CheckCircle2 className="h-2.5 w-2.5" /> Concluída
        </>
      ) : (
        <>
          <XCircle className="h-2.5 w-2.5" /> Cancelada
        </>
      )}
    </Badge>
  );
}

function SizeDistributionBar({ score }: { score: SprintScoreBreakdown }) {
  if (score.total === 0) return null;
  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-px">
      {SIZE_KEYS.map((size) =>
        score[size] > 0 ? (
          <div
            key={size}
            className={cn("transition-all", SIZE_COLORS[size].bar)}
            style={{ width: `${(score[size] / score.total) * 100}%` }}
            title={`${size}: ${score[size]} HUs`}
          />
        ) : null,
      )}
    </div>
  );
}

function SprintScoreCard({ sprintName, score }: { sprintName: string; score: SprintScoreBreakdown }) {
  if (!score || score.total === 0) return null;
  return (
    <Card className="mb-4 border-primary/20 bg-primary/5">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          Estimativas consolidadas — {sprintName}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="flex items-end gap-4 flex-wrap">
          {SIZE_KEYS.map((size) => (
            <div key={size} className="flex flex-col items-center gap-1 min-w-[40px]">
              <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5", SIZE_COLORS[size].badge)}>
                {size}
              </Badge>
              <span className="text-xl font-bold">{score[size]}</span>
              <span className="text-[9px] text-muted-foreground">
                {score.total > 0 ? Math.round((score[size] / score.total) * 100) : 0}%
              </span>
            </div>
          ))}
          <Separator orientation="vertical" className="h-14 mx-1" />
          <div className="flex flex-col items-center gap-1 min-w-[40px]">
            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-muted text-muted-foreground">
              HUs
            </Badge>
            <span className="text-xl font-bold">{score.total}</span>
            <span className="text-[9px] text-muted-foreground">total</span>
          </div>
        </div>

        <SizeDistributionBar score={score} />

        <div className="flex items-center gap-4 pt-1 border-t flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Pontos:</span>
            <span className="text-sm font-bold text-primary">{score.totalPoints} pts</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-blue-500" />
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Horas:</span>
            <span className="text-sm font-bold text-blue-500">{score.totalHours}h</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Dias úteis (~8h):</span>
            <span className="text-sm font-bold text-muted-foreground">~{(score.totalHours / 8).toFixed(1)}d</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanningSessionCard({
  session,
  profiles,
  onView,
}: {
  session: PlanningSessionHistory;
  profiles: Record<string, string>;
  onView: () => void;
}) {
  return (
    <div className="grid gap-3 px-4 py-3 transition-colors hover:bg-muted/25 lg:grid-cols-[minmax(15rem,1fr)_8rem_6rem_6rem_7rem_8rem_4rem] lg:items-center lg:gap-4">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">{session.sprintName}</span>
          <StatusBadge status={session.status} />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-mono">#{session.id.slice(0, 8)}</span>
          <span aria-hidden="true">·</span>
          <Calendar className="h-3 w-3" />
          {formatDate(session.createdAt)}
          <span aria-hidden="true">·</span>
          {profiles[session.createdBy] ?? "Responsável não identificado"}
        </p>
      </div>
      <span className="text-xs text-muted-foreground">{DECK_MODE_LABELS[session.deckMode] ?? session.deckMode}</span>
      <span className="text-sm font-semibold tabular-nums">{session.participantCount}</span>
      <span className="text-sm font-semibold tabular-nums">{session.husVoted}</span>
      <span className="text-sm font-semibold tabular-nums text-success">{session.totalHours}h</span>
      {session.divergenceCount > 0 ? (
        <Badge variant="outline" className="w-fit gap-1 border-warning/30 bg-warning/10 text-warning">
          <AlertTriangle className="h-3 w-3" /> {session.divergenceCount}
        </Badge>
      ) : (
        <Badge variant="outline" className="w-fit gap-1 border-success/30 bg-success/10 text-success">
          <ThumbsUp className="h-3 w-3" /> Consenso
        </Badge>
      )}
      <Button variant="ghost" size="sm" className="h-8 w-fit gap-1 px-2 text-xs" onClick={onView}>
        <Eye className="h-3.5 w-3.5" /> Ver
      </Button>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function AgileHistory() {
  const { currentTeamId } = useAuth(); // history view
  const { sprints } = useSprint();

  const [tab, setTab] = useState("planning");
  const [planningSessions, setPlanningSessions] = useState<PlanningSessionHistory[]>([]);
  const [retroSessions, setRetroSessions] = useState<RetroSessionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sprintFilter, setSprintFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [planningStatusFilter, setPlanningStatusFilter] = useState("all");
  const [planningPeriodFilter, setPlanningPeriodFilter] = useState("all");
  const [planningResponsibleFilter, setPlanningResponsibleFilter] = useState("all");
  const [planningPage, setPlanningPage] = useState(1);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [sprintScores, setSprintScores] = useState<Record<string, SprintScoreBreakdown>>({});

  const [detailSession, setDetailSession] = useState<PlanningSessionHistory | RetroSessionHistory | null>(null);
  const [detailType, setDetailType] = useState<"planning" | "retro">("planning");
  const [detailHuSummaries, setDetailHuSummaries] = useState<HuVoteSummary[]>([]);
  const [detailCards, setDetailCards] = useState<any[]>([]);
  const [detailActions, setDetailActions] = useState<any[]>([]);
  const [detailHuSearch, setDetailHuSearch] = useState("");
  const [detailHuStatus, setDetailHuStatus] = useState<"all" | "consensus" | "divergence">("all");
  const [detailHuPage, setDetailHuPage] = useState(1);

  // ─── Loaders ──────────────────────────────────────────────────────────────

  const loadProfiles = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("profiles")
      .select("user_id, display_name")
      .eq("is_active", true);
    if (error) throw error;
    if (data) {
      const map: Record<string, string> = {};
      (data as Array<{ user_id: string; display_name: string }>).forEach((p) => {
        map[p.user_id] = p.display_name;
      });
      setProfiles(map);
    }
  }, []);

  const loadPlanningSessions = useCallback(async () => {
    if (!currentTeamId) return;
    const { data, error } = await (supabase as any)
      .from("planning_sessions")
      .select("*")
      .eq("team_id", currentTeamId)
      .eq("status", "finished") // ✅ só finished — canceladas não são exibidas
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!data) return;

    const sessions: PlanningSessionHistory[] = [];
    const scores: Record<string, SprintScoreBreakdown> = {};

    for (const s of data as any[]) {
      const sprint = sprints.find((sp) => sp.id === s.sprint_id);
      const { data: votes } = await (supabase as any)
        .from("planning_votes")
        .select("hu_id, user_id, vote_value")
        .eq("session_id", s.id);

      const votesArr = (votes ?? []) as Array<{ hu_id: string; user_id: string; vote_value: string }>;
      const uniqueHus = new Set(votesArr.map((v) => v.hu_id));
      const participantIds = [...new Set(votesArr.map((v) => v.user_id))];
      let sessionTotalHours = 0;
      let divergenceCount = 0;

      if (votesArr.length) {
        const sprintId = s.sprint_id;
        if (!scores[sprintId]) {
          scores[sprintId] = { P: 0, M: 0, G: 0, GG: 0, XG: 0, total: 0, totalPoints: 0, totalHours: 0 };
        }

        const byHu: Record<string, string[]> = {};
        votesArr.forEach((v) => {
          if (!byHu[v.hu_id]) byHu[v.hu_id] = [];
          byHu[v.hu_id].push(v.vote_value);
        });

        Object.values(byHu).forEach((huVotes) => {
          const validVotes = huVotes.filter((v) => v !== "—");
          if (!validVotes.length) return;
          if (calcDivergenceLevel(validVotes, s.deck_mode) !== "none") divergenceCount++;
          const modeVote = getModeVote(validVotes);
          const size: SizeKey | null =
            s.deck_mode === "hours"
              ? HOURS_MAP[modeVote as SizeKey]
                ? (modeVote as SizeKey)
                : null
              : classifyVoteToSize(modeVote);
          if (size) {
            scores[sprintId][size]++;
            scores[sprintId].total++;
            scores[sprintId].totalPoints += POINTS_MAP[size];
            scores[sprintId].totalHours += HOURS_MAP[size];
            sessionTotalHours += HOURS_MAP[size];
          }
        });
      }

      sessions.push({
        id: s.id,
        sprintId: s.sprint_id,
        sprintName: sprint?.name ?? "Sprint desconhecida",
        deckMode: s.deck_mode as DeckMode,
        status: "finished",
        createdAt: s.created_at,
        finishedAt: s.finished_at,
        createdBy: s.created_by,
        participantCount: participantIds.length,
        participantIds,
        husVoted: uniqueHus.size,
        totalHours: sessionTotalHours,
        divergenceCount,
      });
    }

    setPlanningSessions(sessions);
    setSprintScores(scores);
  }, [currentTeamId, sprints]);

  const loadRetroSessions = useCallback(async () => {
    if (!currentTeamId) return;
    const { data, error } = await (supabase as any)
      .from("retro_sessions")
      .select("*")
      .eq("team_id", currentTeamId)
      .in("status", ["finished", "cancelled"])
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!data) return;

    const sessions: RetroSessionHistory[] = [];
    for (const s of data as any[]) {
      const sprint = sprints.find((sp) => sp.id === s.sprint_id);
      const [{ count: cardCount }, { count: actionCount }] = await Promise.all([
        (supabase as any).from("retro_cards").select("*", { count: "exact", head: true }).eq("session_id", s.id),
        (supabase as any).from("retro_actions").select("*", { count: "exact", head: true }).eq("session_id", s.id),
      ]);
      sessions.push({
        id: s.id,
        sprintId: s.sprint_id,
        sprintName: sprint?.name ?? "Sprint desconhecida",
        model: s.model,
        status: s.status as "finished" | "cancelled",
        createdAt: s.created_at,
        finishedAt: s.finished_at,
        createdBy: s.created_by,
        cardCount: cardCount || 0,
        actionCount: actionCount || 0,
      });
    }
    setRetroSessions(sessions);
  }, [currentTeamId, sprints]);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([loadProfiles(), loadPlanningSessions(), loadRetroSessions()])
      .catch((error) => {
        console.error("[AgileHistory] falha ao carregar histórico", error);
        setLoadError(
          "Não foi possível carregar o histórico. Verifique sua permissão para o time e tente novamente.",
        );
      })
      .finally(() => setLoading(false));
  }, [loadProfiles, loadPlanningSessions, loadRetroSessions]);

  // ─── Filtros ──────────────────────────────────────────────────────────────

  const filteredPlanning = useMemo(() => {
    let list = planningSessions;
    if (sprintFilter !== "all") list = list.filter((s) => s.sprintId === sprintFilter);
    if (planningStatusFilter !== "all") list = list.filter((s) => s.status === planningStatusFilter);
    if (planningResponsibleFilter !== "all") list = list.filter((s) => s.createdBy === planningResponsibleFilter);
    if (planningPeriodFilter !== "all") {
      const days = Number(planningPeriodFilter);
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      list = list.filter((s) => new Date(s.createdAt).getTime() >= cutoff);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLocaleLowerCase("pt-BR");
      list = list.filter((s) =>
        s.sprintName.toLocaleLowerCase("pt-BR").includes(q) ||
        s.id.toLocaleLowerCase("pt-BR").includes(q) ||
        (profiles[s.createdBy] ?? "").toLocaleLowerCase("pt-BR").includes(q),
      );
    }
    return list;
  }, [planningSessions, sprintFilter, planningStatusFilter, planningResponsibleFilter, planningPeriodFilter, searchTerm, profiles]);

  const filteredRetro = useMemo(() => {
    let list = retroSessions;
    if (sprintFilter !== "all") list = list.filter((s) => s.sprintId === sprintFilter);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (s) => s.sprintName.toLowerCase().includes(q) || (RETRO_MODEL_LABELS[s.model] || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [retroSessions, sprintFilter, searchTerm]);

  // ─── Métricas ─────────────────────────────────────────────────────────────

  const planningMetrics = useMemo(() => {
    // Métricas sempre baseadas nas sessões filtradas
    const base = filteredPlanning;
    const totalHus = base.reduce((sum, s) => sum + s.husVoted, 0);
    const totalParticipants = base.reduce((sum, s) => sum + s.participantCount, 0);
    const totalHours = base.reduce((sum, s) => sum + s.totalHours, 0);
    const totalDivergences = base.reduce((sum, s) => sum + s.divergenceCount, 0);
    return {
      sessions: base.length,
      totalHus,
      totalParticipants,
      totalHours,
      totalDivergences,
    };
  }, [filteredPlanning]);

  const retroMetrics = useMemo(() => {
    const finished = filteredRetro.filter((s) => s.status === "finished");
    const totalCards = finished.reduce((sum, s) => sum + s.cardCount, 0);
    const totalActions = finished.reduce((sum, s) => sum + s.actionCount, 0);
    return {
      sessions: finished.length,
      avgCards: finished.length > 0 ? (totalCards / finished.length).toFixed(1) : "0",
      avgActions: finished.length > 0 ? (totalActions / finished.length).toFixed(1) : "0",
      cancelled: filteredRetro.filter((s) => s.status === "cancelled").length,
    };
  }, [filteredRetro]);

  const planningPageSize = 10;
  const planningTotalPages = Math.max(1, Math.ceil(filteredPlanning.length / planningPageSize));
  const currentPlanningPage = Math.min(planningPage, planningTotalPages);
  const visiblePlanningSessions = filteredPlanning.slice(
    (currentPlanningPage - 1) * planningPageSize,
    currentPlanningPage * planningPageSize,
  );

  const responsibleOptions = useMemo(
    () => [...new Set(planningSessions.map((session) => session.createdBy))]
      .sort((a, b) => (profiles[a] ?? a).localeCompare(profiles[b] ?? b, "pt-BR")),
    [planningSessions, profiles],
  );

  const participationRanking = useMemo(() => {
    const counts = new Map<string, number>();
    filteredPlanning.forEach((session) => {
      session.participantIds.forEach((userId) => counts.set(userId, (counts.get(userId) ?? 0) + 1));
    });
    return [...counts.entries()]
      .map(([userId, count]) => ({ userId, count, name: profiles[userId] ?? "Participante não identificado" }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
  }, [filteredPlanning, profiles]);

  const hasPlanningFilters = Boolean(
    searchTerm || sprintFilter !== "all" || planningStatusFilter !== "all" ||
    planningPeriodFilter !== "all" || planningResponsibleFilter !== "all",
  );

  useEffect(() => {
    setPlanningPage(1);
  }, [searchTerm, sprintFilter, planningStatusFilter, planningPeriodFilter, planningResponsibleFilter]);

  // ─── Score da sprint selecionada ──────────────────────────────────────────

  // Quando "all": soma os scores de todas as sprints presentes nos filteredPlanning
  const activeScore = useMemo((): SprintScoreBreakdown | null => {
    if (sprintFilter !== "all") {
      return sprintScores[sprintFilter] ?? null;
    }
    // "all" → não exibe o card (retorna null)
    return null;
  }, [sprintFilter, sprintScores]);

  const activeSprintName = useMemo(() => {
    if (sprintFilter === "all") return "";
    return sprints.find((s) => s.id === sprintFilter)?.name ?? "Sprint";
  }, [sprintFilter, sprints]);

  // ─── Detalhes ─────────────────────────────────────────────────────────────

  const openPlanningDetail = async (session: PlanningSessionHistory) => {
    setDetailType("planning");
    setDetailSession(session);

    const { data: votes } = await supabase
      .from("planning_votes")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at");

    if (!votes?.length) {
      setDetailHuSummaries([]);
      return;
    }

    const huIds = [...new Set(votes.map((v) => v.hu_id))];
    const { data: huData } = await supabase.from("user_stories").select("id, code, title").in("id", huIds);
    const huMap: Record<string, { code: string; title: string }> = {};
    huData?.forEach((hu) => {
      huMap[hu.id] = { code: hu.code, title: hu.title };
    });

    const byHu: Record<string, any[]> = {};
    votes.forEach((v) => {
      if (!byHu[v.hu_id]) byHu[v.hu_id] = [];
      byHu[v.hu_id].push(v);
    });

    const summaries: HuVoteSummary[] = Object.entries(byHu).map(([huId, huVotes]) => {
      const validVotes = huVotes.filter((v) => v.vote_value !== "—");
      const modeVote = getModeVote(validVotes.map((v) => v.vote_value));
      const consensusKey: string | null =
        session.deckMode === "hours"
          ? HOURS_MAP[modeVote as SizeKey]
            ? modeVote
            : null
          : (classifyVoteToSize(modeVote) as string | null);
      const consensusHours = consensusKey ? (HOURS_MAP[consensusKey as SizeKey] ?? 0) : 0;
      const divergence = calcDivergenceLevel(
        validVotes.map((v) => v.vote_value),
        session.deckMode,
      );
      return {
        huId,
        huCode: huMap[huId]?.code ?? huId.slice(0, 8) + "...",
        huTitle: huMap[huId]?.title ?? "—",
        votes: huVotes.map((v) => ({ userId: v.user_id, value: v.vote_value })),
        consensusKey,
        consensusHours,
        hadDivergence: divergence !== "none",
      };
    });

    setDetailHuSummaries(summaries);
  };

  const openRetroDetail = async (session: RetroSessionHistory) => {
    setDetailType("retro");
    setDetailSession(session);
    const [{ data: cards }, { data: actions }] = await Promise.all([
      supabase.from("retro_cards").select("*").eq("session_id", session.id).order("votes", { ascending: false }),
      supabase.from("retro_actions").select("*").eq("session_id", session.id).order("created_at"),
    ]);
    setDetailCards(cards || []);
    setDetailActions(actions || []);
  };

  const closeDetail = () => {
    setDetailSession(null);
    setDetailHuSummaries([]);
    setDetailCards([]);
    setDetailActions([]);
    setDetailHuSearch("");
    setDetailHuStatus("all");
    setDetailHuPage(1);
  };

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <BarChart3 className="h-5 w-5 text-primary" /> Relatórios operacionais
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Sessões, estimativas, participação e resultados da operação ágil.</p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="planning" className="gap-1.5 text-xs">
            <Spade className="h-3.5 w-3.5" /> Planning Poker
          </TabsTrigger>
          <TabsTrigger value="retro" className="gap-1.5 text-xs">
            <MessageSquare className="h-3.5 w-3.5" /> Retrospectiva
          </TabsTrigger>
        </TabsList>

        {/* ── Tab Planning ───────────────────────────────────────────── */}
        <TabsContent value="planning" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <MetricCard label="Sessões" value={planningMetrics.sessions} />
            <MetricCard label="HUs estimadas" value={planningMetrics.totalHus} />
            <MetricCard label="Total de horas" value={`${planningMetrics.totalHours}h`} valueClass="text-success" />
            <MetricCard
              label="Divergências"
              value={planningMetrics.totalDivergences}
              valueClass={planningMetrics.totalDivergences > 0 ? "text-warning" : "text-success"}
            />
          </div>

          <Card className="shadow-none">
            <CardContent className="space-y-3 p-3 sm:p-4">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_11rem_10rem_10rem_12rem_auto]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar por nome, ID ou responsável"
                    aria-label="Buscar sessões de Planning"
                    className="h-9 pl-9 text-xs"
                  />
                </div>
                <Select value={sprintFilter} onValueChange={setSprintFilter}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Sessão" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as sessões</SelectItem>
                    {sprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={planningStatusFilter} onValueChange={setPlanningStatusFilter}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="finished">Concluídas</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={planningPeriodFilter} onValueChange={setPlanningPeriodFilter}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Período" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo o período</SelectItem>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={planningResponsibleFilter} onValueChange={setPlanningResponsibleFilter}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os responsáveis</SelectItem>
                    {responsibleOptions.map((userId) => (
                      <SelectItem key={userId} value={userId}>{profiles[userId] ?? "Não identificado"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!hasPlanningFilters}
                  onClick={() => {
                    setSearchTerm("");
                    setSprintFilter("all");
                    setPlanningStatusFilter("all");
                    setPlanningPeriodFilter("all");
                    setPlanningResponsibleFilter("all");
                  }}
                  className="h-9 px-3 text-xs"
                >
                  Limpar
                </Button>
              </div>

              {hasPlanningFilters && (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
                  <span className="mr-1 text-[11px] font-medium text-muted-foreground">Filtros aplicados:</span>
                  {searchTerm && <Badge variant="secondary">Busca: {searchTerm}</Badge>}
                  {sprintFilter !== "all" && <Badge variant="secondary">Sessão: {sprints.find((s) => s.id === sprintFilter)?.name}</Badge>}
                  {planningStatusFilter !== "all" && <Badge variant="secondary">Status: Concluída</Badge>}
                  {planningPeriodFilter !== "all" && <Badge variant="secondary">Período: {planningPeriodFilter} dias</Badge>}
                  {planningResponsibleFilter !== "all" && (
                    <Badge variant="secondary">Responsável: {profiles[planningResponsibleFilter] ?? "Não identificado"}</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ✅ Card de estimativas: só aparece quando uma sprint específica está selecionada */}
          {sprintFilter !== "all" && activeScore && (
            <SprintScoreCard sprintName={activeSprintName} score={activeScore} />
          )}

          <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
            <div className="hidden grid-cols-[minmax(15rem,1fr)_8rem_6rem_6rem_7rem_8rem_4rem] gap-4 border-b border-border/70 bg-muted/35 px-4 py-2.5 text-[10px] font-semibold text-muted-foreground lg:grid">
              <span>Sessão</span><span>Formato</span><span>Participantes</span><span>HUs</span><span>Horas</span><span>Resultado</span><span>Ação</span>
            </div>
            <div className="divide-y divide-border/70">
              {visiblePlanningSessions.length > 0 ? visiblePlanningSessions.map((session) => (
                <PlanningSessionCard key={session.id} session={session} profiles={profiles} onView={() => openPlanningDetail(session)} />
              )) : (
                <div className="px-4 py-12 text-center">
                  <p className="text-sm font-medium">Nenhuma sessão encontrada</p>
                  <p className="mt-1 text-xs text-muted-foreground">Ajuste ou limpe os filtros para visualizar outros registros.</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-border/70 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {visiblePlanningSessions.length} visíveis de {filteredPlanning.length} resultados · Página {currentPlanningPage} de {planningTotalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPlanningPage === 1} onClick={() => setPlanningPage(currentPlanningPage - 1)} className="h-8 gap-1 text-xs">
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={currentPlanningPage === planningTotalPages} onClick={() => setPlanningPage(currentPlanningPage + 1)} className="h-8 gap-1 text-xs">
                  Próxima <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <Card className="shadow-none">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-muted-foreground" /> Participação</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {participationRanking.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {participationRanking.map((participant) => (
                    <Badge key={participant.userId} variant="outline" className="gap-1.5 py-1 text-xs font-normal">
                      <span className="font-medium">{participant.name}</span>
                      <span className="text-muted-foreground">{participant.count} {participant.count === 1 ? "sessão" : "sessões"}</span>
                    </Badge>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground">Nenhuma participação encontrada para os filtros aplicados.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab Retro ──────────────────────────────────────────────── */}
        <TabsContent value="retro" className="space-y-4 mt-4">
          <Card className="shadow-none">
            <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:p-4">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar retrospectiva" className="h-9 pl-9 text-xs" />
              </div>
              <Select value={sprintFilter} onValueChange={setSprintFilter}>
                <SelectTrigger className="h-9 text-xs sm:w-52"><SelectValue placeholder="Sprint" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as sprints</SelectItem>
                  {sprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <div className="grid grid-cols-4 gap-3">
            <MetricCard label="Sessões Concluídas" value={retroMetrics.sessions} />
            <MetricCard label="Média Cards" value={retroMetrics.avgCards} />
            <MetricCard label="Média Ações" value={retroMetrics.avgActions} />
            <MetricCard label="Canceladas" value={retroMetrics.cancelled} valueClass="text-destructive" />
          </div>

          <div className="space-y-2">
            {filteredRetro.map((s) => (
              <Card
                key={s.id}
                className={cn("transition-colors", s.status === "cancelled" && "opacity-60 border-dashed")}
              >
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(s.createdAt)}</span>
                      </div>
                      <Separator orientation="vertical" className="h-4" />
                      <span className="text-sm font-semibold">{s.sprintName}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {RETRO_MODEL_LABELS[s.model] ?? s.model}
                      </Badge>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {s.cardCount} cards
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {s.actionCount} ações
                      </span>
                      <span>{profiles[s.createdBy] ?? "—"}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => openRetroDetail(s)}
                      >
                        <Eye className="h-3 w-3" /> Ver
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredRetro.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-12">Nenhuma sessão encontrada</div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Dialog de Detalhes ─────────────────────────────────────── */}
      <Dialog
        open={!!detailSession}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border/60 pb-3">
            <DialogTitle className="flex items-center gap-2 px-6 pt-5 text-lg">
              {detailType === "planning" ? (
                <>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Spade className="h-3.5 w-3.5" />
                  </span>
                  Detalhes da Sessão de Planning
                </>
              ) : (
                <>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </span>
                  Detalhes da Retrospectiva
                </>
              )}
            </DialogTitle>
            {detailSession && detailType === "planning" && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-1">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {(detailSession as PlanningSessionHistory).sprintName}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate((detailSession as PlanningSessionHistory).createdAt)}
                    <span aria-hidden="true">·</span>
                    {DECK_MODE_LABELS[(detailSession as PlanningSessionHistory).deckMode] ?? (detailSession as PlanningSessionHistory).deckMode}
                    <span aria-hidden="true">·</span>
                    {profiles[(detailSession as PlanningSessionHistory).createdBy] ?? "—"}
                  </p>
                </div>
                <StatusBadge status={(detailSession as PlanningSessionHistory).status} />
              </div>
            )}
          </DialogHeader>

          <ScrollArea className="min-h-0 flex-1">
            {/* ── Detalhe Planning ─────────────────────────────────── */}
            {detailSession &&
              detailType === "planning" &&
              (() => {
                const s = detailSession as PlanningSessionHistory;
                const totalDetailHours = detailHuSummaries.reduce((sum, hu) => sum + hu.consensusHours, 0);
                const divergedCount = detailHuSummaries.filter((hu) => hu.hadDivergence).length;
                const normalizedSearch = detailHuSearch.trim().toLocaleLowerCase("pt-BR");
                const filteredHus = detailHuSummaries.filter((hu) => {
                  const matchesSearch = !normalizedSearch ||
                    hu.huCode.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
                    hu.huTitle.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
                  const matchesStatus = detailHuStatus === "all" ||
                    (detailHuStatus === "divergence" ? hu.hadDivergence : !hu.hadDivergence);
                  return matchesSearch && matchesStatus;
                });
                const pageSize = 5;
                const totalPages = Math.max(1, Math.ceil(filteredHus.length / pageSize));
                const currentPage = Math.min(detailHuPage, totalPages);
                const visibleHus = filteredHus.slice((currentPage - 1) * pageSize, currentPage * pageSize);
                return (
                  <div className="space-y-5 p-4 sm:p-6">
                    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                      <Card className="shadow-none">
                        <CardContent className="px-4 py-3 text-center">
                          <p className="text-[10px] font-medium text-muted-foreground">HUs Estimadas</p>
                          <p className="mt-1 text-xl font-semibold tabular-nums">{s.husVoted}</p>
                        </CardContent>
                      </Card>
                      <Card className="shadow-none">
                        <CardContent className="px-4 py-3 text-center">
                          <p className="text-[10px] font-medium text-muted-foreground">Participantes</p>
                          <p className="mt-1 text-xl font-semibold tabular-nums">{s.participantCount}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-success/20 bg-success/[0.03] shadow-none">
                        <CardContent className="px-4 py-3 text-center">
                          <p className="text-[10px] font-medium text-muted-foreground">Total de Horas</p>
                          <p className="mt-1 text-xl font-semibold tabular-nums text-success">{totalDetailHours}h</p>
                        </CardContent>
                      </Card>
                      <Card className={cn("shadow-none", divergedCount > 0 && "border-warning/20 bg-warning/[0.03]")}>
                        <CardContent className="px-4 py-3 text-center">
                          <p className="text-[10px] font-medium text-muted-foreground">Com Divergência</p>
                          <p className={cn("mt-1 text-xl font-semibold tabular-nums", divergedCount > 0 ? "text-warning" : "text-success")}>
                            {divergedCount}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <section className="space-y-3" aria-labelledby="planning-hus-title">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h3 id="planning-hus-title" className="flex items-center gap-2 text-sm font-semibold">
                            <Hash className="h-4 w-4 text-muted-foreground" /> HUs estimadas
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {filteredHus.length} de {detailHuSummaries.length} registros
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <div className="relative sm:w-64">
                            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={detailHuSearch}
                              onChange={(event) => {
                                setDetailHuSearch(event.target.value);
                                setDetailHuPage(1);
                              }}
                              placeholder="Buscar por código ou título"
                              aria-label="Buscar HUs da sessão"
                              className="h-9 pl-9 text-xs"
                            />
                          </div>
                          <Select
                            value={detailHuStatus}
                            onValueChange={(value) => {
                              setDetailHuStatus(value as "all" | "consensus" | "divergence");
                              setDetailHuPage(1);
                            }}
                          >
                            <SelectTrigger className="h-9 w-full text-xs sm:w-40" aria-label="Filtrar HUs por resultado">
                              <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos os resultados</SelectItem>
                              <SelectItem value="consensus">Com consenso</SelectItem>
                              <SelectItem value="divergence">Com divergência</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
                        <div className="hidden grid-cols-[minmax(0,1fr)_7rem_6rem_12rem] gap-4 border-b border-border/70 bg-muted/35 px-4 py-2.5 text-[10px] font-semibold text-muted-foreground md:grid">
                          <span>História de usuário</span>
                          <span>Resultado</span>
                          <span>Estimativa</span>
                          <span>Votos</span>
                        </div>

                        <div className="max-h-[28vh] min-h-0 divide-y divide-border/70 overflow-y-scroll overscroll-contain [scrollbar-gutter:stable]">
                          {visibleHus.map((hu) => (
                            <div
                              key={hu.huId}
                              className="grid gap-3 px-4 py-3 transition-colors hover:bg-muted/25 md:grid-cols-[minmax(0,1fr)_7rem_6rem_12rem] md:items-center md:gap-4"
                            >
                              <div className="min-w-0">
                                <Badge variant="outline" className="mb-1.5 font-mono text-[10px]">
                                  {hu.huCode}
                                </Badge>
                                <p className="whitespace-normal break-words text-sm font-medium leading-snug text-foreground">
                                  {hu.huTitle}
                                </p>
                              </div>

                              <div>
                                {hu.hadDivergence ? (
                                  <Badge variant="outline" className="gap-1 border-warning/30 bg-warning/10 text-warning">
                                    <AlertTriangle className="h-3 w-3" /> Divergência
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="gap-1 border-success/30 bg-success/10 text-success">
                                    <ThumbsUp className="h-3 w-3" /> Consenso
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-2 md:block">
                                {hu.consensusKey ? (
                                  <>
                                    <Badge className={cn("min-w-9 justify-center", SIZE_COLORS[hu.consensusKey as SizeKey]?.badge ?? "bg-muted")}>
                                      {hu.consensusKey}
                                    </Badge>
                                    <p className="mt-1 text-xs text-muted-foreground">{hu.consensusHours}h</p>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </div>

                              <div className="flex min-w-0 flex-wrap gap-1">
                                {hu.votes.map((vote, index) => {
                                  const estimate = formatVoteEstimate(vote.value);
                                  const participantName = profiles[vote.userId];

                                  return (
                                    <span
                                      key={index}
                                      title={participantName ? `Voto de ${participantName}` : "Participante não identificado"}
                                      className={cn(
                                        "inline-flex max-w-full items-center rounded-md border px-2 py-1 text-[10px] font-semibold",
                                        estimate.size
                                          ? SIZE_COLORS[estimate.size].badge
                                          : "border-border bg-muted/70 text-muted-foreground",
                                      )}
                                    >
                                      {estimate.label}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          ))}

                          {visibleHus.length === 0 && (
                            <div className="px-4 py-10 text-center">
                              <p className="text-sm font-medium">Nenhuma HU encontrada</p>
                              <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros para visualizar outros resultados.</p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-3 border-t border-border/70 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-muted-foreground">
                            Página {currentPage} de {totalPages}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={currentPage === 1}
                              onClick={() => setDetailHuPage(Math.max(1, currentPage - 1))}
                              className="h-8 gap-1.5 px-2.5 text-xs"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={currentPage === totalPages}
                              onClick={() => setDetailHuPage(Math.min(totalPages, currentPage + 1))}
                              className="h-8 gap-1.5 px-2.5 text-xs"
                            >
                              Próxima <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                );
              })()}

            {/* ── Detalhe Retro ─────────────────────────────────────── */}
            {detailSession &&
              detailType === "retro" &&
              (() => {
                const s = detailSession as RetroSessionHistory;
                return (
                  <div className="space-y-5 p-4 sm:p-6">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-base font-bold">{s.sprintName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {formatDate(s.createdAt)}
                          <span className="mx-1">·</span>
                          {RETRO_MODEL_LABELS[s.model] ?? s.model}
                          <span className="mx-1">·</span>
                          {profiles[s.createdBy] ?? "—"}
                        </p>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold mb-2">🏆 Top 3 Cards</h3>
                      <div className="space-y-2">
                        {detailCards.slice(0, 3).map((card: any, i: number) => (
                          <Card key={card.id} className={cn(i === 0 && "border-warning/50 bg-warning/5")}>
                            <CardContent className="p-3 flex items-center gap-3">
                              <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                              <div className="flex-1">
                                <p className="text-xs">{card.text}</p>
                                <p className="text-[10px] text-muted-foreground">{card.column_key}</p>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {card.votes} votos
                              </Badge>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-sm font-bold mb-2">Todos os Cards ({detailCards.length})</h3>
                      <div className="space-y-1.5">
                        {detailCards.map((card: any) => (
                          <div key={card.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {card.column_key}
                            </Badge>
                            <p className="text-xs flex-1">{card.text}</p>
                            {card.votes > 0 && (
                              <Badge variant="secondary" className="text-[10px]">
                                {card.votes}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {detailActions.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h3 className="text-sm font-bold mb-2">Ações ({detailActions.length})</h3>
                          <div className="space-y-1.5">
                            {detailActions.map((action: any, i: number) => (
                              <div key={action.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                                <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                                <p className="text-xs flex-1">{action.description}</p>
                                <Badge variant="outline" className="text-[10px]">
                                  {action.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
