/**
 * Navegação do módulo APF.
 * A baseline contratual é a fonte de verdade do motor de contagem.
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiPipelineProvider } from "../contexts/AiPipelineContext";
import { ApfHubTab } from "./shared/ApfHubTab";
import { ApfBaselineTab } from "./ApfBaselineTab";
import { ApfHuGenerateTab } from "./ApfHuGenerateTab";
import { ApfFunctionPointTab } from "./ApfFunctionPointTab";
import { ApfGenerateTab } from "./ApfGenerateTab";
import { ApfTemplatesTab } from "./ApfTemplatesTab";
import { ApfPredictiveTab } from "./ApfPredictiveTab";
import { ApfKnowledgeLibrary } from "./learning/ApfKnowledgeLibrary";
import {
  Bot,
  BookOpen,
  BrainCircuit,
  Cpu,
  Database,
  FileText,
  LayoutGrid,
  Sparkles,
} from "lucide-react";

const TABS = [
  { value: "hub", label: "Hub IA", icon: Bot, short: "Hub" },
  { value: "baseline", label: "Baseline", icon: Database, short: "Base" },
  { value: "hu", label: "Gerar HUs", icon: Sparkles, short: "HUs" },
  { value: "pf", label: "Contar PF", icon: Cpu, short: "PF" },
  { value: "generate", label: "Gerar Doc", icon: FileText, short: "Doc" },
  { value: "templates", label: "Templates", icon: LayoutGrid, short: "Templates" },
  { value: "predictive", label: "Previsão", icon: BrainCircuit, short: "Previsão" },
  { value: "biblioteca", label: "Biblioteca", icon: BookOpen, short: "Biblio" },
] as const;

export function ApfGeneratorPage() {
  return (
    <AiPipelineProvider>
      <div className="mx-auto flex max-w-screen-xl flex-col gap-4 p-4 md:p-6">
        <Tabs defaultValue="hub">
          <TabsList className="flex h-auto flex-wrap gap-1 p-1">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex h-8 items-center gap-1.5 px-3 text-xs"
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.short}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-4">
            <TabsContent value="hub" className="m-0"><ApfHubTab /></TabsContent>
            <TabsContent value="baseline" className="m-0"><ApfBaselineTab /></TabsContent>
            <TabsContent value="hu" className="m-0"><ApfHuGenerateTab /></TabsContent>
            <TabsContent value="pf" className="m-0"><ApfFunctionPointTab /></TabsContent>
            <TabsContent value="generate" className="m-0"><ApfGenerateTab /></TabsContent>
            <TabsContent value="templates" className="m-0"><ApfTemplatesTab /></TabsContent>
            <TabsContent value="predictive" className="m-0"><ApfPredictiveTab /></TabsContent>
            <TabsContent value="biblioteca" className="m-0"><ApfKnowledgeLibrary /></TabsContent>
          </div>
        </Tabs>
      </div>
    </AiPipelineProvider>
  );
}
