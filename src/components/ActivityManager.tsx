import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useSprint } from "@/contexts/SprintContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ListTodo,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  RotateCcw,
  MessageCircle,
  Search,
  X,
  Copy,
  User,
  Bug,
  Info,
} from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTotalHoursForHU, ActivityType, ACTIVITY_TYPE_LABELS } from "@/types/sprint";
import { toast } from "sonner";
import { ActivityComments } from "@/components/ActivityComments";
import { FileUploader } from "@/components/FileUploader";
import { PaginationControls } from "@/shared/components/common/Pagination";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { SkeletonList } from "@/shared/components/common/SkeletonList";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { usePagination } from "@/shared/hooks/usePagination";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { canonicalizeDevelopers, developerIdMatches } from "@/lib/developerIdentity";

function durationToDecimal(value: string): number {
  const [h = "0", m = "0"] = value.split(":");
  const hours = parseInt(h, 10) || 0;
  const minutes = parseInt(m, 10) || 0;
  return hours + minutes / 60;
}

function decimalToDuration(decimal: number): string {
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function isValidDuration(value: string): boolean {
  return /^\d+:[0-5]\d$/.test(value);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export function ActivityManager() {
  const {
    activities,
    addActivity,
    removeActivity,
    updateActivity,
    closeActivity,
    reopenActivity,
    userStories,
    developers,
    activeSprint,
    sprints,
    loading,
  } = useSprint();
  const { currentTeamId, hasPermission } = useAuth();
  const location = useLocation();
  const canUpdate = hasPermission("update_tasks");

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("task");
  const [huId, setHuId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [duration, setDuration] = useState("4:00");
  const [startDate, setStartDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const isLimitado = ["task", "bug"].includes(activityType);
  const developerOptions = useMemo(() => canonicalizeDevelopers(developers), [developers]);

  // Ref para scroll até a atividade destacada
  const highlightRef = useRef<HTMLDivElement | null>(null);

  // Filters
  const [searchFilter, setSearchFilter] = useState("");
  const debouncedSearch = useDebounce(searchFilter);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sprintFilter, setSprintFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  const hasFilters =
    searchFilter !== "" ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    sprintFilter !== "all" ||
    assigneeFilter !== "all";

  const clearFilters = () => {
    setSearchFilter("");
    setTypeFilter("all");
    setStatusFilter("all");
    setSprintFilter("all");
    setAssigneeFilter("all");
  };

  const allTeamStories = userStories;

  const visibleStories = useMemo(() => {
    if (sprintFilter === "all") return allTeamStories;
    if (sprintFilter === "active") {
      return activeSprint
        ? allTeamStories.filter((hu) => hu.sprintId === activeSprint.id)
        : [];
    }
    return allTeamStories.filter((hu) => hu.sprintId === sprintFilter);
  }, [allTeamStories, activeSprint, sprintFilter]);

  const filteredActivities = useMemo(() => {
    let acts = activities;

    if (sprintFilter !== "all") {
      const visibleHuIds = new Set(visibleStories.map((hu) => hu.id));
      acts = acts.filter((a) => visibleHuIds.has(a.huId));
    }
    if (assigneeFilter !== "all") {
      const selected = developerOptions.find((developer) => developer.id === assigneeFilter);
      acts = selected ? acts.filter((a) => developerIdMatches(selected, a.assigneeId)) : [];
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      acts = acts.filter((a) => a.title.toLowerCase().includes(q));
    }
    if (typeFilter !== "all") acts = acts.filter((a) => a.activityType === typeFilter);
    if (statusFilter === "open")   acts = acts.filter((a) => !a.isClosed);
    if (statusFilter === "closed") acts = acts.filter((a) =>  a.isClosed);

    return [...acts].sort((a, b) => {
      if (a.isClosed !== b.isClosed) return a.isClosed ? 1 : -1;
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });
  }, [activities, visibleStories, sprintFilter, assigneeFilter, debouncedSearch, typeFilter, statusFilter, developerOptions]);

  const {
    paginatedItems: pageActivities,
    currentPage,
    setCurrentPage,
    totalItems,
    pageSize,
  } = usePagination(filteredActivities, { pageSize: 10 });

  /**
   * Deep-link via navigation state.
   * Quando o usuário chega vindo de uma notificação de menção, o NotificationBell
   * passa { highlightActivityId } no state do React Router.
   * Aqui lemos esse valor, limpamos filtros para garantir que a atividade apareça,
   * expandimos os comentários e fazemos scroll até o card.
   */
  useEffect(() => {
    const highlightId = (location.state as any)?.highlightActivityId as string | undefined;
    if (!highlightId || loading || activities.length === 0) return;

    // Limpa filtros para a atividade aparecer independentemente
    clearFilters();
    setCurrentPage(1);

    // Expande a seção de comentários da atividade alvo
    setExpandedComments(highlightId);

    // Aguarda a próxima pintura para garantir que o card esteja no DOM
    const timer = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, loading, activities.length]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Título é obrigatório";
    if (!huId) e.huId = "Selecione uma User Story";
    if (!assigneeId) e.assigneeId = "Selecione um responsável";
    if (!startDate) e.startDate = "Data de início é obrigatória";
    if (!isValidDuration(duration)) {
      e.hours = "Formato inválido. Use H:MM (ex: 0:30, 1:15)";
    } else {
      const dec = durationToDecimal(duration);
      if (dec <= 0) e.hours = "Duração deve ser maior que zero";
      else if (isLimitado && dec > 8) e.hours = "Máximo de 8:00 por tarefa (task/bug)";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setActivityType("task");
    setHuId(""); setAssigneeId(""); setDuration("4:00");
    setStartDate(""); setErrors({}); setEditId(null); setIsCloning(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) { toast.error("Preencha os campos obrigatórios"); return; }
    setSubmitting(true);
    try {
      const numHours = durationToDecimal(duration);
      if (editId && !isCloning) {
        await updateActivity(editId, { title: title.trim(), description: description.trim(), activityType, huId, assigneeId, hours: numHours, startDate });
        toast.success("Alterações salvas com sucesso");
      } else {
        await addActivity({ title: title.trim(), description: description.trim(), activityType, huId, assigneeId, hours: numHours, startDate });
        toast.success(isCloning ? "Tarefa clonada com sucesso!" : "Registro criado com sucesso");
      }
      resetForm(); setOpen(false);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (actId: string) => {
    const act = activities.find((a) => a.id === actId);
    if (!act) return;
    setEditId(act.id); setIsCloning(false); setTitle(act.title); setDescription(act.description);
    setActivityType(act.activityType); setHuId(act.huId); setAssigneeId(act.assigneeId);
    setDuration(decimalToDuration(act.hours)); setStartDate(act.startDate); setErrors({});
    setOpen(true);
  };

  const handleClone = (actId: string) => {
    const act = activities.find((a) => a.id === actId);
    if (!act) return;
    setEditId(act.id); setIsCloning(true); setTitle(`[CÓPIA] ${act.title}`);
    setDescription(act.description); setActivityType(act.activityType);
    setHuId(act.huId); setAssigneeId(act.assigneeId);
    setDuration(decimalToDuration(act.hours)); setStartDate(act.startDate); setErrors({});
    setOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!deleteTarget) return;
    try { await removeActivity(deleteTarget); toast.success("Registro excluído com sucesso"); }
    catch { toast.error("Falha ao excluir item"); }
    setDeleteTarget(null);
  };

  if (loading) return <SkeletonList count={5} variant="row" />;

  const noHUs  = allTeamStories.length === 0;
  const noDevs = developers.length === 0;
  const canCreate = !noHUs && !noDevs;

  // ID da atividade que deve ser destacada (vinda da notificação)
  const highlightActivityId = (location.state as any)?.highlightActivityId as string | undefined;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <ListTodo className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold tracking-tight">Tarefas</h2>
          <Badge variant="secondary">{totalItems}</Badge>
        </div>

        {canUpdate && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" disabled={!canCreate}>
                <Plus className="h-4 w-4" /> Nova Tarefa
              </Button>
            </DialogTrigger>
            <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[760px] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:h-[calc(100dvh-3rem)] sm:p-0">
              <DialogHeader className="border-b bg-muted/30 px-5 py-4 sm:px-6">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {activityType === "bug" ? <Bug className="h-5 w-5" /> : <ListTodo className="h-5 w-5" />}
                  </div>
                  <div>
                    <DialogTitle>{isCloning ? "Clonar tarefa" : editId ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
                    <DialogDescription className="mt-1">
                      {isCloning ? "Revise os dados da cópia antes de criar a nova tarefa." : editId ? "Atualize as informações e salve suas alterações." : "Registre o trabalho, o responsável e o período planejado."}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
                <div>
                  <Label htmlFor="activity-title">Título <span className="text-destructive">*</span></Label>
                  <Input id="activity-title" autoFocus value={title} onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: "" })); }} placeholder="Ex.: Revisar fluxo de autenticação" className="mt-1.5 h-11" aria-invalid={!!errors.title} aria-describedby={errors.title ? "activity-title-error" : undefined} />
                  {errors.title && <p id="activity-title-error" role="alert" className="mt-1.5 text-xs font-medium text-destructive">{errors.title}</p>}
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="activity-description">Descrição</Label>
                    <span className="text-xs text-muted-foreground">Opcional</span>
                  </div>
                  <Textarea id="activity-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Inclua contexto, critérios ou observações relevantes..." className="mt-1.5 min-h-24 resize-y" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                  <Label>Tipo <span className="text-destructive">*</span></Label>
                  <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
                    <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  </div>
                  <div>
                  <Label>User Story <span className="text-destructive">*</span></Label>
                  <Select value={huId} onValueChange={(v) => { setHuId(v); setErrors((p) => ({ ...p, huId: "" })); }}>
                    <SelectTrigger className="mt-1.5 h-11" aria-invalid={!!errors.huId}><SelectValue placeholder="Selecione a HU" /></SelectTrigger>
                    <SelectContent>
                      {allTeamStories.map((hu) => {
                        const used = getTotalHoursForHU(activities, hu.id);
                        return (
                          <SelectItem key={hu.id} value={hu.id}>
                            {hu.code} — {hu.title} ({decimalToDuration(used)}/24:00)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {errors.huId && <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">{errors.huId}</p>}
                  </div>
                </div>
                <div className="border-t pt-5">
                  <Label>Responsável <span className="text-destructive">*</span></Label>
                  <Select value={assigneeId} onValueChange={(v) => { setAssigneeId(v); setErrors((p) => ({ ...p, assigneeId: "" })); }}>
                    <SelectTrigger className="mt-1.5 h-11" aria-invalid={!!errors.assigneeId}><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                    <SelectContent>
                      {developerOptions.map((dev) => (
                        <SelectItem key={dev.id} value={dev.id}>{dev.name} — {dev.role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.assigneeId && <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">{errors.assigneeId}</p>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="activity-duration">Duração estimada <span className="text-destructive">*</span></Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="activity-duration" inputMode="numeric" placeholder="H:MM" value={duration}
                        onChange={(e) => { setDuration(e.target.value); setErrors((p) => ({ ...p, hours: "" })); }}
                        onBlur={() => { if (/^\d+$/.test(duration)) setDuration(`${duration}:00`); }}
                        className="h-11 pr-14 font-medium tabular-nums" aria-invalid={!!errors.hours}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">h:min</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      Ex.: 0:30 ou 1:30{isLimitado && " · máximo de 8:00"}
                    </p>
                    {errors.hours && <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">{errors.hours}</p>}
                  </div>
                  <div>
                    <Label htmlFor="activity-start-date">Data de início <span className="text-destructive">*</span></Label>
                    <Input id="activity-start-date" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setErrors((p) => ({ ...p, startDate: "" })); }} className="mt-1.5 h-11" aria-invalid={!!errors.startDate} />
                    {errors.startDate && <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">{errors.startDate}</p>}
                  </div>
                </div>
                {activityType === "bug" && editId && !isCloning && currentTeamId && (
                  <div className="border-t pt-3 space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold text-destructive"><Bug className="h-4 w-4" /> Prints / Evidências do bug</Label>
                    <FileUploader entityType="activity" entityId={editId} teamId={currentTeamId} />
                  </div>
                )}
                {activityType === "bug" && (!editId || isCloning) && (
                  <div className="flex gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Após salvar, edite a tarefa para anexar evidências. A HU será movida para a coluna <b>Bug</b>.</span>
                  </div>
                )}
                </div>
                <DialogFooter className="shrink-0 bg-background px-5 py-4 sm:px-6">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={submitting}>Cancelar</Button>
                  </DialogClose>
                  <Button type="submit" className="min-w-36 gap-2" disabled={submitting}>
                    {submitting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" /> : isCloning ? <Copy className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {submitting ? "Salvando..." : isCloning ? "Salvar como nova" : editId ? "Salvar alterações" : "Criar tarefa"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchFilter}
            onChange={(e) => { setSearchFilter(e.target.value); setCurrentPage(1); }}
            placeholder="Buscar tarefa..."
            className="pl-8 h-8 text-xs"
          />
        </div>

        <Select value={assigneeFilter} onValueChange={(v) => { setAssigneeFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <User className="h-3 w-3 mr-1 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos responsáveis</SelectItem>
            {developerOptions.map((dev) => (
              <SelectItem key={dev.id} value={dev.id}>{dev.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sprintFilter} onValueChange={(v) => { setSprintFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="h-8 w-[145px] text-xs">
            <SelectValue placeholder="Sprint" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as sprints</SelectItem>
            {activeSprint && <SelectItem value="active">🟢 Sprint ativa</SelectItem>}
            {sprints.filter((s) => !s.isActive).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="h-8 w-[115px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="open">Abertas</SelectItem>
            <SelectItem value="closed">Concluídas</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground"
            onClick={() => { clearFilters(); setCurrentPage(1); }}>
            <X className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      {/* Empty States */}
      {noDevs && (
        <EmptyState icon={ListTodo} title="Cadastre membros do time primeiro"
          description="Adicione desenvolvedores na aba Equipe para criar tarefas." />
      )}
      {!noDevs && noHUs && (
        <EmptyState icon={ListTodo} title="Nenhuma User Story cadastrada"
          description="Crie User Stories no Backlog para poder registrar tarefas." />
      )}
      {canCreate && totalItems === 0 && (
        <EmptyState icon={ListTodo} title="Nenhuma tarefa encontrada"
          description={hasFilters ? "Tente ajustar os filtros ou limpe para ver todas as tarefas." : "Clique em \"Nova Tarefa\" para registrar a primeira tarefa do time."} />
      )}

      {/* Lista */}
      <div className="space-y-2">
        {pageActivities.map((act) => {
          const hu = userStories.find((h) => h.id === act.huId);
          const dev = developers.find((d) => d.id === act.assigneeId);
          const typeInfo = ACTIVITY_TYPE_LABELS[act.activityType || "task"];
          const isClosed = !!act.isClosed;
          const isExpanded = expandedComments === act.id;
          const isHighlighted = act.id === highlightActivityId;

          return (
            <Card
              key={act.id}
              ref={isHighlighted ? (el) => { (highlightRef as any).current = el; } : undefined}
              className={`group hover:shadow-md transition-all ${
                isClosed ? "opacity-60" : ""
              } ${
                isHighlighted
                  ? "ring-2 ring-primary shadow-md"
                  : ""
              }`}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs font-bold">{hu?.code}</Badge>
                      <Badge className={`text-[10px] border ${typeInfo.color}`}>{typeInfo.label}</Badge>
                      {isClosed && <Badge className="bg-success/15 text-success border-success/30 text-[10px]">✓ Concluída</Badge>}
                      {isHighlighted && (
                        <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] animate-pulse">
                          💬 Você foi mencionado
                        </Badge>
                      )}
                    </div>
                    <span className={`text-sm font-semibold ${isClosed ? "line-through" : ""}`}>{act.title}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{dev?.name || "N/A"}</span>
                      <span>{decimalToDuration(act.hours)}</span>
                      <span>{formatDate(act.startDate)} → {formatDate(act.endDate)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Comentários"
                      onClick={() => setExpandedComments(isExpanded ? null : act.id)}>
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                    {canUpdate && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500" title="Clonar tarefa"
                        onClick={() => handleClone(act.id)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!isClosed ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-success" title="Concluir tarefa"
                        onClick={() => { closeActivity(act.id); toast.success("Tarefa concluída!"); }}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Reabrir tarefa"
                        onClick={() => { reopenActivity(act.id); toast.info("Tarefa reaberta"); }}>
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(act.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => setDeleteTarget(act.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {isExpanded && currentTeamId && (
                  <div className="mt-3 space-y-3 border-top pt-3">
                    <FileUploader entityType="activity" entityId={act.id} teamId={currentTeamId} />
                    <ActivityComments activityId={act.id} teamId={currentTeamId} />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <PaginationControls currentPage={currentPage} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} />
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} onConfirm={handleConfirmRemove} />
    </div>
  );
}
