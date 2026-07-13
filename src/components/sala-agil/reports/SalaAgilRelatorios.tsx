import { useState, lazy, Suspense } from "react";
import { BarChart2, TrendingDown, LayoutList, ShieldAlert, User, FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportLayout, ReportCatalog, ReportPageHeader } from "@/shared/components/reports";
import type { CatalogItem } from "@/shared/components/reports";
import { RelatorioVelocidade } from "./RelatorioVelocidade";
import { RelatorioBurndown } from "./RelatorioBurndown";
import { RelatorioBacklog } from "./RelatorioBacklog";
import { RelatorioRetro } from "./RelatorioRetro";
import { RelatorioAtividades } from "./RelatorioAtividades";

const ApfGeneratorPage = lazy(() =>
  import("@/features/apf/components/ApfGeneratorPage").then((m) => ({ default: m.ApfGeneratorPage })),
);

interface SalaAgilRelatoriosProps {
  sprints: { id: string; name: string; isActive?: boolean }[];
  developers: { id: string; name: string; role: string; user_id?: string | null; email?: string | null }[];
  rawData: {
    sprints: any[];
    hus: any[];
    activities: any[];
    impediments: any[];
    developers: any[];
    developerRecords?: any[];
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
  {
    id: "evidencias",
    title: "Relatório de Evidências",
    description: "Gerador de evidências (APF) com HUs, anexos e exportações.",
    icon: <FileText className="h-5 w-5" />,
    badge: "Ágil",
    color: "bg-indigo-500/10 text-indigo-600",
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
  if (active === "evidencias") {
    return (
      <ReportLayout>
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setActive(null)}>
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Button>
        </div>
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success" />
            </div>
          }
        >
          <ApfGeneratorPage />
        </Suspense>
      </ReportLayout>
    );
  }

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
