import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Target,
  Gauge,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Clock,
  BarChart3,
  User,
  Bug,
  Rocket,
  FileBarChart2,
} from "lucide-react";
import { DashboardFilters, DashboardFilterState, INITIAL_FILTERS } from "@/components/dashboard/DashboardFilters";
import { IndividualPerformance } from "@/components/dashboard/IndividualPerformance";
import { TeamPerformance } from "@/components/dashboard/TeamPerformance";
import { QualityPanel } from "@/components/dashboard/QualityPanel";
import { ReleasesPanel } from "@/components/dashboard/ReleasesPanel";
import { SalaAgilRelatorios } from "@/components/sala-agil/reports/SalaAgilRelatorios";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  aguardando_desenvolvimento: "#94a3b8",
  em_desenvolvimento: "#3b82f6",
  em_code_review: "#8b5cf6",
  em_teste: "#f59e0b",
  bug: "#ef4444",
  pronto_para_publicacao: "#22c55e",
};

// Tabelas que disparam reload ao receber evento Realtime
const REALTIME_TABLES = ["user_stories", "activities", "sprints", "impediments", "developers"];

// ─── Persistência de filtros ──────────────────────────────────────────────────

function usePersistedState<T>(key: string, defaultValue: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setPersisted = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof value === "function" ? (value as (p: T) => T)(prev) : value;
        try {
          sessionStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [key],
  );

  return [state, setPersisted] as const;
}

// ─── MetricsDashboard ─────────────────────────────────────────────────────────

