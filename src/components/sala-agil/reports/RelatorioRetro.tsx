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
  rawData: { sprints: any[]; hus: any[]; impediments: any[] };
  teamName: string;
  currentUserName: string;
  onBack: () => void;
}

export function RelatorioRetro({ sprints, rawData, teamName, currentUserName, onBack }: Props) {
  const [sprintId, setSprintId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const rows = useMemo(() => {
    const sprintHuIds: Set<string> =
      sprintId === "all"
        ? new Set(rawData.hus.map((h) => h.id))
        : new Set(rawData.hus.filter((h) => h.sprint_id === sprintId).map((h) => h.id));

    return rawData.impediments
      .filter((imp) => {
        if (!sprintHuIds.has(imp.hu_id) && imp.sprint_id == null) return false;
        if (imp.sprint_id && sprintId !== "all" && imp.sprint_id !== sprintId) return false;
        if (dateFrom && imp.reported_at < dateFrom) return false;
        if (dateTo && imp.reported_at > dateTo) return false;
        return true;
      })
      .sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime())
      .map((imp) => {
        const hu = rawData.hus.find((h) => h.id === imp.hu_id);
        const sprint = rawData.sprints.find(
          (s) => s.id === imp.sprint_id || (hu && s.id === hu.sprint_id),
        );
        const resolvedMs =
          imp.resolved_at && imp.reported_at
            ? Math.max(
                0,
                Math.round(
                  (new Date(imp.resolved_at).getTime() - new Date(imp.reported_at).getTime()) / 3600000,
                ),
              )
            : null;
        return {
          id: imp.id,
          sprint: sprint?.name || "—",
          hu: hu?.code || "—",
          descricao: imp.reason,
          tipo: imp.type || "—",
          criticidade: imp.criticality || "—",
          chamado: imp.ticket_id || "—",
          reportado: imp.reported_at ? new Date(imp.reported_at).toLocaleDateString("pt-BR") : "—",
          resolvido: imp.resolved_at ? new Date(imp.resolved_at).toLocaleDateString("pt-BR") : "Em aberto",
          tempoResolucaoH: resolvedMs != null ? `${resolvedMs}h` : "—",
          _resolved: !!imp.resolved_at,
        };
      });
  }, [rawData, sprintId, dateFrom, dateTo]);

  const total = rows.length;
  const resolvidos = rows.filter((r) => r._resolved).length;
  const emAberto = total - resolvidos;
  const criticos = rows.filter((r) => r.criticidade === "critica" || r.criticidade === "alta").length;

  const kpis = [
    { label: "Total", value: `${total}`, status: "neutral" as const },
    {
      label: "Resolvidos",
      value: `${resolvidos}`,
      status: resolvidos === total && total > 0 ? ("success" as const) : ("warning" as const),
    },
    {
      label: "Em Aberto",
      value: `${emAberto}`,
      status: emAberto === 0 ? ("success" as const) : emAberto <= 2 ? ("warning" as const) : ("danger" as const),
    },
    {
      label: "Críticos/Altos",
      value: `${criticos}`,
      status: criticos === 0 ? ("success" as const) : criticos <= 2 ? ("warning" as const) : ("danger" as const),
    },
  ];

  const columns = [
    { key: "sprint", label: "Sprint", sortable: true },
    { key: "hu", label: "HU", sortable: true },
    { key: "descricao", label: "Descrição" },
    { key: "tipo", label: "Tipo", sortable: true },
    { key: "criticidade", label: "Criticidade", sortable: true },
    { key: "chamado", label: "Chamado" },
    { key: "reportado", label: "Reportado" },
    { key: "resolvido", label: "Resolvido" },
    { key: "tempoResolucaoH", label: "Tempo Res.", sortable: true },
  ];

  const handleExportCSV = () => exportToCSV(rows, columns, `retro-impedimentos-${teamName}`);

  return (
    <ReportLayout
      header={
        <ReportPageHeader
          title="Impedimentos & Retrospectiva"
          subtitle="Histórico de bloqueios com criticidade e tempo de resolução"
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
          emptyMessage="Nenhum impedimento encontrado para os filtros selecionados."
        />
      }
    />
  );
}
