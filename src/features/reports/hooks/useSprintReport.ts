import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth }  from "@/contexts/AuthContext";
import { exportToCSV, exportToPDF } from "../utils/exportUtils";

export interface SprintReportHU {
  id:              string;
  code:            string;
  title:           string;
  status:          string;
  story_points:    number | null;
  estimated_hours: number | null;
  assignee_name:   string;
  priority:        string | null;
  epic:            string | null;
}

export interface SprintReport {
  sprintId:    string;
  sprintName:  string;
  startDate:   string;
  endDate:     string;
  totalHUs:    number;
  doneHUs:     number;
  totalPoints: number;
  donePoints:  number;
  totalHours:  number;
  hus:         SprintReportHU[];
}

export function useSprintReport() {
  const { currentTeam } = useAuth();
  const teamId = currentTeam?.id ?? "";

  const [sprints,  setSprints]  = useState<{ id: string; name: string; start_date: string; end_date: string; is_active: boolean }[]>([]);
  const [report,   setReport]   = useState<SprintReport | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (!teamId) return;
    supabase.from("sprints").select("id, name, start_date, end_date, is_active")
      .eq("team_id", teamId).order("start_date", { ascending: false }).limit(30)
      .then(({ data }) => {
        const list = (data ?? []) as any[];
        setSprints(list);
        const active = list.find(s => s.is_active);
        if (active) setSelected(active.id);
      });
  }, [teamId]);

  const loadReport = useCallback(async (sprintId: string) => {
    if (!sprintId) return;
    setLoading(true);
    const sprint = sprints.find(s => s.id === sprintId);
    const [huRes, devRes] = await Promise.all([
      supabase.from("user_stories").select(
        "id, code, title, status, story_points, estimated_hours, assignee_id, priority, epic"
      ).eq("sprint_id", sprintId),
      supabase.from("developers").select("id, name").eq("team_id", teamId),
    ]);
    const devMap: Record<string, string> = {};
    (devRes.data ?? []).forEach((d: any) => { devMap[d.id] = d.name; });

    const DONE = ["done", "concluido", "concluído", "closed"];
    const hus: SprintReportHU[] = (huRes.data ?? []).map((h: any) => ({
      id:              h.id,
      code:            h.code,
      title:           h.title,
      status:          h.status,
      story_points:    h.story_points,
      estimated_hours: h.estimated_hours,
      assignee_name:   devMap[h.assignee_id] ?? "—",
      priority:        h.priority,
      epic:            h.epic,
    }));
    const done  = hus.filter(h => DONE.some(d => h.status?.toLowerCase().includes(d)));
    setReport({
      sprintId,
      sprintName:  sprint?.name  ?? "",
      startDate:   sprint?.start_date ?? "",
      endDate:     sprint?.end_date   ?? "",
      totalHUs:    hus.length,
      doneHUs:     done.length,
      totalPoints: hus.reduce((a, h) => a + (h.story_points    ?? 0), 0),
      donePoints:  done.reduce((a, h) => a + (h.story_points   ?? 0), 0),
      totalHours:  hus.reduce((a, h) => a + (h.estimated_hours ?? 0), 0),
      hus,
    });
    setLoading(false);
  }, [sprints, teamId]);

  useEffect(() => { if (selected) loadReport(selected); }, [selected, loadReport]);

  // Exporta CSV
  const downloadCSV = useCallback(() => {
    if (!report) return;
    exportToCSV(
      `relatorio-${report.sprintName.replace(/\s+/g, "-")}`,
      ["Código", "Título", "Status", "Responsável", "Prioridade", "Epic", "Pontos", "Horas"],
      report.hus.map(h => [h.code, h.title, h.status, h.assignee_name, h.priority ?? "", h.epic ?? "", h.story_points ?? 0, h.estimated_hours ?? 0])
    );
  }, [report]);

  // Exporta PDF
  const downloadPDF = useCallback(() => {
    if (!report) return;
    const rows = report.hus.map(h => `
      <tr>
        <td>${h.code}</td><td>${h.title}</td><td>${h.status}</td>
        <td>${h.assignee_name}</td><td>${h.priority ?? "—"}</td>
        <td>${h.story_points ?? 0}</td><td>${h.estimated_hours ?? 0}h</td>
      </tr>`).join("");
    exportToPDF(`Relatório ${report.sprintName}`, `
      <h1>Relatório de Sprint — ${report.sprintName}</h1>
      <p class="meta">Período: ${report.startDate} → ${report.endDate} •
        ${report.totalHUs} HUs • ${report.doneHUs} concluídas •
        ${report.donePoints}/${report.totalPoints} pts • ${report.totalHours}h estimadas</p>
      <table>
        <thead><tr>
          <th>Código</th><th>Título</th><th>Status</th>
          <th>Responsável</th><th>Prioridade</th><th>Pts</th><th>Horas</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `);
  }, [report]);

  return { sprints, selected, setSelected, report, loading, downloadCSV, downloadPDF };
}
