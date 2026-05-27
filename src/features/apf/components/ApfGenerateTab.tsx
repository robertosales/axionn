import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileSpreadsheet, FileText, File, Upload, X, Download, Loader2,
  Sparkles, KeyRound, HelpCircle, Eye, CheckCircle2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useApfGenerate,
  YESNO_REGEX,
  PROGRESS_LABELS,
  type OutputFormat,
} from "../hooks/useApfGenerate";
import { markdownToDocxBlob, triggerDownload, downloadMarkdownAsFile } from "../utils/markdownToDocx";

interface FileField {
  label: string;
  description: string;
  accept: string;
  icon: React.ElementType;
}

const BASELINE_FIELD: FileField = { label: "Baseline (opcional)", description: "Planilha xlsx com Item/Tipo — convertida em Markdown localmente", accept: ".xlsx,.xls", icon: FileSpreadsheet };

async function downloadDocxFromMarkdown(markdown: string, filename: string) {
  const blob = await markdownToDocxBlob(markdown);
  triggerDownload(blob, filename);
}

function FileUploadField({ field, file, onSelect, onRemove }: {
  field: FileField; file: File | null;
  onSelect: (f: File) => void; onRemove: () => void;
}) {
  const Icon = field.icon;
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onSelect(f); };
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{field.label}</Label>
      {file ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-foreground truncate flex-1">{file.name}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}><X className="h-3.5 w-3.5" /></Button>
        </div>
      ) : (
        <label
          className="flex flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer py-4"
          onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{field.description}</span>
          <span className="text-[10px] text-muted-foreground/60">{field.accept}</span>
          <input type="file" accept={field.accept} className="hidden" onChange={(e) => e.target.files?.[0] && onSelect(e.target.files[0])} />
        </label>
      )}
    </div>
  );
}

const STEPS = [
  { step: "reading_files", label: "Lendo arquivos" },
  { step: "calling_ai",    label: "Gerando com IA" },
  { step: "saving",        label: "Salvando" },
];

