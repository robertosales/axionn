import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Save } from "lucide-react";
import { useSprint } from "@/contexts/SprintContext";
import { UserStory } from "@/types/sprint";
import { toast } from "sonner";
import { SIZE_REFERENCES, getSizeByKey } from "@/lib/sizeReference";

interface Props {
  huId: string | null;
  open: boolean;
  onClose: () => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
      {children}
    </h3>
  );
}

export function HUEditDrawer({ huId, open, onClose }: Props) {
  const {
    userStories, updateUserStory, sprints, epics,
    workflowColumns, customFields, developers,
  } = useSprint() as any;

  const [title, setTitle]               = useState("");
  const [description, setDescription]   = useState("");
  const [acceptanceCriteria, setAC]     = useState("");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [priority, setPriority]         = useState<string>("media");
  const [epicId, setEpicId]             = useState("");
  const [startDate, setStartDate]       = useState("");
  const [endDate, setEndDate]           = useState("");
  const [functionPoints, setFP]         = useState("");
  const [assigneeId, setAssigneeId]     = useState("");
  const [sprintId, setSprintId]         = useState("");
  const [statusField, setStatusField]   = useState("");
  const [customFieldValues, setCFV]     = useState<Record<string, string | number>>({});
  const [errors, setErrors]             = useState<Record<string, string>>({});
  const [submitting, setSubmitting]     = useState(false);

  useEffect(() => {
    if (!open || !huId) return;
    const hu: UserStory | undefined = userStories.find((h: UserStory) => h.id === huId);
    if (!hu) return;
    setTitle(hu.title);
    const parts = (hu.description || "").split("\\n\\n---\\n**Crit\u00e9rios de Aceite:**\\n");
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
    if (!title.trim()) e.title = "T\u00edtulo \u00e9 obrigat\u00f3rio";
    (customFields ?? []).forEach((f: any) => {
      if (f.required) {
        const val = customFieldValues[f.id];
        if (val === undefined || val === "" || val === null) e[`cf_${f.id}`] = `${f.name} \u00e9 obrigat\u00f3rio`;
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
        ? `${description.trim()}\\n\\n---\\n**Crit\u00e9rios de Aceite:**\\n${acceptanceCriteria.trim()}`
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
      onClose();
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const hu = huId ? userStories.find((h: UserStory) => h.id === huId) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[900px] w-[92vw] max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">

        <DialogHeader className="px-6 pt-5 pb-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {hu && (
                  <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {hu.code}
                  </span>
                )}
                <DialogTitle className="text-base font-semibold">Editar User Story</DialogTitle>
              </div>
              {hu && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{hu.title}</p>}
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 min-h-0">

              {/* Coluna esquerda — conte\u00fado */}
              <div className="lg:col-span-3 px-6 py-5 space-y-5 border-r border-border">
                <SectionTitle>Conte\u00fado da HU</SectionTitle>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">T\u00edtulo <span className="text-destructive">*</span></Label>
                  <Input
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: "" })); }}
                    placeholder="Como usu\u00e1rio, eu quero..."
                    className="text-sm"
                  />
                  {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Descri\u00e7\u00e3o</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descri\u00e7\u00e3o detalhada da funcionalidade..."
                    className="text-sm resize-none" rows={4}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Crit\u00e9rios de Aceite</Label>
                  <Textarea
                    value={acceptanceCriteria}
                    onChange={(e) => setAC(e.target.value)}
                    placeholder="1. Dado que... quando... ent\u00e3o..."
                    className="text-sm resize-none" rows={4}
                  />
                </div>

                {(customFields ?? []).length > 0 && (
                  <>
                    <Separator />
                    <SectionTitle>Campos Personalizados</SectionTitle>
                    <div className="grid grid-cols-2 gap-4">
                      {(customFields ?? []).map((field: any) => (
                        <div key={field.id} className="space-y-1.5">
                          <Label className="text-sm font-medium">
                            {field.name}{field.required && <span className="text-destructive"> *</span>}
                          </Label>
                          {field.type === "text" && (
                            <Input value={String(customFieldValues[field.id] || "")} onChange={(e) => setCFV((p) => ({ ...p, [field.id]: e.target.value }))} className="text-sm" />
                          )}
                          {field.type === "number" && (
                            <Input type="number" value={String(customFieldValues[field.id] || "")} onChange={(e) => setCFV((p) => ({ ...p, [field.id]: Number(e.target.value) }))} className="text-sm" />
                          )}
                          {field.type === "select" && field.options && (
                            <Select value={String(customFieldValues[field.id] || "")} onValueChange={(v) => setCFV((p) => ({ ...p, [field.id]: v }))}>
                              <SelectTrigger className="text-sm"><SelectValue placeholder={`Selecione ${field.name}`} /></SelectTrigger>
                              <SelectContent>{field.options.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                            </Select>
                          )}
                          {errors[`cf_${field.id}`] && <p className="text-xs text-destructive">{errors[`cf_${field.id}`]}</p>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Coluna direita — configura\u00e7\u00f5es */}
              <div className="lg:col-span-2 px-6 py-5 space-y-5 bg-muted/10">
                <SectionTitle>Configura\u00e7\u00f5es</SectionTitle>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Sprint</Label>
                    <Select value={sprintId || "backlog"} onValueChange={(v) => setSprintId(v === "backlog" ? "" : v)}>
                      <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Backlog" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="backlog">Backlog Geral</SelectItem>
                        {(sprints ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}{s.isActive ? " \u2726" : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">\u00c9pico</Label>
                    <Select value={epicId || "none"} onValueChange={(v) => setEpicId(v === "none" ? "" : v)}>
                      <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Sem \u00e9pico" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem \u00e9pico</SelectItem>
                        {(epics ?? []).map((ep: any) => (
                          <SelectItem key={ep.id} value={ep.id}>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: ep.color }} />{ep.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Status</Label>
                    <Select value={statusField || workflowColumns[0]?.key || ""} onValueChange={setStatusField}>
                      <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        {(workflowColumns ?? []).map((col: any) => (
                          <SelectItem key={col.key} value={col.key}>
                            <div className="flex items-center gap-2"><div className={`h-2 w-2 rounded-full ${col.dotColor}`} />{col.label}</div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Prioridade <span className="text-destructive">*</span></Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">M\u00e9dia</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Cr\u00edtica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Estimativa</Label>
                    <Select value={selectedSize ?? "none"} onValueChange={(v) => setSelectedSize(v === "none" ? null : v)}>
                      <SelectTrigger className="text-sm h-9"><SelectValue placeholder="N\u00e3o estimado" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">N\u00e3o estimado</SelectItem>
                        {SIZE_REFERENCES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label} \u2014 {s.hours}h ({s.pointsLabel})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Respons\u00e1vel</Label>
                    <Select value={assigneeId || "none"} onValueChange={(v) => setAssigneeId(v === "none" ? "" : v)}>
                      <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Sem respons\u00e1vel" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem respons\u00e1vel</SelectItem>
                        {(developers ?? []).map((dev: any) => <SelectItem key={dev.id} value={dev.id}>{dev.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Per\u00edodo</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">In\u00edcio</span>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm h-9" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Entrega</span>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm h-9" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Ponto de Fun\u00e7\u00e3o</Label>
                  <Input type="number" step="0.01" min="0" value={functionPoints} onChange={(e) => setFP(e.target.value)} placeholder="Ex: 12,50" className="text-sm h-9" />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-3 border-t bg-muted/20 shrink-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
            <Button type="submit" className="gap-2" disabled={submitting}>
              {submitting
                ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                : <Save className="h-4 w-4" />}
              Salvar HU
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
