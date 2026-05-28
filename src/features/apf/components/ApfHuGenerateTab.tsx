import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "./hu-generation/FileDropzone";
import { AIProviderSelector } from "./shared/AIProviderSelector";
import { DataPayloadSummary } from "./hu-generation/DataPayloadSummary";
import { useFileIngestion } from "../hooks/useFileIngestion";
import { useApfGenerate } from "../hooks/useApfGenerate";
import {
  Loader2,
  Wand2,
  FileText,
  Download,
  Eye,
  AlertCircle,
  Sparkles,
  Cpu,
  CheckCircle2,
  Trash2,
  Maximize2
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { downloadMarkdownAsFile } from "../utils/markdownToDocx";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ApfHuGenerateTab() {
  const {
    files,
    ingestFiles,
    removeFile,
    clearFiles,
    consolidatedMarkdown,
    estimatedTokens,
    totalCharacters,
    totalBytes,
    isProcessing: isIngesting,
    currentProcessingFile
  } = useFileIngestion();

  const {
    aiProviders,
    selectedProviderId,
    setSelectedProviderId,
    apiKey,
    setApiKey,
    generating,
    generateGeneric,
    lastResult,
    showPreview,
    setShowPreview,
    providerCfg
  } = useApfGenerate();

  // Unified context limits matching AIProviderSelector.tsx
  const selectedProvider = aiProviders.find(p => p.id === selectedProviderId);
  const contextLimit = useMemo(() => {
    const pt = selectedProvider?.provider_type;
    if (pt === "gemini") return 1000000;
    if (pt === "anthropic") return 200000;
    if (pt === "lovable") return 32000; // Recommendation for standard processing
    if (pt === "manus" || pt === "openai") return 128000;
    return 32000;
  }, [selectedProvider]);

  const isExceeded = estimatedTokens > contextLimit;

  const canGenerate = files.length > 0 &&
                      !generating &&
                      !isIngesting &&
                      !isExceeded &&
                      (!providerCfg.needsKey || apiKey.trim().length >= 10);

  const handleGenerate = async () => {
    if (!canGenerate) return;

    const basePrompt = `Você é um Engenheiro de Requisitos experiente. Sua tarefa é analisar os documentos fornecidos e gerar User Stories (HUs) detalhadas no formato Markdown.

Siga estas diretrizes:
1. Use o formato: Como [persona], eu quero [objetivo], para que [valor de negócio].
2. Inclua Critérios de Aceitação claros para cada HU.
3. Se houver tabelas de dados (Excel), incorpore-as como referência de regras de negócio.
4. Mantenha o tom técnico e profissional.

---
DADOS DE ENTRADA (CONSOLIDADO):
${consolidatedMarkdown}`;

    try {
      await generateGeneric(basePrompt, `HU_Gerada_${Date.now()}`);
      toast.success("User Stories geradas com sucesso!");
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : "Falha na geração"));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Left Column: Input & Ingestion */}
      <div className="lg:col-span-8 space-y-6">
        <Card className="border-none shadow-xl bg-card overflow-hidden">
          <CardHeader className="bg-muted/30 pb-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-black flex items-center gap-3 tracking-tighter">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  GERADOR DE HU (MARKDOWN)
                </CardTitle>
                <CardDescription className="text-sm font-medium">
                  Engenharia de prompt avançada para extração de User Stories.
                </CardDescription>
              </div>
              {files.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFiles}
                  className="text-muted-foreground hover:text-destructive gap-2 font-bold uppercase text-[10px]"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpar Tudo
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-8 space-y-8">
            <div className="space-y-4">
              <LabelWithBadge
                label="Ingestão Multimídia Local"
                badge="JS Processor"
                icon={<Cpu className="h-3 w-3" />}
              />
              <FileDropzone
                files={files}
                onFilesSelected={ingestFiles}
                onRemoveFile={removeFile}
                isProcessing={isIngesting}
              />

              {isIngesting && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
                  <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-widest text-primary">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Processando: {currentProcessingFile}
                    </span>
                    <span>Aguarde...</span>
                  </div>
                  <Progress value={undefined} className="h-1.5" />
                </div>
              )}
            </div>

            {files.length > 0 && (
              <div className="pt-6 border-t border-border/50 space-y-6">
                <LabelWithBadge
                  label="Análise de Volume de Dados"
                  badge="Guardrail Ativo"
                  icon={<Maximize2 className="h-3 w-3" />}
                />
                <DataPayloadSummary
                  totalChars={totalCharacters}
                  estimatedTokens={estimatedTokens}
                  contextLimit={contextLimit}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: AI Hub & Controls */}
      <div className="lg:col-span-4 space-y-6">
        <AIProviderSelector
          providers={aiProviders}
          selectedProviderId={selectedProviderId}
          onProviderChange={setSelectedProviderId}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
        />

        <div className="space-y-4">
          <Button
            size="lg"
            className={cn(
              "w-full h-16 text-lg font-black uppercase tracking-tighter shadow-2xl transition-all duration-300",
              canGenerate ? "shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]" : "opacity-80 grayscale-[0.5]"
            )}
            disabled={!canGenerate}
            onClick={handleGenerate}
          >
            {generating ? (
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Processando...</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Wand2 className="h-6 w-6" />
                <span>Gerar User Stories</span>
              </div>
            )}
          </Button>

          {!canGenerate && files.length > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive animate-in shake duration-500">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-tight">Impedimento de Execução</p>
                <p className="text-[11px] font-medium leading-relaxed">
                  {isExceeded
                    ? "Volume de dados muito alto. Considere fragmentar seus arquivos ou mudar para uma IA de contexto longo (como Gemini/Claude)."
                    : providerCfg.needsKey && apiKey.trim().length < 10
                    ? "Insira sua API Key para continuar. Ela é salva apenas localmente nesta sessão."
                    : isIngesting
                    ? "Aguarde a finalização do processamento dos arquivos locais."
                    : "Carregue pelo menos um arquivo para iniciar a geração."}
                </p>
              </div>
            </div>
          )}
        </div>

        {lastResult && (
          <Card className="border-primary/20 bg-primary/5 border-dashed overflow-hidden animate-in zoom-in-95 duration-500">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 justify-center">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                    Geração Concluída
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="h-10 bg-background font-bold uppercase text-[10px]" onClick={() => setShowPreview(true)}>
                    <Eye className="h-4 w-4 mr-2" /> Preview
                  </Button>
                  <Button
                    size="sm"
                    className="h-10 font-bold uppercase text-[10px]"
                    onClick={() => downloadMarkdownAsFile(lastResult.markdown, `${lastResult.baseFilename}.md`)}
                  >
                    <Download className="h-4 w-4 mr-2" /> Baixar .md
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-muted/30 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-tight uppercase">
                  <Eye className="h-6 w-6 text-primary" />
                  User Stories Geradas
                </DialogTitle>
                <DialogDescription className="font-medium">
                  Confira e refine o conteúdo antes do download final.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 bg-background p-8">
            <article className="prose prose-sm md:prose-base max-w-none dark:prose-invert
              prose-headings:font-black prose-headings:tracking-tight prose-headings:uppercase
              prose-h1:text-2xl prose-h2:text-xl prose-table:text-[11px] prose-table:border prose-table:border-border
              prose-th:bg-muted prose-th:p-3 prose-td:p-3 prose-td:border-border">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {lastResult?.markdown || ""}
              </ReactMarkdown>
            </article>
          </div>

          <DialogFooter className="p-6 bg-muted/30 border-t border-border/50 gap-3 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPreview(false)} className="font-bold uppercase text-xs px-8 h-11">
              Fechar
            </Button>
            <Button
              className="font-bold uppercase text-xs px-8 h-11 shadow-lg shadow-primary/20"
              onClick={() => lastResult && downloadMarkdownAsFile(lastResult.markdown, `${lastResult.baseFilename}.md`)}
            >
              <Download className="h-4 w-4 mr-2" /> Baixar Markdown (.md)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LabelWithBadge({ label, badge, icon }: { label: string; badge: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-2">
        {label}
      </Label>
      <Badge variant="outline" className="text-[9px] font-black uppercase bg-muted/50 border-border/50 gap-1.5 px-2 py-0.5">
        {icon}
        {badge}
      </Badge>
    </div>
  );
}
