/**
 * ApfGeneratorPage (v2 — Fase 2)
 * --------------------------------
 * Adiciona PipelineStatusBar entre o seletor de provedor e as abas.
 * Tudo mais permanece igual à Fase 1.
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApfGenerateTab }      from "./ApfGenerateTab";
import { ApfTemplatesTab }     from "./ApfTemplatesTab";
import { ApfHuGenerateTab }    from "./ApfHuGenerateTab";
import { ApfFunctionPointTab } from "./ApfFunctionPointTab";
import { AiPipelineProvider }  from "../contexts/AiPipelineContext";
import { AiProviderSelector }  from "./shared/AiProviderSelector";
import { PipelineStatusBar }   from "./shared/PipelineStatusBar";
import {
  FileText, FileCode, LayoutGrid,
  ShieldCheck, Sparkles, Calculator,
} from "lucide-react";

export function ApfGeneratorPage() {
  return (
    <AiPipelineProvider>
      <div className="flex flex-col gap-5 px-4 sm:px-6 py-6 w-full overflow-x-hidden max-w-[1600px] mx-auto pb-16">

        {/* Page Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-1 bg-primary rounded-full shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg font-bold flex items-center gap-2 truncate">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <span className="truncate">
                  Relatório de Evidências{" "}
                  <span className="text-primary">Enterprise</span>
                </span>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                Módulo avançado de geração de documentação técnica, User Stories e gestão de templates com auxílio de IA Multi-Provedor.
              </p>
            </div>
          </div>

          {/* Hub badge */}
          <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2 shrink-0">
            <div className="flex -space-x-2">
              <div className="h-7 w-7 rounded-full border-2 border-background bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white">OA</div>
              <div className="h-7 w-7 rounded-full border-2 border-background bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-white">GM</div>
              <div className="h-7 w-7 rounded-full border-2 border-background bg-orange-500 flex items-center justify-center text-[10px] font-bold text-white">CL</div>
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-foreground leading-none">Hub Ativo</p>
              <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                <ShieldCheck className="h-3 w-3" /> multi-provedor
              </p>
            </div>
          </div>
        </div>

        {/* Seletor de provedor global */}
        <div className="flex items-center gap-4 bg-muted/40 border border-border rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium">IA ativa em todas as abas:</span>
          </div>
          <AiProviderSelector compact />
        </div>

        {/* Barra de status do pipeline HU → PF → Evidência */}
        <PipelineStatusBar />

        {/* Tabs */}
        <Tabs defaultValue="generate" className="w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
            <TabsList className="h-10 w-full md:w-auto">
              <TabsTrigger value="generate" className="gap-2 text-sm">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Relatório de Evidências</span>
                <span className="sm:hidden">Relatório</span>
              </TabsTrigger>
              <TabsTrigger value="hu" className="gap-2 text-sm">
                <FileCode className="h-4 w-4" />
                <span className="hidden sm:inline">Gerar HU (Markdown)</span>
                <span className="sm:hidden">HU</span>
                <Sparkles className="h-3 w-3 text-amber-500" />
              </TabsTrigger>
              <TabsTrigger value="function-points" className="gap-2 text-sm">
                <Calculator className="h-4 w-4" />
                <span className="hidden sm:inline">Contagem por Sprint</span>
                <span className="sm:hidden">APF</span>
                <Sparkles className="h-3 w-3 text-primary" />
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2 text-sm">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Gerenciar Templates</span>
                <span className="sm:hidden">Templates</span>
              </TabsTrigger>
            </TabsList>
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Sistema Online
            </div>
          </div>

          <TabsContent value="generate" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <ApfGenerateTab />
          </TabsContent>
          <TabsContent value="hu" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <ApfHuGenerateTab />
          </TabsContent>
          <TabsContent value="function-points" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <ApfFunctionPointTab />
          </TabsContent>
          <TabsContent value="templates" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <ApfTemplatesTab />
          </TabsContent>
        </Tabs>
      </div>
    </AiPipelineProvider>
  );
}
