import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth }  from "@/contexts/AuthContext";

// ── Types ───────────────────────────────────────────────────────────────────
export interface SprintMetrics {
  sprintId:       string;
  sprintName:     string;
  startDate:      string;
  endDate:        string;
  totalHUs:       number;
  doneHUs:        number;
  inProgressHUs:  number;
  totalPoints:    number;
  donePoints:     number;
  totalHours:     number;
  velocity:       number;
  completionRate: number;
}

export interface DevMetrics {
  devId:        string;
  devName:      string;
  devAvatar:    string | null;
  totalHUs:     number;
  doneHUs:      number;
  totalPoints:  number;
  donePoints:   number;
  avgCycleTime: number | null;
}

export interface DevOption {
  id:     string;
  name:   string;
  avatar: string | null;
}

export interface StatusDistribution {
  status: string;
  label:  string;
  count:  number;
  color:  string;
}

export interface BurndownPoint {
  date:      string;
  remaining: number;
  ideal:     number;
}

export interface DashboardData {
  currentSprint:      SprintMetrics | null;
  sprintHistory:      SprintMetrics[];
  devMetrics:         DevMetrics[];
  statusDistribution: StatusDistribution[];
  burndown:           BurndownPoint[];
  openImpediments:    number;
  totalBacklog:       number;
  avgVelocity:        number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  backlog:     { label: "Backlog",       color: "#94a3b8" },
  todo:        { label: "A fazer",       color: "#60a5fa" },
  in_progress: { label: "Em andamento",  color: "#f59e0b" },
  review:      { label: "Em revisão",    color: "#a78bfa" },
  done:        { label: "Concluído",     color: "#34d399" },
  blocked:     { label: "Bloqueado",     color: "#f87171" },
};

const DONE_STATUSES = ["done", "concluido", "concluído", "closed", "encerrado"];

