import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText, Upload, Download, Eye, Loader2, HelpCircle, X, ChevronRight, History, Settings2, Sparkles
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useApfGenerate } from "../hooks/useApfGenerate";
import { AIProviderSelector } from "./shared/AIProviderSelector";
import { downloadDocxFromMarkdown } from "../utils/markdownToDocx";
import { downloadMarkdownAsFile } from "../utils/markdownToDocx";
import { cn } from "@/lib/utils";

const YESNO_REGEX = /\(sim\/nao\)/gi;

export function ApfGenerateTab() {
  const {
    sprints,
    selectedSprintId, setSelectedSprintId,
    selectedTemplateId, setSelectedTemplateId,
    templates, selectedTemplate,
    aiProviders, selectedProviderId, setSelectedProviderId,
    apiKey, setApiKey,
    generating, canGenerate,
    progressStep,
    handleGenerateClick, runGeneration,
    generations, loadingHistory,
    lastResult, showPreview, setShowPreview,
    questions, answers, setAnswers,
    sqlFiles, setSqlFiles,
    showQuestions, setShowQuestions,
    allQuestionsAnswered,
  } = useApfGenerate();

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-600 border-amber-200" },
      success: { label: "Sucesso", className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
      error:   { label: "Erro", className: "bg-rose-500/10 text-rose-600 border-rose-200" },
    };
    const s = map[status] || { label: status, className: "" };
    return <Badge variant="outline" className={cn("text-[9px] uppercase font-bold px-1.5 h-4", s.className)}>{s.label}</Badge>;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
      <div className="xl:col-span-3 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                Configuração da Geração
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Sprint Alvo</Label>
                <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione a sprint" />
                  </SelectTrigger>
                  <SelectContent>
                    {(sprints ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Template de Prompt</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione o template" />
                  </SelectTrigger>
                  <SelectContent>
                    {(templates ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <AIProviderSelector
            providers={aiProviders}
            selectedProviderId={selectedProviderId}
            onProviderChange={setSelectedProviderId}
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
          />
        </div>

        <div className="flex flex-col items-center justify-center pt-4">
          <Button
            size="lg"
            className="w-full md:w-64 h-12 text-base font-bold shadow-xl shadow-primary/20 gap-2"
            disabled={!canGenerate || generating}
            onClick={handleGenerateClick}
          >
            {generating ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Gerando...</>
            ) : (
              <><Sparkles className="h-5 w-5" /> Iniciar Geração</>
            )}
          </Button>
          {progressStep !== "idle" && (
            <p className="mt-3 text-xs font-medium text-primary animate-pulse">
              {progressStep === "collecting" && "📑 Coletando HUs e dados da sprint..."}
              {progressStep === "calling_ai" && "🤖 IA processando o documento..."}
              {progressStep === "saving" && "💾 Salvando resultado..."}
            </p>
          )}
        </div>

        {lastResult && (
          <Card className="border-emerald-500/20 bg-emerald-500/5 overflow-hidden animate-in zoom-in-95 duration-300">
            <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-400">Documento Gerado!</h4>
                  <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/60 uppercase tracking-tight font-medium">
                    {lastResult.baseFilename}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Button variant="outline" size="sm" className="flex-1 md:flex-none h-9 bg-background" onClick={() => setShowPreview(true)}>
                  <Eye className="h-4 w-4 mr-2" /> Visualizar
                </Button>
                <Button size="sm" className="flex-1 md:flex-none h-9 bg-emerald-600 hover:bg-emerald-700" onClick={() => downloadDocxFromMarkdown(lastResult.markdown, `${lastResult.baseFilename}.docx`)}>
                  <Download className="h-4 w-4 mr-2" /> Word (.docx)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <Card className="border-none shadow-md h-full min-h-[400px]">
          <CardHeader className="pb-2 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Histórico da Sprint
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {!selectedSprintId ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-2 opacity-40">
                <History className="h-8 w-8 text-muted-foreground" />
                <p className="text-xs font-medium">Selecione uma sprint para ver o histórico</p>
              </div>
            ) : loadingHistory ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (generations ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-12">Nenhuma geração para esta sprint ainda</p>
            ) : (
              <ScrollArea className="h-[calc(100vh-450px)] min-h-[300px]">
                <div className="space-y-3 pr-3">
                  {(generations ?? []).map((g) => (
                    <div key={g.id} className="group rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-[11px] font-bold text-foreground line-clamp-1">{g.template_name}</p>
                        {statusBadge(g.status)}
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground uppercase font-semibold">
                        <span>{new Date(g.created_at).toLocaleDateString("pt-BR")}</span>
                        {g.pf_total != null && <span className="text-primary">📊 {g.pf_total} PF</span>}
                      </div>

                      {g.status === "success" && (
                        <div className="flex gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Preview" onClick={() => { /* set last result and show preview */ }}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Download Word">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showQuestions} onOpenChange={setShowQuestions}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><HelpCircle className="h-5 w-5 text-primary" /> Perguntas Adicionais</DialogTitle>
            <DialogDescription>Responda para refinar o contexto que será enviado à IA.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1">
            {(questions ?? []).map((q) => {
              const a = answers[q.id];
              if (q.kind === "yesno") {
                return (
                  <div key={q.id} className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <Label className="text-xs font-semibold leading-relaxed">{q.text.replace(YESNO_REGEX, "").replace(/\?$/, "?").trim()}</Label>
                    <RadioGroup value={a?.value ?? ""} onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: { value: v, detail: prev[q.id]?.detail ?? "" } }))} className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer p-1"><RadioGroupItem value="sim" id={`${q.id}-sim`} /><span className="text-sm">Sim</span></label>
                      <label className="flex items-center gap-2 cursor-pointer p-1"><RadioGroupItem value="nao" id={`${q.id}-nao`} /><span className="text-sm">Não</span></label>
                    </RadioGroup>
                    {a?.value === "sim" && (
                      <div className="space-y-1.5 pt-2 border-t border-border mt-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">{q.followUp ?? "Detalhes"} <span className="text-destructive">*</span></Label>
                        <Textarea rows={3} placeholder="Descreva aqui..." value={a.detail ?? ""}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: { value: "sim", detail: e.target.value } }))} className="bg-background text-xs" />
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <div key={q.id} className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <Label className="text-xs font-semibold">{q.text}</Label>
                  <Textarea rows={3} value={a?.value ?? ""} onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: { value: e.target.value } }))} className="bg-background text-xs" />
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowQuestions(false)} disabled={generating}>Cancelar</Button>
            <Button onClick={runGeneration} disabled={!allQuestionsAnswered || generating}>
              {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</> : "Confirmar e Gerar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" /> Pré-visualização</DialogTitle>
            <DialogDescription>Confira o conteúdo gerado antes de baixar.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 rounded-md border border-border bg-background p-6">
            <article className="prose prose-sm max-w-none dark:prose-invert prose-table:text-xs prose-table:border prose-th:bg-primary/10 prose-th:p-2 prose-td:p-2 prose-td:border">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{lastResult?.markdown || ""}</ReactMarkdown>
            </article>
          </div>
          <DialogFooter className="gap-2 sm:gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowPreview(false)}>Fechar</Button>
            <Button variant="outline" onClick={() => lastResult && downloadMarkdownAsFile(lastResult.markdown, `${lastResult.baseFilename}.md`)}>
              <Download className="h-4 w-4 mr-2" /> Markdown (.md)
            </Button>
            <Button onClick={() => lastResult && downloadDocxFromMarkdown(lastResult.markdown, `${lastResult.baseFilename}.docx`)}>
              <Download className="h-4 w-4 mr-2" /> Word (.docx)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
