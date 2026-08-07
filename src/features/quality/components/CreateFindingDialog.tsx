import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFindingActions } from "../hooks/useQualityFindings";
import { qualityLabel } from "../utils/qualityLabels";

export interface FindingContext { runItemId: string; stepResultId: string; caseTitle: string; action: string; expectedResult: string; actualResult: string }

export function CreateFindingDialog({ orgId, context, open, onOpenChange }: { orgId: string; context: FindingContext | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const actions = useFindingActions(orgId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("high");
  useEffect(() => { if (open && context) { setTitle(`Falha: ${context.caseTitle}`); setDescription(`Etapa: ${context.action}`); setSeverity("high"); } }, [context, open]);
  const submit = async () => { if (!context) return; try { await actions.create.mutateAsync({ title: title.trim(), description: description.trim(), severity, expectedResult: context.expectedResult, actualResult: context.actualResult, runItemId: context.runItemId, stepResultId: context.stepResultId }); onOpenChange(false); toast.success("Achado criado e vinculado à falha."); } catch { toast.error("Não foi possível criar o achado."); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Registrar achado</DialogTitle><DialogDescription>O achado ficará ligado à execução, ao caso e à etapa que originou a falha.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="finding-title">Título</Label><Input id="finding-title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="finding-description">Contexto</Label><Textarea id="finding-description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="finding-severity">Severidade</Label><Select value={severity} onValueChange={setSeverity}><SelectTrigger id="finding-severity"><SelectValue /></SelectTrigger><SelectContent>{["low", "medium", "high", "critical"].map((value) => <SelectItem key={value} value={value}>{qualityLabel(value)}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={!title.trim() || actions.create.isPending} onClick={submit}>Criar achado</Button></DialogFooter></DialogContent></Dialog>;
}