export function MetricsDashboard() {
  const { isAdmin, teams, currentTeamId, user } = useAuth();

  const agileTeams = useMemo(() => teams.filter((t: any) => t.module === "sala_agil"), [teams]);

  const [filters, setFilters] = usePersistedState<DashboardFilterState>("metricas:filters", {
    ...INITIAL_FILTERS,
    teamId: currentTeamId || "all",
  });

  const [activeTab, setActiveTab] = usePersistedState<string>("metricas:tab", "individual");

  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState<{
    sprints: any[];
    hus: any[];
    activities: any[];
    impediments: any[];
    developers: any[];
    workflowCols: any[];
  }>({ sprints: [], hus: [], activities: [], impediments: [], developers: [], workflowCols: [] });

  const lastTeamIdRef = useRef<string>("");
  // Ref para evitar múltiplos reloads simultâneos vindos do Realtime
  const reloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (currentTeamId && filters.teamId === "all") {
      setFilters((f) => ({ ...f, teamId: currentTeamId }));
    }
  }, [currentTeamId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (filters.teamId === "all") return;
    const existsInAgile = agileTeams.some((t: any) => t.id === filters.teamId);
    if (!existsInAgile) {
      setFilters((prev) => ({ ...prev, teamId: "all" }));
    }
  }, [filters.teamId, agileTeams, setFilters]);

  const loadData = useCallback(
    async (forceTeamId?: string) => {
      const teamId = forceTeamId ?? filters.teamId;
      lastTeamIdRef.current = teamId;

      setLoading(true);

      const teamsToLoad =
        isAdmin && teamId === "all"
          ? agileTeams
          : agileTeams.filter((t: any) => t.id === (teamId === "all" ? currentTeamId : teamId));

      const allSprints: any[] = [];
      const allHUs: any[] = [];
      const allActs: any[] = [];
      const allImps: any[] = [];
      const allDevs: any[] = [];
      const allWfCols: any[] = [];

      for (const team of teamsToLoad) {
        const [sprintRes, huRes, actRes, impRes, devRes, wcRes] = await Promise.all([
          supabase.from("sprints").select("*").eq("team_id", team.id),
          supabase.from("user_stories").select("*").eq("team_id", team.id),
          supabase.from("activities").select("*").eq("team_id", team.id),
          supabase.from("impediments").select("*").eq("team_id", team.id),
          supabase.from("developers").select("*").eq("team_id", team.id),
          supabase.from("workflow_columns").select("*").eq("team_id", team.id).order("sort_order"),
        ]);
        allSprints.push(...(sprintRes.data || []));
        allHUs.push(...(huRes.data || []));
        allActs.push(...(actRes.data || []));
        allImps.push(...(impRes.data || []));
        allDevs.push(...(devRes.data || []));
        allWfCols.push(...(wcRes.data || []));
      }

      setRawData({
        sprints: allSprints,
        hus: allHUs,
        activities: allActs,
        impediments: allImps,
        developers: allDevs,
        workflowCols: allWfCols,
      });
      setLoading(false);
    },
    [filters.teamId, agileTeams, isAdmin, currentTeamId],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // Carga inicial ao montar / trocar time
  useEffect(() => {
    if (agileTeams.length > 0) loadData();
  }, [filters.teamId, agileTeams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Supabase Realtime: escuta INSERT / UPDATE / DELETE nas tabelas relevantes
  useEffect(() => {
    if (agileTeams.length === 0) return;

    const scheduleReload = () => {
      if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
      // Debounce de 800 ms para agrupar múltiplos eventos simultâneos
      reloadDebounceRef.current = setTimeout(() => {
        loadData();
      }, 800);
    };

    const channel = supabase
      .channel("metrics-realtime")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "user_stories" },
        scheduleReload,
      )
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "activities" },
        scheduleReload,
      )
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "sprints" },
        scheduleReload,
      )
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "impediments" },
        scheduleReload,
      )
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "developers" },
        scheduleReload,
      )
      .subscribe();

    return () => {
      if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [agileTeams, loadData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recarrega ao voltar para a aba do navegador (fallback)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadData();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadData]);

  // ─── Filtros aplicados ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const { sprints, hus, activities, impediments, developers, workflowCols } = rawData;

    let filteredSprints = sprints;
    if (filters.sprintId === "active") {
      filteredSprints = sprints.filter((s: any) => s.is_active);
    } else if (filters.sprintId !== "all") {
      filteredSprints = sprints.filter((s: any) => s.id === filters.sprintId);
    }
    const sprintIds = new Set(filteredSprints.map((s: any) => s.id));

    let filteredHUs = filters.sprintId === "all" ? hus : hus.filter((h: any) => sprintIds.has(h.sprint_id));
    if (filters.priority !== "all") filteredHUs = filteredHUs.filter((h: any) => h.priority === filters.priority);

    const huIds = new Set(filteredHUs.map((h: any) => h.id));
    let filteredActs = activities.filter((a: any) => huIds.has(a.hu_id));

    if (filters.dateFrom) filteredActs = filteredActs.filter((a: any) => a.end_date >= filters.dateFrom);
    if (filters.dateTo) filteredActs = filteredActs.filter((a: any) => a.start_date <= filters.dateTo);
    if (filters.dateFrom) {
      filteredHUs = filteredHUs.filter((h: any) => {
        if (h.end_date) return h.end_date >= filters.dateFrom;
        return h.created_at.split("T")[0] >= filters.dateFrom;
      });
    }
    if (filters.dateTo) {
      filteredHUs = filteredHUs.filter((h: any) => {
        if (h.start_date) return h.start_date <= filters.dateTo;
        return h.created_at.split("T")[0] <= filters.dateTo;
      });
    }

    const finalHuIds = new Set(filteredHUs.map((h: any) => h.id));
    filteredActs = filteredActs.filter((a: any) => finalHuIds.has(a.hu_id));
    if (filters.activityType !== "all")
      filteredActs = filteredActs.filter((a: any) => a.activity_type === filters.activityType);
    if (filters.memberId !== "all") filteredActs = filteredActs.filter((a: any) => a.assignee_id === filters.memberId);
    if (filters.status !== "all") {
      const today = new Date().toISOString().split("T")[0];
      if (filters.status === "concluida") filteredActs = filteredActs.filter((a: any) => a.is_closed);
      else if (filters.status === "em_progresso")
        filteredActs = filteredActs.filter((a: any) => !a.is_closed && a.start_date <= today);
      else if (filters.status === "nao_iniciada")
        filteredActs = filteredActs.filter((a: any) => !a.is_closed && a.start_date > today);
      else if (filters.status === "bloqueada") {
        const blockedHuIds = new Set(impediments.filter((i: any) => !i.resolved_at).map((i: any) => i.hu_id));
        filteredActs = filteredActs.filter((a: any) => blockedHuIds.has(a.hu_id));
      }
    }

    const filteredImps = impediments.filter((i: any) => finalHuIds.has(i.hu_id));
    const lastCol =
      workflowCols.length > 0
        ? [...workflowCols].sort((a: any, b: any) => a.sort_order - b.sort_order).at(-1)?.key
        : "pronto_para_publicacao";

    return { sprints: filteredSprints, hus: filteredHUs, activities: filteredActs, impediments: filteredImps, developers, workflowCols, lastCol };
  }, [rawData, filters]);

  // ─── Member metrics ─────────────────────────────────────────────────────────
  const memberMetrics = useMemo(() => {
    const { developers, activities, hus, impediments, lastCol } = filtered;
    const today = new Date().toISOString().split("T")[0];
    const blockedHuIds = new Set(impediments.filter((i: any) => !i.resolved_at).map((i: any) => i.hu_id));
    return developers.map((dev: any) => {
      const devActs = activities.filter((a: any) => a.assignee_id === dev.id);
      const devHUIds = new Set(devActs.map((a: any) => a.hu_id));
      const devHUs = hus.filter((h: any) => devHUIds.has(h.id));
      const closedActs = devActs.filter((a: any) => a.is_closed);
      const startedActs = devActs.filter((a: any) => !a.is_closed && a.start_date <= today);
      const notStartedCount = devActs.length - startedActs.length - closedActs.length;
      const hoursPlanned = devActs.reduce((s: number, a: any) => s + Number(a.hours), 0);
      const hoursCompleted = closedActs.reduce((s: number, a: any) => s + Number(a.hours), 0);
      const bugActs = devActs.filter((a: any) => a.activity_type === "bug");
      const bugsClosed = bugActs.filter((a: any) => a.is_closed);
      const completedHUs = devHUs.filter((h: any) => h.status === lastCol);
      const spCompleted = completedHUs.reduce((s: number, h: any) => s + (h.story_points || 0), 0);
      const avgTime = closedActs.length > 0 ? Math.round((hoursCompleted / closedActs.length) * 10) / 10 : 0;
      const wip = startedActs.length;
      let cycleTime = 0;
      if (closedActs.length > 0) {
        const totalDays = closedActs.reduce((s: number, a: any) => {
          if (a.closed_at && a.start_date) return s + Math.max(0, (new Date(a.closed_at).getTime() - new Date(a.start_date).getTime()) / 86400000);
          return s + Math.max(0, (new Date(a.end_date).getTime() - new Date(a.start_date).getTime()) / 86400000);
        }, 0);
        cycleTime = Math.round((totalDays / closedActs.length) * 10) / 10;
      }
      const devBlockedActs = devActs.filter((a: any) => !a.is_closed && blockedHuIds.has(a.hu_id));
      const tasksByStatus = [
        { name: "Concluída", value: closedActs.length, color: "#22c55e" },
        { name: "Em Progresso", value: Math.max(0, startedActs.length - devBlockedActs.length), color: "#3b82f6" },
        { name: "Não Iniciada", value: Math.max(0, notStartedCount), color: "#94a3b8" },
        { name: "Bloqueada", value: devBlockedActs.length, color: "#ef4444" },
      ].filter((s) => s.value > 0);
      return {
        id: dev.id, name: dev.name, role: dev.role || "developer",
        tasksAssigned: devActs.length, tasksStarted: startedActs.length, tasksCompleted: closedActs.length,
        tasksNotStarted: Math.max(0, notStartedCount), hoursPlanned, hoursCompleted,
        hoursPending: hoursPlanned - hoursCompleted,
        efficiency: hoursPlanned > 0 ? Math.round((hoursCompleted / hoursPlanned) * 100) : 0,
        bugsAssigned: bugActs.length, bugsResolved: bugsClosed.length, storyPointsCompleted: spCompleted,
        avgTimePerActivity: avgTime, wip, cycleTime, tasksByStatus, activities: devActs,
      };
    });
  }, [filtered]);

  const hoursPerMemberData = useMemo(
    () => memberMetrics.map((m) => ({ name: m.name.split(" ")[0], concluido: m.hoursCompleted, pendente: m.hoursPending })),
    [memberMetrics],
  );

  const progressBySprintData = useMemo(() => {
    const { sprints: allSprints } = rawData;
    if (allSprints.length <= 1) return [];
    return [...allSprints]
      .sort((a: any, b: any) => a.start_date.localeCompare(b.start_date))
      .slice(-5)
      .map((sprint: any) => {
        const sprintHUs = rawData.hus.filter((h: any) => h.sprint_id === sprint.id);
        const huIds = new Set(sprintHUs.map((h: any) => h.id));
        const sprintActs = rawData.activities.filter((a: any) => huIds.has(a.hu_id));
        const entry: any = { sprint: sprint.name };
        filtered.developers.forEach((dev: any) => {
          const devActs = sprintActs.filter((a: any) => a.assignee_id === dev.id);
          entry[dev.name.split(" ")[0]] = devActs.filter((a: any) => a.is_closed).reduce((s: number, a: any) => s + Number(a.hours), 0);
        });
        return entry;
      });
  }, [rawData, filtered.developers]);

  // ─── Team overview ──────────────────────────────────────────────────────────
  const teamOverview = useMemo(() => {
    const { hus, activities, impediments, lastCol, workflowCols } = filtered;
    const completedHUs = hus.filter((h: any) => h.status === lastCol);
    const totalPoints = hus.reduce((s: number, h: any) => s + (h.story_points || 0), 0);
    const completedPoints = completedHUs.reduce((s: number, h: any) => s + (h.story_points || 0), 0);
    const totalHours = activities.reduce((s: number, a: any) => s + Number(a.hours), 0);
    const completedHours = activities.filter((a: any) => a.is_closed).reduce((s: number, a: any) => s + Number(a.hours), 0);
    const today = new Date().toISOString().split("T")[0];
    const overdueCount = hus.filter((h: any) => h.status !== lastCol && h.end_date && h.end_date < today).length;
    const blockedCount = hus.filter((h: any) => impediments.some((imp: any) => imp.hu_id === h.id && !imp.resolved_at)).length;
    const cols = workflowCols.length > 0 ? workflowCols : [{ key: "aguardando_desenvolvimento", label: "Aguardando" }];
    const statusData = [...cols]
      .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((col: any) => ({ name: col.label, value: hus.filter((h: any) => h.status === col.key).length, color: STATUS_COLORS[col.key] || "#94a3b8" }))
      .filter((d: any) => d.value > 0);
    const commitmentAccuracy = hus.length > 0 ? Math.round((completedHUs.length / hus.length) * 100) : 0;
    const cycleTimeDays = (() => {
      if (completedHUs.length === 0) return 0;
      const withDates = completedHUs.filter((h: any) => h.start_date && h.end_date);
      if (!withDates.length) return 0;
      const total = withDates.reduce((s: number, h: any) => s + Math.max(0, (new Date(h.end_date).getTime() - new Date(h.start_date).getTime()) / 86400000), 0);
      return Math.round((total / withDates.length) * 10) / 10;
    })();
    return {
      totalPoints, completedPoints, totalHUs: hus.length, completedHUs: completedHUs.length,
      totalHours, completedHours, totalActivities: activities.length,
      completedActivities: activities.filter((a: any) => a.is_closed).length,
      overdueCount, blockedCount, devCount: filtered.developers.length, statusData,
      sprintName: filtered.sprints[0]?.name || "Sem sprint",
      sprintStart: filtered.sprints[0]?.start_date || "",
      sprintEnd: filtered.sprints[0]?.end_date || "",
      commitmentAccuracy, cycleTimeDays,
      impedimentHistory: impediments
        .map((imp: any) => {
          const hu = hus.find((h: any) => h.id === imp.hu_id);
          return { id: imp.id, reason: imp.reason, type: imp.type, criticality: imp.criticality, ticketId: imp.ticket_id, reportedAt: imp.reported_at, resolvedAt: imp.resolved_at, resolution: imp.resolution, huCode: hu?.code || "?", huTitle: hu?.title || "" };
        })
        .sort((a: any, b: any) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()),
    };
  }, [filtered]);

  // ─── Trends ─────────────────────────────────────────────────────────────────
  const trends = useMemo(() => {
    const sorted = [...rawData.sprints].sort((a, b) => a.start_date.localeCompare(b.start_date));
    if (sorted.length < 2 || filtered.sprints.length === 0) return null;
    const currentIdx = sorted.findIndex((s) => s.id === filtered.sprints[0].id);
    if (currentIdx <= 0) return null;
    const prev = sorted[currentIdx - 1];
    const prevHUs = rawData.hus.filter((h: any) => h.sprint_id === prev.id);
    const prevHuIds = new Set(prevHUs.map((h: any) => h.id));
    const prevActs = rawData.activities.filter((a: any) => prevHuIds.has(a.hu_id));
    const { lastCol } = filtered;
    const prevCompletedHUs = prevHUs.filter((h: any) => h.status === lastCol);
    const prevVelocity = prevCompletedHUs.reduce((s: number, h: any) => s + (h.story_points || 0), 0);
    const prevCommitment = prevHUs.length > 0 ? Math.round((prevCompletedHUs.length / prevHUs.length) * 100) : 0;
    const prevWithDates = prevCompletedHUs.filter((h: any) => h.start_date && h.end_date);
    const prevCycleTime = prevWithDates.length > 0
      ? Math.round((prevWithDates.reduce((s: number, h: any) => s + Math.max(0, (new Date(h.end_date).getTime() - new Date(h.start_date).getTime()) / 86400000), 0) / prevWithDates.length) * 10) / 10
      : 0;
    const prevDoneHrs = prevActs.filter((a: any) => a.is_closed).reduce((s: number, a: any) => s + Number(a.hours), 0);
    return { velocity: prevVelocity, commitment: prevCommitment, cycleTime: prevCycleTime, hours: prevDoneHrs };
  }, [rawData, filtered]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  const memberNames = filtered.developers.map((d: any) => d.name.split(" ")[0]);
  const effectiveTeamId = filters.teamId === "all" ? currentTeamId || "" : filters.teamId;
  const currentTeamName = agileTeams.find((t: any) => t.id === filters.teamId)?.name ?? "NexOps";

  return (
    <div className="space-y-4">
      <DashboardFilters
        filters={filters}
        onChange={setFilters}
        sprints={rawData.sprints.map((s: any) => ({ id: s.id, name: s.name, isActive: s.is_active }))}
        teams={agileTeams}
        members={rawData.developers.map((d: any) => ({ id: d.id, name: d.name }))}
        isAdmin={isAdmin}
      />

      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold">{teamOverview.sprintName}</span>
        {teamOverview.sprintStart && (
          <Badge variant="outline" className="text-[10px] font-mono">
            {new Date(teamOverview.sprintStart).toLocaleDateString("pt-BR")} —{" "}
            {new Date(teamOverview.sprintEnd).toLocaleDateString("pt-BR")}
          </Badge>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <OverviewKPI icon={TrendingUp} label="Velocity" value={`${teamOverview.completedPoints}`} sub={`/${teamOverview.totalPoints} pts`} trend={trends ? getTrend(teamOverview.completedPoints, trends.velocity) : undefined} />
        <OverviewKPI icon={Target} label="HUs Concluídas" value={`${teamOverview.completedHUs}`} sub={`/${teamOverview.totalHUs}`} trend={trends ? getTrend(teamOverview.completedHUs, teamOverview.totalHUs > 0 ? trends.velocity : 0) : undefined} />
        <OverviewKPI icon={CheckCircle} label="Commitment" value={`${teamOverview.commitmentAccuracy}%`} sub="HUs entregues/plan." accent={teamOverview.commitmentAccuracy >= 80 ? undefined : teamOverview.commitmentAccuracy >= 60 ? "warning" : "destructive"} trend={trends ? getTrend(teamOverview.commitmentAccuracy, trends.commitment) : undefined} />
        <OverviewKPI icon={Clock} label="Cycle Time" value={`${teamOverview.cycleTimeDays}d`} sub="média por HU" trend={trends ? getTrend(trends.cycleTime, teamOverview.cycleTimeDays, true) : undefined} />
        <OverviewKPI icon={Gauge} label="Horas" value={`${teamOverview.completedHours}h`} sub={`/${teamOverview.totalHours}h plan.`} trend={trends ? getTrend(teamOverview.completedHours, trends.hours) : undefined} />
        <OverviewKPI icon={Users} label="Time" value={`${teamOverview.devCount}`} sub="membros" />
        <OverviewKPI icon={AlertTriangle} label="Atrasadas" value={`${teamOverview.overdueCount}`} sub="HUs" accent={teamOverview.overdueCount > 0 ? "destructive" : undefined} />
        <OverviewKPI icon={ShieldAlert} label="Impedidas" value={`${teamOverview.blockedCount}`} sub="HUs" accent={teamOverview.blockedCount > 0 ? "warning" : undefined} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="individual" className="text-xs gap-1"><User className="h-3.5 w-3.5" /> Individual</TabsTrigger>
          <TabsTrigger value="team" className="text-xs gap-1"><Users className="h-3.5 w-3.5" /> Time</TabsTrigger>
          <TabsTrigger value="quality" className="text-xs gap-1"><Bug className="h-3.5 w-3.5" /> Qualidade</TabsTrigger>
          <TabsTrigger value="impediments" className="text-xs gap-1"><ShieldAlert className="h-3.5 w-3.5" /> Impedimentos</TabsTrigger>
          <TabsTrigger value="releases" className="text-xs gap-1"><Rocket className="h-3.5 w-3.5" /> Releases</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs gap-1 text-primary"><FileBarChart2 className="h-3.5 w-3.5" /> Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="individual">
          <IndividualPerformance members={memberMetrics} sprintName={teamOverview.sprintName} hoursPerMemberData={hoursPerMemberData} progressBySprintData={progressBySprintData} memberNames={memberNames} />
        </TabsContent>
        <TabsContent value="team">
          <TeamPerformance sprints={filtered.sprints} hus={filtered.hus} activities={filtered.activities} developers={filtered.developers} impediments={filtered.impediments} lastCol={filtered.lastCol} allSprints={rawData.sprints} allHUs={rawData.hus} allActivities={rawData.activities} statusData={teamOverview.statusData} hoursPerMemberData={hoursPerMemberData} />
        </TabsContent>
        <TabsContent value="quality">
          <QualityPanel activities={filtered.activities} developers={filtered.developers} hus={filtered.hus} lastCol={filtered.lastCol} />
        </TabsContent>
        <TabsContent value="impediments">
          <ImpedimentHistoryPanel data={teamOverview.impedimentHistory} />
        </TabsContent>
        <TabsContent value="releases">
          <ReleasesPanel teamId={effectiveTeamId} sprints={rawData.sprints.map((s: any) => ({ id: s.id, name: s.name }))} />
        </TabsContent>

        {/* ── Relatórios Ágeis ─────────────────────────────── */}
        <TabsContent value="reports" className="mt-0 p-0">
          <SalaAgilRelatorios
            sprints={rawData.sprints.map((s: any) => ({ id: s.id, name: s.name, isActive: s.is_active }))}
            developers={filtered.developers.map((d: any) => ({ id: d.id, name: d.name, role: d.role || "developer" }))}
            rawData={{
              sprints: rawData.sprints,
              hus: rawData.hus,
              activities: rawData.activities,
              impediments: rawData.impediments,
              developers: rawData.developers,
            }}
            teamName={currentTeamName}
            currentUserName={(user as any)?.user_metadata?.name ?? (user as any)?.email ?? "Usuário"}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTrend(current: number, previous: number, invertColor = false): { direction: "up" | "down" | "same"; isGood: boolean } {
  if (current > previous) return { direction: "up", isGood: !invertColor };
  if (current < previous) return { direction: "down", isGood: invertColor };
  return { direction: "same", isGood: true };
}

function OverviewKPI({ icon: Icon, label, value, sub, accent, trend }: { icon: React.ElementType; label: string; value: string; sub: string; accent?: "destructive" | "warning"; trend?: { direction: "up" | "down" | "same"; isGood: boolean }; }) {
  const TrendIcon = trend?.direction === "up" ? TrendingUp : trend?.direction === "down" ? TrendingDown : Minus;
  return (
    <Card className={accent === "destructive" ? "border-destructive/30" : accent === "warning" ? "border-[#eab308]/30" : ""}>
      <CardContent className="p-3 text-center">
        <Icon className={`h-4 w-4 mx-auto mb-1 ${accent === "destructive" ? "text-destructive" : accent === "warning" ? "text-[#eab308]" : "text-primary"}`} />
        <div className="flex items-center justify-center gap-1">
          <p className={`text-xl font-bold ${accent === "destructive" ? "text-destructive" : accent === "warning" ? "text-[#eab308]" : ""}`}>{value}</p>
          {trend && <TrendIcon className={`h-3.5 w-3.5 ${trend.isGood ? "text-[#22c55e]" : "text-[#ef4444]"}`} />}
        </div>
        <p className="text-[10px] text-muted-foreground leading-tight">{sub}</p>
        <p className="text-[10px] font-medium text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

function ImpedimentHistoryPanel({ data }: { data: any[] }) {
  if (data.length === 0)
    return (
      <Card className="border-dashed border-[#22c55e]/30">
        <CardContent className="py-12 text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 text-[#22c55e] opacity-60" />
          <p className="font-medium text-[#22c55e]">✅ Nenhum impedimento registrado nesta sprint.</p>
          <p className="text-sm text-muted-foreground mt-1">O time está livre de bloqueios!</p>
        </CardContent>
      </Card>
    );
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#eab308]" /> Histórico de Impedimentos ({data.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 font-medium">HU</th>
                <th className="text-left py-2 font-medium">Descrição</th>
                <th className="text-center py-2 font-medium">Tipo</th>
                <th className="text-center py-2 font-medium">Criticidade</th>
                <th className="text-center py-2 font-medium">Chamado</th>
                <th className="text-center py-2 font-medium">Reportado</th>
                <th className="text-center py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((imp: any, idx: number) => (
                <tr key={imp.id} className={`border-b last:border-0 ${idx % 2 !== 0 ? "bg-[#f8fafc] dark:bg-muted/10" : ""}`}>
                  <td className="py-2 font-mono text-xs font-bold">{imp.huCode}</td>
                  <td className="py-2 max-w-[200px] truncate">{imp.reason}</td>
                  <td className="text-center py-2 capitalize text-xs">{imp.type}</td>
                  <td className="text-center py-2">
                    <Badge className={`text-[10px] ${imp.criticality === "critica" ? "bg-destructive/15 text-destructive" : imp.criticality === "alta" ? "bg-[#eab308]/15 text-[#eab308]" : imp.criticality === "media" ? "bg-[#3b82f6]/15 text-[#3b82f6]" : "bg-muted text-muted-foreground"}`}>{imp.criticality}</Badge>
                  </td>
                  <td className="text-center py-2 text-xs">{imp.ticketId || "—"}</td>
                  <td className="text-center py-2 text-xs">{new Date(imp.reportedAt).toLocaleDateString("pt-BR")}</td>
                  <td className="text-center py-2">
                    {imp.resolvedAt ? (
                      <Badge variant="secondary" className="text-[10px] gap-1 bg-[#22c55e]/15 text-[#22c55e]"><CheckCircle className="h-3 w-3" /> Resolvido</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] gap-1 bg-[#eab308]/15 text-[#eab308]"><ShieldAlert className="h-3 w-3" /> Ativo</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
