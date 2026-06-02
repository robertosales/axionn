import { useState, useMemo } from "react";
import { useSprint } from "@/contexts/SprintContext";
import { useAuth } from "@/contexts/AuthContext";
import { FileUploader } from "@/components/FileUploader";
import { SizeBadge } from "@/components/SizeBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen, Plus, Trash2, Clock, Pencil, ShieldAlert,
  Search, X, ListFilter,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getTotalHoursForHU, hasActiveImpediment } from "@/types/sprint";
import { toast } from "sonner";
import { PaginationControls } from "@/shared/components/common/Pagination";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { SkeletonList } from "@/shared/components/common/SkeletonList";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { usePagination } from "@/shared/hooks/usePagination";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { SIZE_REFERENCES, getSizeByKey } from "@/lib/sizeReference";
import { QuickActivityDialog } from "@/components/QuickActivityDialog";
import { HUEditDrawer } from "@/components/HUEditDrawer";

const PRIORITY_MAP: Record<string, { label: string; color: string; dot: string }> = {
  baixa:   { label: "Baixa",   color: "bg-muted text-muted-foreground",                                      dot: "bg-muted-foreground" },
  media:   { label: "Média",   color: "bg-info/10 text-info border border-info/30",                          dot: "bg-info" },
  alta:    { label: "Alta",    color: "bg-warning/10 text-warning border border-warning/30",                 dot: "bg-warning" },
  critica: { label: "Crítica", color: "bg-destructive/10 text-destructive border border-destructive/30",     dot: "bg-destructive" },
};

const AC_SEPARATOR = "\n\n---\n**Critérios de Aceite:**\n";

