import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth }  from "@/contexts/AuthContext";
import { toast }    from "sonner";

// Helper: rejeita strings vazias, null, undefined e valores não-UUID
// que causam HTTP 400 (22P02) no PostgREST ao usar .in()
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export type ReportType = "sprint_summary" | "velocity" | "dev_performance" | "impediments" | "burndown" | "planning_results";

export interface ReportFilter {
  sprintId?:    string;
  devId?:       string;
  dateFrom?:    string;
  dateTo?:      string;
  reportType:   ReportType;
}

export interface SprintSummaryRow {
  code:           string;
  title:          string;
  assignee:       string;
  status:         string;
  storyPoints:    number;
  estimatedHours: number;
  completedAt?:   string;
}

export interface VelocityRow {
  sprintName:  string;
  totalPoints: number;
  donePoints:  number;
  completionRate: number;
}

export interface DevPerformanceRow {
  devName:       string;
  totalHUs:      number;
  doneHUs:       number;
  totalPoints:   number;
  avgCycleTime:  number | null;
  completionRate: number;
}

export interface ImpedimentRow {
  title:        string;
  createdBy:    string;
  createdAt:    string;
  resolvedAt:   string | null;
  daysOpen:     number;
  sprintName:   string;
}

export type ReportRow = SprintSummaryRow | VelocityRow | DevPerformanceRow | ImpedimentRow;

const DONE_STATUSES = ["done", "concluido", "concluído", "closed"];

