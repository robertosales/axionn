import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleDashed, Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApfAcceptanceCriteria } from "../../hooks/useApfEvidenceDossiers";
import { saveApfAcceptanceCriterion } from "../../services/apfEvidenceDossier.service";
import type { ApfAcceptanceCriterion, ApfAcceptanceDecision, ApfEvidenceDossierSummary } from "../../types/apfEvidenceDossier.types";
import { ApfDossierEvidence } from "./ApfDossierEvidence";
import { ApfDossierCounting } from "./ApfDossierCounting";
import { ApfDossierAudit } from "./ApfDossierAudit";
import { ApfDossierValidation } from "./ApfDossierValidation";

const decisions: Array<{ value: ApfAcceptanceDecision; label: string }> = [
  { value: "meets", label: "Atende" }, { value: "partially_meets", label: "Atende parcialmente" },
  { value: "does_not_meet", label: "Não atende" }, { value: "not_applicable", label: "Não aplicável" },
];

export function ApfDossierSpecification({ dossier, onBack, onSuccessorCreated }: { dossier: ApfEvidenceDossierSummary; onBack: () => void; onSuccessorCreated: () => Promise<unknown> }) {
  const { data: criteria = [], isLoading, isError, refetch } = useApfAcceptanceCriteria(dossier.id);
  const [adding, setAdding] = useState(false);
  const decided = criteria.filter((criterion) => criterion.decision).length;
  const completeness = criteria.length ? Math.round((decided / criteria.length) * 100) : 0;

  return <section className="space-y-4" aria-labelledby="specification-title">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3"><Button variant="outline" size="icon" onClick={onBack} aria-label="Voltar para dossiês"><ArrowLeft className="h-4 w-4" /></Button><div className="min-w-0"><p className="font-mono text-xs text-muted-foreground">{dossier.dossierCode}</p><h2 id="specification-title" className="truncate text-xl font-semibold">Especificação · {dossier.title}</h2></div></div>
      <Button onClick={() => setAdding(true)} disabled={adding}><Plus className="mr-2 h-4 w-4" />Adicionar critério</Button>
    </div>
    <Card><CardContent className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="mb-2 flex justify-between text-xs font-medium"><span>Critérios com decisão</span><span>{decided}/{criteria.length}</span></div><Progress value={completeness} aria-label={`${completeness}% dos critérios possuem decisão`} /></div><Badge variant={completeness === 100 && criteria.length ? "default" : "secondary"}>{completeness}% completo</Badge></CardContent></Card>
    {isLoading ? <div className="flex min-h-40 items-center justify-center" role="status"><Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />Carregando critérios…</div>
      : isError ? <Card role="alert" className="border-destructive/30"><CardContent className="flex items-center justify-between p-4"><p className="text-sm text-destructive">Falha ao carregar os critérios.</p><Button variant="outline" size="sm" onClick={() => void refetch()}>Tentar novamente</Button></CardContent></Card>
      : <div className="space-y-3">{adding && <CriterionEditor dossierId={dossier.id} criterion={null} nextOrder={criteria.length} onSaved={async () => { setAdding(false); await refetch(); }} onCancel={() => setAdding(false)} />}{criteria.map((criterion) => <CriterionEditor key={criterion.id} dossierId={dossier.id} criterion={criterion} nextOrder={criterion.sortOrder} onSaved={refetch} />)}{!adding && criteria.length === 0 && <Card className="border-dashed"><CardContent className="flex min-h-40 flex-col items-center justify-center text-center"><CircleDashed className="mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">Nenhum critério de aceite</p><p className="text-sm text-muted-foreground">Cadastre o primeiro critério preservando o texto original da HU.</p></CardContent></Card>}</div>}
    <ApfDossierEvidence dossierId={dossier.id} criteria={criteria} />
    <ApfDossierCounting sessionId={dossier.countingSessionId} />
    <ApfDossierAudit dossierId={dossier.id} />
    <ApfDossierValidation dossier={dossier} onSuccessorCreated={onSuccessorCreated} />
  </section>;
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