export function useDashboardData() {
  const { currentTeam, user, roles } = useAuth();
  const teamId = currentTeam?.id ?? "";

  const [data,             setData]             = useState<DashboardData | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [period,           setPeriod]           = useState<"current" | "3sprints" | "6sprints" | "all">("3sprints");
  const [devOptions,       setDevOptions]       = useState<DevOption[]>([]);
  const [currentUserDevId, setCurrentUserDevId] = useState<string | null>(null);

  const isAdminUser = roles.includes("admin") || roles.includes("admin_contrato");

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const [spRes, huRes, devRes, colRes, impRes] = await Promise.all([
        supabase.from("sprints").select("*").eq("team_id", teamId).order("start_date", { ascending: false }).limit(20),
        supabase.from("user_stories").select(
          "id, status, story_points, estimated_hours, assignee_id, sprint_id, start_date, end_date, added_to_sprint_at"
        ).eq("team_id", teamId).limit(1000),
        supabase.from("developers").select("id, name, avatar, user_id").eq("team_id", teamId),
        supabase.from("workflow_columns").select("key, label, hex, dot_color").eq("team_id", teamId),
        supabase.from("impediments").select("id").eq("team_id", teamId).is("resolved_at", null),
      ]);

      const sprints  = (spRes.data  ?? []) as any[];
      const hus      = (huRes.data  ?? []) as any[];
      const devs     = (devRes.data ?? []) as any[];
      const cols     = (colRes.data ?? []) as any[];
      const openImps = (impRes.data ?? []).length;

      // Opções de analista para o combo
      const options: DevOption[] = devs.map((d: any) => ({ id: d.id, name: d.name, avatar: d.avatar ?? null }));
      setDevOptions(options);

      // Encontra o developer correspondente ao usuário logado
      if (user?.id) {
        const myDev = devs.find((d: any) => d.user_id === user.id);
        setCurrentUserDevId(myDev?.id ?? null);
      }

      // Mapa de colunas
      const colMap: Record<string, { label: string; color: string }> = {};
      cols.forEach((c: any) => {
        colMap[c.key] = { label: c.label, color: c.hex ?? c.dot_color ?? "#94a3b8" };
      });

      // ─ Métricas por sprint ──────────────────────────────────────────────
      const sprintMetrics: SprintMetrics[] = sprints.map((s: any) => {
        const spHUs  = hus.filter((h: any) => h.sprint_id === s.id);
        const done   = spHUs.filter((h: any) => DONE_STATUSES.some(ds => h.status?.toLowerCase().includes(ds)));
        const inProg = spHUs.filter((h: any) => h.status === "in_progress");
        const totalPts = spHUs.reduce((acc: number, h: any) => acc + (h.story_points ?? 0), 0);
        const donePts  = done.reduce((acc: number, h: any) => acc + (h.story_points ?? 0), 0);
        const totalHrs = spHUs.reduce((acc: number, h: any) => acc + (h.estimated_hours ?? 0), 0);
        return {
          sprintId:       s.id,
          sprintName:     s.name,
          startDate:      s.start_date,
          endDate:        s.end_date,
          totalHUs:       spHUs.length,
          doneHUs:        done.length,
          inProgressHUs:  inProg.length,
          totalPoints:    totalPts,
          donePoints:     donePts,
          totalHours:     totalHrs,
          velocity:       donePts,
          completionRate: spHUs.length > 0 ? Math.round((done.length / spHUs.length) * 100) : 0,
        };
      });

      const activeSprint   = sprints.find((s: any) => s.is_active);
      const currentMetrics = activeSprint ? sprintMetrics.find(m => m.sprintId === activeSprint.id) ?? null : null;

      // ─ Métricas por dev ─────────────────────────────────────────────────
      const devMetrics: DevMetrics[] = devs.map((d: any) => {
        const devHUs   = hus.filter((h: any) => h.assignee_id === d.id);
        const done     = devHUs.filter((h: any) => DONE_STATUSES.some(ds => h.status?.toLowerCase().includes(ds)));
        const totalPts = devHUs.reduce((acc: number, h: any) => acc + (h.story_points ?? 0), 0);
        const donePts  = done.reduce((acc: number, h: any) => acc + (h.story_points ?? 0), 0);
        const cycleTimes = done
          .filter((h: any) => h.added_to_sprint_at && h.end_date)
          .map((h: any) => {
            const start = new Date(h.added_to_sprint_at).getTime();
            const end   = new Date(h.end_date).getTime();
            return Math.max(0, Math.round((end - start) / 86400000));
          });
        const avgCycleTime = cycleTimes.length > 0
          ? Math.round(cycleTimes.reduce((a: number, b: number) => a + b, 0) / cycleTimes.length)
          : null;
        return { devId: d.id, devName: d.name, devAvatar: d.avatar, totalHUs: devHUs.length, doneHUs: done.length, totalPoints: totalPts, donePoints: donePts, avgCycleTime };
      }).filter(d => d.totalHUs > 0).sort((a, b) => b.donePoints - a.donePoints);

      // ─ Distribuição de status ────────────────────────────────────────────
      const activeHUs = activeSprint ? hus.filter((h: any) => h.sprint_id === activeSprint.id) : hus;
      const statusCount: Record<string, number> = {};
      activeHUs.forEach((h: any) => { statusCount[h.status] = (statusCount[h.status] ?? 0) + 1; });
      const statusDistribution: StatusDistribution[] = Object.entries(statusCount).map(([status, count]) => ({
        status, count,
        label: colMap[status]?.label ?? STATUS_LABELS[status]?.label ?? status,
        color: colMap[status]?.color ?? STATUS_LABELS[status]?.color ?? "#94a3b8",
      })).sort((a, b) => b.count - a.count);

      // ─ Burndown ──────────────────────────────────────────────────────────
      let burndown: BurndownPoint[] = [];
      if (activeSprint && currentMetrics) {
        const start     = new Date(activeSprint.start_date);
        const end       = new Date(activeSprint.end_date);
        const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
        const totalPts  = currentMetrics.totalPoints;
        const today     = new Date();
        for (let i = 0; i <= totalDays; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const dateStr  = d.toISOString().split("T")[0];
          const ideal    = Math.round(totalPts * (1 - i / totalDays));
          const doneByDay = activeHUs.filter((h: any) =>
            DONE_STATUSES.some(ds => h.status?.toLowerCase().includes(ds)) &&
            h.end_date && h.end_date <= dateStr
          ).reduce((acc: number, h: any) => acc + (h.story_points ?? 0), 0);
          const remaining = d <= today ? Math.max(0, totalPts - doneByDay) : totalPts;
          if (i === 0 || d <= today) burndown.push({ date: dateStr, remaining, ideal });
        }
        if (today < end) {
          burndown.push({ date: end.toISOString().split("T")[0], remaining: burndown[burndown.length-1]?.remaining ?? 0, ideal: 0 });
        }
      }

      // ─ Velocidade média ──────────────────────────────────────────────────
      const closedSprints = sprintMetrics.filter(s => new Date(s.endDate) < new Date());
      const avgVelocity   = closedSprints.length > 0
        ? Math.round(closedSprints.slice(0, 6).reduce((a, s) => a + s.velocity, 0) / Math.min(6, closedSprints.length))
        : 0;

      setData({
        currentSprint:      currentMetrics,
        sprintHistory:      sprintMetrics,
        devMetrics,
        statusDistribution,
        burndown,
        openImpediments:    openImps,
        totalBacklog:       hus.filter((h: any) => !h.sprint_id).length,
        avgVelocity,
      });
    } finally {
      setLoading(false);
    }
  }, [teamId, user?.id]);

  useEffect(() => { load(); }, [load]);

  const filteredHistory = useMemo(() => {
    if (!data) return [];
    const h = data.sprintHistory;
    if (period === "current")  return h.slice(0, 1);
    if (period === "3sprints") return h.slice(0, 3);
    if (period === "6sprints") return h.slice(0, 6);
    return h;
  }, [data, period]);

  return {
    data, loading, period, setPeriod, filteredHistory, reload: load,
    devOptions, currentUserDevId, isAdminUser,
  };
}
