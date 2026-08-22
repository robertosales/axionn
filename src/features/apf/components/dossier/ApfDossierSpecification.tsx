import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, CheckCircle2, CircleDashed, FileText, FileUp, Loader2, MoreHorizontal, Pencil, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useApfAcceptanceCriteria } from "../../hooks/useApfEvidenceDossiers";
import { deleteApfDraftDossier, saveApfAcceptanceCriterion, updateApfDraftDossier } from "../../services/apfEvidenceDossier.service";
import { APF_COUNTING_TYPE_LABELS, APF_DOSSIER_STATUS_LABELS, type ApfAcceptanceCriterion, type ApfAcceptanceDecision, type ApfCountingType, type ApfEvidenceDossierSummary } from "../../types/apfEvidenceDossier.types";
import { ApfDossierEvidence } from "./ApfDossierEvidence";
import { ApfDossierCounting } from "./ApfDossierCounting";
import { ApfDossierAudit } from "./ApfDossierAudit";
import { ApfDossierValidation } from "./ApfDossierValidation";
import { ApfDossierTraceability } from "./ApfDossierTraceability";
import { ApfLogicalFileMatrix } from "./ApfLogicalFileMatrix";
import { ApfExceptionReviews } from "./ApfExceptionReviews";
import { ApfSpecificationImportDialog } from "./ApfSpecificationImportDialog";

const decisions: Array<{ value: ApfAcceptanceDecision; label: string }> = [
  { value: "meets", label: "Atende" }, { value: "partially_meets", label: "Atende parcialmente" },
  { value: "does_not_meet", label: "Não atende" }, { value: "not_applicable", label: "Não aplicável" },
];

