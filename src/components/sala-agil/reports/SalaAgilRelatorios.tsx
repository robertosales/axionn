import { useState } from "react";
import { BarChart2, TrendingDown, LayoutList, ShieldAlert, User } from "lucide-react";
import { ReportLayout, ReportCatalog, ReportPageHeader } from "@/shared/components/reports";
import type { CatalogItem } from "@/shared/components/reports";
import { RelatorioVelocidade } from "./RelatorioVelocidade";
import { RelatorioBurndown } from "./RelatorioBurndown";
import { RelatorioBacklog } from "./RelatorioBacklog";
import { RelatorioRetro } from "./RelatorioRetro";
import { RelatorioAtividades } from "./RelatorioAtividades";

interface SalaAgilRelatoriosProps {
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

const CATALOG: CatalogItem[] = [
  {
    id: "velocidade",
    title: "Velocidade",
    description: "Velocity por sprint, commitment accuracy e cycle time do time.",
    icon: <BarChart2 className="h-5 w-5" />,
    badge: "Ágil",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    id: "burndown",
    title: "Burndown",
    description: "Progresso de HUs e pontos concluídos vs. planejados por sprint.",
    icon: <TrendingDown className="h-5 w-5" />,
    badge: "Ágil",
    color: "bg-violet-500/10 text-violet-600",
  },
  {
    id: "backlog",
    title: "Backlog",
    description: "Distribuição de HUs por status, sprint e membro responsável.",
    icon: <LayoutList className="h-5 w-5" />,
    badge: "Ágil",
    color: "bg-amber-500/10 text-amber-600",
  },
  {
    id: "retro",
    title: "Impedimentos",
    description: "Histórico de impedimentos com criticidade e tempo de resolução.",
    icon: <ShieldAlert className="h-5 w-5" />,
    badge: "Ágil",
    color: "bg-red-500/10 text-red-600",
  },
  {
    id: "atividades",
    title: "Atividades & Produtividade",
    description: "Atividades por membro, eficiência, throughput por sprint e cycle time individual.",
    icon: <User className="h-5 w-5" />,
    badge: "Ágil",
    color: "bg-emerald-500/10 text-emerald-600",
  },
];

export function SalaAgilRelatorios({
  sprints,
  developers,
  rawData,
  teamName,
  currentUserName,
}: SalaAgilRelatoriosProps) {
  const [active, setActive] = useState<string | null>(null);

  const commonProps = { sprints, developers, rawData, teamName, currentUserName, onBack: () => setActive(null) };

  if (active === "velocidade") return <RelatorioVelocidade {...commonProps} />;
  if (active === "burndown") return <RelatorioBurndown {...commonProps} />;
  if (active === "backlog") return <RelatorioBacklog {...commonProps} />;
  if (active === "retro") return <RelatorioRetro {...commonProps} />;
  if (active === "atividades") return <RelatorioAtividades {...commonProps} />;

  return (
    <ReportLayout>
      <ReportPageHeader
        title="Relatórios — Sala Ágil"
        description={`Time: ${teamName} · ${sprints.length} sprint(s) disponíveis`}
        badge="Ágil"
        badgeVariant="secondary"
      />
      <ReportCatalog
        items={CATALOG}
        onSelect={setActive}
        subtitle="Selecione um relatório para visualizar métricas detalhadas do time."
      />
    </ReportLayout>
  );
}
