import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Clock, CheckCircle2, Circle, AlertTriangle, BookOpen,
  User, Tag, Calendar, Layers, ListChecks, Pencil,
} from "lucide-react";
import { UserStory } from "@/types/sprint";
import { useSprint } from "@/contexts/SprintContext";
import { formatPersonName, getInitials } from "@/lib/personName";
import { getTotalHoursForHU } from "@/types/sprint";

const PRIORITY_COLORS: Record<string, string> = {
  baixa:   "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
  media:   "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300",
  alta:    "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300",
  critica: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300",
};
const PRIORITY_LABELS: Record<string, string> = {
  baixa: "Baixa", media: "M\u00e9dia", alta: "Alta", critica: "Cr\u00edtica",
};
const AVATAR_COLORS = [
  "#16a34a","#0891b2","#7c3aed","#db2777","#ea580c",
  "#0284c7","#9333ea","#dc2626","#ca8a04","#0d9488",
];
function getAvatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

interface MetaItemProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}
function MetaItem({ icon, label, value }: MetaItemProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </span>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

interface Props {
  hu: UserStory | null;
  open: boolean;
  onClose: () => void;
  onEdit: (huId: string) => void;
}

export function HUPreviewSheet({ hu, open, onClose, onEdit }: Props) {
  const { activities, developers, workflowColumns, epics, sprints } = useSprint() as any;

  if (!hu) return null;

  const huActivities = (activities ?? []).filter((a: any) => a.huId === hu.id);
  const closed       = huActivities.filter((a: any) => a.isClosed);
  const openActs     = huActivities.filter((a: any) => !a.isClosed);
  const totalHours   = getTotalHoursForHU(activities, hu.id);
  const estimated    = hu.estimatedHours ?? null;

  const assignee  = hu.assigneeId ? developers.find((d: any) => d.id === hu.assigneeId) : null;
  const epic      = hu.epicId     ? epics.find((e: any) => e.id === hu.epicId)           : null;
  const statusCol = workflowColumns.find((c: any) => c.key === hu.status);
  const sprint    = hu.sprintId   ? sprints?.find((s: any) => s.id === hu.sprintId)      : null;
  const initials  = assignee?.name ? getInitials(assignee.name) : "?";
  const avatarBg  = assignee?.name ? getAvatarColor(assignee.name) : "#6b7280";
  const shortName = assignee?.name ? formatPersonName(assignee.name) : null;

  let hoursTextClass = "text-muted-foreground";
  let hoursBgClass   = "bg-muted/50 border-border";
  if (estimated && estimated > 0) {
    const pct = totalHours / estimated;
    if (pct > 1.2)      { hoursTextClass = "text-red-600 dark:text-red-400";    hoursBgClass = "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"; }
    else if (pct > 1.0) { hoursTextClass = "text-amber-600 dark:text-amber-400"; hoursBgClass = "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"; }
    else if (pct > 0)   { hoursTextClass = "text-green-600 dark:text-green-400"; hoursBgClass = "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"; }
  }

  const hoursLabel = estimated
    ? `${totalHours}h lan\u00e7adas de ${estimated}h estimadas`
    : `${totalHours}h lan\u00e7adas`;

  const completionPct = huActivities.length > 0
    ? Math.round((closed.length / huActivities.length) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl w-[90vw] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">

        <DialogHeader className="px-6 pt-5 pb-4 border-b bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {hu.code}
                </span>
                {hu.priority && (
                  <Badge variant="outline" className={`text-[11px] px-2 py-0.5 ${PRIORITY_COLORS[hu.priority] ?? ""}`}>
                    {PRIORITY_LABELS[hu.priority]}
                  </Badge>
                )}
                {statusCol && (
                  <Badge variant="secondary" className="text-[11px] gap-1.5 px-2 py-0.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${statusCol.dotColor}`} />
                    {statusCol.label}
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-base font-semibold text-foreground mt-1.5 leading-snug">
                {hu.title}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border">

            {/* Coluna esquerda */}
            <div className="md:col-span-2 px-6 py-5 space-y-5 bg-muted/10">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informa\u00e7\u00f5es</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                {statusCol && (
                  <MetaItem icon={<Tag className="h-3 w-3" />} label="Status"
                    value={<span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${statusCol.dotColor}`} />{statusCol.label}</span>}
                  />
                )}
                {assignee && (
                  <MetaItem icon={<User className="h-3 w-3" />} label="Respons\u00e1vel"
                    value={
                      <span className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          {assignee.avatarUrl || assignee.avatar ? <AvatarImage src={assignee.avatarUrl ?? assignee.avatar} /> : null}
                          <AvatarFallback className="text-[8px] font-bold text-white" style={{ backgroundColor: avatarBg }}>{initials}</AvatarFallback>
                        </Avatar>
                        <span>{shortName ?? assignee.name}</span>
                      </span>
                    }
                  />
                )}
                {epic && (
                  <MetaItem icon={<Layers className="h-3 w-3" />} label="\u00c9pico"
                    value={<span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: epic.color }} /><span className="truncate">{epic.name}</span></span>}
                  />
                )}
                {sprint && (
                  <MetaItem icon={<Calendar className="h-3 w-3" />} label="Sprint"
                    value={<span>{sprint.name}{sprint.isActive ? " \u2726" : ""}</span>}
                  />
                )}
                {hu.startDate && <MetaItem icon={<Calendar className="h-3 w-3" />} label="In\u00edcio" value={hu.startDate} />}
                {hu.endDate   && <MetaItem icon={<Calendar className="h-3 w-3" />} label="Entrega" value={hu.endDate} />}
                {hu.storyPoints != null && hu.storyPoints > 0 && (
                  <MetaItem icon={<Tag className="h-3 w-3" />} label="Story Points" value={`${hu.storyPoints} pts`} />
                )}
              </div>

              <Separator />

              <div className={`rounded-lg border px-4 py-3 space-y-2 ${hoursBgClass}`}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <Clock className={`h-3.5 w-3.5 ${hoursTextClass}`} />
                    <span className={hoursTextClass}>Horas</span>
                  </span>
                  {estimated && estimated > 0 && (
                    <span className={`text-xs font-bold ${hoursTextClass}`}>
                      {Math.round((totalHours / estimated) * 100)}%
                    </span>
                  )}
                </div>
                <p className={`text-sm font-medium ${hoursTextClass}`}>{hoursLabel}</p>
                {estimated && estimated > 0 && (
                  <div className="h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        totalHours > estimated * 1.2 ? "bg-red-500" :
                        totalHours > estimated       ? "bg-amber-500" : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min((totalHours / estimated) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>

              {(hu as any).impediments?.some((i: any) => !i.resolvedAt) && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      {(hu as any).impediments.filter((i: any) => !i.resolvedAt).length} impedimento(s) ativo(s)
                    </p>
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">Verifique antes de prosseguir</p>
                  </div>
                </div>
              )}
            </div>

            {/* Coluna direita */}
            <div className="md:col-span-3 px-6 py-5 space-y-5">
              {huActivities.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <ListChecks className="h-3.5 w-3.5" />Atividades ({huActivities.length})
                    </h3>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" />{closed.length} conclu\u00eddas</span>
                      <span className="flex items-center gap-1"><Circle className="h-3 w-3 text-muted-foreground" />{openActs.length} em aberto</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground w-10 text-right">{completionPct}%</span>
                  </div>
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                    {huActivities.map((a: any) => (
                      <div key={a.id} className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs border ${
                        a.isClosed ? "bg-muted/30 border-border text-muted-foreground" : "bg-card border-border text-foreground"
                      }`}>
                        {a.isClosed
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          : <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <span className={`flex-1 truncate ${a.isClosed ? "line-through" : ""}`}>{a.title}</span>
                        {a.hours != null && <span className="shrink-0 font-medium">{a.hours}h</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <ListChecks className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">Nenhuma atividade lan\u00e7ada</p>
                </div>
              )}

              {hu.description && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descri\u00e7\u00e3o</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{hu.description}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border-t px-6 py-3 flex items-center justify-end gap-2 bg-muted/20">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
          <Button size="sm" className="gap-1.5" onClick={() => { onClose(); onEdit(hu.id); }}>
            <Pencil className="h-3.5 w-3.5" />Editar HU
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
