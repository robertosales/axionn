import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus } from "lucide-react";
import { useSprint } from "@/contexts/SprintContext";
import { UserStory } from "@/types/sprint";
import { toast } from "sonner";
import { SIZE_REFERENCES, getSizeByKey } from "@/lib/sizeReference";

interface Props {
  huId: string | null;
  open: boolean;
  onClose: () => void;
}

export function HUEditDrawer({ huId, open, onClose }: Props) {
  const {
    userStories,
    updateUserStory,
    sprints,
    epics,
    workflowColumns,
    customFields,
    developers,
    activeSprint,
  } = useSprint() as any;

  const [title, setTitle]                     = useState("");
  const [description, setDescription]         = useState("");
  const [acceptanceCriteria, setAC]           = useState("");
  const [selectedSize, setSelectedSize]       = useState<string | null>(null);
  const [priority, setPriority]               = useState<string>("media");
  const [epicId, setEpicId]                   = useState("");
  const [startDate, setStartDate]             = useState("");
  const [endDate, setEndDate]                 = useState("");
  const [functionPoints, setFP]               = useState("");
  const [assigneeId, setAssigneeId]           = useState("");
  const [sprintId, setSprintId]               = useState("");
  const [statusField, setStatusField]         = useState("");
  const [customFieldValues, setCFV]           = useState<Record<string, string | number>>({});
  const [errors, setErrors]                   = useState<Record<string, string>>({});
  const [submitting, setSubmitting]           = useState(false);

  // Popula formulário ao abrir
  useEffect(() => {
    if (!open || !huId) return;
    const hu: UserStory | undefined = userStories.find((h: UserStory) => h.id === huId);
    if (!hu) return;

    setTitle(hu.title);
    const parts = (hu.description || "").split("\\n\\n---\\n**Critérios de Aceite:**\\n");
    setDescription(parts[0] || "");
    setAC(parts[1] || "");
    setSelectedSize(hu.sizeReference ?? null);
    setPriority(hu.priority);
    setEpicId(hu.epicId || "");
    setStartDate(hu.startDate || "");
    setEndDate(hu.endDate || "");
    setSprintId(hu.sprintId || "");
    setStatusField(hu.status || workflowColumns[0]?.key || "");
    setFP(hu.functionPoints != null ? String(hu.functionPoints) : "");
    setAssigneeId(hu.assigneeId || "");
    setCFV((hu as any).customFields || {});
    setErrors({});
  }, [open, huId, userStories, workflowColumns]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Título é obrigatório";
    (customFields ?? []).forEach((f: any) => {
      if (f.required) {
        const val = customFieldValues[f.id];
        if (val === undefined || val === "" || val === null) e[`cf_${f.id}`] = `${f.name} é obrigatório`;
      }
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !huId) return;
    setSubmitting(true);
    try {
      const s = selectedSize ? getSizeByKey(selectedSize) : null;
      const sizeData = s
        ? { sizeReference: s.key, estimatedHours: s.hours, storyPoints: s.points }
        : { sizeReference: null, estimatedHours: null, storyPoints: 0 };
      const fp = functionPoints ? parseFloat(functionPoints) : null;
      const fullDesc = acceptanceCriteria
        ? `${description.trim()}\\n\\n---\\n**Critérios de Aceite:**\\n${acceptanceCriteria.trim()}`
        : description.trim();

      await updateUserStory(huId, {
        title: title.trim(),
        description: fullDesc,
        ...sizeData,
        priority,
        status: statusField || workflowColumns[0]?.key || "",
        sprintId: sprintId || null,
        epicId: epicId || null,
        customFields: customFieldValues,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        functionPoints: fp,
        assigneeId: assigneeId || null,
      } as any);

      toast.success("HU salva com sucesso");
      onClose(); // fecha o drawer — board preservado
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-[520px] sm:w-[600px] flex flex-col gap-0 p-0 overflow-hidden"
      >
        <SheetHeader className="px-6 pt-5 pb-3 border-b">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <SheetTitle>Editar User Story</SheetTitle>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-5">

              {/* Coluna principal */}
              <div className="md:col-span-3 space-y-4">
                <div>
                  <Label>Título <span className="text-destructive">*</span></Label>
                  <Input
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: "" })); }}
                    placeholder="Como usuário, eu quero..."
                    className="mt-1"
                  />
                  {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrição detalhada..."
                    className="mt-1" rows={3}
                  />
                </div>
                <div>
                  <Label>Critérios de Aceite</Label>
                  <Textarea
                    value={acceptanceCriteria}
                    onChange={(e) => setAC(e.target.value)}
                    placeholder="1. Dado que... quando... então..."
                    className="mt-1" rows={3}
                  />
                </div>

                {/* Campos personalizados */}
                {(customFields ?? []).length > 0 && (
                  <div className="space-y-3 border-t pt-3">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Campos Personalizados
                    </Label>
                    {(customFields ?? []).map((field: any) => (
                      <div key={field.id}>
                        <Label className="text-sm">
                          {field.name}{field.required && <span className="text-destructive"> *</span>}
                        </Label>
                        {field.type === "text" && (
                          <Input
                            value={String(customFieldValues[field.id] || "")}
                            onChange={(e) => setCFV((p) => ({ ...p, [field.id]: e.target.value }))}
                            className="mt-1"
                          />
                        )}
                        {field.type === "number" && (
                          <Input type="number"
                            value={String(customFieldValues[field.id] || "")}
                            onChange={(e) => setCFV((p) => ({ ...p, [field.id]: Number(e.target.value) }))}
                            className="mt-1"
                          />
                        )}
                        {field.type === "select" && field.options && (
                          <Select
                            value={String(customFieldValues[field.id] || "")}
                            onValueChange={(v) => setCFV((p) => ({ ...p, [field.id]: v }))}
                          >
                            <SelectTrigger className="mt-1"><SelectValue placeholder={`Selecione ${field.name}`} /></SelectTrigger>
                            <SelectContent>
                              {field.options.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                        {errors[`cf_${field.id}`] && <p className="text-xs text-destructive mt-1">{errors[`cf_${field.id}`]}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Coluna lateral */}
              <div className="md:col-span-2 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {/* Sprint */}
                  <div>
                    <Label className="text-xs">Sprint</Label>
                    <Select value={sprintId || "backlog"} onValueChange={(v) => setSprintId(v === "backlog" ? "" : v)}>
                      <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="Backlog" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="backlog">Backlog Geral</SelectItem>
                        {(sprints ?? []).map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name} {s.isActive ? "✦" : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Épico */}
                  <div>
                    <Label className="text-xs">Épico</Label>
                    <Select value={epicId || "none"} onValueChange={(v) => setEpicId(v === "none" ? "" : v)}>
                      <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="Sem épico" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem épico</SelectItem>
                        {(epics ?? []).map((ep: any) => (
                          <SelectItem key={ep.id} value={ep.id}>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: ep.color }} />
                              {ep.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Status */}
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={statusField || workflowColumns[0]?.key || ""} onValueChange={setStatusField}>
                      <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        {(workflowColumns ?? []).map((col: any) => (
                          <SelectItem key={col.key} value={col.key}>
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${col.dotColor}`} />
                              {col.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Prioridade */}
                  <div>
                    <Label className="text-xs">Prioridade <span className="text-destructive">*</span></Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Tamanho */}
                  <div>
                    <Label className="text-xs">Estimativa</Label>
                    <Select value={selectedSize ?? "none"} onValueChange={(v) => setSelectedSize(v === "none" ? null : v)}>
                      <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="Não estimado" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não estimado</SelectItem>
                        {SIZE_REFERENCES.map((s) => (
                          <SelectItem key={s.key} value={s.key}>{s.label} — {s.hours}h ({s.pointsLabel})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Responsável */}
                  <div>
                    <Label className="text-xs">Responsável</Label>
                    <Select value={assigneeId || "none"} onValueChange={(v) => setAssigneeId(v === "none" ? "" : v)}>
                      <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem responsável</SelectItem>
                        {(developers ?? []).map((dev: any) => (
                          <SelectItem key={dev.id} value={dev.id}>{dev.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Datas */}
                  <div>
                    <Label className="text-xs">Data de Início</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 h-9 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Data de Entrega</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 h-9 text-xs" />
                  </div>
                  {/* Ponto de Função */}
                  <div className="col-span-2">
                    <Label className="text-xs">Ponto de Função</Label>
                    <Input
                      type="number" step="0.01" min="0" value={functionPoints}
                      onChange={(e) => setFP(e.target.value)}
                      placeholder="Ex: 12,50" className="mt-1 h-9 text-xs"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Footer fixo */}
          <div className="border-t px-6 py-3 flex items-center justify-end gap-2 bg-muted/30">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" className="gap-2" disabled={submitting}>
              {submitting
                ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                : <Plus className="h-4 w-4" />}
              Salvar HU
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
