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
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
      else if (isLimitado && dec > 8) e.hours = "Máximo de 8:00 por atividade (task/bug)";
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
        toast.success(isCloning ? "Atividade clonada com sucesso!" : "Registro criado com sucesso");
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
          <h2 className="text-lg font-bold tracking-tight">Atividades</h2>
          <Badge variant="secondary">{totalItems}</Badge>
        </div>

        {canUpdate && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" disabled={!canCreate}>
                <Plus className="h-4 w-4" /> Nova Atividade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ListTodo className="h-5 w-5 text-primary" />
                  {isCloning ? "Clonar Atividade" : editId ? "Editar Atividade" : "Nova Atividade"}
                </DialogTitle>
              </DialogHeader>
              {isCloning && (
                <p className="text-xs text-muted-foreground -mt-2 mb-1">
                  📋 Ajuste os dados abaixo e salve para criar uma nova atividade baseada na original.
                </p>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Título <span className="text-destructive">*</span></Label>
                  <Input value={title} onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: "" })); }} placeholder="Descrição da atividade" className="mt-1" />
                  {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes técnicos, observações..." className="mt-1" />
                </div>
                <div>
                  <Label>Tipo <span className="text-destructive">*</span></Label>
                  <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
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
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a HU" /></SelectTrigger>
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
                  {errors.huId && <p className="text-xs text-destructive mt-1">{errors.huId}</p>}
                </div>
                <div>
                  <Label>Responsável <span className="text-destructive">*</span></Label>
                  <Select value={assigneeId} onValueChange={(v) => { setAssigneeId(v); setErrors((p) => ({ ...p, assigneeId: "" })); }}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                    <SelectContent>
                      {developerOptions.map((dev) => (
                        <SelectItem key={dev.id} value={dev.id}>{dev.name} — {dev.role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.assigneeId && <p className="text-xs text-destructive mt-1">{errors.assigneeId}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Duração estimada <span className="text-destructive">*</span></Label>
                    <div className="relative mt-1">
                      <Input
                        placeholder="H:MM" value={duration}
                        onChange={(e) => { setDuration(e.target.value); setErrors((p) => ({ ...p, hours: "" })); }}
                        onBlur={() => { if (/^\d+$/.test(duration)) setDuration(`${duration}:00`); }}
                        className="pr-14"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">h:min</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Ex: <b>0:15</b> (15min), <b>0:30</b> (30min), <b>1:30</b> (1h30){isLimitado && " · máx 8:00"}
                    </p>
                    {errors.hours && <p className="text-xs text-destructive mt-1">{errors.hours}</p>}
                  </div>
                  <div>
                    <Label>Data início <span className="text-destructive">*</span></Label>
                    <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setErrors((p) => ({ ...p, startDate: "" })); }} className="mt-1" />
                    {errors.startDate && <p className="text-xs text-destructive mt-1">{errors.startDate}</p>}
                  </div>
                </div>
                {activityType === "bug" && editId && !isCloning && currentTeamId && (
                  <div className="border-t pt-3 space-y-2">
                    <Label className="text-xs font-semibold text-destructive flex items-center gap-1.5">🐛 Prints / Evidências do Bug</Label>
                    <FileUploader entityType="activity" entityId={editId} teamId={currentTeamId} />
                  </div>
                )}
                {activityType === "bug" && (!editId || isCloning) && (
                  <div className="text-xs bg-destructive/10 border border-destructive/30 text-destructive rounded p-2">
                    🐛 Após salvar, edite a atividade para anexar prints. A HU será movida para a coluna <b>Bug</b>.
                  </div>
                )}
                <Button type="submit" className="w-full gap-2" disabled={submitting}>
                  {submitting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" /> : isCloning ? <Copy className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {isCloning ? "Salvar como Nova Atividade" : editId ? "Salvar Alterações" : "Criar Atividade"}
                </Button>
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
            placeholder="Buscar atividade..."
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
          description="Adicione desenvolvedores na aba Equipe para criar atividades." />
      )}
      {!noDevs && noHUs && (
        <EmptyState icon={ListTodo} title="Nenhuma User Story cadastrada"
          description="Crie User Stories no Backlog para poder registrar atividades." />
      )}
      {canCreate && totalItems === 0 && (
        <EmptyState icon={ListTodo} title="Nenhuma atividade encontrada"
          description={hasFilters ? "Tente ajustar os filtros ou limpe para ver todas as atividades." : "Clique em \"Nova Atividade\" para registrar a primeira atividade do time."} />
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
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500" title="Clonar atividade"
                        onClick={() => handleClone(act.id)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!isClosed ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-success" title="Concluir atividade"
                        onClick={() => { closeActivity(act.id); toast.success("Atividade concluída!"); }}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Reabrir atividade"
                        onClick={() => { reopenActivity(act.id); toast.info("Atividade reaberta"); }}>
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
