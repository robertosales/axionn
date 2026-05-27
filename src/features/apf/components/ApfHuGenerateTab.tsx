import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "./hu-generation/FileDropzone";
import { AIProviderSelector } from "./shared/AIProviderSelector";
import { DataPayloadSummary } from "./hu-generation/DataPayloadSummary";
import { useFileIngestion } from "../hooks/useFileIngestion";
import { useApfGenerate } from "../hooks/useApfGenerate";
import { Loader2, Wand2, FileText, Download, Eye, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { downloadMarkdownAsFile } from "../utils/markdownToDocx";

export function ApfHuGenerateTab() {
  const {
    files,
    ingestFiles,
    removeFile,
    consolidatedMarkdown,
    estimatedTokens,
    totalCharacters,
    isProcessing: isIngesting
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

  // Determine context limit based on selected provider
  const selectedProvider = aiProviders.find(p => p.id === selectedProviderId);
  const contextLimit = selectedProvider?.provider_type === "gemini" ? 1000000 :
                       selectedProvider?.provider_type === "anthropic" ? 200000 : 128000;

  const canGenerate = files.length > 0 &&
                      !generating &&
                      !isIngesting &&
                      estimatedTokens <= contextLimit &&
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
      <div className="lg:col-span-2 space-y-6">
        <Card className="border-none shadow-md bg-gradient-to-br from-background to-muted/20">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Ingestão Multimídia
            </CardTitle>
            <CardDescription>
              Arraste documentos, planilhas ou PDFs. Convertemos tudo para Markdown automaticamente para a IA.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileDropzone
              files={files}
              onFilesSelected={ingestFiles}
              onRemoveFile={removeFile}
              isProcessing={isIngesting}
            />
          </CardContent>
        </Card>

        {files.length > 0 && (
          <DataPayloadSummary
            totalChars={totalCharacters}
            estimatedTokens={estimatedTokens}
            contextLimit={contextLimit}
          />
        )}
      </div>

      <div className="space-y-6">
        <AIProviderSelector
          providers={aiProviders}
          selectedProviderId={selectedProviderId}
          onProviderChange={setSelectedProviderId}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
        />

        <div className="space-y-3">
          <Button
            className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20"
            disabled={!canGenerate}
            onClick={handleGenerate}
          >
            {generating ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Processando...</>
            ) : (
              <><Wand2 className="h-5 w-5 mr-2" /> Gerar HU (Markdown)</>
            )}
          </Button>

          {!canGenerate && files.length > 0 && (
            <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 text-destructive text-[10px] font-medium">
              <AlertCircle className="h-3 w-3" />
              {providerCfg.needsKey && apiKey.trim().length < 10
                ? "Insira sua API Key para continuar"
                : estimatedTokens > contextLimit
                ? "Limite de contexto excedido"
                : "Aguarde o processamento dos arquivos"}
            </div>
          )}
        </div>

        {lastResult && (
          <Card className="border-primary/20 bg-primary/5 border-dashed">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3">
                <p className="text-[10px] font-bold text-center text-primary uppercase tracking-widest">
                  Resultado Pronto
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 h-9 bg-background" onClick={() => setShowPreview(true)}>
                    <Eye className="h-4 w-4 mr-2" /> Preview
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-9"
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
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Visualização das User Stories
            </DialogTitle>
            <DialogDescription>
              Confira o conteúdo gerado pela IA a partir dos documentos ingeridos.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 rounded-md border border-border bg-background p-6">
            <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-table:text-xs prose-table:border prose-table:border-border">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {lastResult?.markdown || ""}
              </ReactMarkdown>
            </article>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setShowPreview(false)}>Fechar</Button>
            <Button
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