export function UserStoryManager() {
  const {
    userStories, addUserStory, removeUserStory, updateUserStory,
    activities, activeSprint, sprints, epics, workflowColumns,
    customFields, developers, loading,
  } = useSprint();
  const { hasPermission, currentTeamId } = useAuth();
  const canCreate = hasPermission("create_backlog");
  const canEdit   = hasPermission("edit_backlog");

  const [open, setOpen]                   = useState(false);
  const [title, setTitle]                 = useState("");
  const [description, setDescription]     = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [selectedSize, setSelectedSize]   = useState<string | null>(null);
  const [priority, setPriority]           = useState<"baixa"|"media"|"alta"|"critica">("media");
  const [epicId, setEpicId]               = useState<string>("");
  const [startDate, setStartDate]         = useState("");
  const [endDate, setEndDate]             = useState("");
  const [functionPoints, setFunctionPoints] = useState<string>("");
  const [assigneeId, setAssigneeId]       = useState<string>("");
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number>>({});
  const [errors, setErrors]               = useState<Record<string, string>>({});
  const [submitting, setSubmitting]       = useState(false);
  const [sprintId, setSprintId]           = useState<string>("");
  const [statusField, setStatusField]     = useState<string>("");

  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editHuId, setEditHuId]             = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget]     = useState<string | null>(null);
  const [quickTaskHU, setQuickTaskHU]       = useState<string | null>(null);

  const [searchFilter, setSearchFilter]     = useState("");
  const debouncedSearch                     = useDebounce(searchFilter);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter]     = useState("all");
  const [epicFilter, setEpicFilter]         = useState("all");
  const [sprintFilter, setSprintFilter]     = useState("all");

  const hasFilters =
    searchFilter !== "" ||
    priorityFilter !== "all" ||
    statusFilter !== "all" ||
    epicFilter !== "all" ||
    sprintFilter !== "all";

  const clearFilters = () => {
    setSearchFilter(""); setPriorityFilter("all");
    setStatusFilter("all"); setEpicFilter("all"); setSprintFilter("all");
  };

  const filteredStories = useMemo(() => {
    let stories = [...userStories];
    if (sprintFilter === "backlog") {
      stories = stories.filter((hu) => !hu.sprintId);
    } else if (sprintFilter !== "all") {
      stories = stories.filter((hu) => hu.sprintId === sprintFilter);
    } else if (activeSprint) {
      stories = stories.filter((hu) => hu.sprintId === activeSprint.id || !hu.sprintId);
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      stories = stories.filter((hu) => hu.title.toLowerCase().includes(q) || hu.code.toLowerCase().includes(q));
    }
    if (priorityFilter !== "all") stories = stories.filter((hu) => hu.priority === priorityFilter);
    if (statusFilter !== "all")   stories = stories.filter((hu) => hu.status === statusFilter);
    if (epicFilter !== "all")     stories = stories.filter((hu) => hu.epicId === epicFilter);
    return stories;
  }, [activeSprint, userStories, debouncedSearch, priorityFilter, statusFilter, epicFilter, sprintFilter]);

  const { paginatedItems: sprintStories, currentPage, setCurrentPage, totalItems, pageSize } =
    usePagination(filteredStories, { pageSize: 10 });

  const resetForm = () => {
    setTitle(""); setDescription(""); setAcceptanceCriteria(""); setSelectedSize(null);
    setPriority("media"); setEpicId(""); setSprintId(activeSprint?.id || "");
    setStatusField(workflowColumns[0]?.key || ""); setStartDate(""); setEndDate("");
    setFunctionPoints(""); setAssigneeId(""); setCustomFieldValues({}); setErrors({});
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Título é obrigatório";
    customFields.forEach((f) => {
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
    if (!validate()) return;
    setSubmitting(true);
    try {
      const s = selectedSize ? getSizeByKey(selectedSize) : null;
      const sizeData = s
        ? { sizeReference: s.key, estimatedHours: s.hours, storyPoints: s.points }
        : { sizeReference: null, estimatedHours: null, storyPoints: 0 };
      const fp = functionPoints ? parseFloat(functionPoints) : null;
      const fullDesc = acceptanceCriteria
        ? `${description.trim()}${AC_SEPARATOR}${acceptanceCriteria.trim()}`
        : description.trim();
      await addUserStory({
        title: title.trim(), description: fullDesc, ...sizeData, priority,
        sprintId: sprintId === "" ? null : sprintId,
        epicId: epicId || null, customFields: customFieldValues,
        startDate: startDate || undefined, endDate: endDate || undefined,
        functionPoints: fp, assigneeId: assigneeId || null,
      } as any);
      toast.success("Registro criado com sucesso");
      resetForm(); setOpen(false);
    } catch { toast.error("Erro ao salvar. Tente novamente."); }
    finally { setSubmitting(false); }
  };

  const handleConfirmRemove = async () => {
    if (!deleteTarget) return;
    const huActivities = activities.filter((a) => a.huId === deleteTarget);
    if (huActivities.length > 0) {
      toast.error(`Não é possível excluir: esta HU possui ${huActivities.length} atividade(s) vinculada(s). Remova-as primeiro.`);
      setDeleteTarget(null); return;
    }
    try { await removeUserStory(deleteTarget); toast.success("Registro excluído com sucesso"); }
    catch { toast.error("Falha ao excluir item"); }
    setDeleteTarget(null);
  };

  if (loading) return <SkeletonList count={5} variant="row" />;

  const dialogForm = (
    <DialogContent className="max-w-[960px] w-[80vw] max-h-[90vh] overflow-y-auto p-0">
      <DialogHeader className="px-6 pt-6 pb-0">
        <DialogTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Nova User Story
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <div className="flex-1 px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="md:col-span-3 space-y-4">
              <div>
                <Label>Título <span className="text-destructive">*</span></Label>
                <Input value={title} onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: "" })); }}
                  placeholder="Como usuário, eu quero..." className="mt-1" />
                {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição detalhada da funcionalidade..." className="mt-1" rows={3} />
              </div>
              <div>
                <Label>Critérios de Aceite</Label>
                <Textarea value={acceptanceCriteria} onChange={(e) => setAcceptanceCriteria(e.target.value)}
                  placeholder="1. Dado que... quando... então..." className="mt-1" rows={3} />
              </div>
              {customFields.length > 0 && (
                <div className="space-y-3 border-t pt-3">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campos Personalizados</Label>
                  {customFields.map((field) => (
                    <div key={field.id}>
                      <Label className="text-sm">{field.name}{field.required && <span className="text-destructive"> *</span>}</Label>
                      {field.type === "text" && (
                        <Input value={String(customFieldValues[field.id] || "")}
                          onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                          placeholder={field.name} className="mt-1" />
                      )}
                      {field.type === "number" && (
                        <Input type="number" value={String(customFieldValues[field.id] || "")}
                          onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.id]: Number(e.target.value) }))}
                          placeholder={field.name} className="mt-1" />
                      )}
                      {field.type === "select" && field.options && (
                        <Select value={String(customFieldValues[field.id] || "")}
                          onValueChange={(v) => setCustomFieldValues((prev) => ({ ...prev, [field.id]: v }))}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder={`Selecione ${field.name}`} /></SelectTrigger>
                          <SelectContent>{field.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                      {errors[`cf_${field.id}`] && <p className="text-xs text-destructive mt-1">{errors[`cf_${field.id}`]}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Sprint</Label>
                  <Select value={sprintId || "backlog"} onValueChange={(v) => setSprintId(v === "backlog" ? "" : v)}>
                    <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="Backlog" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="backlog">Backlog Geral</SelectItem>
                      {sprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} {s.isActive ? "✦" : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Épico</Label>
                  <Select value={epicId || "none"} onValueChange={(v) => setEpicId(v === "none" ? "" : v)}>
                    <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="Sem épico" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem épico</SelectItem>
                      {epics.map((ep) => (
                        <SelectItem key={ep.id} value={ep.id}>
                          <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: ep.color }} />{ep.name}</div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={statusField || workflowColumns[0]?.key || ""} onValueChange={(v) => setStatusField(v)}>
                    <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      {workflowColumns.map((col) => (
                        <SelectItem key={col.key} value={col.key}>
                          <div className="flex items-center gap-2"><div className={`h-2 w-2 rounded-full ${col.dotColor}`} />{col.label}</div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Prioridade <span className="text-destructive">*</span></Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                    <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(PRIORITY_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Estimativa em horas</Label>
                  <Select value={selectedSize ?? "none"} onValueChange={(v) => setSelectedSize(v === "none" ? null : v)}>
                    <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="Não estimado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não estimado</SelectItem>
                      {SIZE_REFERENCES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label} — {s.hours}h ({s.pointsLabel})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Responsável</Label>
                  <Select value={assigneeId || "none"} onValueChange={(v) => setAssigneeId(v === "none" ? "" : v)}>
                    <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem responsável</SelectItem>
                      {developers.map((dev) => <SelectItem key={dev.id} value={dev.id}>{dev.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Data de Início</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 h-9 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Data de Entrega</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 h-9 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Ponto de Função</Label>
                  <Input type="number" step="0.01" min="0" value={functionPoints}
                    onChange={(e) => setFunctionPoints(e.target.value)} placeholder="Ex: 12,50" className="mt-1 h-9 text-xs" />
                </div>
                <div />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <Button type="button" variant="outline" onClick={() => { resetForm(); setOpen(false); }}>Cancelar</Button>
          <Button type="submit" className="gap-2" disabled={submitting}>
            {submitting
              ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
              : <Plus className="h-4 w-4" />}
            Salvar HU
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight leading-none">User Stories</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Backlog · {totalItems} itens</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          {canCreate && (
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 h-8 text-xs">
                <Plus className="h-3.5 w-3.5" /> Nova HU
              </Button>
            </DialogTrigger>
          )}
          {dialogForm}
        </Dialog>
      </div>

      {/* Barra de filtros */}
      <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchFilter}
            onChange={(e) => { setSearchFilter(e.target.value); setCurrentPage(1); }}
            placeholder="Buscar por título ou código..."
            className="pl-8 h-8 text-xs bg-background"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <ListFilter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Select value={sprintFilter} onValueChange={(v) => { setSprintFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="h-8 w-[145px] text-xs bg-background"><SelectValue placeholder="Sprint" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as sprints</SelectItem>
              <SelectItem value="backlog">📋 Backlog</SelectItem>
              {sprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} {s.isActive ? "✦" : ""}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="h-8 w-[120px] text-xs bg-background"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Prioridade</SelectItem>
              <SelectItem value="critica">Crítica</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="h-8 w-[145px] text-xs bg-background"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {workflowColumns.map((col) => <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {epics.length > 0 && (
            <Select value={epicFilter} onValueChange={(v) => { setEpicFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-8 w-[130px] text-xs bg-background"><SelectValue placeholder="Épico" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos épicos</SelectItem>
                {epics.map((ep) => <SelectItem key={ep.id} value={ep.id}>{ep.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground px-2"
              onClick={() => { clearFilters(); setCurrentPage(1); }}>
              <X className="h-3 w-3" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {totalItems === 0 && (
        <EmptyState
          icon={BookOpen}
          title="Nenhum item encontrado"
          description={hasFilters ? "Tente ajustar os filtros" : "Adicione as User Stories desta Sprint"}
        />
      )}

      {/* Lista de HUs */}
      <div className="space-y-2">
        {sprintStories.map((hu) => {
          const totalHours    = getTotalHoursForHU(activities, hu.id);
          const huActivities  = activities.filter((a) => a.huId === hu.id);
          const closedAct     = huActivities.filter((a) => a.isClosed);
          const pInfo         = PRIORITY_MAP[hu.priority];
          const statusCol     = workflowColumns.find((c) => c.key === hu.status);
          const blocked       = hasActiveImpediment(hu);
          const activeImps    = (hu.impediments || []).filter((i) => !i.resolvedAt).length;
          const epic          = hu.epicId ? epics.find((e) => e.id === hu.epicId) : null;
          const completionPct = huActivities.length > 0
            ? Math.round((closedAct.length / huActivities.length) * 100) : 0;
          const assignee      = hu.assigneeId ? developers.find((d) => d.id === hu.assigneeId) : null;

          return (
            <div
              key={hu.id}
              className={[
                "group relative rounded-xl border bg-card transition-all duration-150",
                "hover:shadow-md hover:border-primary/30",
                blocked ? "border-warning/60 ring-1 ring-warning/30" : "border-border",
              ].join(" ")}
            >
              <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${pInfo.dot}`} style={{ marginLeft: "1px" }} />

              <div className="p-4 pl-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                    <span className="font-mono text-[11px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                      {hu.code}
                    </span>
                    {epic && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0"
                        style={{ backgroundColor: epic.color + "22", color: epic.color }}>
                        <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ backgroundColor: epic.color }} />
                        {epic.name}
                      </span>
                    )}
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${pInfo.color} shrink-0`}>
                      {pInfo.label}
                    </span>
                    {statusCol && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground flex items-center gap-1 shrink-0">
                        <span className={`h-1.5 w-1.5 rounded-full ${statusCol.dotColor}`} />
                        {statusCol.label}
                      </span>
                    )}
                    <SizeBadge sizeReference={hu.sizeReference} storyPoints={hu.storyPoints} />
                    {blocked && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/30 flex items-center gap-1 shrink-0">
                        <ShieldAlert className="h-3 w-3" /> {activeImps} impedimento{activeImps > 1 ? "s" : ""}
                      </span>
                    )}
                    {huActivities.length > 0 && (
                      <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded border border-border bg-background shrink-0">
                        {closedAct.length}/{huActivities.length} tarefas
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title="Adicionar tarefa"
                        onClick={() => setQuickTaskHU(hu.id)}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar HU"
                        onClick={() => { setEditHuId(hu.id); setEditDrawerOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteTarget(hu.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <h3 className="font-semibold text-sm mt-2 leading-snug">{hu.title}</h3>

                {hu.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {hu.description}
                  </p>
                )}

                {hu.customFields && customFields.length > 0 && Object.keys(hu.customFields).length > 0 && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {customFields.map((cf) => {
                      const val = hu.customFields?.[cf.id];
                      if (val === undefined || val === "" || val === null) return null;
                      return (
                        <span key={cf.id} className="text-[10px] border border-border rounded px-1.5 py-0.5 bg-muted/50">
                          {cf.name}: {String(val)}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {totalHours}h
                  </span>
                  {huActivities.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-success rounded-full transition-all" style={{ width: `${completionPct}%` }} />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">{completionPct}%</span>
                    </div>
                  )}
                  {assignee && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 ml-auto">
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/15 text-primary text-[9px] font-bold">
                        {assignee.name.charAt(0).toUpperCase()}
                      </span>
                      {assignee.name}
                    </span>
                  )}
                </div>

                <FileUploader
                  entityType="user_story"
                  entityId={hu.id}
                  teamId={activeSprint ? currentTeamId || "" : ""}
                />
              </div>
            </div>
          );
        })}
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={handleConfirmRemove}
      />

      {quickTaskHU && (
        <QuickActivityDialog
          open={!!quickTaskHU}
          onClose={() => setQuickTaskHU(null)}
          huId={quickTaskHU}
        />
      )}

      <HUEditDrawer
        huId={editHuId}
        open={editDrawerOpen}
        onClose={() => { setEditDrawerOpen(false); setEditHuId(null); }}
      />
    </div>
  );
}
