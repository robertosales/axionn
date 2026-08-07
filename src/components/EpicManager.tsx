import { useState, useRef } from "react";
import { SizeBadge } from "@/components/SizeBadge";
import { useSprint } from "@/contexts/SprintContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Layers, Plus, Trash2, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { SkeletonList } from "@/shared/components/common/SkeletonList";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { PaginationControls } from "@/shared/components/common/Pagination";
import { usePagination } from "@/shared/hooks/usePagination";

const EPIC_COLORS = [
  "hsl(173, 58%, 39%)", "hsl(210, 92%, 55%)", "hsl(262, 52%, 55%)", "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)", "hsl(142, 71%, 40%)", "hsl(330, 60%, 50%)", "hsl(200, 70%, 45%)",
];

export function EpicManager() {
  const { epics, features, addEpic, updateEpic, removeEpic, userStories, activeSprint, workflowColumns, loading } = useSprint();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(EPIC_COLORS[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedEpic, setExpandedEpic] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const colorInputRef = useRef<HTMLInputElement | null>(null);

  const lastCol = workflowColumns[workflowColumns.length - 1]?.key;

  const { paginatedItems: pageEpics, currentPage, setCurrentPage, totalItems, pageSize } = usePagination(epics, { pageSize: 10 });

  const resetForm = () => { setName(""); setDescription(""); setColor(EPIC_COLORS[0]); setErrors({}); setEditId(null); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Nome do épico é obrigatório";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setSubmitting(true);
    try {
      if (editId) {
        await updateEpic(editId, { name: name.trim(), description: description.trim(), color });
        toast.success("Alterações salvas com sucesso");
      } else {
        await addEpic({ name: name.trim(), description: description.trim(), color });
        toast.success("Registro criado com sucesso");
      }
      resetForm();
      setOpen(false);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (epicId: string) => {
    const epic = epics.find((e) => e.id === epicId);
    if (!epic) return;
    setEditId(epic.id); setName(epic.name); setDescription(epic.description); setColor(epic.color); setErrors({}); setOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!deleteTarget) return;
    try {
      await removeEpic(deleteTarget);
      toast.success("Registro excluído com sucesso");
    } catch {
      toast.error("Falha ao excluir item");
    }
    setDeleteTarget(null);
  };

  if (loading) return <SkeletonList count={4} variant="row" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold tracking-tight">Épicos</h2>
          <Badge variant="secondary">{totalItems}</Badge>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Novo Épico</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                {editId ? "Editar Épico" : "Novo Épico"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Nome <span className="text-destructive">*</span></Label>
                <Input value={name} onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }} placeholder="Ex: Módulo de Pagamentos" className="mt-1" />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Objetivo do épico..." className="mt-1" rows={3} />
              </div>
              <div>
                <Label>Cor</Label>
                <div className="flex gap-2 mt-1.5 items-center">
                  {EPIC_COLORS.map((c) => (
                    <button key={c} type="button" className={`h-7 w-7 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-ring scale-110" : "hover:scale-105"}`} style={{ backgroundColor: c }} onClick={() => setColor(c)} />
                  ))}
                  <button type="button" onClick={() => colorInputRef.current?.click()} className="h-7 w-7 rounded-full border flex items-center justify-center text-xs hover:scale-105" title="Escolher cor personalizada">+</button>
                  <input ref={colorInputRef} type="color" className="hidden" value={color} onChange={(e) => setColor(e.target.value)} />
                </div>
              </div>
              <Button type="submit" className="w-full gap-2" disabled={submitting}>
                {submitting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" /> : <Layers className="h-4 w-4" />}
                {editId ? "Salvar Alterações" : "Criar Épico"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {totalItems === 0 ? (
        <EmptyState icon={Layers} title="Nenhum item encontrado" description="Épicos agrupam User Stories em objetivos maiores" actionLabel="Criar novo" onAction={() => setOpen(true)} />
      ) : (
        <div className="space-y-3">
          {pageEpics.map((epic) => {
            const epicHUs = userStories.filter((hu) => hu.epicId === epic.id);
            const sprintHUs = activeSprint ? epicHUs.filter((hu) => hu.sprintId === activeSprint.id) : epicHUs;
            const totalPoints = sprintHUs.reduce((s, hu) => s + hu.storyPoints, 0);
            const donePoints = sprintHUs.filter((hu) => hu.status === lastCol).reduce((s, hu) => s + hu.storyPoints, 0);
            const progress = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
            const expanded = expandedEpic === epic.id;
            const epicFeatures = features.filter((feature) => feature.epicId === epic.id);
            const ungroupedHUs = sprintHUs.filter((hu) => !hu.featureId);

            return (
              <Card key={epic.id} className="group hover:shadow-md transition-shadow overflow-hidden">
                <div className="h-1" style={{ backgroundColor: epic.color }} />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: epic.color }} />
                        <h3 className="font-semibold text-sm">{epic.name}</h3>
                        <Badge variant="secondary" className="text-xs">{sprintHUs.length} HUs</Badge>
                        <Badge variant="outline" className="text-xs">{epicFeatures.length} Features</Badge>
                        <Badge variant="outline" className="text-xs">{totalPoints} pts</Badge>
                      </div>
                      {epic.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 ml-5">{epic.description}</p>}
                      <div className="flex items-center gap-3 mt-2 ml-5">
                        <Progress value={progress} className="h-1.5 flex-1 max-w-[200px]" />
                        <span className="text-xs text-muted-foreground font-medium">{progress}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedEpic(expanded ? null : epic.id)}>
                        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => openEdit(epic.id)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={() => setDeleteTarget(epic.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-4 ml-5 space-y-3">
                      {epicFeatures.map((feature) => {
                        const featureHUs = sprintHUs.filter((hu) => hu.featureId === feature.id);
                        return <div key={feature.id} className="rounded-lg border bg-muted/20 p-2.5">
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: feature.color }} />{feature.name}<Badge variant="secondary" className="ml-auto text-[10px]">{featureHUs.length} HUs</Badge></div>
                          {featureHUs.length ? <div className="space-y-1.5">{featureHUs.map((hu) => {
                            const col = workflowColumns.find((c) => c.key === hu.status);
                            return <div key={hu.id} className="flex items-center gap-2 rounded bg-background px-2.5 py-1.5 text-xs"><Badge variant="outline" className="font-mono text-[10px]">{hu.code}</Badge><span className="flex-1 truncate">{hu.title}</span>{col && <Badge variant="secondary" className="gap-1 text-[10px]"><div className={`h-1.5 w-1.5 rounded-full ${col.dotColor}`} />{col.label}</Badge>}<SizeBadge sizeReference={hu.sizeReference} storyPoints={hu.storyPoints} /></div>;
                          })}</div> : <p className="text-[11px] text-muted-foreground">Nenhuma HU nesta sprint.</p>}
                        </div>;
                      })}
                      {ungroupedHUs.length > 0 && <div className="rounded-lg border border-dashed p-2.5"><p className="mb-2 text-xs font-semibold text-muted-foreground">Sem Feature</p><div className="space-y-1.5">{ungroupedHUs.map((hu) => <div key={hu.id} className="flex items-center gap-2 rounded bg-muted/40 px-2.5 py-1.5 text-xs"><Badge variant="outline" className="font-mono text-[10px]">{hu.code}</Badge><span className="flex-1 truncate">{hu.title}</span><SizeBadge sizeReference={hu.sizeReference} storyPoints={hu.storyPoints} /></div>)}</div></div>}
                      {!epicFeatures.length && !ungroupedHUs.length && <p className="text-xs text-muted-foreground">Nenhuma Feature ou HU neste épico.</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PaginationControls currentPage={currentPage} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} />
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} onConfirm={handleConfirmRemove} />
    </div>
  );
}
