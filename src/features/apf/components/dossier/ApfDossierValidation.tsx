import { useState } from "react";
import { CheckCircle2, Download, Eye, Loader2, LockKeyhole, XCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApfAcceptanceCriteria, useApfAuditScenarios, useApfDossierCountingMemory, useApfEvidenceSources } from "../../hooks/useApfEvidenceDossiers";
import { validateAndSnapshotApfDossier } from "../../services/apfEvidenceDossier.service";
import type { ApfEvidenceDossierSummary } from "../../types/apfEvidenceDossier.types";
import { downloadMarkdownAsFile } from "../../utils/fileDownload";

export function ApfDossierValidation({ dossier }: { dossier: ApfEvidenceDossierSummary }) {
  const criteriaQuery = useApfAcceptanceCriteria(dossier.id); const evidenceQuery = useApfEvidenceSources(dossier.id); const countingQuery = useApfDossierCountingMemory(dossier.countingSessionId); const auditQuery = useApfAuditScenarios(dossier.id);
  const [saving, setSaving] = useState(false); const [result, setResult] = useState<{ markdown: string; hash: string; version: number } | null>(null); const [previewOpen, setPreviewOpen] = useState(false);
  const loading = criteriaQuery.isLoading || evidenceQuery.isLoading || countingQuery.isLoading || auditQuery.isLoading;
  const criteria = criteriaQuery.data ?? []; const evidence = evidenceQuery.data ?? []; const counting = countingQuery.data; const scenarios = auditQuery.data ?? [];
  const checks = [
    { label: "Todos os critérios possuem decisão", ok: criteria.length > 0 && criteria.every((item) => item.decision !== null) },
    { label: "Todos os critérios possuem evidência", ok: criteria.length > 0 && criteria.every((criterion) => evidence.some((item) => item.criterionIds.includes(criterion.id))) },
    { label: "Há evidência verificada", ok: evidence.some((item) => item.verificationStatus === "verified") },
    { label: "Todos os itens contáveis foram validados", ok: Boolean(counting?.items.length) && Boolean(counting?.items.filter((item) => item.decision === "counted").every((item) => item.isValidated)) },
    { label: "Memória de cálculo fecha com a sessão", ok: Boolean(counting?.closes) },
    { label: "Contrato, baseline e ruleset estão congelados", ok: Boolean(dossier.countingSessionId) },
  ];
  const ready = checks.every((check) => check.ok) && Boolean(counting);
  const validate = async () => { if (!ready || !counting) return; setSaving(true); try { const snapshot = await validateAndSnapshotApfDossier({ dossier, criteria, evidence, counting, scenarios }); setResult(snapshot); toast.success(`Dossiê validado na versão ${snapshot.version}.`); } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao validar o dossiê."); } finally { setSaving(false); } };

  return <section className="space-y-3" aria-labelledby="validation-title"><div><h3 id="validation-title" className="font-semibold">Validação e documento</h3><p className="text-sm text-muted-foreground">O snapshot é gerado sem IA e não recalcula os valores oficiais.</p></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><LockKeyhole className="h-4 w-4 text-primary" />Checklist de prontidão</CardTitle><CardDescription>{ready ? "Todos os requisitos de validação foram atendidos." : "Resolva os bloqueios antes de criar uma versão imutável."}</CardDescription></CardHeader><CardContent className="space-y-2">{loading ? <div className="flex items-center text-sm" role="status"><Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />Verificando dossiê…</div> : checks.map((check) => <div key={check.label} className="flex items-center gap-2 text-sm">{check.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Atendido" /> : <XCircle className="h-4 w-4 text-destructive" aria-label="Bloqueado" />}<span>{check.label}</span></div>)}<div className="flex flex-wrap justify-end gap-2 border-t pt-4">{result && <><Button variant="outline" onClick={() => setPreviewOpen(true)}><Eye className="mr-2 h-4 w-4" />Prévia</Button><Button variant="outline" onClick={() => downloadMarkdownAsFile(result.markdown, `${dossier.dossierCode}-v${result.version}.md`)}><Download className="mr-2 h-4 w-4" />Markdown</Button></>}<Button onClick={() => void validate()} disabled={!ready || saving || loading}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}{result ? "Criar nova versão" : "Validar e congelar"}</Button></div>{result && <p className="break-all rounded-md bg-muted p-2 font-mono text-[11px] text-muted-foreground">v{result.version} · SHA-256 {result.hash}</p>}</CardContent></Card>
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}><DialogContent className="flex max-h-[90vh] max-w-4xl flex-col"><DialogHeader><DialogTitle>Prévia do dossiê · v{result?.version}</DialogTitle><DialogDescription>Conteúdo determinístico associado ao hash exibido no checklist.</DialogDescription></DialogHeader><div className="min-h-0 flex-1 overflow-y-auto rounded-md border p-5"><article className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown remarkPlugins={[remarkGfm]}>{result?.markdown ?? ""}</ReactMarkdown></article></div><DialogFooter><Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
