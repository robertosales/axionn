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
  { value: "generate", label: "Dossiês APF", icon: FileText, short: "Dossiês" },
  {
    value: "templates",
    label: "Templates",
    icon: LayoutGrid,
    short: "Templates",
  },
  {
    value: "predictive",
    label: "Previsão",
    icon: BrainCircuit,
    short: "Previsão",
  },
  { value: "biblioteca", label: "Biblioteca", icon: BookOpen, short: "Biblio" },
] as const;

export function ApfGeneratorPage() {
  return (
    <AiPipelineProvider>
      <div className="mx-auto flex max-w-screen-xl flex-col gap-5 p-4 md:p-6">
        <header className="border-b border-border/70 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              APF
            </span>
            <span className="text-xs text-muted-foreground">Operações</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Medição &amp; Evidências
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Contabilize pontos de função, gerencie evidências e gere os
            artefatos necessários para formalizar as entregas.
          </p>
        </header>
        <Tabs defaultValue="hub">
          <TabsList aria-label="Navegação de Medição e Evidências" className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border/70 bg-muted/60 p-1">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="min-h-10 shrink-0 gap-1.5 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.short}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-4">
            <TabsContent value="hub" className="m-0">
              <ApfHubTab />
            </TabsContent>
            <TabsContent value="baseline" className="m-0">
              <ApfBaselineTab />
            </TabsContent>
            <TabsContent value="hu" className="m-0">
              <ApfHuGenerateTab />
            </TabsContent>
            <TabsContent value="pf" className="m-0">
              <ApfFunctionPointTab />
            </TabsContent>
            <TabsContent value="generate" className="m-0">
              <ApfGenerateTab />
            </TabsContent>
            <TabsContent value="templates" className="m-0">
              <ApfTemplatesTab />
            </TabsContent>
            <TabsContent value="predictive" className="m-0">
              <ApfPredictiveTab />
            </TabsContent>
            <TabsContent value="biblioteca" className="m-0">
              <ApfKnowledgeLibrary />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AiPipelineProvider>
  );
}
