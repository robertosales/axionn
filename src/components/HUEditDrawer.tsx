import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Save } from "lucide-react";
import { useSprint } from "@/contexts/SprintContext";
import { UserStory } from "@/types/sprint";
import { toast } from "sonner";
import { SIZE_REFERENCES, getSizeByKey } from "@/lib/sizeReference";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAssignees } from "@/hooks/useTeamAssignees";

interface Props {
  huId: string | null;
  open: boolean;
  onClose: () => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 pb-1 border-b">
      {children}
    </p>
  );
}

export const HUEditDrawer = React.memo(function HUEditDrawer({ huId, open, onClose }: Props) {
  const {
    userStories,
    updateUserStory,
    sprints,
    epics,
    workflowColumns,
    customFields,
    developers,
  } = useSprint() as any;
  const { currentTeamId } = useAuth();

  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAC]   = useState("");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [priority, setPriority]       = useState<string>("media");
  const [epicId, setEpicId]           = useState("");
  const [startDate, setStartDate]     = useState("");
  const [endDate, setEndDate]         = useState("");
  const [functionPoints, setFP]       = useState("");
  const [assigneeId, setAssigneeId]   = useState("");
  const [sprintId, setSprintId]       = useState("");
  const [statusField, setStatusField] = useState("");
  const [customFieldValues, setCFV]   = useState<Record<string, string | number>>({});
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [submitting, setSubmitting]   = useState(false);

  const assigneeOptions = useTeamAssignees(currentTeamId, developers ?? [], assigneeId || null);

  // ─── Sincroniza developers com team_members do time atual ─────────────────
  // Garante que o combo "Responsável" reflita TODOS os membros do time,
  // criando registros faltantes em `developers` (vinculados via user_id).
  useEffect(() => {
    if (!open || !currentTeamId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: members } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("team_id", currentTeamId);
        if (cancelled || !members || members.length === 0) return;
        const userIds = members.map((m: any) => m.user_id).filter(Boolean);
        if (userIds.length === 0) return;

        const { data: existingDevs } = await supabase
          .from("developers")
          .select("user_id")
          .eq("team_id", currentTeamId)
          .not("user_id", "is", null);
        if (cancelled) return;
        const existingUserIds = new Set((existingDevs ?? []).map((d: any) => d.user_id));
        const missing = userIds.filter((id: string) => !existingUserIds.has(id));
        if (missing.length === 0) return;

        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", missing);
        if (cancelled || !profiles) return;

        const rows = profiles
          .filter((p: any) => p.user_id && (p.display_name || p.email))
          .map((p: any) => ({
            team_id: currentTeamId,
            user_id: p.user_id,
            name: p.display_name || p.email,
            email: p.email || "",
            role: "developer",
          }));
        if (rows.length === 0) return;

        const { error } = await supabase.from("developers").insert(rows);
        if (error) console.warn("[HUEditDrawer] insert developers:", error);
        // Realtime do SprintContext propaga automaticamente os novos devs.
      } catch (err) {
        console.warn("[HUEditDrawer] sync developers falhou:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [open, currentTeamId]);

  useEffect(() => {
    if (!open || !huId) return;
    const hu: UserStory | undefined = userStories.find((h: UserStory) => h.id === huId);
    if (!hu) return;
    setTitle(hu.title);
    const parts = (hu.description || "").split("\n\n---\n**Critérios de Aceite:**\n");
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

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Título é obrigatório";
    (customFields ?? []).forEach((f: any) => {
      if (f.required) {
        const val = customFieldValues[f.id];
        if (val === undefined || val === "" || val === null)
          e[`cf_${f.id}`] = `${f.name} é obrigatório`;
      }
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [title, customFields, customFieldValues]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
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
        ? `${description.trim()}\n\n---\n**Critérios de Aceite:**\n${acceptanceCriteria.trim()}`
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
  }, [
    validate, huId, selectedSize, functionPoints, acceptanceCriteria,
    description, title, priority, statusField, workflowColumns,
    sprintId, epicId, customFieldValues, startDate, endDate,
    assigneeId, updateUserStory, onClose,
  ]);

  const hu = huId ? userStories.find((h: UserStory) => h.id === huId) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[900px] w-[92vw] max-h-[92vh] flex flex-col gap-0 p-0 overflow-x-hidden overflow-y-hidden rounded-xl">

        {/* HEADER */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b bg-muted/20 shrink-0 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {hu && (
                  <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                    {hu.code}
                  </span>
                )}
                <DialogTitle className="text-base font-semibold">
                  Editar User Story
                </DialogTitle>
              </div>
              {hu && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{hu.title}</p>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* BODY */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] divide-y lg:divide-y-0 lg:divide-x divide-border min-w-0">

              {/* Coluna esquerda — Conteúdo */}
              <div className="px-5 py-5 space-y-4 min-w-0 overflow-hidden">
                <SectionTitle>Conteúdo da HU</SectionTitle>

                {/* Título */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    Título <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: "" })); }}
                    placeholder="Como usuário, eu quero..."
                    className="text-sm"
                  />
                  {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                </div>

                {/* Descrição */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Descrição</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrição detalhada da funcionalidade..."
                    className="text-sm resize-none"
                    rows={4}
                  />
                </div>

                {/* Critérios de Aceite */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Critérios de Aceite</Label>
                  <Textarea
                    value={acceptanceCriteria}
                    onChange={(e) => setAC(e.target.value)}
                    placeholder="1. Dado que... quando... então..."
                    className="text-sm resize-none"
                    rows={4}
                  />
                </div>

                {/* Campos personalizados */}
                {(customFields ?? []).length > 0 && (
                  <>
                    <Separator />
                    <SectionTitle>Campos Personalizados</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      {(customFields ?? []).map((field: any) => (
                        <div key={field.id} className="space-y-1.5">
                          <Label className="text-sm font-medium">
                            {field.name}
                            {field.required && <span className="text-destructive"> *</span>}
                          </Label>
                          {field.type === "text" && (
                            <Input
                              value={String(customFieldValues[field.id] || "")}
                              onChange={(e) => setCFV((p) => ({ ...p, [field.id]: e.target.value }))}
                              className="text-sm"
                            />
                          )}
                          {field.type === "number" && (
                            <Input
                              type="number"
                              value={String(customFieldValues[field.id] || "")}
                              onChange={(e) => setCFV((p) => ({ ...p, [field.id]: Number(e.target.value) }))}
                              className="text-sm"
                            />
                          )}
                          {field.type === "select" && field.options && (
                            <Select
                              value={String(customFieldValues[field.id] || "")}
                              onValueChange={(v) => setCFV((p) => ({ ...p, [field.id]: v }))}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue placeholder={`Selecione ${field.name}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {field.options.map((opt: string) => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {errors[`cf_${field.id}`] && (
                            <p className="text-xs text-destructive">{errors[`cf_${field.id}`]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Coluna direita — Configurações */}
              <div className="px-5 py-5 space-y-4 bg-muted/10 min-w-0 overflow-hidden">
                <SectionTitle>Configurações</SectionTitle>

                {/* Sprint */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Sprint</Label>
                  <Select
                    value={sprintId || "backlog"}
                    onValueChange={(v) => setSprintId(v === "backlog" ? "" : v)}
                  >
                    <SelectTrigger className="text-sm h-9 w-full">
                      <SelectValue placeholder="Backlog" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="backlog">Backlog Geral</SelectItem>
                      {(sprints ?? []).map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}{s.isActive ? " ❆" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Épico */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Épico</Label>
                  <Select
                    value={epicId || "none"}
                    onValueChange={(v) => setEpicId(v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="text-sm h-9 w-full">
                      <SelectValue placeholder="Sem épico" />
                    </SelectTrigger>
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
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Status</Label>
                  <Select
                    value={statusField || workflowColumns[0]?.key || ""}
                    onValueChange={setStatusField}
                  >
                    <SelectTrigger className="text-sm h-9 w-full">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
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
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    Prioridade <span className="text-destructive">*</span>
                  </Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="text-sm h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Estimativa */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Estimativa</Label>
                  <Select
                    value={selectedSize ?? "none"}
                    onValueChange={(v) => setSelectedSize(v === "none" ? null : v)}
                  >
                    <SelectTrigger className="text-sm h-9 w-full">
                      <SelectValue placeholder="Não estimado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não estimado</SelectItem>
                      {SIZE_REFERENCES.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.label} — {s.hours}h ({s.pointsLabel})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Responsável */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Responsável</Label>
                  <Select
                    value={assigneeId || "none"}
                    onValueChange={(v) => setAssigneeId(v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="text-sm h-9 w-full">
                      <SelectValue placeholder="Sem responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem responsável</SelectItem>
                      {assigneeOptions.map((dev) => (
                        <SelectItem key={dev.id} value={dev.id}>{dev.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Período */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Período</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Início</span>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="text-sm h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Entrega</span>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="text-sm h-9"
                      />
                    </div>
                  </div>
                </div>

                {/* Ponto de Função */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Ponto de Função</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={functionPoints}
                    onChange={(e) => setFP(e.target.value)}
                    placeholder="Ex: 12,50"
                    className="text-sm h-9"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <DialogFooter className="px-5 py-3 border-t bg-muted/10 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" className="gap-2" disabled={submitting}>
              {submitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar HU
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