function ProgressSteps({ currentStep }: { currentStep: string }) {
  const currentIdx = STEPS.findIndex((s) => s.step === currentStep);
  return (
    <div className="flex items-center justify-center gap-3 py-2">
      {STEPS.map((s, i) => {
        const done   = currentIdx > i;
        const active = currentIdx === i;
        return (
          <div key={s.step} className="flex items-center gap-1.5">
            {i > 0 && <div className={`h-px w-6 ${done ? "bg-primary" : "bg-border"}`} />}
            <div className={`flex items-center gap-1.5 text-[11px] font-medium ${
              active ? "text-primary" : done ? "text-primary/60" : "text-muted-foreground/40"
            }`}>
              {done
                ? <CheckCircle2 className="h-3.5 w-3.5 text-primary/60" />
                : active
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <div className="h-3.5 w-3.5 rounded-full border border-current" />}
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ApfGenerateTab() {
  const {
    sprints,
    selectedSprintId, setSelectedSprintId,
    selectedTemplateId, setSelectedTemplateId,
    templates, selectedTemplate,
    baselineFile, setBaselineFile,
    providerCfg,
    aiProviders, selectedProviderId, setSelectedProviderId,
    apiKey, setApiKey,
    outputFormat, setOutputFormat,
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
    switch (status) {
      case "success": return <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-[10px]">Concluído</Badge>;
      case "error":   return <Badge variant="destructive" className="text-[10px]">Erro</Badge>;
      default:        return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30 text-[10px]">Processando</Badge>;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-5">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Seleção</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Sprint <span className="text-destructive">*</span></Label>
              <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma sprint" /></SelectTrigger>
                <SelectContent>{sprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Template <span className="text-destructive">*</span></Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedTemplate && (
              <div className="rounded-md bg-muted/50 border border-border p-3 max-h-[150px] overflow-y-auto">
                <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-words">
                  {selectedTemplate.prompt_content}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Provedor de IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Escolha qual IA gerará o documento <span className="text-destructive">*</span></Label>
              <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                <SelectTrigger>
                  <SelectValue placeholder={aiProviders.length === 0 ? "Nenhuma IA cadastrada — configure no painel admin" : "Selecione uma IA"} />
                </SelectTrigger>
                <SelectContent>
                  {aiProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {aiProviders.length === 0 && (
                <p className="text-[11px] text-destructive">
                  Nenhum provedor de IA ativo. Peça ao administrador para cadastrar em <strong>Admin → IAs</strong>.
                </p>
              )}
            </div>
            {providerCfg.needsKey ? (
              <div className="space-y-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <Label className="text-xs flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" /> Sua API Key <span className="text-destructive">*</span>
                </Label>
                <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={providerCfg.placeholder} autoComplete="off" />
                <p className="text-[11px] text-muted-foreground">
                  Esta IA ainda não tem chave cadastrada. A chave informada será usada apenas nesta requisição e <strong>não será armazenada</strong>.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">✅ Provedor pronto para uso — sem necessidade de informar chave.</p>
            )}
            <div className="space-y-1.5 pt-2 border-t border-border/60">
              <Label className="text-xs">Formato de saída <span className="text-destructive">*</span></Label>
              <RadioGroup value={outputFormat} onValueChange={(v) => setOutputFormat(v as OutputFormat)} className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="docx" id="fmt-docx" />
                  <span className="text-sm flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Word (.docx)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="markdown" id="fmt-md" />
                  <span className="text-sm flex items-center gap-1.5"><File className="h-3.5 w-3.5" /> Markdown (.md)</span>
                </label>
              </RadioGroup>
              <p className="text-[11px] text-muted-foreground">Você poderá visualizar antes de baixar e escolher qualquer formato no preview.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Arquivos de Entrada</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FileUploadField field={BASELINE_FIELD} file={baselineFile} onSelect={setBaselineFile} onRemove={() => setBaselineFile(null)} />
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {HU_FIELD.label} <span className="text-muted-foreground">({huFiles.length} anexada{huFiles.length === 1 ? "" : "s"})</span>
              </Label>
              {huFiles.length > 0 && (
                <div className="space-y-1.5">
                  {huFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs text-foreground truncate flex-1">{f.name}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setHuFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <label
                className="flex flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer py-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const dropped = Array.from(e.dataTransfer.files); if (dropped.length) setHuFiles((prev) => [...prev, ...dropped]); }}
              >
                {huFiles.length === 0
                  ? <><Upload className="h-5 w-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">{HU_FIELD.description}</span></>
                  : <><Plus className="h-5 w-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Adicionar mais HUs</span></>}
                <span className="text-[10px] text-muted-foreground/60">{HU_FIELD.accept}</span>
                <input type="file" multiple accept={HU_FIELD.accept} className="hidden"
                  onChange={(e) => { const selected = Array.from(e.target.files ?? []); if (selected.length) setHuFiles((prev) => [...prev, ...selected]); e.target.value = ""; }}
                />
              </label>
            </div>
            <FileUploadField field={MODEL_FIELD} file={modelFile} onSelect={setModelFile} onRemove={() => setModelFile(null)} />
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Button className="w-full" size="lg" disabled={!canGenerate || generating} onClick={handleGenerateClick}>
            {generating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {PROGRESS_LABELS[progressStep] || "Gerando com IA..."}</>
            ) : questions.length > 0 && !allQuestionsAnswered ? (
              <><HelpCircle className="h-4 w-4 mr-2" /> Responder {questions.length} pergunta{questions.length > 1 ? "s" : ""} e gerar</>
            ) : (
              <><Eye className="h-4 w-4 mr-2" /> Gerar e visualizar documento</>
            )}
          </Button>
          {generating && progressStep !== "idle" && (
            <ProgressSteps currentStep={progressStep} />
          )}
          {questions.length > 0 && (
            <p className="text-[11px] text-muted-foreground px-1">
              ⓘ Este template contém {questions.length} pergunta{questions.length > 1 ? "s" : ""} interativa{questions.length > 1 ? "s" : ""} que você precisa responder antes da geração.
            </p>
          )}
        </div>
      </div>

      <div className="lg:col-span-2">
        <Card className="h-full">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Histórico desta Sprint</CardTitle></CardHeader>
          <CardContent>
            {!selectedSprintId ? (
              <p className="text-xs text-muted-foreground text-center py-8">Selecione uma sprint para ver o histórico</p>
            ) : loadingHistory ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            ) : generations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Nenhuma geração para esta sprint ainda</p>
            ) : (
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-3">
                  {generations.map((g) => (
                    <div key={g.id} className="rounded-md border border-border p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-foreground">{g.template_name}</p>
                        {statusBadge(g.status)}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(g.created_at).toLocaleString("pt-BR")}
                      </p>
                      {g.pf_total != null && (
                        <p className="text-[10px] font-semibold text-primary">📊 PF Total: {g.pf_total}</p>
                      )}
                      {g.status === "success" && lastResult && g.output_filename?.startsWith(lastResult.baseFilename) && (
                        <div className="flex gap-1.5 mt-1">
                          <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => setShowPreview(true)}>
                            <Eye className="h-3 w-3 mr-1" /> Visualizar
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs flex-1"
                            onClick={() => lastResult && downloadDocxFromBase64(lastResult.base64, `${lastResult.baseFilename}.docx`)}>
                            <Download className="h-3 w-3 mr-1" /> DOCX
                          </Button>
                        </div>
                      )}
                      {g.status === "error" && g.error_message && (
                        <p className="text-[10px] text-destructive">{g.error_message}</p>
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
            <DialogTitle className="flex items-center gap-2"><HelpCircle className="h-5 w-5 text-primary" /> Responda antes de gerar</DialogTitle>
            <DialogDescription>O template selecionado contém perguntas. Suas respostas serão enviadas à IA — as perguntas <strong>não</strong> aparecerão no arquivo final.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1">
            {questions.map((q) => {
              const a = answers[q.id];
              if (q.kind === "yesno") {
                return (
                  <div key={q.id} className="space-y-2">
                    <Label className="text-xs font-medium leading-relaxed">{q.text.replace(YESNO_REGEX, "").replace(/\?$/, "?").trim()}</Label>
                    <RadioGroup value={a?.value ?? ""} onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: { value: v, detail: prev[q.id]?.detail ?? "" } }))} className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="sim" id={`${q.id}-sim`} /><span className="text-sm">Sim</span></label>
                      <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="nao" id={`${q.id}-nao`} /><span className="text-sm">Não</span></label>
                    </RadioGroup>
                    {a?.value === "sim" && (
                      <div className="space-y-1.5 pt-1 border-l-2 border-primary/40 pl-3">
                        <Label className="text-[11px] text-muted-foreground">{q.followUp ?? "Descreva os detalhes"} <span className="text-destructive">*</span></Label>
                        <Textarea rows={3} placeholder="Informe aqui o que foi alterado..." value={a.detail ?? ""}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: { value: "sim", detail: e.target.value } }))} />
                        {q.allowSqlFiles && (
                          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                            <Label className="text-[11px] font-medium">Scripts SQL Server</Label>
                            {sqlFiles.length > 0 && (
                              <div className="space-y-1">
                                {sqlFiles.map((file, idx) => (
                                  <div key={`${file.name}-${idx}`} className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="min-w-0 flex-1 truncate text-[11px]">{file.name}</span>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSqlFiles((prev) => prev.filter((_, i) => i !== idx))}>
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground hover:border-primary/50">
                              <Upload className="h-3.5 w-3.5" /> Anexar .sql ou .txt
                              <input type="file" multiple accept=".sql,.txt" className="hidden" onChange={(e) => { const selected = Array.from(e.target.files ?? []); if (selected.length) setSqlFiles((prev) => [...prev, ...selected]); e.target.value = ""; }} />
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <div key={q.id} className="space-y-1.5">
                  <Label className="text-xs font-medium">{q.text}</Label>
                  <Textarea rows={3} value={a?.value ?? ""} onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: { value: e.target.value } }))} />
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowQuestions(false)} disabled={generating}>Cancelar</Button>
            <Button onClick={runGeneration} disabled={!allQuestionsAnswered || generating}>
              {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</> : "Confirmar e gerar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" /> Pré-visualização do documento</DialogTitle>
            <DialogDescription>Confira o conteúdo gerado pela IA antes de baixar. Você pode escolher o formato de download abaixo.</DialogDescription>
          </DialogHeader>
          {lastResult?.pfTotal != null && (
            <div className="rounded-md bg-primary/5 border border-primary/20 px-4 py-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-primary">📊 PF Total extraído: {lastResult.pfTotal}</span>
              <span className="text-[10px] text-muted-foreground">(disponivel no Planning Poker)</span>
            </div>
          )}
          <div className="rounded-md border border-border bg-background p-5 max-h-[55vh] overflow-y-auto">
            {lastResult?.markdown ? (
              <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-xl prose-h1:mt-4 prose-h1:mb-3 prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-base prose-p:text-sm prose-p:leading-relaxed prose-li:text-sm prose-table:text-xs prose-table:border prose-table:border-border prose-th:bg-[#1F4E78] prose-th:text-white prose-th:p-2 prose-th:text-left prose-th:font-semibold prose-td:p-2 prose-td:border prose-td:border-border">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{lastResult.markdown}</ReactMarkdown>
              </article>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum conteúdo para exibir.</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowPreview(false)}>Fechar</Button>
            <Button variant="outline" disabled={!lastResult} onClick={() => lastResult && downloadMarkdown(lastResult.markdown, `${lastResult.baseFilename}.md`)}>
              <Download className="h-4 w-4 mr-2" /> Baixar Markdown (.md)
            </Button>
            <Button disabled={!lastResult} onClick={() => lastResult && downloadDocxFromBase64(lastResult.base64, `${lastResult.baseFilename}.docx`)}>
              <Download className="h-4 w-4 mr-2" /> Baixar Word (.docx)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
