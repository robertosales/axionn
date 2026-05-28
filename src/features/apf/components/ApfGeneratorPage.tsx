import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApfGenerateTab } from "./ApfGenerateTab";
import { ApfTemplatesTab } from "./ApfTemplatesTab";
import { ApfHuGenerateTab } from "./ApfHuGenerateTab";
import { FileText, FileCode, LayoutGrid, ShieldCheck, Sparkles } from "lucide-react";

export function ApfGeneratorPage() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-16 px-4 md:px-8">
      {/* Header Corporativo Moderno */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-8 mt-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1.5 bg-primary rounded-full" />
            <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground">
              Relatório de Evidências <span className="text-primary">Enterprise</span>
            </h1>
          </div>
          <p className="text-muted-foreground text-sm font-medium max-w-2xl leading-relaxed uppercase tracking-widest text-[10px] opacity-70">
            Módulo avançado de geração de documentação técnica, User Stories e gestão de templates com auxílio de IA Multi-Provedor.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-muted/30 p-3 rounded-2xl border border-border/50">
          <div className="flex -space-x-2">
            <div className="h-8 w-8 rounded-full border-2 border-background bg-blue-500 flex items-center justify-center text-[10px] font-black text-white">OA</div>
            <div className="h-8 w-8 rounded-full border-2 border-background bg-emerald-500 flex items-center justify-center text-[10px] font-black text-white">GM</div>
            <div className="h-8 w-8 rounded-full border-2 border-background bg-orange-500 flex items-center justify-center text-[10px] font-black text-white">CL</div>
          </div>
          <div className="text-left">
            <p className="text-[9px] font-black uppercase tracking-tighter leading-none">Hub Ativo</p>
            <p className="text-[11px] font-bold text-primary flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> multi-provedor
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="generate" className="w-full space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <TabsList className="bg-muted/50 p-1.5 h-14 w-full md:w-auto rounded-2xl border border-border/50 shadow-sm">
            <TabsTrigger
              value="generate"
              className="px-8 h-11 data-[state=active]:bg-background data-[state=active]:shadow-xl data-[state=active]:text-primary gap-3 rounded-xl font-black uppercase text-[10px] tracking-[0.1em] transition-all"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Relatório de Evidências</span>
              <span className="sm:hidden">Relatório</span>
            </TabsTrigger>
            <TabsTrigger
              value="hu"
              className="px-8 h-11 data-[state=active]:bg-background data-[state=active]:shadow-xl data-[state=active]:text-primary gap-3 rounded-xl font-black uppercase text-[10px] tracking-[0.1em] transition-all"
            >
              <FileCode className="h-4 w-4" />
              <span className="hidden sm:inline">Gerar HU (Markdown)</span>
              <span className="sm:hidden">HU</span>
              <Sparkles className="h-3 w-3 text-amber-500 animate-pulse" />
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="px-8 h-11 data-[state=active]:bg-background data-[state=active]:shadow-xl data-[state=active]:text-primary gap-3 rounded-xl font-black uppercase text-[10px] tracking-[0.1em] transition-all"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Gerenciar Templates</span>
              <span className="sm:hidden">Templates</span>
            </TabsTrigger>
          </TabsList>

          <div className="hidden lg:flex items-center gap-2 text-muted-foreground">
            <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-muted rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sistema Online
            </div>
          </div>
        </div>

        <div className="animate-in fade-in zoom-in-95 duration-500">
          <TabsContent value="generate" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <ApfGenerateTab />
          </TabsContent>

          <TabsContent value="hu" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <ApfHuGenerateTab />
          </TabsContent>

          <TabsContent value="templates" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <ApfTemplatesTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
