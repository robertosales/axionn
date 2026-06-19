/**
 * ApfGeneratorPage (v3 — Fase 5)
 * ---------------------------------
 * Adiciona a aba "Previsão" (APF Preditivo) ao layout de navegação.
 * Mantém todas as abas anteriores intactas.
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiPipelineProvider }   from "../contexts/AiPipelineContext";
import { ApfHubTab }           from "./shared/ApfHubTab";
import { ApfHuGenerateTab }     from "./ApfHuGenerateTab";
import { ApfFunctionPointTab }  from "./ApfFunctionPointTab";
import { ApfGenerateTab }       from "./ApfGenerateTab";
import { ApfTemplatesTab }      from "./ApfTemplatesTab";
import { ApfPredictiveTab }     from "./ApfPredictiveTab";
import {
  Cpu, Sparkles, FileText, LayoutGrid, BrainCircuit, Bot
} from "lucide-react";

const TABS = [
  { value: "hub",        label: "Hub IA",     icon: Bot,          short: "Hub"       },
  { value: "hu",         label: "Gerar HUs",  icon: Sparkles,     short: "HUs"       },
  { value: "pf",         label: "Contar PF",  icon: Cpu,          short: "PF"        },
  { value: "generate",   label: "Gerar Doc",  icon: FileText,     short: "Doc"       },
  { value: "templates",  label: "Templates",  icon: LayoutGrid,   short: "Templates" },
  { value: "predictive", label: "Previsão",   icon: BrainCircuit, short: "Previsão"  },
] as const;

export function ApfGeneratorPage() {
  return (
    <AiPipelineProvider>
      <div className="flex flex-col gap-4 p-4 md:p-6 max-w-screen-xl mx-auto">
        <Tabs defaultValue="hub">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="flex items-center gap-1.5 text-xs h-8 px-3"
              >
                <t.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.short}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-4">
            <TabsContent value="hub"       className="m-0"><ApfHubTab /></TabsContent>
            <TabsContent value="hu"        className="m-0"><ApfHuGenerateTab /></TabsContent>
            <TabsContent value="pf"        className="m-0"><ApfFunctionPointTab /></TabsContent>
            <TabsContent value="generate"  className="m-0"><ApfGenerateTab /></TabsContent>
            <TabsContent value="templates" className="m-0"><ApfTemplatesTab /></TabsContent>
            <TabsContent value="predictive" className="m-0"><ApfPredictiveTab /></TabsContent>
          </div>
        </Tabs>
      </div>
    </AiPipelineProvider>
  );
}