export function useReports() {
  const { currentTeam } = useAuth();
  const teamId = currentTeam?.id ?? "";
  const [rows,    setRows]    = useState<ReportRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState<ReportFilter>({ reportType: "sprint_summary" });
  const [sprints, setSprints] = useState<{ id: string; name: string }[]>([]);
  const [devs,    setDevs]    = useState<{ id: string; name: string }[]>([]);

  const loadMeta = useCallback(async () => {
    if (!teamId) return;
    const [sp, dv] = await Promise.all([
      supabase.from("sprints").select("id, name").eq("team_id", teamId).order("created_at", { ascending: false }).limit(30),
      supabase.from("developers").select("id, name").eq("team_id", teamId),
    ]);
    setSprints((sp.data ?? []) as any[]);
    setDevs((dv.data ?? []) as any[]);
  }, [teamId]);

  const generate = useCallback(async (f: ReportFilter) => {
    if (!teamId) return;
    setLoading(true);
    setFilter(f);
    try {
      if (f.reportType === "sprint_summary") {
        let q = supabase.from("user_stories").select("code, title, status, story_points, estimated_hours, end_date, assignee_id").eq("team_id", teamId);
        if (f.sprintId) q = q.eq("sprint_id", f.sprintId);
        const { data: hus } = await q.order("code");
        const devIds = [...new Set((hus ?? []).map((h: any) => h.assignee_id).filter(isValidUUID))];
        const { data: devData } = devIds.length > 0
          ? await supabase.from("developers").select("id, name").in("id", devIds)
          : { data: [] };
        const devMap: Record<string, string> = {};
        (devData ?? []).forEach((d: any) => { devMap[d.id] = d.name; });
        const result: SprintSummaryRow[] = (hus ?? []).map((h: any) => ({
          code: h.code, title: h.title, assignee: devMap[h.assignee_id] ?? "-",
          status: h.status, storyPoints: h.story_points ?? 0,
          estimatedHours: h.estimated_hours ?? 0, completedAt: h.end_date ?? "-",
        }));
        setRows(result);
        setColumns(["Código", "Título", "Responsável", "Status", "Pontos", "Horas", "Concluído em"]);

      } else if (f.reportType === "velocity") {
        const { data: sps } = await supabase.from("sprints").select("id, name").eq("team_id", teamId).order("start_date", { ascending: false }).limit(12);
        const spIds = (sps ?? []).map((s: any) => s.id).filter(isValidUUID);
        const { data: hus } = spIds.length > 0
          ? await supabase.from("user_stories").select("sprint_id, status, story_points").in("sprint_id", spIds)
          : { data: [] };
        const result: VelocityRow[] = (sps ?? []).map((s: any) => {
          const spHUs = (hus ?? []).filter((h: any) => h.sprint_id === s.id);
          const done  = spHUs.filter((h: any) => DONE_STATUSES.some(ds => h.status?.toLowerCase().includes(ds)));
          const total = spHUs.reduce((a: number, h: any) => a + (h.story_points ?? 0), 0);
          const donePts = done.reduce((a: number, h: any) => a + (h.story_points ?? 0), 0);
          return { sprintName: s.name, totalPoints: total, donePoints: donePts, completionRate: total > 0 ? Math.round(donePts / total * 100) : 0 };
        });
        setRows(result);
        setColumns(["Sprint", "Total pts", "Concluído pts", "Taxa (%)"]);

      } else if (f.reportType === "dev_performance") {
        const { data: dvs } = await supabase.from("developers").select("id, name").eq("team_id", teamId);
        const { data: hus } = await supabase.from("user_stories").select("assignee_id, status, story_points, added_to_sprint_at, end_date").eq("team_id", teamId);
        const result: DevPerformanceRow[] = (dvs ?? []).map((d: any) => {
          const devHUs = (hus ?? []).filter((h: any) => h.assignee_id === d.id);
          const done   = devHUs.filter((h: any) => DONE_STATUSES.some(ds => h.status?.toLowerCase().includes(ds)));
          const totalPts = devHUs.reduce((a: number, h: any) => a + (h.story_points ?? 0), 0);
          const cycleTimes = done.filter((h: any) => h.added_to_sprint_at && h.end_date)
            .map((h: any) => Math.max(0, Math.round((new Date(h.end_date).getTime() - new Date(h.added_to_sprint_at).getTime()) / 86400000)));
          return {
            devName: d.name, totalHUs: devHUs.length, doneHUs: done.length, totalPoints: totalPts,
            avgCycleTime: cycleTimes.length > 0 ? Math.round(cycleTimes.reduce((a: number, b: number) => a + b, 0) / cycleTimes.length) : null,
            completionRate: devHUs.length > 0 ? Math.round(done.length / devHUs.length * 100) : 0,
          };
        }).filter(d => d.totalHUs > 0);
        setRows(result);
        setColumns(["Dev", "HUs", "Concluídas", "Pontos", "Cycle time (d)", "Taxa (%)"]);

      } else if (f.reportType === "impediments") {
        const { data: imps } = await supabase.from("impediments").select("title, created_by, created_at, resolved_at, sprint_id").eq("team_id", teamId).order("created_at", { ascending: false });
        const sprintIds = [...new Set((imps ?? []).map((i: any) => i.sprint_id).filter(isValidUUID))];
        const { data: spData } = sprintIds.length > 0
          ? await supabase.from("sprints").select("id, name").in("id", sprintIds)
          : { data: [] };
        const spMap: Record<string, string> = {};
        (spData ?? []).forEach((s: any) => { spMap[s.id] = s.name; });
        const result: ImpedimentRow[] = (imps ?? []).map((i: any) => ({
          title: i.title, createdBy: i.created_by ?? "-", createdAt: i.created_at?.slice(0, 10) ?? "-",
          resolvedAt: i.resolved_at ? i.resolved_at.slice(0, 10) : null,
          daysOpen: Math.round((new Date(i.resolved_at ?? Date.now()).getTime() - new Date(i.created_at).getTime()) / 86400000),
          sprintName: spMap[i.sprint_id] ?? "-",
        }));
        setRows(result);
        setColumns(["Título", "Criado por", "Criado em", "Resolvido em", "Dias aberto", "Sprint"]);
      }
    } finally { setLoading(false); }
  }, [teamId]);

  // Exportar CSV
  const exportCSV = useCallback(() => {
    if (rows.length === 0) return;
    const header = columns.join(",");
    const body = rows.map(row => Object.values(row).map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `relatorio_${filter.reportType}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  }, [rows, columns, filter.reportType]);

  // Exportar JSON
  const exportJSON = useCallback(() => {
    if (rows.length === 0) return;
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `relatorio_${filter.reportType}_${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("JSON exportado!");
  }, [rows, filter.reportType]);

  return { rows, columns, loading, filter, sprints, devs, loadMeta, generate, exportCSV, exportJSON };
}
