import { useMemo, useState } from "react";
import {
  ReportLayout,
  ReportPageHeader,
  ReportFilterBar,
  ReportKPISummary,
  ReportDataTable,
} from "@/shared/components/reports";
import { exportToCSV } from "@/shared/components/reports/exportToCSV";

interface Props {
  sprints: { id: string; name: string; isActive?: boolean }[];
  rawData: { sprints: any[]; hus: any[]; activities: any[]; developers: any[] };
  teamName: string;
  currentUserName: string;
  onBack: () => void;
}

export function RelatorioBacklog({ sprints, rawData, teamName, currentUserName, onBack }: Props) {
  const [sprintId, setSprintId] = useState("all");
  const [memberId, setMemberId] = useState("all");

  const rows = useMemo(() => {
    let hus = sprintId === "all" ? rawData.hus : rawData.hus.filter((h) => h.sprint_id === sprintId);
    if (memberId !== "all") {
      const memberHuIds = new Set(
        rawData.activities.filter((a) => a.assignee_id === memberId).map((a) => a.hu_id),
      );
      hus = hus.filter((h) => memberHuIds.has(h.id));
    }
    return hus.map((hu) => {
      const sprint = rawData.sprints.find((s) => s.id === hu.sprint_id);
      const acts = rawData.activities.filter((a) => a.hu_id === hu.id);
      const assignees = [...new Set(acts.map((a) => a.assignee_id))]
        .map((id) => rawData.developers.find((d) => d.id === id)?.name || "?")
        .join(", ");
      return {
        id: hu.id,
        codigo: hu.code || hu.id.slice(0, 8),
        titulo: hu.title,
        status: hu.status,
        prioridade: hu.priority || "—",
        storyPoints: hu.story_points || 0,
        sprint: sprint?.name || "Sem sprint",
        responsaveis: assignees || "—",
        inicio: hu.start_date ? new Date(hu.start_date).toLocaleDateString("pt-BR") : "—",
        fim: hu.end_date ? new Date(hu.end_date).toLocaleDateString("pt-BR") : "—",
      };
    });
  }, [rawData, sprintId, memberId]);

  const doneStatuses = ["pronto_para_publicacao"];
  const totalHUs = rows.length;
  const concluidas = rows.filter((r) => doneStatuses.includes(r.status)).length;
  const emProgresso = rows.filter(
    (r) => !doneStatuses.includes(r.status) && r.status !== "aguardando_desenvolvimento",
  ).length;
  const pendentes = rows.filter((r) => r.status === "aguardando_desenvolvimento").length;

  const kpis = [
    { label: "Total HUs", value: `${totalHUs}`, status: "neutral" as const },
    {
      label: "Concluídas",
      value: `${concluidas}`,
      status: concluidas === totalHUs && totalHUs > 0 ? ("success" as const) : ("neutral" as const),
    },
    { label: "Em Progresso", value: `${emProgresso}`, status: emProgresso > 0 ? ("warning" as const) : ("success" as const) },
    { label: "Pendentes", value: `${pendentes}`, status: pendentes > 5 ? ("danger" as const) : ("neutral" as const) },
  ];

  const columns = [
    { key: "codigo", label: "Código", sortable: true },
    { key: "titulo", label: "Título" },
    { key: "status", label: "Status", sortable: true },
    { key: "prioridade", label: "Prioridade", sortable: true },
    { key: "storyPoints", label: "Story Pts", sortable: true },
    { key: "sprint", label: "Sprint", sortable: true },
    { key: "responsaveis", label: "Responsáveis" },
    { key: "inicio", label: "Início" },
    { key: "fim", label: "Fim" },
  ];

  const handleExportCSV = () => exportToCSV(rows, columns, `backlog-${teamName}`);

  return (
    <ReportLayout
      header={
        <ReportPageHeader
          title="Distribuição do Backlog"
          subtitle="HUs por status, sprint e membro responsável"
          module="Sala Ágil"
          teamName={teamName}
          onBack={onBack}
          onExportCSV={handleExportCSV}
        />
      }
      filters={
        <ReportFilterBar
          sprints={sprints}
          sprintId={sprintId}
          onSprintChange={setSprintId}
          analistas={rawData.developers.map((d) => ({ id: d.id, name: d.name }))}
          analistaId={memberId}
          onAnalistaChange={setMemberId}
        />
      }
      kpis={<ReportKPISummary items={kpis} />}
      table={
        <ReportDataTable
          columns={columns}
          rows={rows}
          emptyMessage="Nenhuma HU encontrada para os filtros selecionados."
        />
      }
    />
  );
}
