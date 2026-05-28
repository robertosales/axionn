import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDropzone } from "./hu-generation/FileDropzone";
import { AIProviderSelector } from "./shared/AIProviderSelector";
import { DataPayloadSummary } from "./hu-generation/DataPayloadSummary";
import { useFileIngestion } from "../hooks/useFileIngestion";
import { useApfGenerate } from "../hooks/useApfGenerate";
import {
  Loader2, Wand2, FileText, Download, Eye,
  AlertCircle, Settings2, Trash2, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { downloadMarkdownAsFile } from "../utils/markdownToDocx";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const MODULE_HU_ID = "9b8a28da-3de0-4af8-b2bb-a2e22df4ea9b";

export function ApfHuGenerateTab() {
  const {
    files,
    ingestFiles,
    removeFile,
    clearFiles,
    consolidatedMarkdown,
    estimatedTokens,
    isProcessing: isIngesting,
    currentProcessingFile,
  } = useFileIngestion();

  const {
    templates,
    selectedTemplateId, setSelectedTemplateId,
    aiProviders,
    selectedProviderId, setSelectedProviderId,
    apiKey, setApiKey,
    generating,
    generateGeneric,
    lastResult,
    showPreview, setShowPreview,
    providerCfg,
  } = useApfGenerate(MODULE_HU_ID);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const selectedProvider = aiProviders.find((p) => p.id === selectedProviderId);
  const contextLimit = useMemo(() => {
    const pt = selectedProvider?.provider_type;
    if (pt === "gemini")    return 1_000_000;
    if (pt === "anthropic") return 200_000;
    if (pt === "lovable")   return 32_000;
    if (pt === "manus" || pt === "openai") return 128_000;
    return 32_000;
  }, [selectedProvider]);

  const isExceeded = estimatedTokens > contextLimit;

  const canGenerate =
    files.length > 0 &&
    !!selectedTemplateId &&
    !generating &&
    !isIngesting &&
    !isExceeded &&
    !(providerCfg.needsKey && apiKey.trim().length < 10);

  const handleGenerate = async () => {
    if (!canGenerate || !selectedTemplate) return;
    const prompt = `${selectedTemplate.prompt_template}\n\n---\nDADOS DE ENTRADA (CONSOLIDADO):\n${consolidatedMarkdown}`;
    const baseFilename = `HU_${selectedTemplate.name}_${Date.now()}`.replace(/\s+/g, "_");
    try {
      await generateGeneric(prompt, baseFilename);
      toast.success("User Stories geradas com sucesso!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha na geração");
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Arquivos de Entrada
              </CardTitle>
              {files.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFiles}
                  className="h-7 text-[10px] font-semibold text-muted-foreground hover:text-destructive gap-1">
                  <Trash2 className="h-3 w-3" /> Limpar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileDropzone
              files={files}
              onFilesSelected={ingestFiles}
              onRemoveFile={removeFile}
              isProcessing={isIngesting}
            />
            {isIngesting && (
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] font-medium text-primary">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processando: {currentProcessingFile}
                  </span>
                  <span>Aguarde...</span>
                </div>
                <Progress value={undefined} className="h-1" />
              </div>
            )}
            {files.length > 0 && (
              <DataPayloadSummary
                totalChars={consolidatedMarkdown.length}
                estimatedTokens={estimatedTokens}
                contextLimit={contextLimit}
              />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              Configuração da Geração
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Template de Prompt *
              </Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione o template de prompt" />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                      Nenhum template ativo para este módulo. Crie um em Gerenciar Templates.
                    </div>
                  ) : (
                    templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedTemplate && (
                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                  {selectedTemplate.description || selectedTemplate.prompt_template?.slice(0, 120) + "..."}
                </p>
              )}
            </div>
            <AIProviderSelector
              providers={aiProviders}
              selectedProviderId={selectedProviderId}
              onProviderChange={setSelectedProviderId}
              apiKey={apiKey}
              onApiKeyChange={setApiKey}
            />
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Button
            size="lg"
            className={cn(
              "w-full h-11 font-bold gap-2 shadow-md transition-all",
              canGenerate ? "shadow-primary/20" : ""
            )}
            disabled={!canGenerate}
            onClick={handleGenerate}
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
            ) : (
              <><Wand2 className="h-4 w-4" /> Gerar User Stories</>
            )}
          </Button>

          {!canGenerate && files.length > 0 && !generating && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-xs font-medium">
                {isExceeded
                  ? "Volume de dados muito alto. Fragmente os arquivos ou use um provedor de contexto maior (Gemini/Claude)."
                  : !selectedTemplateId
                  ? "Selecione um template de prompt para continuar."
                  : providerCfg.needsKey && apiKey.trim().length < 10
                  ? "Informe sua API Key para continuar."
                  : isIngesting
                  ? "Aguarde o processamento dos arquivos."
                  : ""}
              </p>
            </div>
          )}
        </div>

        {lastResult && (
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-900 dark:text-emerald-400">Geração Concluída!</p>
                  <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/60 font-medium">{lastResult.baseFilename}</p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none h-8 bg-background"
                  onClick={() => setShowPreview(true)}>
                  <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
                </Button>
                <Button size="sm" className="flex-1 sm:flex-none h-8"
                  onClick={() => downloadMarkdownAsFile(lastResult.markdown, `${lastResult.baseFilename}.md`)}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Baixar .md
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Como usar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { step: "1", title: "Faça o upload", desc: "Carregue PDF, DOCX, Excel ou Markdown com os dados que servirão de base para as HUs." },
              { step: "2", title: "Escolha o template", desc: "Selecione o template de prompt cadastrado em Gerenciar Templates. O prompt define o estilo das HUs geradas." },
              { step: "3", title: "Selecione a IA", desc: "Escolha o provedor de IA. Para grandes volumes de dados, prefira Gemini (1M tokens)." },
              { step: "4", title: "Gere e baixe", desc: "Clique em Gerar e baixe o resultado em Markdown para usar em qualquer ferramenta." },
            ].map((item) => (
              <div key={item.step} className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {item.step}
                </div>
                <div>
                  <p className="text-xs font-semibold">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {files.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Arquivos carregados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {files.map((f) => (
                <div key={f.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-foreground font-medium">{f.name}</span>
                  {f.status === "processing" ? (
                    <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                  ) : f.status === "error" ? (
                    <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" /> User Stories Geradas
            </DialogTitle>
            <DialogDescription>Confira e refine o conteúdo antes do download.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 rounded-md border border-border bg-background p-6">
            <article className="prose prose-sm max-w-none dark:prose-invert prose-table:text-xs prose-table:border prose-th:bg-primary/10 prose-th:p-2 prose-td:p-2 prose-td:border">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{lastResult?.markdown || ""}</ReactMarkdown>
            </article>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowPreview(false)}>Fechar</Button>
            <Button onClick={() => lastResult && downloadMarkdownAsFile(lastResult.markdown, `${lastResult.baseFilename}.md`)}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Baixar Markdown (.md)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
