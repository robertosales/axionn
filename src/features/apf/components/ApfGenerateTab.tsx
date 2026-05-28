import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText, Download, Eye, Loader2, History, Settings2, Sparkles,
  Upload, FileUp, X, CheckCircle2, AlertCircle, Trash2
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useApfGenerate } from "../hooks/useApfGenerate";
import { AIProviderSelector } from "./shared/AIProviderSelector";
import { downloadDocxFromMarkdown, downloadMarkdownAsFile } from "../utils/markdownToDocx";
import { useFileIngestion } from "../hooks/useFileIngestion";
import { FileDropzone } from "./hu-generation/FileDropzone";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MODULE_EVIDENCE_ID = "ab9d0077-f455-41b9-887c-edb1c256bdea";

function SingleFileUpload({
  label, icon, file, onFile, onRemove,
  accept = ".pdf,.docx,.doc,.xlsx,.xls,.txt,.md",
}: {
  label: string;
  icon: React.ReactNode;
  file: import("../hooks/useFileIngestion").IngestedFile | null;
  onFile: (f: File) => void;
  onRemove: () => void;
  accept?: string;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) onFile(e.target.files[0]);
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {icon}{label}
      </Label>
      {!file ? (
        <label className="flex flex-col items-center justify-center gap-2 h-16 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-all group">
          <Upload className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">Clique para selecionar</span>
          <input type="file" accept={accept} className="hidden" onChange={handleChange} />
        </label>
      ) : (
        <div className={cn(
          "flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-muted/30",
          file.status === "error" ? "border-destructive/40 bg-destructive/5" : "border-border"
        )}>
          <div className="flex items-center gap-2 min-w-0">
            {file.status === "processing" ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            ) : file.status === "error" ? (
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            )}
            <span className="text-xs font-medium truncate">{file.name}</span>
          </div>
          <button type="button" onClick={onRemove} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function ApfGenerateTab() {
  const huIngestion    = useFileIngestion();
  const baseIngestion  = useFileIngestion();
  const modelIngestion = useFileIngestion();

  const baseFile  = baseIngestion.files[0] ?? null;
  const modelFile = modelIngestion.files[0] ?? null;
  const huFilesOk = huIngestion.files.filter(f => f.status === "success");

  const {
    selectedTemplateId, setSelectedTemplateId,
    templates,
    aiProviders, selectedProviderId, setSelectedProviderId,
    apiKey, setApiKey,
    generating,
    progressStep,
    generations, loadingHistory,
    lastResult, showPreview, setShowPreview,
    providerCfg,
    generateGeneric,
  } = useApfGenerate(MODULE_EVIDENCE_ID);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const canGenerate =
    huFilesOk.length > 0 &&
    !!selectedTemplateId &&
    !!selectedProviderId &&
    !generating &&
    !huIngestion.isProcessing &&
    !(providerCfg.needsKey && !apiKey.trim());

  const handleGenerate = async () => {
    if (!canGenerate || !selectedTemplate) return;
    const parts: string[] = [];
    if (selectedTemplate.prompt_template) parts.push(selectedTemplate.prompt_template);
    const huConsolidado = huFilesOk
      .map(f => `## Origem: ${f.name}\n\n${f.content}`)
      .join("\n\n---\n\n");
    parts.push(`\n\n---\n### HUs do Projeto:\n${huConsolidado}`);
    if (baseFile?.status === "success")  parts.push(`\n\n---\n### Baseline / Refer\u00eancia:\n${baseFile.content}`);
    if (modelFile?.status === "success") parts.push(`\n\n---\n### Modelo de Evid\u00eancias (estrutura esperada):\n${modelFile.content}`);
    const prompt = parts.join("");
    const baseFilename = `Evidencias_${selectedTemplate.name}`.replace(/\s+/g, "_");
    try {
      await generateGeneric(prompt, baseFilename);
      toast.success("Relat\u00f3rio de evid\u00eancias gerado com sucesso!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar relat\u00f3rio");
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-600 border-amber-200" },
      success: { label: "Sucesso",  className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
      error:   { label: "Erro",     className: "bg-rose-500/10 text-rose-600 border-rose-200" },
    };
    const s = map[status] || { label: status, className: "" };
    return <Badge variant="outline" className={cn("text-[9px] uppercase font-bold px-1.5 h-4", s.className)}>{s.label}</Badge>;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileUp className="h-4 w-4 text-primary" />
                HUs do Projeto *
                {huIngestion.files.length > 0 && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                    {huIngestion.files.length} arquivo{huIngestion.files.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </CardTitle>
              {huIngestion.files.length > 0 && (
                <Button variant="ghost" size="sm" onClick={huIngestion.clearFiles}
                  className="h-7 text-[10px] font-semibold text-muted-foreground hover:text-destructive gap-1">
                  <Trash2 className="h-3 w-3" /> Limpar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <FileDropzone
              files={huIngestion.files}
              onFilesSelected={huIngestion.ingestFiles}
              onRemoveFile={huIngestion.removeFile}
              isProcessing={huIngestion.isProcessing}
            />
            {huIngestion.isProcessing && (
              <p className="text-[11px] text-primary flex items-center gap-1.5 mt-2 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                Processando: {huIngestion.currentProcessingFile}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Documentos de Refer\u00eancia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SingleFileUpload
              label="Baseline / Refer\u00eancia"
              icon={<FileText className="h-3.5 w-3.5" />}
              file={baseFile}
              onFile={(f) => baseIngestion.ingestFiles([f])}
              onRemove={() => baseIngestion.removeFile(baseFile!.name)}
            />
            <SingleFileUpload
              label="Modelo de Evid\u00eancias"
              icon={<FileText className="h-3.5 w-3.5" />}
              file={modelFile}
              onFile={(f) => modelIngestion.ingestFiles([f])}
              onRemove={() => modelIngestion.removeFile(modelFile!.name)}
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              Configura\u00e7\u00e3o da Gera\u00e7\u00e3o
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Template de Prompt *</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione o template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum template ativo para este m\u00f3dulo. Crie um em Gerenciar Templates.</div>
                  ) : (
                    templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
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

        <div className="flex flex-col items-center gap-2 pt-1">
          <Button
            size="lg"
            className="w-full h-11 font-bold gap-2 shadow-md shadow-primary/20"
            disabled={!canGenerate}
            onClick={handleGenerate}
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Gerar Relat\u00f3rio de Evid\u00eancias</>
            )}
          </Button>
          {!canGenerate && !generating && (
            <p className="text-[11px] text-muted-foreground text-center">
              {huIngestion.files.length === 0 ? "Fa\u00e7a upload de pelo menos uma HU para continuar" :
               huIngestion.isProcessing ? "Aguarde o processamento dos arquivos..." :
               !selectedTemplateId ? "Selecione um template de prompt" :
               providerCfg.needsKey && !apiKey.trim() ? "Informe sua API key do provedor selecionado" : ""}
            </p>
          )}
          {progressStep !== "idle" && (
            <p className="text-xs font-medium text-primary animate-pulse">
              {progressStep === "calling_ai" && "\uD83E\uDD16 IA processando os documentos..."}
              {progressStep === "saving" && "\uD83D\uDCBE Salvando resultado..."}
            </p>
          )}
        </div>

        {lastResult && (
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-900 dark:text-emerald-400">Documento Gerado!</p>
                  <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/60 font-medium">{lastResult.baseFilename}</p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none h-8 bg-background" onClick={() => setShowPreview(true)}>
                  <Eye className="h-3.5 w-3.5 mr-1.5" /> Visualizar
                </Button>
                <Button size="sm" className="flex-1 sm:flex-none h-8 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => downloadDocxFromMarkdown(lastResult.markdown, `${lastResult.baseFilename}.docx`)}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Word (.docx)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <Card className="shadow-sm h-full">
          <CardHeader className="pb-2 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Hist\u00f3rico de Gera\u00e7\u00f5es
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loadingHistory ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : (generations ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-2 opacity-40">
                <History className="h-7 w-7 text-muted-foreground" />
                <p className="text-xs">Nenhuma gera\u00e7\u00e3o ainda</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-2 pr-2">
                  {(generations ?? []).map((g) => (
                    <div key={g.id} className="rounded-lg border border-border bg-card p-2.5 hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-[11px] font-semibold line-clamp-1">{g.template_name}</p>
                        {statusBadge(g.status)}
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground uppercase font-semibold">
                        <span>{new Date(g.created_at).toLocaleDateString("pt-BR")}</span>
                        {g.pf_total != null && <span className="text-primary">\uD83D\uDCCA {g.pf_total} PF</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> Pr\u00e9-visualiza\u00e7\u00e3o</DialogTitle>
            <DialogDescription>Confira o conte\u00fado gerado antes de baixar.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 rounded-md border border-border bg-background p-6">
            <article className="prose prose-sm max-w-none dark:prose-invert prose-table:text-xs prose-table:border prose-th:bg-primary/10 prose-th:p-2 prose-td:p-2 prose-td:border">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{lastResult?.markdown || ""}</ReactMarkdown>
            </article>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowPreview(false)}>Fechar</Button>
            <Button variant="outline" onClick={() => lastResult && downloadMarkdownAsFile(lastResult.markdown, `${lastResult.baseFilename}.md`)}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Markdown (.md)
            </Button>
            <Button onClick={() => lastResult && downloadDocxFromMarkdown(lastResult.markdown, `${lastResult.baseFilename}.docx`)}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Word (.docx)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
