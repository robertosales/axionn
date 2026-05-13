import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge }  from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, Bell, Zap, Shield, Clock, AlertCircle, ChevronRight } from "lucide-react";
import type { AppNotification, NotificationCategory, NotificationSeverity } from "../hooks/useNotifications";

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  sprint:     "Sprint",
  impedimento:"Impedimento",
  sla:        "SLA",
  backlog:    "Backlog",
  capacidade: "Capacidade",
};

const CATEGORY_ICON: Record<NotificationCategory, React.ReactNode> = {
  sprint:     <Zap       className="h-3.5 w-3.5" />,
  impedimento:<AlertCircle className="h-3.5 w-3.5" />,
  sla:        <Clock     className="h-3.5 w-3.5" />,
  backlog:    <Shield    className="h-3.5 w-3.5" />,
  capacidade: <Bell      className="h-3.5 w-3.5" />,
};

function SeverityIcon({ s }: { s: NotificationSeverity }) {
  if (s === "critical") return <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />;
  if (s === "warning")  return <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />;
  return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
}

function severityBg(s: NotificationSeverity) {
  if (s === "critical") return "border-l-destructive bg-destructive/5";
  if (s === "warning")  return "border-l-orange-400 bg-orange-50/60 dark:bg-orange-950/20";
  return "border-l-blue-400 bg-blue-50/60 dark:bg-blue-950/20";
}

interface Props {
  open:          boolean;
  onClose:       () => void;
  notifications: AppNotification[];
  criticalCount: number;
  warningCount:  number;
}

type FilterTab = "all" | NotificationCategory;

export function NotificationDrawer({ open, onClose, notifications, criticalCount, warningCount }: Props) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const tabs: { value: FilterTab; label: string }[] = [
    { value: "all",        label: "Todos" },
    { value: "sprint",     label: "Sprint" },
    { value: "impedimento",label: "Impedimento" },
    { value: "sla",        label: "SLA" },
    { value: "backlog",    label: "Backlog" },
  ];

  const filtered = filter === "all" ? notifications : notifications.filter(n => n.category === filter);

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notificações
            {criticalCount > 0 && <Badge variant="destructive" className="text-[10px]">{criticalCount} crítico{criticalCount !== 1 ? "s" : ""}</Badge>}
            {warningCount  > 0 && <Badge className="text-[10px] bg-orange-500 hover:bg-orange-600">{warningCount} aviso{warningCount !== 1 ? "s" : ""}</Badge>}
          </SheetTitle>
        </SheetHeader>

        {/* Filtros por categoria */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                filter === t.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {t.label}
              {t.value !== "all" && (
                <span className="ml-1 opacity-60">
                  {notifications.filter(n => n.category === t.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Bell className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhum alerta nesta categoria</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(n => (
              <div key={n.id} className={`rounded-lg border-l-4 p-3.5 space-y-1.5 ${severityBg(n.severity)}`}>
                <div className="flex items-start gap-2">
                  <SeverityIcon s={n.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-6">
                  <Badge variant="outline" className="text-[9px] gap-1">
                    {CATEGORY_ICON[n.category]}
                    {CATEGORY_LABELS[n.category]}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{n.teamName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
