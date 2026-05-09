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
  rawData: { sprints: any[]; hus: any[]; activities: any[] };
  teamName: string;
  currentUserName: string;
  onBack: () => void;
}

export function RelatorioBurndown({ sprints, rawData, teamName, currentUserName, onBack }: Props) {
  const [sprintId, setSprintId] = useState(() => {
    const active = rawData.sprints.find((s) => s.is_active);
    return active ? active.id : "all";
  });

  const rows = useMemo(() => {
    const selectedSprints = sprintId === "all" ? rawData.sprints : rawData.sprints.filter((s) => s.id === sprintId);
    return selectedSprints
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .map((sprint) => {
        const sprintHUs = rawData.hus.filter((h) => h.sprint_id === sprint.id);
        const doneStatuses = ["pronto_para_publicacao"];
        const completedHUs = sprintHUs.filter((h) => doneStatuses.includes(h.status));
        const inProgressHUs = sprintHUs.filter(
          (h) => !doneStatuses.includes(h.status) && h.status !== "aguardando_desenvolvimento",
        );
        const pendingHUs = sprintHUs.filter((h) => h.status === "aguardando_desenvolvimento");
        const totalPoints = sprintHUs.reduce((s, h) => s + (h.story_points || 0), 0);
        const donePoints = completedHUs.reduce((s, h) => s + (h.story_points || 0), 0);
        const remainingPoints = totalPoints - donePoints;
        const progressPct = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
        return {
          id: sprint.id,
          sprint: sprint.name,
          periodo: `${new Date(sprint.start_date).toLocaleDateString("pt-BR")} – ${new Date(sprint.end_date).toLocaleDateString("pt-BR")}`,
          totalHUs: sprintHUs.length,
          concluidas: completedHUs.length,
          emProgresso: inProgressHUs.length,
          pendentes: pendingHUs.length,
          totalPoints,
          donePoints,
          remainingPoints,
          progresso: `${progressPct}%`,
          _progressPct: progressPct,
        };
      });
  }, [rawData, sprintId]);

  const totalHUs = rows.reduce((s, r) => s + r.totalHUs, 0);
  const totalConcluidas = rows.reduce((s, r) => s + r.concluidas, 0);
  const totalRemaining = rows.reduce((s, r) => s + r.remainingPoints, 0);
  const avgProgress = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r._progressPct, 0) / rows.length) : 0;

  const kpis = [
    {
      label: "HUs Total",
      value: `${totalHUs}`,
      status: "neutral" as const,
    },
    {
      label: "HUs Concluídas",
      value: `${totalConcluidas}`,
      status: totalConcluidas === totalHUs && totalHUs > 0 ? ("success" as const) : ("neutral" as const),
    },
    {
      label: "Pontos Restantes",
      value: `${totalRemaining} pts`,
      status: totalRemaining === 0 ? ("success" as const) : totalRemaining < 20 ? ("warning" as const) : ("danger" as const),
    },
    {
      label: "Progresso Médio",
      value: `${avgProgress}%`,
      status: avgProgress >= 80 ? ("success" as const) : avgProgress >= 50 ? ("warning" as const) : ("danger" as const),
      meta: "Meta: ≥ 80%",
    },
  ];

  const columns = [
    { key: "sprint", label: "Sprint", sortable: true },
    { key: "periodo", label: "Período" },
    { key: "totalHUs", label: "Total HUs", sortable: true },
    { key: "concluidas", label: "Concluídas", sortable: true },
    { key: "emProgresso", label: "Em Progresso", sortable: true },
    { key: "pendentes", label: "Pendentes", sortable: true },
    { key: "donePoints", label: "Pts Entregues", sortable: true },
    { key: "remainingPoints", label: "Pts Restantes", sortable: true },
    { key: "progresso", label: "Progresso", sortable: true },
  ];

  const handleExportCSV = () => exportToCSV(rows, columns, `burndown-${teamName}`);

  return (
    <ReportLayout
      header={
        <ReportPageHeader
          title="Burndown / Progresso"
          subtitle="Progresso de HUs e pontos por sprint"
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
        />
      }
      kpis={<ReportKPISummary items={kpis} />}
      table={
        <ReportDataTable
          columns={columns}
          rows={rows}
          emptyMessage="Nenhuma sprint encontrada para os filtros selecionados."
        />
      }
    />
  );
}
