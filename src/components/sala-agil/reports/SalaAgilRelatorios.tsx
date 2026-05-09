import { useState } from "react";
import {
  ReportCatalog,
  ReportLayout,
  ReportPageHeader,
  ReportFilterBar,
  ReportKPISummary,
  ReportDataTable,
} from "@/shared/components/reports";
import { RelatorioVelocidade } from "./RelatorioVelocidade";
import { RelatorioBurndown } from "./RelatorioBurndown";
import { RelatorioBacklog } from "./RelatorioBacklog";
import { RelatorioRetro } from "./RelatorioRetro";
import { BarChart3, TrendingDown, LayoutList, MessageSquareText } from "lucide-react";

export type SalaAgilReport = "velocidade" | "burndown" | "backlog" | "retro" | null;

export interface SalaAgilRelatoriosProps {
  sprints: { id: string; name: string; isActive?: boolean }[];
  developers: { id: string; name: string; role: string }[];
  rawData: {
    sprints: any[];
    hus: any[];
    activities: any[];
    impediments: any[];
    developers: any[];
  };
  teamName: string;
  currentUserName: string;
}

const CATALOG_ITEMS = [
  {
    id: "velocidade",
    title: "Velocidade do Time",
    description: "Story points entregues vs. planejados por sprint. Commitment accuracy e cycle time.",
    icon: BarChart3,
    module: "Sala Ágil",
    color: "blue" as const,
  },
  {
    id: "burndown",
    title: "Burndown / Progresso",
    description: "Progresso de HUs e pontos por sprint. Tendência de entrega e itens em aberto.",
    icon: TrendingDown,
    module: "Sala Ágil",
    color: "green" as const,
  },
  {
    id: "backlog",
    title: "Distribuição do Backlog",
    description: "HUs por status, épico e membro responsável. Identifica gargalos e concentração.",
    icon: LayoutList,
    module: "Sala Ágil",
    color: "purple" as const,
  },
  {
    id: "retro",
    title: "Impedimentos & Retro",
    description: "Histórico de impedimentos com semáforo de criticidade e tempo médio de resolução.",
    icon: MessageSquareText,
    module: "Sala Ágil",
    color: "orange" as const,
  },
];

export function SalaAgilRelatorios(props: SalaAgilRelatoriosProps) {
  const [active, setActive] = useState<SalaAgilReport>(null);

  if (!active) {
    return (
      <ReportCatalog
        title="Relatórios — Sala Ágil"
        subtitle="Selecione um relatório para visualizar os dados da sprint"
        items={CATALOG_ITEMS}
        onSelect={(id) => setActive(id as SalaAgilReport)}
      />
    );
  }

  const commonProps = { ...props, onBack: () => setActive(null) };

  if (active === "velocidade") return <RelatorioVelocidade {...commonProps} />;
  if (active === "burndown") return <RelatorioBurndown {...commonProps} />;
  if (active === "backlog") return <RelatorioBacklog {...commonProps} />;
  if (active === "retro") return <RelatorioRetro {...commonProps} />;

  return null;
}
