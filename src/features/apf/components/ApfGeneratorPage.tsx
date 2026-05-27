import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApfGenerateTab } from "./ApfGenerateTab";
import { ApfTemplatesTab } from "./ApfTemplatesTab";
import { ApfHuGenerateTab } from "./ApfHuGenerateTab";
import { FileText, FileCode, LayoutGrid } from "lucide-react";

export function ApfGeneratorPage() {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Relatório de Evidências</h1>
        <p className="text-muted-foreground text-sm">
          Gere documentação técnica e User Stories com auxílio de IA multi-provedor.
        </p>
      </div>

      <Tabs defaultValue="generate" className="w-full space-y-6">
        <TabsList className="bg-muted/50 p-1 h-12 w-full justify-start md:w-auto">
          <TabsTrigger value="generate" className="px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Gerar Relatório de Evidências</span>
            <span className="sm:hidden">Relatório</span>
          </TabsTrigger>
          <TabsTrigger value="hu" className="px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
            <FileCode className="h-4 w-4" />
            <span className="hidden sm:inline">Gerar HU (Markdown)</span>
            <span className="sm:hidden">HU</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Gerenciar Templates</span>
            <span className="sm:hidden">Templates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <ApfGenerateTab />
        </TabsContent>

        <TabsContent value="hu" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <ApfHuGenerateTab />
        </TabsContent>

        <TabsContent value="templates" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <ApfTemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