export function ApfDossierSpecification({ dossier, onBack, onDossierChanged, onDeleted, onSuccessorCreated }: { dossier: ApfEvidenceDossierSummary; onBack: () => void; onDossierChanged: () => Promise<unknown>; onDeleted: () => Promise<unknown>; onSuccessorCreated: () => Promise<unknown> }) {
  const { hasPermission } = useAuth();
  const { data: criteria = [], isLoading, isError, refetch } = useApfAcceptanceCriteria(dossier.id);
  const [adding, setAdding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const decided = criteria.filter((criterion) => criterion.decision).length;
  const completeness = criteria.length ? Math.round((decided / criteria.length) * 100) : 0;
  const canManageDraft = dossier.status === "draft" && hasPermission("apf.dossier.review");

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteApfDraftDossier(dossier.id);
      toast.success("Dossiê excluído com sucesso.");
      setDeleteOpen(false);
      await onDeleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o dossiê.");
    } finally {
      setDeleting(false);
    }
  };

  return <section className="mx-auto w-full max-w-screen-2xl space-y-5 overflow-x-hidden" aria-labelledby="specification-title">
    <header className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={onBack} aria-label="Voltar para a lista de dossiês"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></Button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{dossier.dossierCode}</span><Badge variant="outline">{APF_DOSSIER_STATUS_LABELS[dossier.status]}</Badge></div>
          <h2 id="specification-title" className="break-words text-xl font-semibold leading-tight tracking-tight sm:text-2xl">{dossier.title}</h2>
          <p className="text-sm text-muted-foreground">Dossiê de evidências e contagem APF por {APF_COUNTING_TYPE_LABELS[dossier.countingType].toLocaleLowerCase("pt-BR")}.</p>
        </div>
        {canManageDraft && <DropdownMenu modal={false}><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Abrir ações do dossiê"><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" aria-hidden="true" />Editar dossiê</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteOpen(true)}><Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />Excluir dossiê</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
      </div>
    </header>
    <Tabs defaultValue="overview" className="min-w-0">
      <div className="overflow-x-auto rounded-lg bg-muted/70 p-1"><TabsList className="inline-flex h-10 min-w-full justify-start bg-transparent p-0">
        <TabsTrigger value="overview">Visão geral</TabsTrigger><TabsTrigger value="specification">Especificação</TabsTrigger><TabsTrigger value="evidence">Evidências</TabsTrigger><TabsTrigger value="traceability">Rastreabilidade</TabsTrigger><TabsTrigger value="counting">Contagem</TabsTrigger><TabsTrigger value="audit">Auditoria</TabsTrigger><TabsTrigger value="document">Documento</TabsTrigger>
      </TabsList></div>
      <TabsContent value="overview" className="mt-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><OverviewMetric icon={CheckCircle2} label="Critérios decididos" value={`${decided}/${criteria.length}`} detail={`${completeness}% da especificação revisada`} /><OverviewMetric icon={BarChart3} label="Tipo de contagem" value={APF_COUNTING_TYPE_LABELS[dossier.countingType]} detail="Classificação aplicada ao dossiê" /><OverviewMetric icon={ShieldCheck} label="Situação" value={APF_DOSSIER_STATUS_LABELS[dossier.status]} detail={dossier.status === "draft" ? "Disponível para edição" : "Acompanha o fluxo de governança"} /></div><Card className="mt-4 border-dashed"><CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center"><span className="rounded-lg bg-primary/10 p-2.5 text-primary"><FileText className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><p className="font-medium">Origem da evidência</p><p className="break-words text-sm text-muted-foreground">{dossier.userStory ? `${dossier.userStory.code} · ${dossier.userStory.title}` : "Nenhuma história de usuário vinculada."}</p></div></CardContent></Card></TabsContent>
      <TabsContent value="specification" className="space-y-3">
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setImportOpen(true)}><FileUp className="mr-2 h-4 w-4" />Importar especificação</Button><Button onClick={() => setAdding(true)} disabled={adding}><Plus className="mr-2 h-4 w-4" />Adicionar critério</Button></div>
    <Card><CardContent className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="mb-2 flex justify-between text-xs font-medium"><span>Critérios com decisão</span><span>{decided}/{criteria.length}</span></div><Progress value={completeness} aria-label={`${completeness}% dos critérios possuem decisão`} /></div><Badge variant={completeness === 100 && criteria.length ? "default" : "secondary"}>{completeness}% completo</Badge></CardContent></Card>
    {isLoading ? <div className="flex min-h-40 items-center justify-center" role="status"><Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />Carregando critérios…</div>
      : isError ? <Card role="alert" className="border-destructive/30"><CardContent className="flex items-center justify-between p-4"><p className="text-sm text-destructive">Falha ao carregar os critérios.</p><Button variant="outline" size="sm" onClick={() => void refetch()}>Tentar novamente</Button></CardContent></Card>
      : <div className="space-y-3">{adding && <CriterionEditor dossierId={dossier.id} criterion={null} nextOrder={criteria.length} onSaved={async () => { setAdding(false); await refetch(); }} onCancel={() => setAdding(false)} />}{criteria.map((criterion) => <CriterionEditor key={criterion.id} dossierId={dossier.id} criterion={criterion} nextOrder={criterion.sortOrder} onSaved={refetch} />)}{!adding && criteria.length === 0 && <Card className="border-dashed"><CardContent className="flex min-h-40 flex-col items-center justify-center text-center"><CircleDashed className="mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">Nenhum critério de aceite</p><p className="text-sm text-muted-foreground">Cadastre o primeiro critério preservando o texto original da HU.</p></CardContent></Card>}</div>}
      </TabsContent>
      <TabsContent value="evidence"><ApfDossierEvidence dossierId={dossier.id} organizationId={dossier.organizationId} userStoryId={dossier.userStoryId} criteria={criteria} /></TabsContent>
      <TabsContent value="traceability"><ApfDossierTraceability dossierId={dossier.id} criteria={criteria} /></TabsContent>
      <TabsContent value="counting" className="space-y-5"><ApfDossierCounting dossierId={dossier.id} sessionId={dossier.countingSessionId} /><ApfLogicalFileMatrix dossierId={dossier.id} sessionId={dossier.countingSessionId} /><ApfExceptionReviews dossierId={dossier.id} sessionId={dossier.countingSessionId} /></TabsContent>
      <TabsContent value="audit"><ApfDossierAudit dossierId={dossier.id} /></TabsContent>
      <TabsContent value="document"><ApfDossierValidation dossier={dossier} onSuccessorCreated={onSuccessorCreated} /></TabsContent>
    </Tabs><ApfSpecificationImportDialog open={importOpen} onOpenChange={setImportOpen} dossierId={dossier.id} onImported={refetch} />
    <EditDossierDialog open={editOpen} onOpenChange={setEditOpen} dossier={dossier} onSaved={onDossierChanged} />
    <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir este dossiê?</AlertDialogTitle><AlertDialogDescription>Esta ação é permanente. O rascunho <strong className="font-semibold text-foreground">{dossier.dossierCode}</strong> e todos os dados associados serão excluídos e não poderão ser recuperados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleting} onClick={(event) => { event.preventDefault(); void remove(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />}Excluir permanentemente</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}

function OverviewMetric({ icon: Icon, label, value, detail }: { icon: typeof CheckCircle2; label: string; value: string; detail: string }) {
  return <Card className="shadow-sm"><CardContent className="flex min-h-28 items-start gap-3 p-4"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 break-words text-lg font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div></CardContent></Card>;
}

function EditDossierDialog({ open, onOpenChange, dossier, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; dossier: ApfEvidenceDossierSummary; onSaved: () => Promise<unknown> }) {
  const [code, setCode] = useState(dossier.dossierCode);
  const [title, setTitle] = useState(dossier.title);
  const [countingType, setCountingType] = useState<ApfCountingType>(dossier.countingType);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setCode(dossier.dossierCode); setTitle(dossier.title); setCountingType(dossier.countingType); } }, [dossier, open]);
  const save = async () => { if (!code.trim() || !title.trim() || saving) return; setSaving(true); try { await updateApfDraftDossier(dossier.id, code, title, countingType); toast.success("Dossiê atualizado com sucesso."); onOpenChange(false); await onSaved(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o dossiê."); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Editar dossiê</DialogTitle><DialogDescription>Atualize os dados gerais do rascunho. A história e os vínculos de contagem serão preservados.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="space-y-2"><Label htmlFor="edit-dossier-code">Código do dossiê</Label><Input id="edit-dossier-code" value={code} onChange={(event) => setCode(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="edit-dossier-title">Título</Label><Input id="edit-dossier-title" value={title} onChange={(event) => setTitle(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="edit-dossier-type">Tipo de contagem</Label><Select value={countingType} onValueChange={(value) => setCountingType(value as ApfCountingType)}><SelectTrigger id="edit-dossier-type"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(APF_COUNTING_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button><Button onClick={() => void save()} disabled={saving || !code.trim() || !title.trim()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}Salvar alterações</Button></DialogFooter></DialogContent></Dialog>;
}

function CriterionEditor({ dossierId, criterion, nextOrder, onSaved, onCancel }: { dossierId: string; criterion: ApfAcceptanceCriterion | null; nextOrder: number; onSaved: () => Promise<unknown>; onCancel?: () => void }) {
  const [stableId, setStableId] = useState(criterion?.stableId ?? `CA-${String(nextOrder + 1).padStart(2, "0")}`);
  const [originalText, setOriginalText] = useState(criterion?.originalText ?? "");
  const [expectedBehavior, setExpectedBehavior] = useState(criterion?.expectedBehavior ?? "");
  const [decision, setDecision] = useState<ApfAcceptanceDecision | "pending">(criterion?.decision ?? "pending");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (criterion) { setStableId(criterion.stableId); setOriginalText(criterion.originalText); setExpectedBehavior(criterion.expectedBehavior ?? ""); setDecision(criterion.decision ?? "pending"); } }, [criterion]);
  const save = async () => { if (!stableId.trim() || !originalText.trim()) return; setSaving(true); try { await saveApfAcceptanceCriterion({ id: criterion?.id, dossierId, stableId, sortOrder: nextOrder, originalText, expectedBehavior, decision: decision === "pending" ? null : decision }); toast.success(criterion ? "Critério atualizado." : "Critério adicionado."); await onSaved(); } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao salvar o critério."); } finally { setSaving(false); } };
  return <Card><CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-sm">{criterion ? stableId : "Novo critério"}</CardTitle><CardDescription>{criterion?.sourceType === "manual" || !criterion ? "Cadastro manual" : "Extraído da especificação"}</CardDescription></div>{decision !== "pending" && <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Critério revisado" />}</div></CardHeader><CardContent className="grid gap-4">
    <div className="grid gap-4 sm:grid-cols-[8rem_1fr]"><div className="space-y-1.5"><Label htmlFor={`stable-${criterion?.id ?? "new"}`}>Identificador</Label><Input id={`stable-${criterion?.id ?? "new"}`} value={stableId} onChange={(event) => setStableId(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor={`decision-${criterion?.id ?? "new"}`}>Decisão funcional</Label><Select value={decision} onValueChange={(value) => setDecision(value as ApfAcceptanceDecision | "pending")}><SelectTrigger id={`decision-${criterion?.id ?? "new"}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pendente</SelectItem>{decisions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div></div>
    <div className="space-y-1.5"><Label htmlFor={`original-${criterion?.id ?? "new"}`}>Texto original</Label><Textarea id={`original-${criterion?.id ?? "new"}`} value={originalText} onChange={(event) => setOriginalText(event.target.value)} rows={3} required /></div>
    <div className="space-y-1.5"><Label htmlFor={`expected-${criterion?.id ?? "new"}`}>Comportamento esperado</Label><Textarea id={`expected-${criterion?.id ?? "new"}`} value={expectedBehavior} onChange={(event) => setExpectedBehavior(event.target.value)} rows={2} /></div>
    <div className="flex justify-end gap-2">{onCancel && <Button variant="outline" onClick={onCancel}>Cancelar</Button>}<Button onClick={() => void save()} disabled={saving || !stableId.trim() || !originalText.trim()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Save className="mr-2 h-4 w-4" />}Salvar</Button></div>
  </CardContent></Card>;
}
