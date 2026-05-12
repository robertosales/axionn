import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, CheckCircle2, Circle, AlertTriangle, BookOpen } from "lucide-react";
import { UserStory } from "@/types/sprint";
import { useSprint } from "@/contexts/SprintContext";
import { formatPersonName, getInitials } from "@/lib/personName";
import { getTotalHoursForHU } from "@/types/sprint";

const PRIORITY_COLORS: Record<string, string> = {
  baixa:   "bg-muted text-muted-foreground",
  media:   "bg-info/15 text-info border border-info/30",
  alta:    "bg-warning/15 text-warning border border-warning/30",
  critica: "bg-destructive/15 text-destructive border border-destructive/30",
};
const PRIORITY_LABELS: Record<string, string> = {
  baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica",
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

interface Props {
  hu: UserStory | null;
  open: boolean;
  onClose: () => void;
  onEdit: (huId: string) => void;
}

export function HUPreviewSheet({ hu, open, onClose, onEdit }: Props) {
  const { activities, developers, workflowColumns, epics } = useSprint() as any;

  if (!hu) return null;

  const huActivities  = (activities ?? []).filter((a: any) => a.huId === hu.id);
  const closed        = huActivities.filter((a: any) => a.isClosed);
  const open_acts     = huActivities.filter((a: any) => !a.isClosed);
  const totalHours    = getTotalHoursForHU(activities, hu.id);
  const estimated     = hu.estimatedHours ?? null;

  const assignee   = hu.assigneeId ? developers.find((d: any) => d.id === hu.assigneeId) : null;
  const epic       = hu.epicId    ? epics.find((e: any) => e.id === hu.epicId)           : null;
  const statusCol  = workflowColumns.find((c: any) => c.key === hu.status);
  const initials   = assignee?.name ? getInitials(assignee.name) : "?";
  const avatarBg   = assignee?.name ? getAvatarColor(assignee.name) : "#6b7280";
  const shortName  = assignee?.name ? formatPersonName(assignee.name) : null;

  // Cor do badge horas
  let hoursColor = "text-muted-foreground";
  let hoursBg    = "bg-muted/40 border-border";
  if (estimated && estimated > 0) {
    const pct = totalHours / estimated;
    if (pct > 1.2)      { hoursColor = "text-destructive"; hoursBg = "bg-destructive/10 border-destructive/30"; }
    else if (pct > 1.0) { hoursColor = "text-warning";     hoursBg = "bg-warning/10 border-warning/30"; }
    else                { hoursColor = "text-success";     hoursBg = "bg-success/10 border-success/30"; }
  }

  const hoursLabel = estimated
    ? `${totalHours}h lançadas / ${estimated}h estimadas`
    : `${totalHours}h lançadas`;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[380px] sm:w-[420px] flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="h-4 w-4 text-primary shrink-0" />
              <SheetTitle className="text-sm font-mono text-muted-foreground">{hu.code}</SheetTitle>
            </div>
            {hu.priority && (
              <Badge className={`${PRIORITY_COLORS[hu.priority]} text-[10px] shrink-0`}>
                {PRIORITY_LABELS[hu.priority]}
              </Badge>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground mt-1 leading-snug">{hu.title}</p>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Meta */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {statusCol && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Status</span>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${statusCol.dotColor}`} />
                  <span className="font-medium">{statusCol.label}</span>
                </div>
              </div>
            )}
            {epic && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Épico</span>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: epic.color }} />
                  <span className="font-medium truncate">{epic.name}</span>
                </div>
              </div>
            )}
            {assignee && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Responsável</span>
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-4 w-4">
                    {assignee.avatarUrl || assignee.avatar
                      ? <AvatarImage src={assignee.avatarUrl ?? assignee.avatar} />
                      : null}
                    <AvatarFallback className="text-[7px] font-bold text-white" style={{ backgroundColor: avatarBg }}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{shortName ?? assignee.name}</span>
                </div>
              </div>
            )}
            {hu.estimatedHours != null && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground uppercase tracking-wider text-[10px]">H. Estimadas</span>
                <span className="font-medium">{hu.estimatedHours}h</span>
              </div>
            )}
          </div>

          {/* Badge horas realizadas vs estimadas */}
          <div className={`flex items-center gap-2 rounded-md border px-3 py-2 ${hoursBg}`}>
            <Clock className={`h-3.5 w-3.5 shrink-0 ${hoursColor}`} />
            <span className={`text-xs font-medium ${hoursColor}`}>{hoursLabel}</span>
          </div>

          {/* Atividades */}
          {huActivities.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Atividades ({huActivities.length})
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {closed.length} concluídas · {open_acts.length} em aberto
                </span>
              </div>
              <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                {huActivities.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-1.5 text-xs">
                    {a.isClosed
                      ? <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                      : <Circle className="h-3 w-3 text-muted-foreground shrink-0" />}
                    <span className={`flex-1 truncate ${a.isClosed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {a.title}
                    </span>
                    {a.hours != null && (
                      <span className="text-muted-foreground shrink-0">{a.hours}h</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Descrição resumida */}
          {hu.description && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Descrição</span>
              <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed">{hu.description}</p>
            </div>
          )}

          {/* Impedimentos ativos */}
          {(hu as any).impediments?.some((i: any) => !i.resolvedAt) && (
            <div className="flex items-center gap-2 rounded-md bg-warning/10 border border-warning/30 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
              <span className="text-xs text-warning font-medium">
                {(hu as any).impediments.filter((i: any) => !i.resolvedAt).length} impedimento(s) ativo(s)
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 flex items-center gap-2">
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => { onClose(); onEdit(hu.id); }}
          >
            Editar HU
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
