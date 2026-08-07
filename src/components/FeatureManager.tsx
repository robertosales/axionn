import { useMemo, useState } from "react";
import { Boxes, Pencil, Plus, Trash2 } from "lucide-react";
import { useSprint } from "@/contexts/SprintContext";
import { useSalaAgilPermission } from "@/hooks/useSalaAgilPermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { toast } from "sonner";

const FEATURE_COLORS = ["#0ea5e9", "#14b8a6", "#8b5cf6", "#f59e0b", "#ef4444", "#22c55e"];

export function FeatureManager() {
  const { features, epics, userStories, workflowColumns, addFeature, updateFeature, removeFeature } = useSprint();
  const canCreate = useSalaAgilPermission("create_backlog");
  const canEdit = useSalaAgilPermission("edit_backlog");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [epicId, setEpicId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(FEATURE_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const lastStatus = workflowColumns.at(-1)?.key;
  const ordered = useMemo(() => [...features].sort((a, b) => a.name.localeCompare(b.name)), [features]);

  const reset = () => { setEditId(null); setEpicId(""); setName(""); setDescription(""); setColor(FEATURE_COLORS[0]); };
  const startEdit = (id: string) => {
    const feature = features.find((item) => item.id === id);
    if (!feature) return;
    setEditId(id); setEpicId(feature.epicId); setName(feature.name);
    setDescription(feature.description || ""); setColor(feature.color); setOpen(true);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !epicId) return toast.error("Informe o épico e o nome da feature");
    setSubmitting(true);
    try {
      const values = { epicId, name: name.trim(), description: description.trim(), color };
      if (editId) await updateFeature(editId, values); else await addFeature(values);
      toast.success(editId ? "Feature atualizada" : "Feature criada"); setOpen(false); reset();
    } catch (error: any) { toast.error(error?.message || "Não foi possível salvar a feature"); }
    finally { setSubmitting(false); }
  };
  const confirmDelete = async () => {
    if (!deleteId) return;
    try { await removeFeature(deleteId); toast.success("Feature removida"); }
    catch (error: any) { toast.error(error?.message || "Não foi possível remover a feature"); }
    finally { setDeleteId(null); }
  };

  return <section className="space-y-4" aria-labelledby="features-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Boxes className="h-5 w-5 text-primary" /><h2 id="features-heading" className="text-lg font-bold tracking-tight">Features</h2><Badge variant="secondary">{features.length}</Badge></div>
      {canCreate && <Button size="sm" className="gap-1.5" disabled={!epics.length} onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4" /> Nova Feature</Button>}
    </div>
    {!ordered.length ? <EmptyState icon={Boxes} title="Nenhuma feature cadastrada" description={epics.length ? "Organize as histórias em entregas dentro de cada épico." : "Crie um épico antes de cadastrar features."} actionLabel={canCreate && epics.length ? "Criar feature" : undefined} onAction={canCreate && epics.length ? () => setOpen(true) : undefined} /> :
      <div className="grid gap-3 md:grid-cols-2">{ordered.map((feature) => {
        const stories = userStories.filter((story) => story.featureId === feature.id);
        const progress = stories.length ? Math.round(stories.filter((story) => story.status === lastStatus).length / stories.length * 100) : 0;
        const epic = epics.find((item) => item.id === feature.epicId);
        return <Card key={feature.id} className="overflow-hidden transition-shadow hover:shadow-md"><div className="h-1" style={{ backgroundColor: feature.color }} /><CardContent className="p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{feature.name}</h3><Badge variant="outline" className="text-[10px]">{epic?.name || "Épico removido"}</Badge><Badge variant="secondary" className="text-[10px]">{stories.length} HUs</Badge></div>{feature.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{feature.description}</p>}<div className="mt-3 flex items-center gap-2"><Progress value={progress} className="h-1.5" /><span className="text-xs font-medium text-muted-foreground">{progress}%</span></div></div>{canEdit && <div className="flex shrink-0"><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar ${feature.name}`} onClick={() => startEdit(feature.id)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Excluir ${feature.name}`} onClick={() => setDeleteId(feature.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>}</div></CardContent></Card>;
      })}</div>}
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset(); }}><DialogContent><DialogHeader><DialogTitle>{editId ? "Editar Feature" : "Nova Feature"}</DialogTitle></DialogHeader><form onSubmit={submit} className="space-y-4"><div className="space-y-1.5"><Label>Épico *</Label><Select value={epicId} onValueChange={setEpicId}><SelectTrigger><SelectValue placeholder="Selecione o épico" /></SelectTrigger><SelectContent>{epics.map((epic) => <SelectItem key={epic.id} value={epic.id}>{epic.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label htmlFor="feature-name">Nome *</Label><Input id="feature-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Recuperação de senha" /></div><div className="space-y-1.5"><Label htmlFor="feature-description">Descrição</Label><Textarea id="feature-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div><fieldset><legend className="mb-2 text-sm font-medium">Cor</legend><div className="flex gap-2">{FEATURE_COLORS.map((item) => <button key={item} type="button" aria-label={`Usar cor ${item}`} aria-pressed={color === item} onClick={() => setColor(item)} className="h-7 w-7 rounded-full ring-offset-background transition-transform hover:scale-105 aria-pressed:ring-2 aria-pressed:ring-ring aria-pressed:ring-offset-2" style={{ backgroundColor: item }} />)}</div></fieldset><Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Salvando..." : editId ? "Salvar alterações" : "Criar Feature"}</Button></form></DialogContent></Dialog>
    <ConfirmDialog open={!!deleteId} onOpenChange={(value) => !value && setDeleteId(null)} onConfirm={confirmDelete} />
  </section>;
}
