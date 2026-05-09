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

export function RelatorioVelocidade({ sprints, rawData, teamName, currentUserName, onBack }: Props) {
  const [sprintId, setSprintId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const rows = useMemo(() => {
    return rawData.sprints
      .filter((s) => sprintId === "all" || s.id === sprintId)
      .filter((s) => {
        if (dateFrom && s.end_date < dateFrom) return false;
        if (dateTo && s.start_date > dateTo) return false;
        return true;
      })
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .map((sprint) => {
        const sprintHUs = rawData.hus.filter((h) => h.sprint_id === sprint.id);
        const cols = ["pronto_para_publicacao"];
        const completedHUs = sprintHUs.filter((h) => cols.includes(h.status));
        const plannedPoints = sprintHUs.reduce((s, h) => s + (h.story_points || 0), 0);
        const deliveredPoints = completedHUs.reduce((s, h) => s + (h.story_points || 0), 0);
        const commitment = sprintHUs.length > 0 ? Math.round((completedHUs.length / sprintHUs.length) * 100) : 0;
        const withDates = completedHUs.filter((h) => h.start_date && h.end_date);
        const cycleTime =
          withDates.length > 0
            ? Math.round(
                (withDates.reduce(
                  (s, h) =>
                    s + Math.max(0, (new Date(h.end_date).getTime() - new Date(h.start_date).getTime()) / 86400000),
                  0,
                ) /
                  withDates.length) *
                  10,
              ) / 10
            : 0;
        return {
          id: sprint.id,
          sprint: sprint.name,
          plannedHUs: sprintHUs.length,
          completedHUs: completedHUs.length,
          plannedPoints,
          deliveredPoints,
          commitment: `${commitment}%`,
          cycleTime: `${cycleTime}d`,
          _commitment: commitment,
        };
      });
  }, [rawData, sprintId, dateFrom, dateTo]);

  const avgVelocity = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.deliveredPoints, 0) / rows.length) : 0;
  const avgCommitment =
    rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r._commitment, 0) / rows.length) : 0;
  const totalDelivered = rows.reduce((s, r) => s + r.deliveredPoints, 0);
  const totalHUsCompleted = rows.reduce((s, r) => s + r.completedHUs, 0);

  const kpis = [
    {
      label: "Velocity Média",
      value: `${avgVelocity} pts`,
      status: avgVelocity >= 20 ? ("success" as const) : avgVelocity >= 10 ? ("warning" as const) : ("danger" as const),
      meta: "Meta: ≥ 20 pts/sprint",
    },
    {
      label: "Commitment",
      value: `${avgCommitment}%`,
      status: avgCommitment >= 80 ? ("success" as const) : avgCommitment >= 60 ? ("warning" as const) : ("danger" as const),
      meta: "Meta: ≥ 80%",
    },
    {
      label: "Total Entregue",
      value: `${totalDelivered} pts`,
      status: "neutral" as const,
    },
    {
      label: "HUs Concluídas",
      value: `${totalHUsCompleted}`,
      status: "neutral" as const,
    },
  ];

  const columns = [
    { key: "sprint", label: "Sprint", sortable: true },
    { key: "plannedHUs", label: "HUs Plan.", sortable: true },
    { key: "completedHUs", label: "HUs Entregues", sortable: true },
    { key: "plannedPoints", label: "Pts Planejados", sortable: true },
    { key: "deliveredPoints", label: "Pts Entregues", sortable: true },
    { key: "commitment", label: "Commitment", sortable: true },
    { key: "cycleTime", label: "Cycle Time", sortable: true },
  ];

  const handleExportCSV = () => exportToCSV(rows, columns, `velocidade-${teamName}`);

  return (
    <ReportLayout
      header={
        <ReportPageHeader
          title="Velocidade do Time"
          subtitle="Story points entregues vs. planejados por sprint"
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
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
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
