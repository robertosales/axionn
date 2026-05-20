import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TabsContent } from "@/components/ui/tabs";
import {
  TrendingUp,
  Users,
  Target,
  Gauge,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Clock,
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
import { SprintHeader } from "@/components/dashboard/SprintHeader";
import { KpiGroup } from "@/components/dashboard/KpiCards";
import { MetricsTabs } from "@/components/dashboard/MetricsTabs";
import { ImpedimentHistoryPanel } from "@/components/dashboard/ImpedimentHistoryPanel";
import { formatMinutes } from "@/lib/duration";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  aguardando_desenvolvimento: "#94a3b8",
  em_desenvolvimento: "#3b82f6",
  em_code_review: "#8b5cf6",
  em_teste: "#f59e0b",
  bug: "#ef4444",
  pronto_para_publicacao: "#22c55e",
};

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
        try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [rawData, setRawData] = useState<{
    sprints: any[]; hus: any[]; activities: any[];
    impediments: any[]; developers: any[]; workflowCols: any[];
  }>({ sprints: [], hus: [], activities: [], impediments: [], developers: [], workflowCols: [] });

  const lastTeamIdRef = useRef<string>("");
  const reloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (currentTeamId && filters.teamId === "all")
      setFilters((f) => ({ ...f, teamId: currentTeamId }));
  }, [currentTeamId]); // eslint-disable-line

  useEffect(() => {
    if (filters.teamId === "all") return;
    if (!agileTeams.some((t: any) => t.id === filters.teamId))
      setFilters((prev) => ({ ...prev, teamId: "all" }));
  }, [filters.teamId, agileTeams, setFilters]);

  const loadData = useCallback(async (forceTeamId?: string) => {
    const teamId = forceTeamId ?? filters.teamId;
    lastTeamIdRef.current = teamId;
    setLoading(true);
    const teamsToLoad = isAdmin && teamId === "all"
      ? agileTeams
      : agileTeams.filter((t: any) => t.id === (teamId === "all" ? currentTeamId : teamId));

    const allSprints: any[] = [], allHUs: any[] = [], allActs: any[] = [];
    const allImps: any[] = [], allDevs: any[] = [], allWfCols: any[] = [];

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
    setRawData({ sprints: allSprints, hus: allHUs, activities: allActs, impediments: allImps, developers: allDevs, workflowCols: allWfCols });
    setLastUpdated(new Date());
    setLoading(false);
  }, [filters.teamId, agileTeams, isAdmin, currentTeamId]);

  useEffect(() => { if (agileTeams.length > 0) loadData(); }, [filters.teamId, agileTeams]); // eslint-disable-line

  useEffect(() => {
    if (agileTeams.length === 0) return;
    const scheduleReload = () => {
      if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
      reloadDebounceRef.current = setTimeout(() => loadData(), 800);
    };
    const channel = supabase.channel("metrics-realtime")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "user_stories" }, scheduleReload)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "activities" }, scheduleReload)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "sprints" }, scheduleReload)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "impediments" }, scheduleReload)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "developers" }, scheduleReload)
      .subscribe();
    return () => {
      if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [agileTeams, loadData]);

  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === "visible") loadData(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadData]);

  // ─── Filtros ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const { sprints, hus, activities, impediments, developers, workflowCols } = rawData;
    let filteredSprints = sprints;
    if (filters.sprintId === "active") filteredSprints = sprints.filter((s: any) => s.is_active);
    else if (filters.sprintId !== "all") filteredSprints = sprints.filter((s: any) => s.id === filters.sprintId);
    const sprintIds = new Set(filteredSprints.map((s: any) => s.id));

    let filteredHUs = filters.sprintId === "all" ? hus : hus.filter((h: any) => sprintIds.has(h.sprint_id));
    if (filters.priority !== "all") filteredHUs = filteredHUs.filter((h: any) => h.priority === filters.priority);
    const huIds = new Set(filteredHUs.map((h: any) => h.id));
    let filteredActs = activities.filter((a: any) => huIds.has(a.hu_id));
    if (filters.dateFrom) filteredActs = filteredActs.filter((a: any) => a.end_date >= filters.dateFrom);
    if (filters.dateTo)   filteredActs = filteredActs.filter((a: any) => a.start_date <= filters.dateTo);
    if (filters.dateFrom) filteredHUs = filteredHUs.filter((h: any) => h.end_date ? h.end_date >= filters.dateFrom : h.created_at.split("T")[0] >= filters.dateFrom);
    if (filters.dateTo)   filteredHUs = filteredHUs.filter((h: any) => h.start_date ? h.start_date <= filters.dateTo : h.created_at.split("T")[0] <= filters.dateTo);
    const finalHuIds = new Set(filteredHUs.map((h: any) => h.id));
    filteredActs = filteredActs.filter((a: any) => finalHuIds.has(a.hu_id));
    if (filters.activityType !== "all") filteredActs = filteredActs.filter((a: any) => a.activity_type === filters.activityType);
    if (filters.memberId !== "all")     filteredActs = filteredActs.filter((a: any) => a.assignee_id === filters.memberId);
    if (filters.status !== "all") {
      const today = new Date().toISOString().split("T")[0];
      if      (filters.status === "concluida")    filteredActs = filteredActs.filter((a: any) => a.is_closed);
      else if (filters.status === "em_progresso") filteredActs = filteredActs.filter((a: any) => !a.is_closed && a.start_date <= today);
      else if (filters.status === "nao_iniciada") filteredActs = filteredActs.filter((a: any) => !a.is_closed && a.start_date > today);
      else if (filters.status === "bloqueada") {
        const blockedHuIds = new Set(impediments.filter((i: any) => !i.resolved_at).map((i: any) => i.hu_id));
        filteredActs = filteredActs.filter((a: any) => blockedHuIds.has(a.hu_id));
      }
    }
    const filteredImps = impediments.filter((i: any) => finalHuIds.has(i.hu_id));
    const lastCol = workflowCols.length > 0
      ? [...workflowCols].sort((a: any, b: any) => a.sort_order - b.sort_order).at(-1)?.key
      : "pronto_para_publicacao";
    return { sprints: filteredSprints, hus: filteredHUs, activities: filteredActs, impediments: filteredImps, developers, workflowCols, lastCol };
  }, [rawData, filters]);

  // ─── Member metrics ────────────────────────────────────────────────────────
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
      const hoursPlannedMin = devActs.reduce((s: number, a: any) => s + Math.round(Number(a.hours) * 60), 0);
      const hoursCompletedMin = closedActs.reduce((s: number, a: any) => s + Math.round(Number(a.hours) * 60), 0);
      const bugActs = devActs.filter((a: any) => a.activity_type === "bug");
      const bugsClosed = bugActs.filter((a: any) => a.is_closed);
      const completedHUs = devHUs.filter((h: any) => h.status === lastCol);
      const spCompleted = completedHUs.reduce((s: number, h: any) => s + (h.story_points || 0), 0);
      const avgTimeMin = closedActs.length > 0 ? Math.round(hoursCompletedMin / closedActs.length) : 0;
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
        { name: "Concluída",    value: closedActs.length,                                     color: "#22c55e" },
        { name: "Em Progresso", value: Math.max(0, startedActs.length - devBlockedActs.length), color: "#3b82f6" },
        { name: "Não Iniciada", value: Math.max(0, notStartedCount),                          color: "#94a3b8" },
        { name: "Bloqueada",    value: devBlockedActs.length,                                 color: "#ef4444" },
      ].filter((s) => s.value > 0);
      return {
        id: dev.id, name: dev.name, role: dev.role || "developer",
        tasksAssigned: devActs.length, tasksStarted: startedActs.length, tasksCompleted: closedActs.length,
        tasksNotStarted: Math.max(0, notStartedCount),
        hoursPlanned: hoursPlannedMin, hoursCompleted: hoursCompletedMin,
        hoursPending: hoursPlannedMin - hoursCompletedMin,
        efficiency: hoursPlannedMin > 0 ? Math.round((hoursCompletedMin / hoursPlannedMin) * 100) : 0,
        bugsAssigned: bugActs.length, bugsResolved: bugsClosed.length, storyPointsCompleted: spCompleted,
        avgTimePerActivity: avgTimeMin, wip, cycleTime, tasksByStatus, activities: devActs,
      };
    });
  }, [filtered]);

  const hoursPerMemberData = useMemo(
    () => memberMetrics.map((m) => ({ name: m.name.split(" ")[0], concluido: m.hoursCompleted, pendente: m.hoursPending })),
    [memberMetrics],
  );

  const progressBySprintData = useMemo(() => {
    if (rawData.sprints.length <= 1) return [];
    return [...rawData.sprints]
      .sort((a: any, b: any) => a.start_date.localeCompare(b.start_date))
      .slice(-5)
      .map((sprint: any) => {
        const sprintHUs = rawData.hus.filter((h: any) => h.sprint_id === sprint.id);
        const huIds = new Set(sprintHUs.map((h: any) => h.id));
        const sprintActs = rawData.activities.filter((a: any) => huIds.has(a.hu_id));
        const entry: any = { sprint: sprint.name };
        filtered.developers.forEach((dev: any) => {
          entry[dev.name.split(" ")[0]] = sprintActs
            .filter((a: any) => a.assignee_id === dev.id && a.is_closed)
            .reduce((s: number, a: any) => s + Math.round(Number(a.hours) * 60), 0);
        });
        return entry;
      });
  }, [rawData, filtered.developers]);

  // ─── Team overview ─────────────────────────────────────────────────────────
  const teamOverview = useMemo(() => {
    const { hus, activities, impediments, lastCol, workflowCols } = filtered;
    const completedHUs = hus.filter((h: any) => h.status === lastCol);
    const totalPoints = hus.reduce((s: number, h: any) => s + (h.story_points || 0), 0);
    const completedPoints = completedHUs.reduce((s: number, h: any) => s + (h.story_points || 0), 0);
    const totalHoursMin = activities.reduce((s: number, a: any) => s + Math.round(Number(a.hours) * 60), 0);
    const completedHoursMin = activities.filter((a: any) => a.is_closed).reduce((s: number, a: any) => s + Math.round(Number(a.hours) * 60), 0);
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
    const activeSprint = filtered.sprints.find((s: any) => s.is_active) || filtered.sprints[0];
    const impedimentHistory = impediments
      .map((imp: any) => {
        const hu = hus.find((h: any) => h.id === imp.hu_id);
        return { id: imp.id, reason: imp.reason, type: imp.type, criticality: imp.criticality, ticketId: imp.ticket_id, reportedAt: imp.reported_at, resolvedAt: imp.resolved_at, resolution: imp.resolution, huCode: hu?.code || "?", huTitle: hu?.title || "" };
      })
      .sort((a: any, b: any) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
    return {
      totalPoints, completedPoints, totalHUs: hus.length, completedHUs: completedHUs.length,
      totalHoursMin, completedHoursMin,
      totalActivities: activities.length,
      completedActivities: activities.filter((a: any) => a.is_closed).length,
      overdueCount, blockedCount, devCount: filtered.developers.length, statusData,
      sprintName: activeSprint?.name || "Sem sprint",
      sprintStart: activeSprint?.start_date || "",
      sprintEnd: activeSprint?.end_date || "",
      isActive: activeSprint?.is_active ?? false,
      commitmentAccuracy, cycleTimeDays, impedimentHistory,
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
    const prevDoneMin = prevActs.filter((a: any) => a.is_closed).reduce((s: number, a: any) => s + Math.round(Number(a.hours) * 60), 0);
    return { velocity: prevVelocity, commitment: prevCommitment, cycleTime: prevCycleTime, hoursMin: prevDoneMin };
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

  const getTrend = (current: number, previous: number, invertColor = false) => {
    if (current > previous) return { direction: "up" as const, isGood: !invertColor };
    if (current < previous) return { direction: "down" as const, isGood: invertColor };
    return { direction: "same" as const, isGood: true };
  };

  const deliveryKpis = [
    { icon: TrendingUp, label: "Velocity",       value: `${teamOverview.completedPoints}`,       sub: `de ${teamOverview.totalPoints} pts planejados`,  trend: trends ? getTrend(teamOverview.completedPoints, trends.velocity) : undefined },
    { icon: Target,     label: "HUs Concluídas", value: `${teamOverview.completedHUs}`,         sub: `de ${teamOverview.totalHUs} HUs`,                trend: trends ? getTrend(teamOverview.completedHUs, teamOverview.totalHUs > 0 ? trends.velocity : 0) : undefined },
    { icon: CheckCircle,label: "Commitment",     value: `${teamOverview.commitmentAccuracy}%`,   sub: "HUs entregues / planejadas",
      accent: teamOverview.commitmentAccuracy >= 80 ? ("success" as const) : teamOverview.commitmentAccuracy >= 60 ? ("warning" as const) : ("destructive" as const),
      trend: trends ? getTrend(teamOverview.commitmentAccuracy, trends.commitment) : undefined },
    { icon: Clock,      label: "Cycle Time",     value: `${teamOverview.cycleTimeDays}d`,        sub: "média por HU",                                  trend: trends ? getTrend(trends.cycleTime, teamOverview.cycleTimeDays, true) : undefined },
  ];

  const operationalKpis = [
    { icon: Gauge,         label: "Horas",     value: formatMinutes(teamOverview.completedHoursMin), sub: `de ${formatMinutes(teamOverview.totalHoursMin)} planejadas`, trend: trends ? getTrend(teamOverview.completedHoursMin, trends.hoursMin) : undefined },
    { icon: Users,         label: "Membros",   value: `${teamOverview.devCount}`,    sub: "no time" },
    { icon: AlertTriangle, label: "Atrasadas", value: `${teamOverview.overdueCount}`, sub: "HUs fora do prazo", accent: teamOverview.overdueCount > 0 ? ("destructive" as const) : undefined },
    { icon: ShieldAlert,   label: "Impedidas", value: `${teamOverview.blockedCount}`, sub: "HUs bloqueadas",   accent: teamOverview.blockedCount > 0 ? ("warning" as const) : undefined },
  ];

  const activeImpediments = teamOverview.impedimentHistory.filter((i: any) => !i.resolvedAt).length;

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

      <SprintHeader
        sprintName={teamOverview.sprintName}
        sprintStart={teamOverview.sprintStart}
        sprintEnd={teamOverview.sprintEnd}
        isActive={teamOverview.isActive}
        lastUpdated={lastUpdated}
        onRefresh={() => loadData()}
        refreshing={loading}
      />

      <KpiGroup delivery={deliveryKpis} operational={operationalKpis} />

      <MetricsTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={{ impediments: activeImpediments }}
      >
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
        <TabsContent value="reports" className="mt-0 p-0">
          <SalaAgilRelatorios
            sprints={rawData.sprints.map((s: any) => ({ id: s.id, name: s.name, isActive: s.is_active }))}
            developers={filtered.developers.map((d: any) => ({ id: d.id, name: d.name, role: d.role || "developer" }))}
            rawData={{ sprints: rawData.sprints, hus: rawData.hus, activities: rawData.activities, impediments: rawData.impediments, developers: rawData.developers }}
            teamName={currentTeamName}
            currentUserName={(user as any)?.user_metadata?.name ?? (user as any)?.email ?? "Usuário"}
          />
        </TabsContent>
      </MetricsTabs>
    </div>
  );
}
